# Healthcare Voice Agent Platform

A comprehensive, full-stack voice agent system for healthcare organizations featuring AI-powered speech-to-text (STT), large language models (LLM), and text-to-speech (TTS). The platform enables dynamic tool creation with real-time voice interaction, intelligent data validation, and seamless integration with external APIs and databases.

## Features

### 🔐 Enterprise Authentication
- Beautiful, branded login interface
- JWT-based secure session management
- AES-256 credential encryption
- Session auto-expiration and renewal
- Audit logging and user tracking
- Demo credentials: `demo` / `demo123`

### 🤖 Multi-Provider AI Integration
- **STT Providers**: OpenAI Whisper, Azure Speech, Google Cloud Speech, Amazon Transcribe
- **LLM Providers**: OpenAI GPT, Azure OpenAI, Google Gemini, Amazon Bedrock, Anthropic Claude
- **TTS Providers**: OpenAI TTS, Azure Speech, Google Text-to-Speech, Amazon Polly
- Intelligent provider failover and load balancing
- Real-time voice processing with streaming support
- Advanced audio quality optimization

### 📊 Intelligent Dashboard
- Real-time analytics and performance metrics
- Voice session monitoring and history
- Tool usage statistics and success rates
- Data handoff success tracking
- Interactive charts and visualizations
- Quick access to frequently used tools

### 🛠️ Dynamic Tool Builder
- Drag-and-drop interface for tool creation
- 10+ field types (text, email, phone, date, number, select, etc.)
- Advanced validation rules and custom prompts
- Real-time field status tracking
- Tool templates and duplication
- Multi-language support for prompts

### 🔄 Enterprise Data Handoff
- **API Integration**: REST endpoints with full HTTP method support
- **Database Support**: PostgreSQL, MySQL/MariaDB, SQLite
- **Authentication**: Bearer tokens, Basic auth, API keys
- **Security**: Encrypted credentials and secure connections
- **Testing**: Pre-deployment configuration validation
- **Monitoring**: Real-time success/failure tracking with retry mechanisms
- **Analytics**: Performance metrics and detailed audit trails

### 🎤 Advanced Voice Interaction
- Real-time speech recognition with confidence scoring
- Intelligent conversation flow management
- Context-aware response generation
- Multi-language support
- Noise cancellation and audio enhancement
- Session persistence and recovery
- Voice biometric integration (planned)

## Tech Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: React Router DOM v6
- **Styling**: Custom CSS with CSS Variables, Responsive Design
- **Forms**: React Hook Form with validation
- **State**: React Context API with Hooks
- **UI Components**: Custom component library
- **Build**: Webpack 5 with Hot Module Replacement

### Backend
- **Runtime**: Node.js with Express.js
- **Database**: PostgreSQL with connection pooling
- **Authentication**: JWT with secure session management
- **Security**: Helmet, CORS, rate limiting, encryption
- **External DBs**: MySQL2, SQLite3 support
- **API**: RESTful endpoints with comprehensive error handling

### AI & Voice Processing
- **Multi-Provider Support**: OpenAI, Azure, Google, Amazon, Anthropic
- **Audio Processing**: Web Audio API, MediaRecorder
- **Real-time Streaming**: WebSocket connections for live transcription
- **Voice Enhancement**: Noise reduction and audio optimization

### Development & Deployment
- **Testing**: Jest, React Testing Library
- **Code Quality**: ESLint, Prettier, TypeScript strict mode
- **Package Management**: npm with security auditing
- **Development**: Nodemon, Concurrently for full-stack development

## Architecture

### Full-Stack Project Structure

