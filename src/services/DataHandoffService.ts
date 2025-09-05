import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { DataHandoffConfig, ApiResponse, Tool } from '@/types';
import { EncryptionService } from './EncryptionService';

export interface DatabaseConnection {
  type: 'mysql' | 'postgresql' | 'sqlite' | 'mssql' | 'mongodb';
  hostname: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  connectionString?: string;
}

export interface DatabaseTestResult {
  success: boolean;
  message: string;
  tables?: string[];
  columns?: Record<string, DatabaseColumn[]>;
}

export interface DatabaseColumn {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: any;
  maxLength?: number;
}

export interface APITestResult {
  success: boolean;
  message: string;
  statusCode?: number;
  responseTime?: number;
  responseData?: any;
  headers?: Record<string, string>;
}

export interface DataSubmissionResult {
  success: boolean;
  message: string;
  submissionId?: string;
  responseData?: any;
  errors?: string[];
}

export interface FieldMapping {
  toolFieldName: string;
  targetFieldName: string;
  dataTransformation?: {
    type: 'none' | 'uppercase' | 'lowercase' | 'format' | 'custom';
    format?: string;
    customFunction?: string;
  };
  required?: boolean;
  defaultValue?: any;
}

export class DataHandoffService {
  /**
   * Test API endpoint configuration
   */
  static async testAPIEndpoint(config: DataHandoffConfig): Promise<APITestResult> {
    if (!config.api) {
      return {
        success: false,
        message: 'API configuration is missing'
      };
    }

    const startTime = Date.now();
    
    try {
      // Prepare test payload
      const testPayload = this.generateTestPayload(config.api.payloadStructure);
      
      const axiosConfig: AxiosRequestConfig = {
        method: config.api.method,
        url: config.api.endpoint,
        headers: {
          'Content-Type': 'application/json',
          ...config.api.headers
        },
        timeout: 30000,
        validateStatus: (status) => status < 500 // Don't throw for 4xx errors
      };

      // Add payload for methods that support it
      if (['POST', 'PUT', 'PATCH'].includes(config.api.method)) {
        axiosConfig.data = testPayload;
      }

      const response: AxiosResponse = await axios(axiosConfig);
      const responseTime = Date.now() - startTime;

      return {
        success: response.status >= 200 && response.status < 300,
        message: response.status >= 200 && response.status < 300 
          ? 'API endpoint is working correctly'
          : `API returned status ${response.status}: ${response.statusText}`,
        statusCode: response.status,
        responseTime,
        responseData: response.data,
        headers: response.headers as Record<string, string>
      };

    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      if (error.code === 'ECONNABORTED') {
        return {
          success: false,
          message: 'API request timed out (30s)',
          responseTime
        };
      } else if (error.response) {
        return {
          success: false,
          message: `API error: ${error.response.status} ${error.response.statusText}`,
          statusCode: error.response.status,
          responseTime,
          responseData: error.response.data
        };
      } else if (error.request) {
        return {
          success: false,
          message: 'Cannot reach API endpoint - check URL and network connectivity',
          responseTime
        };
      } else {
        return {
          success: false,
          message: `Configuration error: ${error.message}`,
          responseTime
        };
      }
    }
  }

  /**
   * Generate test payload for API testing
   */
  private static generateTestPayload(payloadStructure: Record<string, any>): Record<string, any> {
    const testPayload: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(payloadStructure)) {
      if (typeof value === 'string') {
        // Replace placeholders with test data
        testPayload[key] = this.generateTestValue(value);
      } else if (typeof value === 'object' && value !== null) {
        testPayload[key] = this.generateTestPayload(value);
      } else {
        testPayload[key] = value;
      }
    }
    
