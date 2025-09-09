const { Pool } = require('pg');
const crypto = require('crypto');
const { dbConfig } = require('../migrations/migrate');

class DatabaseService {
  constructor() {
    // Create connection pool for better performance
    this.pool = new Pool({
      ...dbConfig,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // How long a client is allowed to remain idle
      connectionTimeoutMillis: 2000, // How long to try connecting before timing out
    });

    // Handle pool errors
    this.pool.on('error', (err, client) => {
      console.error('Unexpected error on idle client', err);
      process.exit(-1);
    });

    console.log('📊 Database connection pool initialized');
  }

  // Generic query method with error handling
  async query(text, params = []) {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      return result;
    } catch (error) {
      console.error('❌ Database query error:', { text: text.substring(0, 100), error: error.message });
      throw error;
    }
  }

  // Transaction wrapper
  async transaction(callback) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // User management methods
  async createUser(userData) {
    const query = `
      INSERT INTO users (id, username, email, password_hash, role, organization_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, username, email, role, organization_id, created_at;
    `;
    const values = [
      userData.id || crypto.randomUUID(),
      userData.username,
      userData.email,
      userData.password_hash,
      userData.role || 'user',
      userData.organization_id
    ];
    const result = await this.query(query, values);
    return result.rows[0];
  }

  async getUserByUsername(username) {
    const query = 'SELECT * FROM users WHERE username = $1 AND is_active = true';
    const result = await this.query(query, [username]);
    return result.rows[0] || null;
  }

  async getUserById(id) {
    const query = 'SELECT id, username, email, role, organization_id, created_at FROM users WHERE id = $1 AND is_active = true';
    const result = await this.query(query, [id]);
    return result.rows[0] || null;
  }

  async updateUserLastLogin(id) {
    const query = 'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1';
    await this.query(query, [id]);
  }

  // Provider configuration methods
  async saveProviderConfig(config) {
    const query = `
      INSERT INTO provider_configs (id, user_id, provider_type, provider_name, encrypted_credentials, configuration)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id, provider_type, provider_name)
      DO UPDATE SET 
        encrypted_credentials = EXCLUDED.encrypted_credentials,
        configuration = EXCLUDED.configuration,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    const values = [
      config.id || crypto.randomUUID(),
      config.user_id,
      config.provider_type,
      config.provider_name,
      config.encrypted_credentials,
      JSON.stringify(config.configuration || {})
    ];
    const result = await this.query(query, values);
    return result.rows[0];
  }

  async getProviderConfigs(userId) {
    const query = 'SELECT * FROM provider_configs WHERE user_id = $1 AND is_active = true ORDER BY provider_type, provider_name';
    const result = await this.query(query, [userId]);
    return result.rows.map(row => ({
      ...row,
      configuration: (() => {
        try {
          // If it's already an object, return it directly
          if (typeof row.configuration === 'object' && row.configuration !== null) {
            return row.configuration;
          }
          // If it's a string, try to parse it
          return row.configuration ? JSON.parse(row.configuration) : {};
        } catch (error) {
          console.error('Error parsing provider configuration:', row.configuration, error);
          return {};
        }
      })()
    }));
  }

  async getProviderConfig(userId, providerType, providerName) {
    const query = 'SELECT * FROM provider_configs WHERE user_id = $1 AND provider_type = $2 AND provider_name = $3 AND is_active = true';
    const result = await this.query(query, [userId, providerType, providerName]);
    if (!result.rows[0]) return null;
    
    return {
      ...result.rows[0],
      configuration: (() => {
        try {
          return result.rows[0].configuration ? JSON.parse(result.rows[0].configuration) : {};
        } catch (error) {
          console.error('Error parsing provider configuration:', result.rows[0].configuration, error);
          return {};
        }
      })()
    };
  }

  // Tool management methods
  async createTool(toolData) {
    return await this.transaction(async (client) => {
      // Insert tool (or update if exists)
      const toolQuery = `
        INSERT INTO tools (id, user_id, name, description, template_id, initial_prompt, conclusion_prompt, intermediate_prompts)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) 
        DO UPDATE SET 
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          template_id = EXCLUDED.template_id,
          initial_prompt = EXCLUDED.initial_prompt,
          conclusion_prompt = EXCLUDED.conclusion_prompt,
          intermediate_prompts = EXCLUDED.intermediate_prompts,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *;
      `;
      const toolValues = [
        toolData.id || crypto.randomUUID(),
        toolData.user_id,
        toolData.name,
        toolData.description,
        toolData.template_id,
        toolData.initialPrompt || toolData.initial_prompt,
        toolData.conclusionPrompt || toolData.conclusion_prompt,
        JSON.stringify(toolData.intermediatePrompts || toolData.intermediate_prompts || [])
      ];
      const toolResult = await client.query(toolQuery, toolValues);
      const tool = toolResult.rows[0];

      // Delete existing fields and insert new ones
      await client.query('DELETE FROM tool_fields WHERE tool_id = $1', [tool.id]);
      
      if (toolData.fields && toolData.fields.length > 0) {
        for (let i = 0; i < toolData.fields.length; i++) {
          const field = toolData.fields[i];
          const fieldQuery = `
            INSERT INTO tool_fields (id, tool_id, name, field_type, is_required, instructional_prompt, field_options, validation_rules, field_order)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
          `;
          const fieldValues = [
            field.id || crypto.randomUUID(),
            tool.id,
            field.name,
            field.type,
            field.required || false,
            field.instructionalPrompt || field.instructional_prompt,
            JSON.stringify(field.options || []),
            JSON.stringify(field.validation || {}),
            i
          ];
          await client.query(fieldQuery, fieldValues);
        }
      }

      // Delete existing handoff config and insert new one if provided
      await client.query('DELETE FROM data_handoff_configs WHERE tool_id = $1', [tool.id]);
      
      const dataHandoff = toolData.dataHandoff || toolData.data_handoff;
      if (dataHandoff) {
        const handoffQuery = `
          INSERT INTO data_handoff_configs (id, tool_id, handoff_type, api_config, database_config, field_mappings)
          VALUES ($1, $2, $3, $4, $5, $6);
        `;
        const handoffValues = [
          crypto.randomUUID(),
          tool.id,
          dataHandoff.type,
          dataHandoff.api ? JSON.stringify(dataHandoff.api) : null,
          dataHandoff.database ? JSON.stringify(dataHandoff.database) : null,
          JSON.stringify(dataHandoff.fieldMappings || dataHandoff.field_mappings || [])
        ];
        await client.query(handoffQuery, handoffValues);
      }

      return tool;
    });
  }

  async getToolsByUser(userId) {
    const query = `
      SELECT t.*, 
             COALESCE(json_agg(
               json_build_object(
                 'id', tf.id,
                 'name', tf.name,
                 'type', tf.field_type,
                 'required', tf.is_required,
                 'instructional_prompt', tf.instructional_prompt,
                 'options', tf.field_options,
                 'validation', tf.validation_rules
               ) ORDER BY tf.field_order
             ) FILTER (WHERE tf.id IS NOT NULL), '[]') as fields,
             dhc.handoff_type,
             dhc.api_config,
             dhc.database_config,
             dhc.field_mappings
      FROM tools t
      LEFT JOIN tool_fields tf ON t.id = tf.tool_id
      LEFT JOIN data_handoff_configs dhc ON t.id = dhc.tool_id
      WHERE t.user_id = $1 AND t.is_active = true
      GROUP BY t.id, dhc.id
      ORDER BY t.updated_at DESC;
    `;
    const result = await this.query(query, [userId]);
    
    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      template_id: row.template_id,
      initial_prompt: row.initial_prompt,
      conclusion_prompt: row.conclusion_prompt,
      intermediate_prompts: (() => {
        try {
          // If it's already an object/array, return it directly
          if (typeof row.intermediate_prompts === 'object' && row.intermediate_prompts !== null) {
            return row.intermediate_prompts;
          }
          // If it's a string, try to parse it
          return row.intermediate_prompts ? JSON.parse(row.intermediate_prompts) : [];
        } catch (error) {
          console.error('Error parsing intermediate_prompts:', row.intermediate_prompts, error);
          return [];
        }
      })(),
      fields: row.fields.map(field => ({
        ...field,
        options: (() => {
          try {
            // If it's already an object/array, return it directly
            if (typeof field.options === 'object' && field.options !== null) {
              return field.options;
            }
            // If it's a string, try to parse it
            return field.options ? JSON.parse(field.options) : [];
          } catch (error) {
            console.error('Error parsing field options:', field.options, error);
            return [];
          }
        })(),
        validation: (() => {
          try {
            // If it's already an object, return it directly
            if (typeof field.validation === 'object' && field.validation !== null) {
              return field.validation;
            }
            // If it's a string, try to parse it
            return field.validation ? JSON.parse(field.validation) : {};
          } catch (error) {
            console.error('Error parsing field validation:', field.validation, error);
            return {};
          }
        })()
      })),
      data_handoff: row.handoff_type ? {
        type: row.handoff_type,
        api: (() => {
          try {
            // If it's already an object, return it directly
            if (typeof row.api_config === 'object' && row.api_config !== null) {
              return row.api_config;
            }
            // If it's a string, try to parse it
            return row.api_config ? JSON.parse(row.api_config) : null;
          } catch (error) {
            console.error('Error parsing api_config:', row.api_config, error);
            return null;
          }
        })(),
        database: (() => {
          try {
            // If it's already an object, return it directly
            if (typeof row.database_config === 'object' && row.database_config !== null) {
              return row.database_config;
            }
            // If it's a string, try to parse it
            return row.database_config ? JSON.parse(row.database_config) : null;
          } catch (error) {
            console.error('Error parsing database_config:', row.database_config, error);
            return null;
          }
        })(),
        field_mappings: (() => {
          try {
            // If it's already an object/array, return it directly
            if (typeof row.field_mappings === 'object' && row.field_mappings !== null) {
              return row.field_mappings;
            }
            // If it's a string, try to parse it
            return row.field_mappings ? JSON.parse(row.field_mappings) : [];
          } catch (error) {
            console.error('Error parsing field_mappings:', row.field_mappings, error);
            return [];
          }
        })()
      } : null,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));
  }

  async getToolById(toolId, userId) {
    const query = `
      SELECT t.*, 
             COALESCE(json_agg(
               json_build_object(
                 'id', tf.id,
                 'name', tf.name,
                 'type', tf.field_type,
                 'required', tf.is_required,
                 'instructional_prompt', tf.instructional_prompt,
                 'options', tf.field_options,
                 'validation', tf.validation_rules
               ) ORDER BY tf.field_order
             ) FILTER (WHERE tf.id IS NOT NULL), '[]') as fields,
             dhc.handoff_type,
             dhc.api_config,
             dhc.database_config,
             dhc.field_mappings
      FROM tools t
      LEFT JOIN tool_fields tf ON t.id = tf.tool_id
      LEFT JOIN data_handoff_configs dhc ON t.id = dhc.tool_id
      WHERE t.id = $1 AND t.user_id = $2 AND t.is_active = true
      GROUP BY t.id, dhc.id;
    `;
    const result = await this.query(query, [toolId, userId]);
    
    if (!result.rows[0]) return null;
    
    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      template_id: row.template_id,
      initial_prompt: row.initial_prompt,
      conclusion_prompt: row.conclusion_prompt,
      intermediate_prompts: (() => {
        try {
          // If it's already an object/array, return it directly
          if (typeof row.intermediate_prompts === 'object' && row.intermediate_prompts !== null) {
            return row.intermediate_prompts;
          }
          // If it's a string, try to parse it
          return row.intermediate_prompts ? JSON.parse(row.intermediate_prompts) : [];
        } catch (error) {
          console.error('Error parsing intermediate_prompts:', row.intermediate_prompts, error);
          return [];
        }
      })(),
      fields: row.fields.map(field => ({
        ...field,
        options: (() => {
          try {
            // If it's already an object/array, return it directly
            if (typeof field.options === 'object' && field.options !== null) {
              return field.options;
            }
            // If it's a string, try to parse it
            return field.options ? JSON.parse(field.options) : [];
          } catch (error) {
            console.error('Error parsing field options:', field.options, error);
            return [];
          }
        })(),
        validation: (() => {
          try {
            // If it's already an object, return it directly
            if (typeof field.validation === 'object' && field.validation !== null) {
              return field.validation;
            }
            // If it's a string, try to parse it
            return field.validation ? JSON.parse(field.validation) : {};
          } catch (error) {
            console.error('Error parsing field validation:', field.validation, error);
            return {};
          }
        })()
      })),
      data_handoff: row.handoff_type ? {
        type: row.handoff_type,
        api: (() => {
          try {
            // If it's already an object, return it directly
            if (typeof row.api_config === 'object' && row.api_config !== null) {
              return row.api_config;
            }
            // If it's a string, try to parse it
            return row.api_config ? JSON.parse(row.api_config) : null;
          } catch (error) {
            console.error('Error parsing api_config:', row.api_config, error);
            return null;
          }
        })(),
        database: (() => {
          try {
            // If it's already an object, return it directly
            if (typeof row.database_config === 'object' && row.database_config !== null) {
              return row.database_config;
            }
            // If it's a string, try to parse it
            return row.database_config ? JSON.parse(row.database_config) : null;
          } catch (error) {
            console.error('Error parsing database_config:', row.database_config, error);
            return null;
          }
        })(),
        field_mappings: (() => {
          try {
            // If it's already an object/array, return it directly
            if (typeof row.field_mappings === 'object' && row.field_mappings !== null) {
              return row.field_mappings;
            }
            // If it's a string, try to parse it
            return row.field_mappings ? JSON.parse(row.field_mappings) : [];
          } catch (error) {
            console.error('Error parsing field_mappings:', row.field_mappings, error);
            return [];
          }
        })()
      } : null,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  async updateTool(toolId, userId, toolData) {
    return await this.transaction(async (client) => {
      // Update tool basic info
      const toolQuery = `
        UPDATE tools 
        SET name = $1, description = $2, initial_prompt = $3, conclusion_prompt = $4, intermediate_prompts = $5
        WHERE id = $6 AND user_id = $7
        RETURNING *;
      `;
      const toolValues = [
        toolData.name,
        toolData.description,
        toolData.initial_prompt,
        toolData.conclusion_prompt,
        JSON.stringify(toolData.intermediate_prompts || []),
        toolId,
        userId
      ];
      const toolResult = await client.query(toolQuery, toolValues);
      
      if (toolResult.rows.length === 0) {
        throw new Error('Tool not found or access denied');
      }

      // Update fields - delete old ones and insert new ones
      if (toolData.fields) {
        await client.query('DELETE FROM tool_fields WHERE tool_id = $1', [toolId]);
        
        for (let i = 0; i < toolData.fields.length; i++) {
          const field = toolData.fields[i];
          const fieldQuery = `
            INSERT INTO tool_fields (id, tool_id, name, field_type, is_required, instructional_prompt, field_options, validation_rules, field_order)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
          `;
          const fieldValues = [
            field.id || crypto.randomUUID(),
            toolId,
            field.name,
            field.type,
            field.required || false,
            field.instructional_prompt,
            JSON.stringify(field.options || []),
            JSON.stringify(field.validation || {}),
            i
          ];
          await client.query(fieldQuery, fieldValues);
        }
      }

      // Update data handoff config
      if (toolData.data_handoff) {
        const handoffQuery = `
          INSERT INTO data_handoff_configs (id, tool_id, handoff_type, api_config, database_config, field_mappings)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (tool_id)
          DO UPDATE SET 
            handoff_type = EXCLUDED.handoff_type,
            api_config = EXCLUDED.api_config,
            database_config = EXCLUDED.database_config,
            field_mappings = EXCLUDED.field_mappings,
            updated_at = CURRENT_TIMESTAMP;
        `;
        const handoffValues = [
          crypto.randomUUID(),
          toolId,
          toolData.data_handoff.type,
          toolData.data_handoff.api ? JSON.stringify(toolData.data_handoff.api) : null,
          toolData.data_handoff.database ? JSON.stringify(toolData.data_handoff.database) : null,
          JSON.stringify(toolData.data_handoff.field_mappings || [])
        ];
        await client.query(handoffQuery, handoffValues);
      }

      return toolResult.rows[0];
    });
  }

  async deleteTool(toolId, userId) {
    const query = 'UPDATE tools SET is_active = false WHERE id = $1 AND user_id = $2';
    const result = await this.query(query, [toolId, userId]);
    return result.rowCount > 0;
  }

  // Session management methods
  async createUserSession(userId, sessionToken, expiresAt, ipAddress, userAgent) {
    const query = `
      INSERT INTO user_sessions (id, user_id, session_token, expires_at, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const values = [crypto.randomUUID(), userId, sessionToken, expiresAt, ipAddress, userAgent];
    const result = await this.query(query, values);
    return result.rows[0];
  }

  async getUserSession(sessionToken) {
    const query = `
      SELECT us.*, u.username, u.email, u.role 
      FROM user_sessions us
      JOIN users u ON us.user_id = u.id
      WHERE us.session_token = $1 AND us.expires_at > CURRENT_TIMESTAMP AND us.is_active = true;
    `;
    const result = await this.query(query, [sessionToken]);
    return result.rows[0] || null;
  }

  async invalidateUserSession(sessionToken) {
    const query = 'UPDATE user_sessions SET is_active = false WHERE session_token = $1';
    await this.query(query, [sessionToken]);
  }

  // Voice session methods
  async createVoiceSession(sessionData) {
    try {
      // First verify that the tool exists and belongs to the user
      const toolCheckQuery = `
        SELECT id FROM tools 
        WHERE id = $1 AND user_id = $2 AND is_active = true
      `;
      const toolResult = await this.query(toolCheckQuery, [sessionData.tool_id, sessionData.user_id]);
      
      if (toolResult.rows.length === 0) {
        throw new Error(`Tool not found or access denied: ${sessionData.tool_id}`);
      }
      
      // If tool exists, create the session
      const query = `
        INSERT INTO voice_sessions (id, user_id, tool_id, session_state, collected_data, field_statuses)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *;
      `;
      const values = [
        sessionData.id || crypto.randomUUID(),
        sessionData.user_id,
        sessionData.tool_id,
        sessionData.session_state || 'initializing',
        JSON.stringify(sessionData.collected_data || {}),
        JSON.stringify(sessionData.field_statuses || {})
      ];
      const result = await this.query(query, values);
      return result.rows[0];
    } catch (error) {
      // Re-throw with more specific error message
      if (error.code === '23503') { // Foreign key violation
        throw new Error(`Invalid tool_id: Tool '${sessionData.tool_id}' does not exist`);
      }
      throw error;
    }
  }

  async updateVoiceSession(sessionId, updateData) {
    const query = `
      UPDATE voice_sessions 
      SET session_state = $1, collected_data = $2, field_statuses = $3, transcript = $4, end_time = $5
      WHERE id = $6
      RETURNING *;
    `;
    const values = [
      updateData.session_state || 'active', // Provide default value if null
      JSON.stringify(updateData.collected_data || {}),
      JSON.stringify(updateData.field_statuses || {}),
      JSON.stringify(updateData.transcript || []),
      updateData.end_time,
      sessionId
    ];
    const result = await this.query(query, values);
    return result.rows[0];
  }

  // Application settings methods
  async getUserSetting(userId, settingKey) {
    const query = 'SELECT setting_value FROM app_settings WHERE user_id = $1 AND setting_key = $2';
    const result = await this.query(query, [userId, settingKey]);
    return result.rows[0] ? JSON.parse(result.rows[0].setting_value) : null;
  }

  async setUserSetting(userId, settingKey, settingValue) {
    const query = `
      INSERT INTO app_settings (user_id, setting_key, setting_value)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, setting_key)
      DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = CURRENT_TIMESTAMP;
    `;
    const values = [userId, settingKey, JSON.stringify(settingValue)];
    await this.query(query, values);
  }

  // Audit logging
  async logAuditEvent(userId, action, entityType, entityId, oldValues, newValues, ipAddress, userAgent) {
    const query = `
      INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
    `;
    const values = [
      crypto.randomUUID(),
      userId,
      action,
      entityType,
      entityId,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      ipAddress,
      userAgent
    ];
    await this.query(query, values);
  }

  // External database methods for data handoff
  async insertToExternalDatabase(dbConfig, data) {
    let externalDb = null;
    
    try {
      // Import required database modules dynamically
      let dbModule;
      let connectionConfig;
      
      switch (dbConfig.type.toLowerCase()) {
        case 'postgresql':
        case 'postgres':
          dbModule = require('pg');
          connectionConfig = {
            host: dbConfig.hostname,
            port: dbConfig.port || 5432,
            database: dbConfig.database,
            user: dbConfig.username,
            password: dbConfig.password,
            ssl: dbConfig.ssl || false,
            connectionTimeoutMillis: 5000
          };
          externalDb = new dbModule.Client(connectionConfig);
          await externalDb.connect();
          break;
          
        case 'mysql':
        case 'mariadb':
          dbModule = require('mysql2/promise');
          connectionConfig = {
            host: dbConfig.hostname,
            port: dbConfig.port || 3306,
            database: dbConfig.database,
            user: dbConfig.username,
            password: dbConfig.password,
            connectTimeout: 5000,
            ssl: dbConfig.ssl || false
          };
          externalDb = await dbModule.createConnection(connectionConfig);
          break;
          
        case 'sqlite':
        case 'sqlite3':
          dbModule = require('sqlite3').verbose();
          externalDb = new dbModule.Database(dbConfig.database);
          break;
          
        default:
          throw new Error(`Unsupported database type: ${dbConfig.type}`);
      }
      
      // Build INSERT query dynamically
      const columns = Object.keys(data);
      const values = Object.values(data);
      const placeholders = dbConfig.type.toLowerCase().includes('mysql') 
        ? columns.map(() => '?').join(', ')
        : columns.map((_, index) => `$${index + 1}`).join(', ');
      
      const insertQuery = `INSERT INTO ${dbConfig.table} (${columns.join(', ')}) VALUES (${placeholders})`;
      
      let result;
      
      switch (dbConfig.type.toLowerCase()) {
        case 'postgresql':
        case 'postgres':
          const pgResult = await externalDb.query(`${insertQuery} RETURNING *`, values);
          result = {
            insertId: pgResult.rows[0]?.id || null,
            rowsAffected: pgResult.rowCount,
            insertedData: pgResult.rows[0] || null
          };
          break;
          
        case 'mysql':
        case 'mariadb':
          const [mysqlResult] = await externalDb.execute(insertQuery, values);
          result = {
            insertId: mysqlResult.insertId,
            rowsAffected: mysqlResult.affectedRows
          };
          break;
          
        case 'sqlite':
        case 'sqlite3':
          result = await new Promise((resolve, reject) => {
            externalDb.run(insertQuery, values, function(err) {
              if (err) reject(err);
              else resolve({
                insertId: this.lastID,
                rowsAffected: this.changes
              });
            });
          });
          break;
      }
      
      console.log(`✅ Data successfully inserted into ${dbConfig.type} table: ${dbConfig.table}`);
      return result;
      
    } catch (error) {
      console.error(`❌ External database insertion failed:`, error);
      throw new Error(`Database insertion failed: ${error.message}`);
    } finally {
      // Clean up connection
      if (externalDb) {
        try {
          if (dbConfig.type.toLowerCase().includes('postgres')) {
            await externalDb.end();
          } else if (dbConfig.type.toLowerCase().includes('mysql')) {
            await externalDb.end();
          } else if (dbConfig.type.toLowerCase().includes('sqlite')) {
            externalDb.close();
          }
        } catch (closeError) {
          console.error('Error closing external database connection:', closeError);
        }
      }
    }
  }
  
  async testExternalDatabaseConnection(dbConfig) {
    let externalDb = null;
    
    try {
      let dbModule;
      let connectionConfig;
      
      switch (dbConfig.type.toLowerCase()) {
        case 'postgresql':
        case 'postgres':
          dbModule = require('pg');
          connectionConfig = {
            host: dbConfig.hostname,
            port: dbConfig.port || 5432,
            database: dbConfig.database,
            user: dbConfig.username,
            password: dbConfig.password,
            ssl: dbConfig.ssl || false,
            connectionTimeoutMillis: 5000
          };
          externalDb = new dbModule.Client(connectionConfig);
          await externalDb.connect();
          
          // Test query and table existence
          const pgTestResult = await externalDb.query('SELECT 1 as test');
          const tableExists = await externalDb.query(`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_name = $1
            )
          `, [dbConfig.table]);
          
          return {
            success: true,
            message: 'PostgreSQL connection successful',
            tableExists: tableExists.rows[0].exists,
            databaseVersion: (await externalDb.query('SELECT version()')).rows[0].version
          };
          
        case 'mysql':
        case 'mariadb':
          dbModule = require('mysql2/promise');
          connectionConfig = {
            host: dbConfig.hostname,
            port: dbConfig.port || 3306,
            database: dbConfig.database,
            user: dbConfig.username,
            password: dbConfig.password,
            connectTimeout: 5000,
            ssl: dbConfig.ssl || false
          };
          externalDb = await dbModule.createConnection(connectionConfig);
          
          // Test query and table existence
          const [mysqlTestResult] = await externalDb.execute('SELECT 1 as test');
          const [tableCheckResult] = await externalDb.execute(`
            SELECT COUNT(*) as table_exists 
            FROM information_schema.tables 
            WHERE table_schema = ? AND table_name = ?
          `, [dbConfig.database, dbConfig.table]);
          
          const [versionResult] = await externalDb.execute('SELECT VERSION() as version');
          
          return {
            success: true,
            message: 'MySQL connection successful',
            tableExists: tableCheckResult[0].table_exists > 0,
            databaseVersion: versionResult[0].version
          };
          
        case 'sqlite':
        case 'sqlite3':
          dbModule = require('sqlite3').verbose();
          externalDb = new dbModule.Database(dbConfig.database);
          
          const sqliteTableExists = await new Promise((resolve, reject) => {
            externalDb.get(`
              SELECT name FROM sqlite_master 
              WHERE type='table' AND name=?
            `, [dbConfig.table], (err, row) => {
              if (err) reject(err);
              else resolve(!!row);
            });
          });
          
          const version = await new Promise((resolve, reject) => {
            externalDb.get('SELECT sqlite_version() as version', (err, row) => {
              if (err) reject(err);
              else resolve(row.version);
            });
          });
          
          return {
            success: true,
            message: 'SQLite connection successful',
            tableExists: sqliteTableExists,
            databaseVersion: `SQLite ${version}`
          };
          
        default:
          throw new Error(`Unsupported database type: ${dbConfig.type}`);
      }
      
    } catch (error) {
      console.error('External database connection test failed:', error);
      return {
        success: false,
        message: `Database connection failed: ${error.message}`,
        error: error.code || 'CONNECTION_ERROR'
      };
    } finally {
      // Clean up connection
      if (externalDb) {
        try {
          if (dbConfig.type.toLowerCase().includes('postgres')) {
            await externalDb.end();
          } else if (dbConfig.type.toLowerCase().includes('mysql')) {
            await externalDb.end();
          } else if (dbConfig.type.toLowerCase().includes('sqlite')) {
            externalDb.close();
          }
        } catch (closeError) {
          console.error('Error closing external database connection:', closeError);
        }
      }
    }
  }
  
  async testAPIEndpoint(endpoint, method, headers, testData) {
    try {
      const axios = require('axios');
      
      const requestConfig = {
        method: method.toLowerCase(),
        url: endpoint,
        headers: {
          'Content-Type': 'application/json',
          'X-Test-Request': 'true',
          ...headers
        },
        timeout: 10000,
        validateStatus: (status) => status >= 200 && status < 500
      };
      
      if (method.toLowerCase() !== 'get' && testData) {
        requestConfig.data = testData;
      }
      
      const response = await axios(requestConfig);
      
      return {
        success: response.status >= 200 && response.status < 300,
        message: `API endpoint test ${response.status >= 200 && response.status < 300 ? 'successful' : 'returned non-success status'}`,
        status: response.status,
        statusText: response.statusText,
        responseHeaders: response.headers,
        responseData: response.data,
        responseTime: response.headers['x-response-time'] || 'N/A'
      };
      
    } catch (error) {
      console.error('API endpoint test failed:', error);
      
      if (error.response) {
        return {
          success: false,
          message: `API endpoint returned error: ${error.response.status} ${error.response.statusText}`,
          status: error.response.status,
          statusText: error.response.statusText,
          responseData: error.response.data
        };
      } else if (error.request) {
        return {
          success: false,
          message: 'Network error: Unable to reach API endpoint',
          error: 'NETWORK_ERROR'
        };
      } else {
        return {
          success: false,
          message: `Configuration error: ${error.message}`,
          error: 'CONFIG_ERROR'
        };
      }
    }
  }
  
  // Graceful shutdown
  async close() {
    await this.pool.end();
    console.log('🔐 Database connection pool closed');
  }
}

// Create singleton instance
const db = new DatabaseService();

// Handle process termination
process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, closing database connections...');
  await db.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, closing database connections...');
  await db.close();
  process.exit(0);
});

module.exports = db;
