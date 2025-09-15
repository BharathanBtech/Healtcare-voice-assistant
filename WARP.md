# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

Healthcare Voice Agent Platform is a full-stack TypeScript/React application for healthcare organizations featuring AI-powered speech-to-text, language models, and text-to-speech. The platform enables dynamic tool creation with real-time voice interaction and seamless integration with external APIs and databases.

## Common Development Commands

### Core Development Commands
```bash
# Install all dependencies (frontend and backend)
npm install

# Start full development environment (both frontend and backend)
npm run dev:full

# Start frontend only (React on port 3000)
npm start

# Start backend only (Express on port 3001)  
npm run server

# Start backend with auto-reload during development
npm run dev:server

# Set up PostgreSQL database schema and initial data
npm run db:migrate
```

### Build and Quality Commands
```bash
# Build React app for production
npm run build

# Run Jest test suite
npm test

# Run ESLint on all TypeScript files
npm run lint

# Run TypeScript compiler type checking (no emit)
npm run type-check
```

### Database Commands
```bash
# Run database migrations and setup
npm run db:migrate

# The migration script handles PostgreSQL setup automatically
# Creates tables for users, tools, sessions, providers, and audit logs
```

## Architecture Overview

### Full-Stack Structure
- **Frontend**: React 18 + TypeScript with Webpack 5 (port 3000)
- **Backend**: Node.js + Express (port 3001)
- **Database**: PostgreSQL (primary), with MySQL and SQLite support
- **Authentication**: JWT with secure session management
- **Security**: AES-256 encryption, helmet, CORS, rate limiting

### Key Frontend Architecture

#### Service Layer Pattern
The application uses a service-oriented architecture where business logic is separated into dedicated service classes:

- **AuthService**: JWT authentication and session management
- **AIProviderService**: Multi-provider AI integration (OpenAI, Azure, Google, Amazon, Anthropic)
- **VoiceInteractionService**: Core voice session orchestration
- **VoiceRecordingService**: Audio capture and processing
- **VoiceSessionService**: Session persistence and state management
- **ToolService**: Dynamic tool creation and management
- **DataHandoffService**: External API and database integrations
- **EncryptionService**: Client-side encryption for sensitive data
- **StorageService**: Secure local storage with encryption

#### React Context for State Management
Global application state is managed through React Context (`AppContext`) providing:
- User authentication state
- Provider configurations (STT/LLM/TTS)
- Tool definitions and management
- Application settings

#### Component Organization
```
src/components/
├── auth/           # Authentication UI (LoginScreen)
├── dashboard/      # Main dashboard and analytics
├── providers/      # AI provider configuration
├── tools/          # Tool creation and editing (ToolCreator, ToolEditor)
├── voice/          # Voice interaction interface
└── common/         # Shared UI components (Layout)
```

### Backend Architecture

#### Express.js API Server
The backend is structured as a RESTful API with these key components:

- **DatabaseService**: Abstracted database operations with connection pooling
- **EncryptionService**: Server-side encryption for credential storage
- **Authentication middleware**: JWT verification with session validation
- **Security middleware**: Helmet, CORS, rate limiting

#### Key API Endpoints
```
Authentication:
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me

Provider Management:
GET  /api/providers
POST /api/providers

Tool Management:
GET  /api/tools
POST /api/tools
PUT  /api/tools/:id
DELETE /api/tools/:id

Voice Sessions:
POST /api/voice-sessions
PUT  /api/voice-sessions/:id

Data Handoff:
POST /api/data-handoff/database
POST /api/data-handoff/test-database
POST /api/data-handoff/test-api

Health Monitoring:
GET  /api/health
GET  /api/health/db
```

### TypeScript Type System

The application uses a comprehensive type system defined in `src/types/index.ts`:

#### Core Domain Types
- **User**: Authentication and user management
- **ProviderConfig**: AI provider configurations (STT/LLM/TTS)
- **Tool**: Dynamic tool definitions with field validation
- **VoiceSession**: Voice interaction state and data collection
- **DataHandoffConfig**: External integration configurations

