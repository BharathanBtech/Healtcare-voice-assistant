const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const db = require('./services/DatabaseService');
const { EncryptionService } = require('./services/EncryptionService');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware - Relaxed CSP for test routes
app.use('/test', helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "http://localhost:3001", "ws://localhost:3000", "http://localhost:8080", "ws://localhost:8080"]
    }
  }
}));

// More restrictive security for API routes
app.use('/api', helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "http://localhost:3001", "ws://localhost:3000", "http://localhost:8080", "ws://localhost:8080"]
    }
  }
}));

// CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:8080', 'http://127.0.0.1:8080'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// More restrictive rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs for auth
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// JWT Secret (should be in environment variable in production)
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production-12345';

// Encryption service instance
const encryptionService = new EncryptionService();

// Authentication middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  // Check if token looks like a valid JWT (should have 3 parts separated by dots)
  if (typeof token !== 'string' || token.split('.').length !== 3) {
    return res.status(401).json({ error: 'Invalid token format' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const session = await db.getUserSession(decoded.sessionToken);
    
    if (!session || !session.is_active) {
      return res.status(403).json({ error: 'Invalid or expired session' });
    }

    req.user = {
      id: session.user_id,
      username: session.username,
      email: session.email,
      role: session.role
    };
    req.sessionToken = decoded.sessionToken;
    next();
  } catch (error) {
    console.error('❌ Token verification error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token format' });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    } else {
      return res.status(403).json({ error: 'Token verification failed' });
    }
  }
};

// Helper function to get client IP
const getClientIP = (req) => {
  return req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 
         (req.connection.socket ? req.connection.socket.remoteAddress : null);
};

// ==================== AUTH ROUTES ====================