    return testPayload;
  }

  /**
   * Generate test values based on field types or placeholders
   */
  private static generateTestValue(placeholder: string): any {
    const lowerPlaceholder = placeholder.toLowerCase();
    
    // Common test values based on field names/types
    if (lowerPlaceholder.includes('email')) {
      return 'test@example.com';
    } else if (lowerPlaceholder.includes('phone')) {
      return '+1-555-123-4567';
    } else if (lowerPlaceholder.includes('name')) {
      return 'John Doe';
    } else if (lowerPlaceholder.includes('date')) {
      return new Date().toISOString().split('T')[0];
    } else if (lowerPlaceholder.includes('id')) {
      return 'TEST_' + Math.random().toString(36).substr(2, 9).toUpperCase();
    } else if (lowerPlaceholder.includes('amount') || lowerPlaceholder.includes('price')) {
      return 99.99;
    } else if (lowerPlaceholder.includes('age')) {
      return 30;
    } else if (lowerPlaceholder.includes('zip') || lowerPlaceholder.includes('postal')) {
      return '12345';
    } else {
      return 'Test Value';
    }
  }

  /**
   * Test database connection
   */
  static async testDatabaseConnection(config: DataHandoffConfig): Promise<DatabaseTestResult> {
    if (!config.database) {
      return {
        success: false,
        message: 'Database configuration is missing'
      };
    }

    try {
      // Note: In a real implementation, you would use actual database drivers
      // For this demo, we'll simulate the connection test
      
      const dbConfig = config.database;
      
      // Basic validation
      if (!dbConfig.hostname || !dbConfig.database) {
        return {
          success: false,
          message: 'Database hostname and database name are required'
        };
      }

      // Simulate connection test based on database type
      const connectionResult = await this.simulateDatabaseConnection(dbConfig);
      
      if (connectionResult.success) {
        // Simulate getting table information
        const tableInfo = await this.simulateTableInformation(dbConfig);
        
        return {
          success: true,
          message: `Successfully connected to ${dbConfig.type} database`,
          tables: tableInfo.tables,
          columns: tableInfo.columns
        };
      } else {
        return connectionResult;
      }

    } catch (error: any) {
      return {
        success: false,
        message: `Database connection error: ${error.message}`
      };
    }
  }

  /**
   * Simulate database connection (in real implementation, use actual drivers)
   */
  private static async simulateDatabaseConnection(config: any): Promise<DatabaseTestResult> {
    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Basic validation checks
    const commonPorts = {
      mysql: 3306,
      postgresql: 5432,
      mssql: 1433,
      mongodb: 27017
    };

    // Simulate connection success based on common configurations
    if (config.hostname === 'localhost' || config.hostname.includes('127.0.0.1')) {
      return {
        success: true,
        message: 'Connection successful'
      };
    } else if (!config.username || !config.password) {
      return {
        success: false,
        message: 'Database username and password are required for remote connections'
      };
    } else {
      // For demo purposes, assume external connections work
      return {
        success: true,
        message: 'Connection successful'
      };
    }
  }

  /**
   * Simulate getting table and column information
   */
  private static async simulateTableInformation(config: any): Promise<{
    tables: string[];
    columns: Record<string, DatabaseColumn[]>;
  }> {
    // Simulate common healthcare database tables
    const tables = [
      'patients',
      'appointments', 
      'claims',
      'medical_records',
      'insurance_policies',
      'providers',
      'billing'
    ];

    const columns: Record<string, DatabaseColumn[]> = {
      patients: [
        { name: 'id', type: 'INTEGER', nullable: false },
        { name: 'first_name', type: 'VARCHAR', nullable: false, maxLength: 50 },
        { name: 'last_name', type: 'VARCHAR', nullable: false, maxLength: 50 },
        { name: 'date_of_birth', type: 'DATE', nullable: false },
        { name: 'phone_number', type: 'VARCHAR', nullable: true, maxLength: 20 },
        { name: 'email', type: 'VARCHAR', nullable: true, maxLength: 100 },
        { name: 'insurance_id', type: 'VARCHAR', nullable: true, maxLength: 50 },
        { name: 'created_at', type: 'TIMESTAMP', nullable: false, defaultValue: 'CURRENT_TIMESTAMP' }
      ],
      appointments: [
        { name: 'id', type: 'INTEGER', nullable: false },
        { name: 'patient_id', type: 'INTEGER', nullable: false },
        { name: 'appointment_type', type: 'VARCHAR', nullable: false, maxLength: 100 },
        { name: 'appointment_date', type: 'DATETIME', nullable: false },
        { name: 'reason', type: 'TEXT', nullable: true },
        { name: 'status', type: 'VARCHAR', nullable: false, maxLength: 20, defaultValue: 'scheduled' }
      ],
      claims: [
        { name: 'id', type: 'INTEGER', nullable: false },
        { name: 'claimant_name', type: 'VARCHAR', nullable: false, maxLength: 100 },
        { name: 'policy_number', type: 'VARCHAR', nullable: false, maxLength: 50 },
        { name: 'incident_date', type: 'DATE', nullable: false },
        { name: 'service_provider', type: 'VARCHAR', nullable: false, maxLength: 200 },
        { name: 'total_amount', type: 'DECIMAL', nullable: false },
        { name: 'status', type: 'VARCHAR', nullable: false, maxLength: 20, defaultValue: 'pending' }
      ]
    };

    return { tables, columns };
  }

  /**
   * Submit data using the configured handoff method
   */
  static async submitData(
    config: DataHandoffConfig,
    data: Record<string, any>,
    fieldMappings?: FieldMapping[]
  ): Promise<DataSubmissionResult> {
    try {
      // Apply field mappings and transformations
      const transformedData = this.transformData(data, fieldMappings);
      
      if (config.type === 'api' && config.api) {
        return await this.submitToAPI(config.api, transformedData);
      } else if (config.type === 'database' && config.database) {
        return await this.submitToDatabase(config.database, transformedData);
      } else {
        return {
          success: false,
          message: 'Invalid data handoff configuration'
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: `Data submission error: ${error.message}`
      };
    }
  }

  /**
   * Transform data based on field mappings
   */
  private static transformData(
    data: Record<string, any>,
    fieldMappings?: FieldMapping[]
  ): Record<string, any> {
    if (!fieldMappings || fieldMappings.length === 0) {
      return data;
    }

    const transformedData: Record<string, any> = {};

    for (const mapping of fieldMappings) {
      let value = data[mapping.toolFieldName];

      // Use default value if field is missing and default is provided
      if ((value === undefined || value === null) && mapping.defaultValue !== undefined) {
        value = mapping.defaultValue;
      }

      // Skip if required field is missing
      if (mapping.required && (value === undefined || value === null || value === '')) {
        continue;
      }

      // Apply transformations
      if (value !== undefined && value !== null && mapping.dataTransformation) {
        value = this.applyTransformation(value, mapping.dataTransformation);
      }

      transformedData[mapping.targetFieldName] = value;
    }

    return transformedData;
  }

  /**
   * Apply data transformation based on type
   */
  private static applyTransformation(value: any, transformation: any): any {
    const stringValue = String(value);

    switch (transformation.type) {
      case 'uppercase':
        return stringValue.toUpperCase();
      case 'lowercase':
        return stringValue.toLowerCase();
      case 'format':
        if (transformation.format) {
          // Simple format replacement (could be expanded)
          return transformation.format.replace('{value}', stringValue);
        }
        return value;
      case 'custom':
        if (transformation.customFunction) {
          try {
            // In a real implementation, you'd have a safe way to execute custom functions
            // For now, we'll just return the original value
            return value;
          } catch (error) {
            return value;
          }
        }
        return value;
      case 'none':
      default:
        return value;
    }
  }

  /**
   * Submit data to API endpoint
   */
  private static async submitToAPI(
    apiConfig: any,
    data: Record<string, any>
  ): Promise<DataSubmissionResult> {
    try {
      const response = await axios({
        method: apiConfig.method,
        url: apiConfig.endpoint,
        data: data,
        headers: {
          'Content-Type': 'application/json',
          ...apiConfig.headers
        },
        timeout: 30000
      });

      // Generate a submission ID from response or create one
      const submissionId = response.data?.id || 
                          response.data?.submissionId || 
                          'SUB_' + Date.now();

      return {
        success: true,
        message: 'Data submitted successfully to API',
        submissionId,
        responseData: response.data
      };

    } catch (error: any) {
      if (error.response) {
        return {
          success: false,
          message: `API submission failed: ${error.response.status} ${error.response.statusText}`,
          responseData: error.response.data
        };
      } else {
        return {
          success: false,
          message: `API submission error: ${error.message}`
        };
      }
    }
  }

  /**
   * Submit data to database
   */
  private static async submitToDatabase(
    dbConfig: any,
    data: Record<string, any>
  ): Promise<DataSubmissionResult> {
    try {
      // In a real implementation, this would use actual database drivers
      // For demo purposes, we'll simulate the database insertion
      
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate DB operation
      
      const submissionId = 'DB_' + Date.now();
      
      return {
        success: true,
        message: `Data inserted successfully into ${dbConfig.table} table`,
        submissionId,
        responseData: {
          table: dbConfig.table,
          insertedData: data,
          insertId: submissionId
        }
      };

    } catch (error: any) {
      return {
        success: false,
        message: `Database submission error: ${error.message}`
      };
    }
  }

  /**
   * Generate field mappings based on tool fields and target schema
   */
  static generateFieldMappings(
    toolFields: string[],
    targetFields: string[]
  ): FieldMapping[] {
    const mappings: FieldMapping[] = [];

    for (const toolField of toolFields) {
      // Try to find a matching target field
      const matchingTarget = this.findMatchingField(toolField, targetFields);
      
      mappings.push({
        toolFieldName: toolField,
        targetFieldName: matchingTarget || toolField,
        dataTransformation: {
          type: 'none'
        },
        required: true
      });
    }

    return mappings;
  }

  /**
   * Find matching field name using fuzzy matching
   */
  private static findMatchingField(toolField: string, targetFields: string[]): string | null {
    const normalizedToolField = toolField.toLowerCase().replace(/[_\s]/g, '');
    
    // Direct match
    for (const targetField of targetFields) {
      if (targetField.toLowerCase() === toolField.toLowerCase()) {
        return targetField;
      }
    }

    // Fuzzy match
    for (const targetField of targetFields) {
      const normalizedTarget = targetField.toLowerCase().replace(/[_\s]/g, '');
      
      if (normalizedTarget.includes(normalizedToolField) || 
          normalizedToolField.includes(normalizedTarget)) {
        return targetField;
      }
    }

    // Common field name mappings
    const commonMappings: Record<string, string[]> = {
      firstname: ['first_name', 'fname', 'given_name'],
      lastname: ['last_name', 'lname', 'surname', 'family_name'],
      email: ['email_address', 'email_addr', 'e_mail'],
      phone: ['phone_number', 'telephone', 'mobile', 'contact_number'],
      dob: ['date_of_birth', 'birth_date', 'birthdate'],
      ssn: ['social_security_number', 'social_security', 'tax_id']
    };

    for (const [key, variations] of Object.entries(commonMappings)) {
      if (normalizedToolField.includes(key)) {
        for (const variation of variations) {
          const matchingTarget = targetFields.find(f => 
            f.toLowerCase().replace(/[_\s]/g, '') === variation.replace(/[_\s]/g, '')
          );
          if (matchingTarget) {
            return matchingTarget;
          }
        }
      }
    }

    return null;
  }

  /**
   * Validate field mapping configuration
   */
  static validateFieldMappings(
    mappings: FieldMapping[],
    toolFields: string[],
    targetFields: string[]
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for duplicate target fields
    const targetFieldCounts: Record<string, number> = {};
    mappings.forEach(mapping => {
      targetFieldCounts[mapping.targetFieldName] = 
        (targetFieldCounts[mapping.targetFieldName] || 0) + 1;
    });

    Object.entries(targetFieldCounts).forEach(([field, count]) => {
      if (count > 1) {
        errors.push(`Target field '${field}' is mapped to multiple tool fields`);
      }
    });

    // Check for invalid tool fields
    mappings.forEach(mapping => {
      if (!toolFields.includes(mapping.toolFieldName)) {
        errors.push(`Tool field '${mapping.toolFieldName}' does not exist`);
      }
    });

    // Check for invalid target fields
    mappings.forEach(mapping => {
      if (!targetFields.includes(mapping.targetFieldName)) {
        errors.push(`Target field '${mapping.targetFieldName}' does not exist`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get supported database types
   */
  static getSupportedDatabaseTypes(): Array<{ value: string; label: string; port: number }> {
    return [
      { value: 'mysql', label: 'MySQL', port: 3306 },
      { value: 'postgresql', label: 'PostgreSQL', port: 5432 },
      { value: 'mssql', label: 'Microsoft SQL Server', port: 1433 },
      { value: 'sqlite', label: 'SQLite', port: 0 },
      { value: 'mongodb', label: 'MongoDB', port: 27017 }
    ];
  }

  /**
   * Get common HTTP methods for APIs
   */
  static getHttpMethods(): Array<{ value: string; label: string }> {
    return [
      { value: 'POST', label: 'POST - Create new record' },
      { value: 'PUT', label: 'PUT - Update entire record' },
      { value: 'PATCH', label: 'PATCH - Update specific fields' },
      { value: 'GET', label: 'GET - Retrieve data (query parameters)' }
    ];
  }

  /**
   * Get common data transformation types
   */
  static getTransformationTypes(): Array<{ value: string; label: string }> {
    return [
      { value: 'none', label: 'No transformation' },
      { value: 'uppercase', label: 'Convert to uppercase' },
      { value: 'lowercase', label: 'Convert to lowercase' },
      { value: 'format', label: 'Apply custom format' },
      { value: 'custom', label: 'Custom function (advanced)' }
    ];
  }

  /**
   * Export data handoff configuration as JSON
   */
  static exportConfiguration(config: DataHandoffConfig): string {
    const exportData = {
      config,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };
    
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import data handoff configuration from JSON
   */
  static importConfiguration(jsonData: string): DataHandoffConfig | null {
    try {
      const importData = JSON.parse(jsonData);
      
      if (!importData.config) {
        throw new Error('Invalid configuration data');
      }
      
      return importData.config;
    } catch (error) {
      console.error('Error importing configuration:', error);
      return null;
    }
  }
}
