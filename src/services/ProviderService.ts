import axios from 'axios';
import { ProviderConfig, STTProvider, LLMProvider, TTSProvider, ApiResponse } from '@/types';
import { StorageService } from './StorageService';
import { EncryptionService } from './EncryptionService';
import { apiClient } from '@/config/api';

export interface ProviderDefinition {
  id: string;
  name: string;
  description: string;
  credentialFields: CredentialField[];
  configFields?: ConfigField[];
  testEndpoint?: string;
}

export interface CredentialField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'select';
  required: boolean;
  placeholder?: string;
  options?: string[];
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
  };
}

export interface ConfigField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'boolean';
  defaultValue?: any;
  options?: string[];
  description?: string;
  placeholder?: string;
}

export class ProviderService {
  // STT Provider Definitions
  static readonly STT_PROVIDERS: Record<string, ProviderDefinition> = {
    openai: {
      id: 'openai',
      name: 'OpenAI Whisper',
      description: 'OpenAI\'s state-of-the-art speech recognition API',
      credentialFields: [
        {
          key: 'apiKey',
          label: 'API Key',
          type: 'password',
          required: true,
          placeholder: 'sk-...',
          validation: {
            pattern: '^sk-',
            minLength: 20,
            maxLength: 200
          }
        }
      ],
      configFields: [
        {
          key: 'model',
          label: 'Model',
          type: 'select',
          defaultValue: 'whisper-1',
          options: ['whisper-1']
        },
        {
          key: 'language',
          label: 'Language',
          type: 'select',
          defaultValue: 'en',
          options: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh']
        }
      ],
      testEndpoint: 'https://api.openai.com/v1/models'
    },
    azure: {
      id: 'azure',
      name: 'Azure Speech Services',
      description: 'Microsoft Azure\'s speech-to-text service',
      credentialFields: [
        {
          key: 'subscriptionKey',
          label: 'Subscription Key',
          type: 'password',
          required: true,
          placeholder: 'Your Azure subscription key'
        },
        {
          key: 'region',
          label: 'Region',
          type: 'select',
          required: true,
          options: ['eastus', 'westus2', 'westeurope', 'eastasia', 'southeastasia']
        }
      ],
      configFields: [
        {
          key: 'language',
          label: 'Language',
          type: 'select',
          defaultValue: 'en-US',
          options: ['en-US', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ru-RU', 'ja-JP', 'ko-KR', 'zh-CN']
        }
      ]
    },
    google: {
      id: 'google',
      name: 'Google Cloud Speech-to-Text',
      description: 'Google\'s powerful speech recognition service',
      credentialFields: [
        {
          key: 'apiKey',
          label: 'API Key',
          type: 'password',
          required: true,
          placeholder: 'Your Google Cloud API key'
        },
        {
          key: 'projectId',
          label: 'Project ID',
          type: 'text',
          required: true,
          placeholder: 'your-project-id'
        }
      ],
      configFields: [
        {
          key: 'languageCode',
          label: 'Language Code',
          type: 'select',
          defaultValue: 'en-US',
          options: ['en-US', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ru-RU', 'ja-JP', 'ko-KR', 'zh-CN']
        },
        {
          key: 'model',
          label: 'Model',
          type: 'select',
          defaultValue: 'default',
          options: ['default', 'medical_conversation', 'medical_dictation']
        }
      ]
    },
    amazon: {
      id: 'amazon',
      name: 'Amazon Transcribe',
      description: 'AWS automatic speech recognition service',
      credentialFields: [
        {
          key: 'accessKeyId',
          label: 'Access Key ID',
          type: 'text',
          required: true,
          placeholder: 'AKIA...'
        },
        {
          key: 'secretAccessKey',
          label: 'Secret Access Key',
          type: 'password',
          required: true,
          placeholder: 'Your secret access key'
        },
        {
          key: 'region',
          label: 'AWS Region',
          type: 'select',
          required: true,
          options: ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1', 'ap-northeast-1']
        }
      ],
      configFields: [
        {
          key: 'languageCode',
          label: 'Language Code',
          type: 'select',
          defaultValue: 'en-US',
          options: ['en-US', 'es-US', 'fr-CA', 'de-DE', 'it-IT', 'pt-BR', 'ru-RU', 'ja-JP', 'ko-KR', 'zh-CN']
        }
      ]
    }
  };

  // LLM Provider Definitions
  static readonly LLM_PROVIDERS: Record<string, ProviderDefinition> = {
    openai: {
      id: 'openai',
      name: 'OpenAI GPT',
      description: 'OpenAI\'s GPT models for natural language processing',
      credentialFields: [
        {
          key: 'apiKey',
          label: 'API Key',
          type: 'password',
          required: true,
          placeholder: 'sk-...',
          validation: {
            pattern: '^sk-',
            minLength: 20,
            maxLength: 200
          }
        }
      ],
      configFields: [
        {
          key: 'model',
          label: 'Model',
          type: 'select',
          defaultValue: 'gpt-4',
          options: ['gpt-4', 'gpt-4-turbo-preview', 'gpt-3.5-turbo', 'gpt-3.5-turbo-16k']
        },
        {
          key: 'temperature',
          label: 'Temperature',
          type: 'number',
          defaultValue: 0.7,
          description: 'Controls randomness (0.0 to 2.0)'
        },
        {
          key: 'maxTokens',
          label: 'Max Tokens',
          type: 'number',
          defaultValue: 1000,
          description: 'Maximum number of tokens in response'
        }
      ],
      testEndpoint: 'https://api.openai.com/v1/models'
    },
    azure: {
      id: 'azure',
      name: 'Azure OpenAI Service',
      description: 'Microsoft Azure\'s OpenAI service',
      credentialFields: [
        {
          key: 'apiKey',
          label: 'API Key',
          type: 'password',
          required: true,
          placeholder: 'Your Azure OpenAI API key'
        },
        {
          key: 'endpoint',
          label: 'Endpoint',
          type: 'url',
          required: true,
          placeholder: 'https://your-resource.openai.azure.com/'
        },
        {
          key: 'deploymentName',
          label: 'Deployment Name',
          type: 'text',
          required: true,
          placeholder: 'gpt-4'
        }
      ],
      configFields: [
        {
          key: 'apiVersion',
          label: 'API Version',
          type: 'select',
          defaultValue: '2024-02-15-preview',
          options: ['2024-02-15-preview', '2023-12-01-preview', '2023-05-15']
        },
        {
          key: 'temperature',
          label: 'Temperature',
          type: 'number',
          defaultValue: 0.7
        }
      ]
    },
    anthropic: {
      id: 'anthropic',
      name: 'Anthropic Claude',
      description: 'Anthropic\'s Claude AI assistant',
      credentialFields: [
        {
          key: 'apiKey',
          label: 'API Key',
          type: 'password',
          required: true,
          placeholder: 'sk-ant-...'
        }
      ],
      configFields: [
        {
          key: 'model',
          label: 'Model',
          type: 'select',
          defaultValue: 'claude-3-opus-20240229',
          options: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307']
        },
        {
          key: 'maxTokens',
          label: 'Max Tokens',
          type: 'number',
          defaultValue: 1000
        }
      ],
      testEndpoint: 'https://api.anthropic.com/v1/models'
    }
  };

  // TTS Provider Definitions
  static readonly TTS_PROVIDERS: Record<string, ProviderDefinition> = {
    openai: {
      id: 'openai',
      name: 'OpenAI TTS',
      description: 'OpenAI\'s text-to-speech service',
      credentialFields: [
        {
          key: 'apiKey',
          label: 'API Key',
          type: 'password',
          required: true,
          placeholder: 'sk-...'
        }
      ],
      configFields: [
        {
          key: 'model',
          label: 'Model',
          type: 'select',
          defaultValue: 'tts-1',
          options: ['tts-1', 'tts-1-hd']
        },
        {
          key: 'voice',
          label: 'Voice',
          type: 'select',
          defaultValue: 'alloy',
          options: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']
        }
      ]
    },
    azure: {
      id: 'azure',
      name: 'Azure Speech Services',
      description: 'Microsoft Azure\'s text-to-speech service',
      credentialFields: [
        {
          key: 'subscriptionKey',
          label: 'Subscription Key',
          type: 'password',
          required: true
        },
        {
          key: 'region',
          label: 'Region',
          type: 'select',
          required: true,
          options: ['eastus', 'westus2', 'westeurope', 'eastasia', 'southeastasia']
        }
      ],
      configFields: [
        {
          key: 'voice',
          label: 'Voice',
          type: 'select',
          defaultValue: 'en-US-JennyNeural',
          options: [
            'en-US-JennyNeural', 'en-US-GuyNeural', 'en-US-AriaNeural', 
            'en-US-DavisNeural', 'en-US-AmberNeural', 'en-US-AnaNeural'
          ]
        },
        {
          key: 'style',
          label: 'Speaking Style',
          type: 'select',
          defaultValue: 'neutral',
          options: ['neutral', 'cheerful', 'sad', 'angry', 'fearful', 'disgruntled', 'serious', 'affectionate', 'gentle', 'calm']
        }
      ]
    },
    google: {
      id: 'google',
      name: 'Google Cloud Text-to-Speech',
      description: 'Google\'s natural text-to-speech service',
      credentialFields: [
        {
          key: 'apiKey',
          label: 'API Key',
          type: 'password',
          required: true
        }
      ],
      configFields: [
        {
          key: 'languageCode',
          label: 'Language Code',
          type: 'select',
          defaultValue: 'en-US',
          options: ['en-US', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ru-RU', 'ja-JP', 'ko-KR', 'zh-CN']
        },
        {
          key: 'voiceName',
          label: 'Voice Name',
          type: 'select',
          defaultValue: 'en-US-Wavenet-D',
          options: ['en-US-Wavenet-D', 'en-US-Wavenet-A', 'en-US-Neural2-D', 'en-US-Neural2-A']
        }
      ]
    },
    amazon: {
      id: 'amazon',
      name: 'Amazon Polly',
      description: 'AWS lifelike text-to-speech service',
      credentialFields: [
        {
          key: 'accessKeyId',
          label: 'Access Key ID',
          type: 'text',
          required: true
        },
        {
          key: 'secretAccessKey',
          label: 'Secret Access Key',
          type: 'password',
          required: true
        },
        {
          key: 'region',
          label: 'AWS Region',
          type: 'select',
          required: true,
          options: ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1', 'ap-northeast-1']
        }
      ],
      configFields: [
        {
          key: 'voiceId',
          label: 'Voice ID',
          type: 'select',
          defaultValue: 'Joanna',
          options: ['Joanna', 'Matthew', 'Ivy', 'Justin', 'Kendra', 'Kimberly', 'Salli', 'Joey', 'Amy', 'Brian', 'Emma']
        },
        {
          key: 'engine',
          label: 'Engine',
          type: 'select',
          defaultValue: 'neural',
          options: ['neural', 'standard']
        }
      ]
    }
  };

  /**
   * Get all available providers for a given type
   */
  static getProviders(type: 'stt' | 'llm' | 'tts'): Record<string, ProviderDefinition> {
    switch (type) {
      case 'stt':
        return this.STT_PROVIDERS;
      case 'llm':
        return this.LLM_PROVIDERS;
      case 'tts':
        return this.TTS_PROVIDERS;
      default:
        return {};
    }
  }

  /**
   * Get a specific provider definition
   */
  static getProvider(type: 'stt' | 'llm' | 'tts', providerId: string): ProviderDefinition | null {
    const providers = this.getProviders(type);
    return providers[providerId] || null;
  }

  /**
   * Validate provider credentials format
   */
  static validateCredentials(
    type: 'stt' | 'llm' | 'tts',
    providerId: string,
    credentials: Record<string, string>
  ): { isValid: boolean; errors: Record<string, string> } {
    const provider = this.getProvider(type, providerId);
    if (!provider) {
      return { isValid: false, errors: { provider: 'Provider not found' } };
    }

    const errors: Record<string, string> = {};

    provider.credentialFields.forEach(field => {
      const value = credentials[field.key];

      if (field.required && !value) {
        errors[field.key] = `${field.label} is required`;
        return;
      }

      if (value && field.validation) {
        const validation = field.validation;
        
        if (validation.pattern && !new RegExp(validation.pattern).test(value)) {
          errors[field.key] = `${field.label} format is invalid`;
        }
        
        if (validation.minLength && value.length < validation.minLength) {
          errors[field.key] = `${field.label} must be at least ${validation.minLength} characters`;
        }
        
        if (validation.maxLength && value.length > validation.maxLength) {
          errors[field.key] = `${field.label} must be no more than ${validation.maxLength} characters`;
        }
      }
    });

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  /**
   * Test provider connection
   */
  static async testProvider(
    type: 'stt' | 'llm' | 'tts',
    providerId: string,
    credentials: Record<string, string>
  ): Promise<ApiResponse<boolean>> {
    const provider = this.getProvider(type, providerId);
    
    if (!provider) {
      return { success: false, error: 'Provider not found' };
    }

    if (!provider.testEndpoint) {
      return { success: true, data: true, message: 'Provider configured successfully (no test endpoint available)' };
    }

    try {
      // Different test approaches based on provider
      let headers: Record<string, string> = {};
      
      if (providerId === 'openai') {
        headers['Authorization'] = `Bearer ${credentials.apiKey}`;
      } else if (providerId === 'anthropic') {
        headers['x-api-key'] = credentials.apiKey;
        headers['anthropic-version'] = '2023-06-01';
      }

      const response = await axios.get(provider.testEndpoint, {
        headers,
        timeout: 10000
      });

      if (response.status === 200) {
        return { success: true, data: true, message: 'Provider connection successful' };
      } else {
        return { success: false, error: 'Provider connection failed' };
      }
    } catch (error: any) {
      console.error('Provider test error:', error);
      
      if (error.response?.status === 401) {
        return { success: false, error: 'Invalid credentials' };
      } else if (error.response?.status === 403) {
        return { success: false, error: 'Access denied' };
      } else if (error.code === 'ECONNABORTED') {
        return { success: false, error: 'Connection timeout' };
      } else {
        return { success: false, error: 'Connection failed' };
      }
    }
  }

  /**
   * Save provider configuration
   */
  static async saveProviderConfig(config: ProviderConfig): Promise<ApiResponse<ProviderConfig>> {
    try {
      // Validate each provider configuration
      const sttValidation = this.validateCredentials('stt', config.stt.type, config.stt.credentials);
      if (!sttValidation.isValid) {
        return { success: false, error: 'Invalid STT provider configuration' };
      }

      const llmValidation = this.validateCredentials('llm', config.llm.type, config.llm.credentials);
      if (!llmValidation.isValid) {
        return { success: false, error: 'Invalid LLM provider configuration' };
      }

      const ttsValidation = this.validateCredentials('tts', config.tts.type, config.tts.credentials);
      if (!ttsValidation.isValid) {
        return { success: false, error: 'Invalid TTS provider configuration' };
      }

      // Save to backend API
      const response = await apiClient.post('/api/providers', config);

      if (response.data.success) {
        // Also save to local storage as cache
        StorageService.saveProviderConfig(config);
        return { success: true, data: config, message: 'Provider configuration saved successfully' };
      } else {
        return { success: false, error: response.data.error || 'Failed to save provider configuration' };
      }
    } catch (error: any) {
      console.error('Error saving provider configuration:', error);
      
      if (error.response?.status === 400) {
        return { success: false, error: error.response.data?.error || 'Invalid configuration data' };
      } else if (error.response?.status === 500) {
        return { success: false, error: 'Server error while saving configuration' };
      } else if (error.code === 'ECONNABORTED') {
        return { success: false, error: 'Request timeout - please try again' };
      } else {
        return { success: false, error: 'Failed to save provider configuration' };
      }
    }
  }

  /**
   * Load provider configuration
   */
  static async loadProviderConfig(): Promise<ProviderConfig | null> {
    try {
      // Try to load from backend API first
      const response = await apiClient.get('/api/providers');
      
      if (response.data.success && response.data.data) {
        const config = response.data.data;
        // Update local storage cache
        StorageService.saveProviderConfig(config);
        return config;
      }
    } catch (error) {
      console.warn('Failed to load provider config from API, falling back to local storage:', error);
    }
    
    // Fallback to local storage
    return StorageService.getProviderConfig();
  }

  /**
   * Get default configuration for a provider
   */
  static getDefaultConfig(type: 'stt' | 'llm' | 'tts', providerId: string): Record<string, any> {
    const provider = this.getProvider(type, providerId);
    if (!provider?.configFields) return {};

    const config: Record<string, any> = {};
    provider.configFields.forEach(field => {
      if (field.defaultValue !== undefined) {
        config[field.key] = field.defaultValue;
      }
    });

    return config;
  }
}