```
healthcare-voice-agent/
├── src/                           # Frontend React Application
│   ├── components/                # React Components
│   │   ├── auth/                   # Authentication UI
│   │   ├── dashboard/              # Dashboard & Analytics
│   │   ├── providers/              # AI Provider Configuration
│   │   ├── tools/                  # Tool Builder & Management
│   │   ├── voice/                  # Voice Interaction Interface
│   │   ├── DataHandoffTestPanel.*  # Data Integration Testing
│   │   ├── DataHandoffStatsPanel.* # Integration Analytics
│   │   └── common/                 # Shared UI Components
│   ├── services/                  # Frontend Services
│   │   ├── AuthService.ts          # Authentication Management
│   │   ├── AIProviderService.ts    # Multi-AI Provider Integration
│   │   ├── VoiceInteractionService.ts # Voice Session Management
│   │   ├── VoiceRecordingService.ts   # Audio Processing
│   │   ├── VoiceSessionService.ts     # Session Persistence
│   │   ├── RealTimeDataHandoffService.ts # Data Integration
│   │   ├── EncryptionService.ts    # Client-side Encryption
│   │   └── StorageService.ts       # Secure Local Storage
│   ├── types/                     # TypeScript Definitions
│   ├── validations/               # Form & Data Validation
│   ├── styles/                    # Global CSS & Themes
│   └── utils/                     # Utility Functions
│
├── server/                        # Backend Node.js Application
│   ├── index.js                   # Express Server & API Routes
│   ├── services/                  # Backend Services
│   │   ├── DatabaseService.js      # Database Operations & Connection Pool
│   │   └── EncryptionService.js    # Server-side Encryption
│   └── migrations/                # Database Schema & Setup
│       └── migrate.js              # Database Migration Scripts
│
├── docs/                          # Documentation
│   └── DATA_HANDOFF_INTEGRATION.md # Data Integration Guide
│
├── package.json                   # Dependencies & Scripts
├── webpack.config.js              # Build Configuration
├── tsconfig.json                  # TypeScript Configuration
└── README.md                      # This File
```

## Getting Started

### Prerequisites

- **Node.js** 18+ (recommended) or 16+
- **npm** (comes with Node.js) or **yarn**
- **PostgreSQL** 12+ (for production database)
- **Git** (for version control)

### Quick Start

1. **Clone or extract the project**
   ```bash
   git clone <repository-url>
   cd healthcare-voice-agent
   ```

2. **Install all dependencies**
   ```bash
   npm install
   ```
   *This installs both frontend and backend dependencies including database drivers.*

3. **Set up the database**
   ```bash
   npm run db:migrate
   ```
   *Creates the PostgreSQL database schema and initial data.*

4. **Start the full-stack development environment**
   ```bash
   npm run dev:full
   ```
   *Starts both backend (port 3001) and frontend (port 3000) servers.*

5. **Access the application**
   - **Frontend**: http://localhost:3000
   - **Backend API**: http://localhost:3001/api/health

### Demo Login Credentials

- **Username**: `demo`
- **Password**: `demo123`

### Alternative Development Commands

```bash
# Start frontend only (requires backend running separately)
npm start

# Start backend only 
npm run server

# Start backend with auto-reload (development)
npm run dev:server

# Build frontend for production
npm run build

# Run tests
npm test

# Run linting
npm run lint

# Type checking
npm run type-check
```

## Configuration

### Environment Variables

Create a `.env` file in the root directory:

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

# AI Provider API Keys (Configure via UI - more secure)
# OPENAI_API_KEY=your-openai-key
# AZURE_API_KEY=your-azure-key  
# GOOGLE_API_KEY=your-google-key
# AWS_ACCESS_KEY_ID=your-aws-key
# AWS_SECRET_ACCESS_KEY=your-aws-secret
# ANTHROPIC_API_KEY=your-anthropic-key
```

### Database Setup

#### PostgreSQL (Recommended for Production)
```bash
# Install PostgreSQL (Ubuntu/Debian)
sudo apt update
sudo apt install postgresql postgresql-contrib

