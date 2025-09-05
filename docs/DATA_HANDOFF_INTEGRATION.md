# Data Handoff Integration

The Data Handoff Integration feature allows voice sessions to automatically submit collected data to external systems such as APIs or databases. This enables seamless integration with existing healthcare systems, CRMs, EMRs, and other data management platforms.

## Overview

The Data Handoff system consists of several components:

1. **RealTimeDataHandoffService** - Core service for executing data handoffs
2. **DataHandoffTestPanel** - React component for testing configurations
3. **DataHandoffStatsPanel** - React component for viewing statistics and history
4. **Backend API Endpoints** - Server-side handling of database connections
5. **Database Support** - Multi-database support for PostgreSQL, MySQL, and SQLite

## Features

### ✅ API Integration
- Support for REST API endpoints
- Multiple HTTP methods (GET, POST, PUT, DELETE)
- Custom headers and authentication
- Bearer token, Basic auth, and API key authentication
- Payload transformation and field mapping
- Response validation and error handling

### ✅ Database Integration  
- Support for PostgreSQL, MySQL/MariaDB, and SQLite databases
- Secure credential encryption
- Connection testing and validation
- Dynamic table insertion with field mapping
- Transaction support and rollback on errors
- Connection pooling and timeout handling

### ✅ Configuration Testing
- Test configurations before going live
- Auto-generated test data based on field types
- Custom test data input
- Real-time validation and response analysis
- Connection health checks

### ✅ Statistics & Monitoring
- Success/failure rates tracking
- Response time monitoring
- Attempt history with detailed logs
- Retry mechanisms for failed submissions
- Audit trail with session tracking

## Configuration

### API Configuration

```typescript
interface APIConfig {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  authentication?: {
    type: 'bearer' | 'basic' | 'api-key';
    credentials: Record<string, string>;
  };
  payloadStructure: Record<string, any>;
}
```

### Database Configuration

```typescript
interface DatabaseConfig {
  type: 'postgresql' | 'mysql' | 'sqlite';
  hostname: string;
  port: number;
  database: string;
  username: string;
  password: string;
  table: string;
  fieldMapping: Record<string, string>;
  ssl?: boolean;
}
```

## Usage Examples

### Setting up API Integration

1. **Configure API Endpoint**
   ```typescript
   const apiConfig: APIConfig = {
     endpoint: 'https://api.example.com/patients',
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'X-API-Version': '1.0'
     },
     authentication: {
       type: 'bearer',
       credentials: {
         token: 'your-api-token-here'
       }
     },
     payloadStructure: {
       patient_name: '{{fullName}}',
       email: '{{email}}',
       phone: '{{phoneNumber}}',
       appointment_date: '{{appointmentDate}}',
       notes: '{{additionalNotes}}',
       created_at: '{{timestamp}}'
     }
   };
   ```

2. **Test Configuration**
   ```typescript
   const testResult = await RealTimeDataHandoffService.testHandoffConfiguration(tool);
   console.log('API Test Result:', testResult);
   ```

### Setting up Database Integration

1. **Configure Database Connection**
   ```typescript
   const dbConfig: DatabaseConfig = {
     type: 'postgresql',
     hostname: 'localhost',
     port: 5432,
     database: 'healthcare_db',
     username: 'app_user',
     password: 'encrypted_password',
     table: 'patient_data',
     fieldMapping: {
       'fullName': 'patient_name',
       'email': 'email_address', 
       'phoneNumber': 'phone',
       'appointmentDate': 'appointment_date',
       'additionalNotes': 'notes'
     }
   };
   ```

2. **Execute Handoff**
   ```typescript
   const handoffResult = await RealTimeDataHandoffService.executeHandoff(
     session,
     tool,
     collectedData
   );
   
   if (handoffResult.success) {
     console.log('Data submitted successfully:', handoffResult.submissionId);
   } else {
     console.error('Handoff failed:', handoffResult.message);
   }
   ```

## React Components

### DataHandoffTestPanel

Test your data handoff configurations before going live:

```tsx
import { DataHandoffTestPanel } from '@/components/DataHandoffTestPanel';

<DataHandoffTestPanel
  tool={selectedTool}
  onTestResult={(result) => {
    if (result.success) {
      toast.success('Configuration test successful!');
    } else {
      toast.error(`Test failed: ${result.message}`);
    }
  }}
/>
```

### DataHandoffStatsPanel

Monitor handoff performance and view attempt history:

```tsx
import { DataHandoffStatsPanel } from '@/components/DataHandoffStatsPanel';

// Show global stats
<DataHandoffStatsPanel />

// Show stats for specific session
<DataHandoffStatsPanel sessionId="session_123" />

// Show stats for specific tool
<DataHandoffStatsPanel toolId="tool_456" />
```

## Backend API Endpoints

### Database Handoff
```
POST /api/data-handoff/database
```

Submit data to an external database:

```json
{
  "dbConfig": {
    "type": "postgresql",
    "hostname": "localhost",
    "port": 5432,
    "database": "healthcare_db",
    "username": "app_user",
    "password": "encrypted_password",
    "table": "patients"
  },
  "data": {
    "patient_name": "John Doe",
    "email": "john@example.com",
    "phone": "+1-555-123-4567"
  }
}
```