#### State Management Types
- **AppState**: Global application state structure
- **VoiceInteractionState**: Voice session lifecycle states
- **ValidationResult**: Form and data validation results

### Data Flow Architecture

#### Voice Interaction Flow
1. **VoiceInteraction** component manages UI state
2. **VoiceInteractionService** orchestrates the conversation
3. **VoiceRecordingService** handles audio capture
4. **AIProviderService** processes STT → LLM → TTS
5. **VoiceSessionService** persists session data
6. **DataHandoffService** submits completed data

#### Tool Creation Flow
1. **ToolCreator** provides drag-and-drop interface
2. **ToolService** handles tool persistence
3. **ValidationService** ensures data integrity
4. Dynamic tool rendering in **VoiceInteraction**

### Security Architecture

#### Multi-Layer Security
- **Authentication**: JWT tokens with server-side session validation
- **Encryption**: AES-256 for credentials and sensitive data
- **Transport**: TLS/SSL for all communications
- **Validation**: Input sanitization and parameterized queries
- **Audit**: Comprehensive logging of all user actions

## Development Guidelines

### Working with Services
When modifying or adding services, follow the established patterns:
- Services are classes with static methods for stateless operations
- Use TypeScript interfaces for all data structures
- Implement proper error handling with try-catch blocks
- Include audit logging for sensitive operations

### Database Operations
- All database operations go through `DatabaseService.js`
- Use parameterized queries to prevent SQL injection
- Handle connection pooling automatically
- Support multiple database types (PostgreSQL primary, MySQL, SQLite)

### Adding New AI Providers
1. Update provider types in `src/types/index.ts`
2. Extend `AIProviderService.ts` with new provider logic
3. Add provider configuration UI in `ProviderConfiguration.tsx`
4. Test integration with validation endpoints

### Voice Integration Development
- Voice sessions are state machines with defined lifecycle states
- Audio processing uses Web Audio API with MediaRecorder
- STT/LLM/TTS pipeline is orchestrated through service layer
- Session persistence enables recovery from interruptions

### Data Handoff Integration
- Supports both API endpoints and direct database connections
- Field mapping allows transformation between internal and external formats
- Pre-deployment testing validates configurations
- Real-time monitoring tracks success/failure rates

## Environment Setup

### Required Environment Variables
```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=healthcare_voice_agent
DB_USER=your_db_user
DB_PASSWORD=your_db_password

# Server Configuration
PORT=3001
NODE_ENV=development
JWT_SECRET=your-super-secret-jwt-key-change-in-production-12345

# Frontend Configuration (Optional)
REACT_APP_API_BASE_URL=http://localhost:3001
REACT_APP_ENCRYPTION_KEY=your-client-encryption-key
```

### Demo Credentials
- Username: `demo`
- Password: `demo123`

### Development URLs
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Health Check: http://localhost:3001/api/health
- Database Health: http://localhost:3001/api/health/db

## Testing Strategy

### Current Test Setup
- Jest configuration for unit tests
- React Testing Library for component testing
- TypeScript strict mode for compile-time validation

### Manual Testing Areas
- AI provider integrations (requires API keys)
- Voice interaction workflows
- Database connection testing
- Data handoff configurations

## Healthcare Compliance Features

### HIPAA Compliance
- AES-256 encryption for data at rest and in transit
- JWT-based authentication with session management
- Comprehensive audit logging of all data access
- Secure credential storage with encryption
- Input validation and sanitization

### Security Standards
- OWASP compliance with security best practices
- Rate limiting protection against abuse
- Secure error handling without information disclosure
- Parameterized queries preventing SQL injection

## Production Deployment Notes

### Database Requirements
- PostgreSQL 12+ recommended for production
- Connection pooling configured automatically
- Migration scripts handle schema setup
- Backup strategy required for production data

### Security Checklist
- Change all default passwords and secrets
- Enable SSL/TLS certificates
- Configure firewall rules
- Set up monitoring and alerting
- Enable log aggregation and error tracking