# Create database and user
sudo -u postgres psql
CREATE DATABASE healthcare_voice_agent;
CREATE USER your_db_user WITH ENCRYPTED PASSWORD 'your_db_password';
GRANT ALL PRIVILEGES ON DATABASE healthcare_voice_agent TO your_db_user;
\q
```

#### Windows PostgreSQL Setup
```cmd
# Download and install PostgreSQL from https://www.postgresql.org/download/windows/
# Use pgAdmin or psql to create the database and user
```

### AI Provider Configuration

**Recommended Approach**: Configure AI providers through the web interface for better security.

1. **Login to the application**
2. **Navigate to Providers**
3. **Add your AI provider credentials**
4. **Test connections before using**

### Security Features

- **AES-256 Encryption**: All sensitive data encrypted at rest and in transit
- **JWT Authentication**: Secure session management with automatic expiration
- **Rate Limiting**: API endpoints protected against abuse
- **CORS Protection**: Cross-origin requests properly configured
- **Helmet Security**: HTTP security headers automatically applied
- **Database Security**: Parameterized queries prevent SQL injection
- **Credential Encryption**: AI provider keys encrypted in database
- **Audit Logging**: All actions logged for compliance

## Development

### Available Scripts

```bash
# Full-Stack Development
npm run dev:full        # Start both frontend and backend with hot reload
npm run dev:server      # Start backend only with auto-reload (nodemon)

# Frontend Development  
npm start              # Start React development server (port 3000)
npm run build          # Build React app for production

# Backend Development
npm run server         # Start Express server (port 3001)

# Database Management
npm run db:migrate     # Run database migrations and setup

# Testing & Quality
npm test              # Run Jest test suite
npm run lint          # Run ESLint on all TypeScript files
npm run type-check    # Run TypeScript compiler (no emit)
```

### Development Workflow

1. **Start full development environment**:
   ```bash
   npm run dev:full
   ```

2. **Access development tools**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - Health Check: http://localhost:3001/api/health
   - Database Health: http://localhost:3001/api/health/db

3. **Hot reload** is enabled for both frontend and backend

### Code Standards

- **TypeScript**: Strict mode enabled for type safety
- **ESLint**: Code quality and consistency rules
- **Prettier**: Automatic code formatting (if configured)
- **CSS Modules**: Scoped styling with CSS variables
- **Conventional Commits**: Structured commit messages

### Adding New Features

#### Frontend Components
1. Create components in `src/components/[feature]/`
2. Add TypeScript interfaces in `src/types/index.ts`
3. Implement service logic in `src/services/`
4. Add CSS styling following existing patterns
5. Update routing if needed

#### Backend APIs
1. Add routes in `server/index.js`
2. Implement database operations in `server/services/DatabaseService.js`
3. Add authentication middleware if required
4. Include audit logging for sensitive operations

#### Database Changes
1. Update migration scripts in `server/migrations/migrate.js`
2. Add new table definitions and relationships
3. Update DatabaseService methods
4. Test migrations in development environment

### Testing Strategy

- **Unit Tests**: Components and services
- **Integration Tests**: API endpoints and database operations
- **E2E Tests**: Critical user workflows (planned)
- **Manual Testing**: AI provider integrations and voice interactions

## Deployment

### Production Deployment

#### Full-Stack Docker Deployment

**Frontend Dockerfile**:
```dockerfile
FROM node:18-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src ./src
COPY public ./public
COPY webpack.config.js tsconfig.json ./
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Backend Dockerfile**:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY server ./server
EXPOSE 3001
CMD ["node", "server/index.js"]
```

**Docker Compose**:
```yaml
version: '3.8'
services:
  frontend:
    build: .
    ports:
      - "80:80"
    depends_on:
      - backend
  
  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    ports:
      - "3001:3001"
    environment:
      - DB_HOST=postgres
      - NODE_ENV=production
    depends_on:
      - postgres
  
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: healthcare_voice_agent
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  postgres_data:
```

#### Cloud Deployment Options

**AWS Deployment**:
- **Frontend**: S3 + CloudFront + Route 53
- **Backend**: ECS Fargate or EC2 with Load Balancer
- **Database**: RDS PostgreSQL
- **AI Services**: Amazon Bedrock, Transcribe, Polly

**Azure Deployment**:
- **Frontend**: Static Web Apps or App Service
- **Backend**: Container Instances or App Service
- **Database**: Azure Database for PostgreSQL
- **AI Services**: Azure OpenAI, Speech Services

**Google Cloud Deployment**:
- **Frontend**: Firebase Hosting or Cloud Storage
- **Backend**: Cloud Run or Compute Engine
- **Database**: Cloud SQL for PostgreSQL
- **AI Services**: Vertex AI, Speech-to-Text, Text-to-Speech

### Environment-Specific Configuration

**Production Environment Variables**:
```env
NODE_ENV=production
DB_HOST=your-production-db-host
DB_SSL=true
JWT_SECRET=your-strong-production-secret
REDIS_URL=your-redis-cache-url
SENTRY_DSN=your-error-tracking-url
```

**Security Checklist for Production**:
- [ ] Change all default passwords and secrets
- [ ] Enable SSL/TLS certificates
- [ ] Configure firewall rules
- [ ] Set up database backups
- [ ] Enable monitoring and alerting
- [ ] Configure log aggregation
- [ ] Set up error tracking (Sentry recommended)
- [ ] Enable rate limiting and DDoS protection

## Integration Capabilities

### Healthcare System Integration

Seamlessly connect with existing healthcare infrastructure:

- **Electronic Health Records (EHR)**: Epic, Cerner, AllScripts, athenahealth
- **Practice Management Systems**: NextGen, eClinicalWorks, DrChrono
- **Claims Processing Systems**: ClearClaim, Availity, ClaimLogiq
- **Patient Registration Systems**: Custom portals and kiosks
- **CRM Systems**: Salesforce Health Cloud, Microsoft Dynamics
- **Telehealth Platforms**: Zoom Healthcare, Teladoc, Amwell

### Data Handoff & Integration

**Real-time Data Submission**:
- RESTful API integration with custom endpoints
- Direct database connectivity (PostgreSQL, MySQL, SQLite)
- Secure credential management and encryption
- Field mapping and data transformation
- Success/failure tracking with retry mechanisms

**Supported Data Formats**:
- **HL7 FHIR R4** (planned)
- **JSON** (native support)
- **XML** (with transformation)
- **CSV** exports and imports
- **Custom API payloads** with template support

**Configuration Testing**:
- Pre-deployment validation of API endpoints
- Database connection testing
- Auto-generated test data for validation
- Real-time monitoring and analytics

### API Documentation

**Backend API Endpoints**:
```
# Authentication
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me

