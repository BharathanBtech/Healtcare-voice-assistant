import axios from 'axios';
import { DataHandoffConfig, APIConfig, DatabaseConfig, Tool, VoiceSession, ApiResponse } from '@/types';
import { VoiceSessionService } from './VoiceSessionService';
import { EncryptionService } from './EncryptionService';

export interface DataHandoffResult {
  success: boolean;
  message: string;
  submissionId?: string;
  responseData?: any;
  errors?: string[];
  transmissionTime?: number;
  retryCount?: number;
}

export interface DataHandoffAttempt {
  id: string;
  sessionId: string;
  toolId: string;
  handoffConfig: DataHandoffConfig;
  attemptTime: Date;
  result: DataHandoffResult;
  finalData: Record<string, any>;
}

export class RealTimeDataHandoffService {
  private static handoffAttempts: Map<string, DataHandoffAttempt> = new Map();

  /**
   * Execute data handoff for a completed voice session
   */
  static async executeHandoff(
    session: VoiceSession,
    tool: Tool,
    finalData: Record<string, any>
  ): Promise<DataHandoffResult> {
    const startTime = Date.now();
    
    if (!tool.dataHandoff) {
      return {
        success: true,
        message: 'No data handoff configured for this tool'
      };
    }

    const attemptId = this.generateAttemptId();
    const attempt: DataHandoffAttempt = {
      id: attemptId,
      sessionId: session.id,
      toolId: tool.id,
      handoffConfig: tool.dataHandoff,
      attemptTime: new Date(),
      result: { success: false, message: 'In progress' },
      finalData
    };

    this.handoffAttempts.set(attemptId, attempt);

    try {
      let result: DataHandoffResult;

      switch (tool.dataHandoff.type) {
        case 'api':
          result = await this.executeAPIHandoff(tool.dataHandoff.api!, finalData);
          break;
        case 'database':
          result = await this.executeDatabaseHandoff(tool.dataHandoff.database!, finalData);
          break;
        default:
          result = {
            success: false,
            message: `Unsupported handoff type: ${tool.dataHandoff.type}`
          };
      }

      result.transmissionTime = Date.now() - startTime;
      attempt.result = result;

      // Log the handoff attempt to voice session
      await this.logHandoffAttempt(session.id, attempt);

      return result;
    } catch (error: any) {
      const result: DataHandoffResult = {
        success: false,
        message: `Data handoff failed: ${error.message}`,
        errors: [error.message],
        transmissionTime: Date.now() - startTime
      };

      attempt.result = result;
      await this.logHandoffAttempt(session.id, attempt);

      return result;
    }
  }

