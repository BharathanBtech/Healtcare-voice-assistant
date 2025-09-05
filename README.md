# Healthcare Voice Agent Platform

A configurable voice agent system for healthcare organizations that supports speech-to-text (STT), large language models (LLM), and text-to-speech (TTS). The platform allows dynamic tool creation with real-time voice interaction, validation, and data handoff to APIs or databases.

## Features

### 🔐 Authentication
- Beautiful login screen with branding support
- Secure credential handling with encryption
- Session management with automatic expiration
- Demo credentials: `demo` / `demo123`

### ⚙️ Provider Configuration
- Support for multiple STT providers (OpenAI, Azure, Google, Amazon)
- Support for multiple LLM providers (OpenAI, Azure, Google, Amazon, Anthropic)
- Support for multiple TTS providers (OpenAI, Azure, Google, Amazon)
- Dynamic credential input fields based on selected provider
- Secure, encrypted storage of API keys

### 📊 Dashboard
- Overview of created tools and statistics
- Quick action buttons for common tasks
- Real-time monitoring of voice sessions
- Summarization toggle for voice sessions

### 🛠️ Tool Creation
- Unlimited custom tools via intuitive interface
- Configurable fields with validation rules
- Client-side validation (regex, length, format)
- Server-side validation (database/API checks)
- Custom prompts for each field
- Real-time UI with field status tracking

### 🔄 Data Handoff
- Flexible data export options (API or Database)
- API configuration with custom headers and payload structure
- Database integration with multiple database types
- Field mapping and response viewing
- Testing capabilities for endpoints

### 🎤 Voice Interaction
- Real-time speech transcription
- Dynamic field tracking and value display
- Visual validation status indicators
- Error handling and retry prompts
- Session summarization

## Tech Stack

- **Frontend**: React 18, TypeScript, React Router
- **Styling**: Custom CSS with CSS variables for theming
- **Forms**: React Hook Form
- **State Management**: React Context API
- **Security**: CryptoJS for encryption
- **Build Tools**: Webpack, TypeScript Compiler
- **Development**: Hot reload, ESLint, Jest

## Architecture

```
src/
├── components/          # React components organized by feature
│   ├── auth/           # Authentication components
│   ├── dashboard/      # Dashboard and overview
│   ├── providers/      # Provider configuration
│   ├── tools/          # Tool creation and editing
│   ├── voice/          # Voice interaction interface
│   └── common/         # Shared UI components
├── services/           # Business logic and API services
│   ├── AuthService.ts  # Authentication management
│   ├── StorageService.ts # Local storage with encryption
│   └── EncryptionService.ts # Cryptographic operations
├── types/              # TypeScript type definitions
├── styles/             # Global CSS styles
├── utils/              # Utility functions
└── validations/        # Form and data validation
```

## Getting Started

### Prerequisites

- Node.js 16+ 
- npm or yarn

### Installation

1. Clone or extract the project
2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

4. Open your browser to http://localhost:3000

### Login

Use the demo credentials:
- **Username**: `demo`
- **Password**: `demo123`

### Building for Production

```bash
npm run build
```

## Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# API endpoints (if using external services)
REACT_APP_API_BASE_URL=https://your-api.com
REACT_APP_ENCRYPTION_KEY=your-encryption-key

# Provider API keys (for development only - use secure storage in production)
REACT_APP_OPENAI_API_KEY=your-openai-key
REACT_APP_AZURE_API_KEY=your-azure-key
```

### Security Notes

- All sensitive data is encrypted using CryptoJS
- Session tokens are automatically expired after 24 hours
- API keys are never stored in plain text
- Device fingerprinting for additional security

## Development

### Available Scripts

- `npm start` - Start development server
- `npm run build` - Build for production
- `npm run test` - Run test suite
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript compiler

### Code Style

The project uses:
- TypeScript for type safety
- ESLint for code quality
- Prettier for code formatting
- CSS custom properties for theming

### Adding New Features

1. Create components in appropriate feature folders
2. Add types to `src/types/index.ts`
3. Implement business logic in services
4. Update routing in `App.tsx`
5. Add appropriate styling

## Deployment

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### Static Hosting

After running `npm run build`, deploy the `dist/` folder to any static hosting service:
- Netlify
- Vercel
- AWS S3 + CloudFront
- Azure Static Web Apps

## API Integration

### Healthcare Systems

The platform is designed to integrate with:
- Electronic Health Records (EHR)
- Practice Management Systems
- Claims Processing Systems
- Patient Registration Systems

### Data Formats

Supports common healthcare data formats:
- HL7 FHIR
- JSON
- XML
- CSV exports

## Compliance

Built with healthcare compliance in mind:
- HIPAA considerations for data handling
- Audit logging capabilities
- Secure data transmission
- Role-based access control (planned)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For issues and questions:
- Create an issue in the repository
- Check the documentation
- Review the code comments

---

**Healthcare Voice Agent Platform** - Empowering healthcare with voice technology