# Provider Management
GET  /api/providers
POST /api/providers

# Tool Management
GET  /api/tools
POST /api/tools
PUT  /api/tools/:id
DELETE /api/tools/:id

# Voice Sessions
POST /api/voice-sessions
PUT  /api/voice-sessions/:id

# Data Handoff
POST /api/data-handoff/database
POST /api/data-handoff/test-database
POST /api/data-handoff/test-api

# Health & Monitoring
GET  /api/health
GET  /api/health/db
```

## Compliance & Security

### HIPAA Compliance Features

- **Data Encryption**: AES-256 encryption for data at rest and in transit
- **Access Controls**: JWT-based authentication with session management
- **Audit Logging**: Comprehensive logging of all data access and modifications
- **Secure Transmission**: TLS/SSL for all network communications
- **Data Minimization**: Only collect necessary data for specified purposes
- **User Training**: Built-in guidance for HIPAA-compliant usage

### Security Standards

- **OWASP Compliance**: Security best practices implementation
- **Rate Limiting**: Protection against abuse and DDoS attacks
- **Input Validation**: Comprehensive data sanitization and validation
- **Error Handling**: Secure error messages without information disclosure
- **Session Security**: Automatic session timeout and secure token handling
- **Database Security**: Parameterized queries and connection encryption

### Audit & Monitoring

- **Real-time Monitoring**: System health and performance metrics
- **Activity Logging**: User actions, data access, and system events
- **Integration Tracking**: Data handoff success/failure rates
- **Performance Analytics**: Response times and system utilization
- **Compliance Reports**: Automated reporting for regulatory requirements

## Key Features Summary

### ✅ **Recently Completed**
- **Data Handoff Integration**: Full API and database integration capabilities
- **Multi-Provider AI Support**: OpenAI, Azure, Google, Amazon, Anthropic
- **Real-time Voice Processing**: Streaming STT, LLM, and TTS
- **Enterprise Security**: AES-256 encryption, JWT auth, audit logging
- **Testing Framework**: Pre-deployment validation and monitoring
- **Full-Stack Architecture**: React frontend with Node.js backend
- **Multi-Database Support**: PostgreSQL, MySQL, SQLite connectivity

### 🚀 **Coming Soon**
- **FHIR Integration**: HL7 FHIR R4 support for healthcare interoperability
- **Voice Biometrics**: Speaker identification and verification
- **Advanced Analytics**: ML-powered insights and reporting
- **Mobile App**: React Native companion application
- **Multi-tenant Support**: Organization and user management
- **Webhook Integration**: Real-time event notifications

## Documentation

### Quick Links
- **[Data Handoff Integration Guide](docs/DATA_HANDOFF_INTEGRATION.md)** - Complete integration documentation
- **API Reference** - Backend endpoint documentation (in-app)
- **Component Library** - React component documentation (in development)
- **Deployment Guide** - Production setup instructions (above)

### Video Tutorials (Planned)
- Getting Started with Healthcare Voice Agent
- Setting Up AI Providers
- Creating Custom Voice Tools
- Configuring Data Handoff Integration
- Production Deployment Walkthrough

## Contributing

We welcome contributions from the healthcare and developer community!

### How to Contribute
1. **Fork the repository** on GitHub
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes** following our coding standards
4. **Add tests** for new functionality
5. **Update documentation** as needed
6. **Submit a pull request** with a clear description

### Contribution Areas
- **AI Provider Integration**: Add support for new AI services
- **Healthcare Integrations**: EHR, EMR, and other healthcare system connectors
- **UI/UX Improvements**: Enhanced user interface and experience
- **Testing**: Automated testing and quality assurance
- **Documentation**: Guides, tutorials, and API documentation
- **Security**: Security audits and vulnerability assessments

### Development Setup for Contributors
```bash
# Clone your fork
git clone https://github.com/your-username/healthcare-voice-agent.git
cd healthcare-voice-agent