### Database Connection Test
```
POST /api/data-handoff/test-database
```

Test database connectivity and table existence:

```json
{
  "dbConfig": {
    "type": "postgresql",
    "hostname": "localhost",
    "port": 5432,
    "database": "healthcare_db",
    "username": "app_user",
    "password": "encrypted_password",
    "table": "patients"
  },
  "testOnly": true
}
```

## Security Features

### Credential Encryption
All database passwords and API tokens are encrypted using AES-256 encryption before storage:

```typescript
// Passwords are automatically encrypted
const encryptedPassword = EncryptionService.encrypt(plainTextPassword);

// And decrypted when needed
const decryptedPassword = EncryptionService.decrypt(encryptedPassword);
```

### Secure Connection Handling
- Database connections are closed after each operation
- Connection timeouts prevent hanging connections
- SSL support for secure database connections
- API requests include security headers

## Error Handling & Retry Logic

### Automatic Retry
Failed handoff attempts can be automatically retried:

```typescript
const retryResult = await RealTimeDataHandoffService.retryHandoff(attemptId);
```

### Error Categories
1. **Network Errors** - Connection timeouts, DNS failures
2. **Authentication Errors** - Invalid credentials, expired tokens
3. **Configuration Errors** - Invalid endpoints, missing required fields
4. **Data Validation Errors** - Malformed data, constraint violations

### Fallback Strategies
- Multiple database connection attempts
- Graceful degradation when external systems are unavailable
- Data queuing for offline scenarios (future enhancement)

## Monitoring & Analytics

### Statistics Tracked
- Total handoff attempts
- Success/failure rates
- Average response times
- Error categorization
- Usage patterns by tool/session

### Audit Trail
Every handoff attempt is logged with:
- Session ID and Tool ID
- Timestamp and user information
- Configuration used
- Data submitted (sanitized)
- Response received
- Error details (if any)

## Performance Optimization

### Connection Pooling
Database connections are managed efficiently:
- Connection reuse for multiple operations
- Automatic cleanup of idle connections
- Timeout configuration for different database types

### Payload Optimization
- Data transformation happens client-side when possible
- Minimal payload sizes for API calls
- Compressed data transmission for large payloads

## Troubleshooting

### Common Issues

1. **Database Connection Failures**
   ```
   Solution: Verify hostname, port, credentials, and network connectivity
   Test using the database connection test endpoint
   ```

2. **API Authentication Errors**
   ```
   Solution: Verify API tokens are current and have required permissions
   Check authentication type matches API requirements
   ```

3. **Data Mapping Issues**
   ```
   Solution: Verify field mapping configuration
   Use test panel to validate data transformation
   ```

4. **Network Timeouts**
   ```
   Solution: Increase timeout values or check network stability
   Verify external system availability
   ```

### Debug Mode
Enable detailed logging for troubleshooting:

```typescript
// Set environment variable for debug logging
process.env.DEBUG_DATA_HANDOFF = 'true';
```

## Database Setup

### Required Packages
The following npm packages are required for database support:

```bash
npm install mysql2@^3.6.5 sqlite3@^5.1.6
```

PostgreSQL support uses the existing `pg` package.

### Database Schema Examples

#### PostgreSQL
```sql
CREATE TABLE patient_data (
    id SERIAL PRIMARY KEY,
    patient_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    appointment_date DATE,
    notes TEXT,
    submission_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source VARCHAR(50) DEFAULT 'voice_agent'
);
```

#### MySQL
```sql
CREATE TABLE patient_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    appointment_date DATE,
    notes TEXT,
    submission_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source VARCHAR(50) DEFAULT 'voice_agent'
);
```

#### SQLite
```sql
CREATE TABLE patient_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    appointment_date TEXT,
    notes TEXT,
    submission_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    source TEXT DEFAULT 'voice_agent'
);
```

## Future Enhancements

### Planned Features
- [ ] Webhook support for real-time notifications
- [ ] Batch data submission for multiple records
- [ ] Data transformation rules engine
- [ ] Custom authentication plugins
- [ ] Data encryption in transit and at rest
- [ ] Integration with popular EMR systems
- [ ] Real-time dashboard for monitoring
- [ ] Alert system for failed submissions

### Integration Roadmap
- [ ] FHIR (Fast Healthcare Interoperability Resources) support
- [ ] HL7 message formatting
- [ ] Salesforce Health Cloud integration
- [ ] Epic MyChart API integration
- [ ] Cerner PowerChart integration

## Contributing

When contributing to the Data Handoff Integration:

1. **Testing Requirements**
   - Add unit tests for new database types
   - Include integration tests for API endpoints
   - Test error handling scenarios

2. **Security Considerations**
   - Never log sensitive data (passwords, tokens)
   - Validate all input data
   - Use parameterized queries for database operations

3. **Documentation**
   - Update this README for new features
   - Add inline code documentation
   - Include usage examples

## License

This feature is part of the Healthcare Voice Agent platform and follows the same MIT license terms.

---

For additional support or questions about Data Handoff Integration, please refer to the main project documentation or create an issue in the project repository.