// Login endpoint
app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Get user from database
    const user = await db.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await db.updateUserLastLogin(user.id);

    // Create session token
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    const ipAddress = getClientIP(req);
    const userAgent = req.get('User-Agent');

    // Save session to database
    await db.createUserSession(user.id, sessionToken, expiresAt, ipAddress, userAgent);

    // Create JWT token
    const jwtToken = jwt.sign({ sessionToken }, JWT_SECRET, { expiresIn: '24h' });

    // Log audit event
    await db.logAuditEvent(user.id, 'LOGIN', 'user', user.id, null, null, ipAddress, userAgent);

    res.json({
      success: true,
      token: jwtToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        organizationId: user.organization_id
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout endpoint
app.post('/api/auth/logout', authenticateToken, async (req, res) => {
  try {
    await db.invalidateUserSession(req.sessionToken);
    
    // Log audit event
    await db.logAuditEvent(req.user.id, 'LOGOUT', 'user', req.user.id, null, null, 
                          getClientIP(req), req.get('User-Agent'));
    
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user info
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await db.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        organizationId: user.organization_id,
        createdAt: user.created_at
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== PROVIDER CONFIG ROUTES ====================

// Get all provider configurations
app.get('/api/providers', authenticateToken, async (req, res) => {
  try {
    const configs = await db.getProviderConfigs(req.user.id);
    
    // Decrypt credentials and organize by provider type
    const providerConfig = {
      stt: { type: 'openai', credentials: {}, config: {} },
      llm: { type: 'openai', credentials: {}, config: {} },
      tts: { type: 'openai', credentials: {}, config: {} }
    };

    configs.forEach(config => {
      const decryptedCredentials = JSON.parse(encryptionService.decrypt(config.encrypted_credentials));
      
      if (config.provider_type === 'stt') {
        providerConfig.stt = {
          type: config.provider_name,
          credentials: decryptedCredentials,
          config: config.configuration || {}
        };
      } else if (config.provider_type === 'llm') {
        providerConfig.llm = {
          type: config.provider_name,
          credentials: decryptedCredentials,
          config: config.configuration || {}
        };
      } else if (config.provider_type === 'tts') {
        providerConfig.tts = {
          type: config.provider_name,
          credentials: decryptedCredentials,
          config: config.configuration || {}
        };
      }
    });

    res.json({ success: true, data: providerConfig });
  } catch (error) {
    console.error('Get providers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Save provider configuration
app.post('/api/providers', authenticateToken, async (req, res) => {
  try {
    console.log('🔧 Provider config request received:', JSON.stringify(req.body, null, 2));
    const { stt, llm, tts } = req.body;

    if (!stt || !llm || !tts) {
      console.log('❌ Missing required configurations');
      return res.status(400).json({ error: 'STT, LLM, and TTS configurations are required' });
    }

    const savedConfigs = [];

    // Save STT configuration
    if (stt.type && stt.credentials) {
      console.log('💾 Saving STT configuration...');
      const sttConfigData = {
        user_id: req.user.id,
        provider_type: 'stt',
        provider_name: stt.type,
        encrypted_credentials: encryptionService.encrypt(JSON.stringify(stt.credentials)),
        configuration: stt.config || {}
      };
      console.log('📋 STT config data:', sttConfigData);
      const savedSttConfig = await db.saveProviderConfig(sttConfigData);
      console.log('✅ STT config saved:', savedSttConfig);
      savedConfigs.push(savedSttConfig);
      
      // Log audit event
      await db.logAuditEvent(req.user.id, 'CREATE', 'provider_config', savedSttConfig.id, 
                            null, { providerType: 'stt', providerName: stt.type }, 
                            getClientIP(req), req.get('User-Agent'));
    }

    // Save LLM configuration
    if (llm.type && llm.credentials) {
      const llmConfigData = {
        user_id: req.user.id,
        provider_type: 'llm',
        provider_name: llm.type,
        encrypted_credentials: encryptionService.encrypt(JSON.stringify(llm.credentials)),
        configuration: llm.config || {}
      };
      const savedLlmConfig = await db.saveProviderConfig(llmConfigData);
      savedConfigs.push(savedLlmConfig);
      
      // Log audit event
      await db.logAuditEvent(req.user.id, 'CREATE', 'provider_config', savedLlmConfig.id, 
                            null, { providerType: 'llm', providerName: llm.type }, 
                            getClientIP(req), req.get('User-Agent'));
    }

    // Save TTS configuration
    if (tts.type && tts.credentials) {
      const ttsConfigData = {
        user_id: req.user.id,
        provider_type: 'tts',
        provider_name: tts.type,
        encrypted_credentials: encryptionService.encrypt(JSON.stringify(tts.credentials)),
        configuration: tts.config || {}
      };
      const savedTtsConfig = await db.saveProviderConfig(ttsConfigData);
      savedConfigs.push(savedTtsConfig);
      
      // Log audit event
      await db.logAuditEvent(req.user.id, 'CREATE', 'provider_config', savedTtsConfig.id, 
                            null, { providerType: 'tts', providerName: tts.type }, 
                            getClientIP(req), req.get('User-Agent'));
    }

    res.json({ success: true, data: savedConfigs });
  } catch (error) {
    console.error('❌ Save provider error:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== TOOLS ROUTES ====================

// Get all tools for user
app.get('/api/tools', authenticateToken, async (req, res) => {
  try {
    const tools = await db.getToolsByUser(req.user.id);
    res.json({ success: true, data: tools });
  } catch (error) {
    console.error('Get tools error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific tool by ID
app.get('/api/tools/:id', authenticateToken, async (req, res) => {
  try {
    const tool = await db.getToolById(req.params.id, req.user.id);
    if (!tool) {
      return res.status(404).json({ error: 'Tool not found' });
    }
    res.json({ success: true, data: tool });
  } catch (error) {
    console.error('Get tool error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new tool
app.post('/api/tools', authenticateToken, async (req, res) => {
  try {
    const toolData = {
      ...req.body,
      user_id: req.user.id
    };

    const tool = await db.createTool(toolData);

    // Log audit event
    await db.logAuditEvent(req.user.id, 'CREATE', 'tool', tool.id, 
                          null, { name: toolData.name }, 
                          getClientIP(req), req.get('User-Agent'));

    res.status(201).json({ success: true, data: tool });
  } catch (error) {
    console.error('Create tool error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update existing tool
app.put('/api/tools/:id', authenticateToken, async (req, res) => {
  try {
    const toolId = req.params.id;
    const updateData = req.body;

    // Get existing tool for audit log
    const existingTool = await db.getToolById(toolId, req.user.id);
    if (!existingTool) {
      return res.status(404).json({ error: 'Tool not found' });
    }

    const updatedTool = await db.updateTool(toolId, req.user.id, updateData);

    // Log audit event
    await db.logAuditEvent(req.user.id, 'UPDATE', 'tool', toolId, 
                          { name: existingTool.name }, { name: updateData.name }, 
                          getClientIP(req), req.get('User-Agent'));

    res.json({ success: true, data: updatedTool });
  } catch (error) {
    console.error('Update tool error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete tool
app.delete('/api/tools/:id', authenticateToken, async (req, res) => {
  try {
    const toolId = req.params.id;
    
    // Get existing tool for audit log
    const existingTool = await db.getToolById(toolId, req.user.id);
    if (!existingTool) {
      return res.status(404).json({ error: 'Tool not found' });
    }

    const deleted = await db.deleteTool(toolId, req.user.id);
    
    if (deleted) {
      // Log audit event
      await db.logAuditEvent(req.user.id, 'DELETE', 'tool', toolId, 
                            { name: existingTool.name }, null, 
                            getClientIP(req), req.get('User-Agent'));
      
      res.json({ success: true, message: 'Tool deleted successfully' });
    } else {
      res.status(404).json({ error: 'Tool not found' });
    }
  } catch (error) {
    console.error('Delete tool error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== VOICE SESSION ROUTES ====================

// Create voice session
app.post('/api/voice-sessions', authenticateToken, async (req, res) => {
  try {
    const sessionData = {
      ...req.body,
      user_id: req.user.id
    };

    const session = await db.createVoiceSession(sessionData);
    res.status(201).json({ success: true, data: session });
  } catch (error) {
    console.error('Create voice session error:', error);
    
    // Handle specific error cases
    if (error.message.includes('Tool not found') || error.message.includes('Invalid tool_id')) {
      return res.status(400).json({ 
        success: false, 
        error: error.message 
      });
    }
    
    // Generic server error
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create voice session',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Update voice session
app.put('/api/voice-sessions/:id', authenticateToken, async (req, res) => {
  try {
    const sessionId = req.params.id;
    const updateData = req.body;

    // Ensure session_state is never null
    if (updateData.session_state === null || updateData.session_state === undefined) {
      updateData.session_state = 'active';
    }

    const session = await db.updateVoiceSession(sessionId, updateData);
    res.json({ success: true, data: session });
  } catch (error) {
    console.error('Update voice session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== DATA HANDOFF ROUTES ====================

// Submit data to external database
app.post('/api/data-handoff/database', authenticateToken, async (req, res) => {
  try {
    const { dbConfig, data } = req.body;
    
    if (!dbConfig || !data) {
      return res.status(400).json({ 
        success: false, 
        error: 'Database configuration and data are required' 
      });
    }

    // Decrypt password
    const decryptedPassword = encryptionService.decrypt(dbConfig.password);
    const connectionConfig = {
      ...dbConfig,
      password: decryptedPassword
    };

    const result = await db.insertToExternalDatabase(connectionConfig, data);
    
    // Log audit event
    await db.logAuditEvent(req.user.id, 'DATA_HANDOFF', 'external_database', 
                          connectionConfig.table, null, { recordCount: 1 }, 
                          getClientIP(req), req.get('User-Agent'));
    
    res.json({ 
      success: true, 
      message: `Data successfully inserted into ${connectionConfig.table}`,
      insertId: result.insertId,
      data: result 
    });
  } catch (error) {
    console.error('Database handoff error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Database insertion failed',
      message: error.message 
    });
  }
});

// Test database connection
app.post('/api/data-handoff/test-database', authenticateToken, async (req, res) => {
  try {
    const { dbConfig } = req.body;
    
    if (!dbConfig) {
      return res.status(400).json({ 
        success: false, 
        error: 'Database configuration is required' 
      });
    }

    // Decrypt password
    const decryptedPassword = encryptionService.decrypt(dbConfig.password);
    const connectionConfig = {
      ...dbConfig,
      password: decryptedPassword
    };

    const result = await db.testExternalDatabaseConnection(connectionConfig);
    
    res.json(result);
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Database connection test failed',
      message: error.message 
    });
  }
});

// Test API endpoint
app.post('/api/data-handoff/test-api', authenticateToken, async (req, res) => {
  try {
    const { endpoint, method, headers, testData } = req.body;
    
    if (!endpoint) {
      return res.status(400).json({ 
        success: false, 
        error: 'API endpoint is required' 
      });
    }

    const result = await db.testAPIEndpoint(endpoint, method || 'POST', headers || {}, testData);
    
    res.json(result);
  } catch (error) {
    console.error('API test error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'API endpoint test failed',
      message: error.message 
    });
  }
});

// ==================== SETTINGS ROUTES ====================

// Get user setting
app.get('/api/settings/:key', authenticateToken, async (req, res) => {
  try {
    const settingValue = await db.getUserSetting(req.user.id, req.params.key);
    res.json({ success: true, data: settingValue });
  } catch (error) {
    console.error('Get setting error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Set user setting
app.post('/api/settings/:key', authenticateToken, async (req, res) => {
  try {
    await db.setUserSetting(req.user.id, req.params.key, req.body.value);
    res.json({ success: true, message: 'Setting saved' });
  } catch (error) {
    console.error('Set setting error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== TEST TOOLS ROUTES ====================

// Serve test tools (for development)
const path = require('path');
const fs = require('fs');

app.get('/test/voice-session', (req, res) => {
  const testFilePath = path.join(__dirname, '..', 'test-voice-session.html');
  if (fs.existsSync(testFilePath)) {
    res.sendFile(testFilePath);
  } else {
    res.status(404).send('Test file not found');
  }
});

app.get('/test/connection', (req, res) => {
  const testFilePath = path.join(__dirname, '..', 'test-connection.html');
  if (fs.existsSync(testFilePath)) {
    res.sendFile(testFilePath);
  } else {
    res.status(404).send('Test file not found');
  }
});

app.get('/test/debug-voice', (req, res) => {
  const testFilePath = path.join(__dirname, '..', 'debug-voice-timeout.html');
  if (fs.existsSync(testFilePath)) {
    res.sendFile(testFilePath);
  } else {
    res.status(404).send('Test file not found');
  }
});

// ==================== HEALTH CHECK ROUTES ====================

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Database health check
app.get('/api/health/db', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ 
      success: true, 
      status: 'Database connection OK', 
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    console.error('Database health check failed:', error);
    res.status(500).json({ 
      success: false, 
      status: 'Database connection failed', 
      error: error.message 
    });
  }
});

// ==================== ERROR HANDLING ====================

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// ==================== SERVER STARTUP ====================

app.listen(PORT, () => {
  console.log(`🚀 Healthcare Voice Agent API Server running on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📊 Database health: http://localhost:${PORT}/api/health/db`);
  console.log('🔐 API endpoints are secured with JWT authentication');
});

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT. Graceful shutdown...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM. Graceful shutdown...');
  process.exit(0);
});

module.exports = app;