# Install dependencies
npm install

# Set up development database
npm run db:migrate

# Start development environment
npm run dev:full

# Run tests
npm test

# Check code quality
npm run lint
npm run type-check
```

## License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

### Commercial Use
This software is free for commercial use in healthcare environments. We encourage healthcare organizations to deploy and customize the platform for their specific needs.

## Support & Community

### Getting Help
- 📚 **Documentation**: Check this README and the docs/ folder
- 🐛 **Bug Reports**: Create an issue with detailed reproduction steps
- 💡 **Feature Requests**: Open an issue with your enhancement ideas
- 💬 **Discussions**: Join our community discussions (link coming soon)
- 📧 **Email Support**: For enterprise inquiries and partnerships

### Community
- **Healthcare Developers**: Join our Slack workspace (invite coming soon)
- **LinkedIn**: Follow our updates and healthcare tech discussions
- **Twitter**: @HealthcareVoiceAgent (coming soon)
- **Blog**: Technical articles and healthcare AI insights (coming soon)

### Enterprise Support
For healthcare organizations requiring:
- Custom integration development
- HIPAA compliance consulting
- Training and implementation support
- Priority technical support
- Service level agreements (SLAs)

Contact us for enterprise support packages.

---

## Project Status

**Current Version**: 1.0.0 (Production Ready)
**Last Updated**: January 2025
**Active Development**: ✅ Yes
**Production Deployments**: Healthcare clinics and practices

### Roadmap
- **Q1 2025**: FHIR integration and mobile app
- **Q2 2025**: Advanced analytics and ML insights
- **Q3 2025**: Multi-tenant architecture
- **Q4 2025**: Voice biometrics and advanced security

---

<div align="center">

**🏥 Healthcare Voice Agent Platform**

*Empowering healthcare organizations with AI-powered voice technology*

**Built with ❤️ for the healthcare community**

[⭐ Star this project](https://github.com/your-repo/healthcare-voice-agent) | [🐛 Report Issues](https://github.com/your-repo/healthcare-voice-agent/issues) | [💡 Request Features](https://github.com/your-repo/healthcare-voice-agent/issues/new)

</div>