  /**
   * Execute API-based data handoff
   */
  private static async executeAPIHandoff(
    apiConfig: APIConfig,
    data: Record<string, any>
  ): Promise<DataHandoffResult> {
    try {
      // Transform data according to payload structure
      const transformedData = this.transformDataForAPI(data, apiConfig.payloadStructure);

      // Prepare headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...apiConfig.headers
      };

      // Add authentication if configured
      if (apiConfig.authentication) {
        this.addAuthentication(headers, apiConfig.authentication);
      }

      // Make API request
      const response = await axios({
        method: apiConfig.method,
        url: apiConfig.endpoint,
        data: transformedData,
        headers,
        timeout: 30000,
        validateStatus: (status) => status >= 200 && status < 300
      });

      // Generate submission ID from response
      const submissionId = this.extractSubmissionId(response.data) || 
                          `API_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

      return {
        success: true,
        message: 'Data successfully submitted to API',
        submissionId,
        responseData: response.data
      };
    } catch (error: any) {
      if (error.response) {
        return {
          success: false,
          message: `API error: ${error.response.status} ${error.response.statusText}`,
          responseData: error.response.data,
          errors: [error.response.statusText]
        };
      } else if (error.request) {
        return {
          success: false,
          message: 'Network error: Unable to reach API endpoint',
          errors: ['Network connectivity issue']
        };
      } else {
        return {
          success: false,
          message: `Configuration error: ${error.message}`,
          errors: [error.message]
        };
      }
    }
  }

  /**
   * Execute database-based data handoff
   */
  private static async executeDatabaseHandoff(
    dbConfig: DatabaseConfig,
    data: Record<string, any>
  ): Promise<DataHandoffResult> {
    try {
      // Transform data according to field mapping
      const mappedData = this.transformDataForDatabase(data, dbConfig.fieldMapping);

      // Create database connection payload for our backend
      const dbHandoffPayload = {
        dbConfig: {
          type: dbConfig.type,
          hostname: dbConfig.hostname,
          port: dbConfig.port,
          database: dbConfig.database,
          username: dbConfig.username,
          password: EncryptionService.encrypt(dbConfig.password), // Encrypt password
          table: dbConfig.table
        },
        data: mappedData
      };

      // Send to our backend for database insertion
      const response = await axios.post('http://localhost:3001/api/data-handoff/database', 
        dbHandoffPayload, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const submissionId = response.data.insertId || 
                          `DB_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

      return {
        success: true,
        message: `Data successfully inserted into ${dbConfig.table} table`,
        submissionId,
        responseData: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Database handoff failed: ${error.message}`,
        errors: [error.message]
      };
    }
  }

  /**
   * Transform data for API submission based on payload structure
   */
  private static transformDataForAPI(
    data: Record<string, any>,
    payloadStructure: Record<string, any>
  ): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, template] of Object.entries(payloadStructure)) {
      if (typeof template === 'string') {
        // Replace placeholders with actual data
        result[key] = this.replacePlaceholders(template, data);
      } else if (typeof template === 'object' && template !== null) {
        result[key] = this.transformDataForAPI(data, template);
      } else {
        result[key] = template;
      }
    }

    return result;
  }

  /**
   * Transform data for database insertion based on field mapping
   */
  private static transformDataForDatabase(
    data: Record<string, any>,
    fieldMapping: Record<string, string>
  ): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [toolFieldName, dbFieldName] of Object.entries(fieldMapping)) {
      if (data.hasOwnProperty(toolFieldName)) {
        result[dbFieldName] = data[toolFieldName];
      }
    }

    // Add metadata
    result.submission_timestamp = new Date().toISOString();
    result.source = 'voice_agent';

    return result;
  }

  /**
   * Replace placeholders in templates with actual data
   */
  private static replacePlaceholders(template: string, data: Record<string, any>): any {
    // Handle direct field references like {{fieldName}}
    let result = template.replace(/\{\{([^}]+)\}\}/g, (match, fieldName) => {
      return data[fieldName] || match;
    });

    // Handle special placeholders
    result = result.replace('{{timestamp}}', new Date().toISOString());
    result = result.replace('{{date}}', new Date().toISOString().split('T')[0]);
    result = result.replace('{{sessionId}}', data._sessionId || '');

    // Try to parse as number if it looks like one
    const numValue = parseFloat(result);
    if (!isNaN(numValue) && isFinite(numValue)) {
      return numValue;
    }

    // Try to parse as boolean
    if (result.toLowerCase() === 'true') return true;
    if (result.toLowerCase() === 'false') return false;

    return result;
  }

  /**
   * Add authentication to headers
   */
  private static addAuthentication(
    headers: Record<string, string>,
    auth: { type: 'bearer' | 'basic' | 'api-key'; credentials: Record<string, string> }
  ): void {
    switch (auth.type) {
      case 'bearer':
        headers['Authorization'] = `Bearer ${auth.credentials.token}`;
        break;
      case 'basic':
        const basicAuth = Buffer.from(`${auth.credentials.username}:${auth.credentials.password}`).toString('base64');
        headers['Authorization'] = `Basic ${basicAuth}`;
        break;
      case 'api-key':
        headers[auth.credentials.header || 'X-API-Key'] = auth.credentials.key;
        break;
    }
  }

  /**
   * Extract submission ID from API response
   */
  private static extractSubmissionId(responseData: any): string | null {
    if (!responseData) return null;

    // Common field names for submission/record IDs
    const idFields = ['id', 'recordId', 'submissionId', 'transactionId', 'referenceId'];
    
    for (const field of idFields) {
      if (responseData[field]) {
        return String(responseData[field]);
      }
    }

    return null;
  }

  /**
   * Log handoff attempt to voice session
   */
  private static async logHandoffAttempt(
    sessionId: string,
    attempt: DataHandoffAttempt
  ): Promise<void> {
    try {
      await VoiceSessionService.addTranscriptEntry(sessionId, {
        speaker: 'system',
        text: `Data handoff ${attempt.result.success ? 'successful' : 'failed'}: ${attempt.result.message}`
      });
    } catch (error) {
      console.error('Failed to log handoff attempt:', error);
    }
  }

  /**
   * Test data handoff configuration without submitting real data
   */
  static async testHandoffConfiguration(
    tool: Tool,
    testData?: Record<string, any>
  ): Promise<DataHandoffResult> {
    if (!tool.dataHandoff) {
      return {
        success: false,
        message: 'No data handoff configuration found'
      };
    }

    // Generate test data if not provided
    const data = testData || this.generateTestData(tool);

    switch (tool.dataHandoff.type) {
      case 'api':
        return await this.testAPIHandoff(tool.dataHandoff.api!, data);
      case 'database':
        return await this.testDatabaseHandoff(tool.dataHandoff.database!, data);
      default:
        return {
          success: false,
          message: `Unsupported handoff type: ${tool.dataHandoff.type}`
        };
    }
  }

  /**
   * Test API handoff configuration
   */
  private static async testAPIHandoff(
    apiConfig: APIConfig,
    testData: Record<string, any>
  ): Promise<DataHandoffResult> {
    try {
      // Transform test data
      const transformedData = this.transformDataForAPI(testData, apiConfig.payloadStructure);

      // Prepare headers with TEST flag
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Test-Request': 'true',
        ...apiConfig.headers
      };

      if (apiConfig.authentication) {
        this.addAuthentication(headers, apiConfig.authentication);
      }

      // Make test request with OPTIONS first to check endpoint
      try {
        await axios.options(apiConfig.endpoint, { timeout: 10000 });
      } catch (optionsError) {
        // If OPTIONS fails, try the actual request (some APIs don't support OPTIONS)
      }

      // Test with a HEAD request if possible, otherwise use configured method
      const testMethod = apiConfig.method === 'GET' ? 'GET' : 'POST';
      
      const response = await axios({
        method: testMethod,
        url: apiConfig.endpoint,
        data: testMethod === 'POST' ? transformedData : undefined,
        headers,
        timeout: 15000,
        validateStatus: (status) => status >= 200 && status < 500 // Accept more status codes for testing
      });

      return {
        success: response.status >= 200 && response.status < 300,
        message: `API test ${response.status >= 200 && response.status < 300 ? 'successful' : 'failed'}: ${response.status} ${response.statusText}`,
        responseData: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        message: `API test failed: ${error.message}`,
        errors: [error.message]
      };
    }
  }

  /**
   * Test database handoff configuration
   */
  private static async testDatabaseHandoff(
    dbConfig: DatabaseConfig,
    testData: Record<string, any>
  ): Promise<DataHandoffResult> {
    try {
      // Test database connection via our backend
      const testPayload = {
        dbConfig: {
          type: dbConfig.type,
          hostname: dbConfig.hostname,
          port: dbConfig.port,
          database: dbConfig.database,
          username: dbConfig.username,
          password: EncryptionService.encrypt(dbConfig.password),
          table: dbConfig.table
        },
        testOnly: true
      };

      const response = await axios.post('http://localhost:3001/api/data-handoff/test-database',
        testPayload, {
        timeout: 15000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return {
        success: response.data.success,
        message: response.data.message,
        responseData: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Database test failed: ${error.message}`,
        errors: [error.message]
      };
    }
  }

  /**
   * Generate test data based on tool fields
   */
  private static generateTestData(tool: Tool): Record<string, any> {
    const testData: Record<string, any> = {};

    tool.fields.forEach(field => {
      switch (field.type) {
        case 'text':
          testData[field.name] = 'Test Value';
          break;
        case 'email':
          testData[field.name] = 'test@example.com';
          break;
        case 'phone':
          testData[field.name] = '+1-555-123-4567';
          break;
        case 'number':
          testData[field.name] = 123;
          break;
        case 'date':
          testData[field.name] = new Date().toISOString().split('T')[0];
          break;
        case 'select':
          testData[field.name] = field.options?.[0] || 'Option 1';
          break;
        default:
          testData[field.name] = 'Test Value';
      }
    });

    return testData;
  }

  /**
   * Get handoff attempt history for a session
   */
  static getHandoffHistory(sessionId: string): DataHandoffAttempt[] {
    return Array.from(this.handoffAttempts.values())
      .filter(attempt => attempt.sessionId === sessionId)
      .sort((a, b) => a.attemptTime.getTime() - b.attemptTime.getTime());
  }

  /**
   * Retry failed handoff attempt
   */
  static async retryHandoff(attemptId: string): Promise<DataHandoffResult> {
    const originalAttempt = this.handoffAttempts.get(attemptId);
    if (!originalAttempt) {
      return {
        success: false,
        message: 'Original handoff attempt not found'
      };
    }

    // Create new attempt with retry count
    const retryAttempt: DataHandoffAttempt = {
      ...originalAttempt,
      id: this.generateAttemptId(),
      attemptTime: new Date(),
      result: { success: false, message: 'Retrying...' }
    };

    const retryCount = (originalAttempt.result.retryCount || 0) + 1;

    try {
      let result: DataHandoffResult;

      switch (retryAttempt.handoffConfig.type) {
        case 'api':
          result = await this.executeAPIHandoff(retryAttempt.handoffConfig.api!, retryAttempt.finalData);
          break;
        case 'database':
          result = await this.executeDatabaseHandoff(retryAttempt.handoffConfig.database!, retryAttempt.finalData);
          break;
        default:
          result = {
            success: false,
            message: `Unsupported handoff type: ${retryAttempt.handoffConfig.type}`
          };
      }

      result.retryCount = retryCount;
      retryAttempt.result = result;
      this.handoffAttempts.set(retryAttempt.id, retryAttempt);

      return result;
    } catch (error: any) {
      const result: DataHandoffResult = {
        success: false,
        message: `Retry failed: ${error.message}`,
        errors: [error.message],
        retryCount
      };

      retryAttempt.result = result;
      this.handoffAttempts.set(retryAttempt.id, retryAttempt);

      return result;
    }
  }

  /**
   * Generate unique attempt ID
   */
  private static generateAttemptId(): string {
    return `handoff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear handoff history (for cleanup)
   */
  static clearHistory(): void {
    this.handoffAttempts.clear();
  }

  /**
   * Get statistics about handoff attempts
   */
  static getHandoffStats(): {
    total: number;
    successful: number;
    failed: number;
    successRate: number;
    averageTransmissionTime: number;
  } {
    const attempts = Array.from(this.handoffAttempts.values());
    const total = attempts.length;
    const successful = attempts.filter(a => a.result.success).length;
    const failed = total - successful;
    const successRate = total > 0 ? (successful / total) * 100 : 0;
    
    const transmissionTimes = attempts
      .filter(a => a.result.transmissionTime)
      .map(a => a.result.transmissionTime!);
    
    const averageTransmissionTime = transmissionTimes.length > 0
      ? transmissionTimes.reduce((sum, time) => sum + time, 0) / transmissionTimes.length
      : 0;

    return {
      total,
      successful,
      failed,
      successRate: Math.round(successRate * 100) / 100,
      averageTransmissionTime: Math.round(averageTransmissionTime)
    };
  }
}
