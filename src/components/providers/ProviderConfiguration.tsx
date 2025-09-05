import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { ProviderConfig, STTProvider, LLMProvider, TTSProvider } from '@/types';
import { ProviderService, ProviderDefinition, CredentialField, ConfigField } from '@/services/ProviderService';
import { useApp } from '../../App';

interface ProviderFormData {
  sttProvider: string;
  llmProvider: string;
  ttsProvider: string;
  [key: string]: any;
}

interface ProviderSectionProps {
  type: 'stt' | 'llm' | 'tts';
  title: string;
  icon: React.ReactNode;
  selectedProvider: string;
  onProviderChange: (providerId: string) => void;
  credentials: Record<string, string>;
  onCredentialsChange: (credentials: Record<string, string>) => void;
  config: Record<string, any>;
  onConfigChange: (config: Record<string, any>) => void;
  errors: Record<string, string>;
  isLoading: boolean;
  onTest: () => void;
  testResult?: { success: boolean; message: string } | null;
}

const ProviderSection: React.FC<ProviderSectionProps> = ({
  type,
  title,
  icon,
  selectedProvider,
  onProviderChange,
  credentials,
  onCredentialsChange,
  config,
  onConfigChange,
  errors,
  isLoading,
  onTest,
  testResult
}) => {
  const providers = ProviderService.getProviders(type);
  const selectedProviderDef = selectedProvider ? providers[selectedProvider] : null;

  const handleCredentialChange = (key: string, value: string) => {
    onCredentialsChange({ ...credentials, [key]: value });
  };

  const handleConfigChange = (key: string, value: any) => {
    onConfigChange({ ...config, [key]: value });
  };

  const renderField = (field: CredentialField | ConfigField, value: any, onChange: (key: string, value: any) => void) => {
    const fieldError = errors[field.key];
    const fieldId = `${type}-${field.key}`;

    return (
      <div key={field.key} className="form-group">
        <label htmlFor={fieldId} className="form-label">
          {field.label}
          {(field as CredentialField).required && <span className="text-error ml-1">*</span>}
        </label>
        
        {field.type === 'select' && field.options ? (
          <select
            id={fieldId}
            className={`form-select ${fieldError ? 'error' : ''}`}
            value={value || ''}
            onChange={(e) => onChange(field.key, e.target.value)}
          >
            <option value="">Select {field.label}</option>
            {field.options.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        ) : field.type === 'number' ? (
          <input
            id={fieldId}
            type="number"
            className={`form-input ${fieldError ? 'error' : ''}`}
            value={value || ''}
            onChange={(e) => onChange(field.key, parseFloat(e.target.value) || 0)}
            placeholder={field.placeholder}
            step="0.1"
            min="0"
          />
        ) : field.type === 'boolean' ? (
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={value || false}
              onChange={(e) => onChange(field.key, e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm text-gray-700">{field.label}</span>
          </label>
        ) : (
          <input
            id={fieldId}
            type={field.type === 'password' ? 'password' : field.type === 'url' ? 'url' : 'text'}
            className={`form-input ${fieldError ? 'error' : ''}`}
            value={value || ''}
            onChange={(e) => onChange(field.key, e.target.value)}
            placeholder={field.placeholder}
          />
        )}
        
        {fieldError && (
          <div className="form-error">{fieldError}</div>
        )}
        
        {(field as ConfigField).description && (
          <div className="form-help">{(field as ConfigField).description}</div>
        )}
      </div>
    );
  };

  return (
    <div className="provider-section">
      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-3">
            <div className="provider-icon">{icon}</div>
            <div>
              <h3 className="card-title">{title}</h3>
              <p className="text-sm text-gray-500">Configure your {title.toLowerCase()} provider</p>
            </div>
          </div>
        </div>
        
        <div className="card-body">
          {/* Provider Selection */}
          <div className="form-group">
            <label className="form-label">Provider</label>
            <div className="provider-grid">
              {Object.values(providers).map(provider => (
                <div
                  key={provider.id}
                  className={`provider-card ${
                    selectedProvider === provider.id ? 'selected' : ''
                  }`}
                  onClick={() => onProviderChange(provider.id)}
                >
                  <div className="provider-name">{provider.name}</div>
                  <div className="provider-description">{provider.description}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Credentials Configuration */}
          {selectedProviderDef && (
            <div className="provider-config">
              <h4 className="section-title">Credentials</h4>
              <div className="config-grid">
                {selectedProviderDef.credentialFields.map(field =>
                  renderField(field, credentials[field.key], handleCredentialChange)
                )}
              </div>

              {/* Configuration Settings */}
              {selectedProviderDef.configFields && selectedProviderDef.configFields.length > 0 && (
                <>
                  <h4 className="section-title mt-6">Configuration</h4>
                  <div className="config-grid">
                    {selectedProviderDef.configFields.map(field =>
                      renderField(field, config[field.key], handleConfigChange)
                    )}
                  </div>
                </>
              )}

              {/* Test Connection */}
              <div className="test-section">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onTest}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="loading-spinner mr-2"></span>
                      Testing...
                    </>
                  ) : (
                    'Test Connection'
                  )}
                </button>
                
                {testResult && (
                  <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
                    <span className="test-icon">
                      {testResult.success ? '✓' : '✗'}
                    </span>
                    {testResult.message}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ProviderConfiguration: React.FC = () => {
  const { providerConfig, setProviderConfig } = useApp();
  const [isLoading, setIsLoading] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string } | null>>({});
  const [errors, setErrors] = useState<Record<string, Record<string, string>>>({ stt: {}, llm: {}, tts: {} });
  
  // Form state
  const [sttProvider, setSttProvider] = useState(providerConfig?.stt.type || 'openai');
  const [llmProvider, setLlmProvider] = useState(providerConfig?.llm.type || 'openai');
  const [ttsProvider, setTtsProvider] = useState(providerConfig?.tts.type || 'openai');
  
  const [sttCredentials, setSttCredentials] = useState(providerConfig?.stt.credentials || {});
  const [llmCredentials, setLlmCredentials] = useState(providerConfig?.llm.credentials || {});
  const [ttsCredentials, setTtsCredentials] = useState(providerConfig?.tts.credentials || {});
  
  const [sttConfig, setSttConfig] = useState(providerConfig?.stt.config || {});
  const [llmConfig, setLlmConfig] = useState(providerConfig?.llm.config || {});
  const [ttsConfig, setTtsConfig] = useState(providerConfig?.tts.config || {});

  // Load default configurations when provider changes
  useEffect(() => {
    const defaultConfig = ProviderService.getDefaultConfig('stt', sttProvider);
    setSttConfig(prev => ({ ...defaultConfig, ...prev }));
  }, [sttProvider]);

  useEffect(() => {
    const defaultConfig = ProviderService.getDefaultConfig('llm', llmProvider);
    setLlmConfig(prev => ({ ...defaultConfig, ...prev }));
  }, [llmProvider]);

  useEffect(() => {
    const defaultConfig = ProviderService.getDefaultConfig('tts', ttsProvider);
    setTtsConfig(prev => ({ ...defaultConfig, ...prev }));
  }, [ttsProvider]);

  const handleTest = async (type: 'stt' | 'llm' | 'tts') => {
    setIsLoading(true);
    setTestResults(prev => ({ ...prev, [type]: null }));
    
    let credentials: Record<string, string>;
    let providerId: string;
    
    switch (type) {
      case 'stt':
        credentials = sttCredentials;
        providerId = sttProvider;
        break;
      case 'llm':
        credentials = llmCredentials;
        providerId = llmProvider;
        break;
      case 'tts':
        credentials = ttsCredentials;
        providerId = ttsProvider;
        break;
    }
    
    try {
      const result = await ProviderService.testProvider(type, providerId, credentials);
      setTestResults(prev => ({ 
        ...prev, 
        [type]: { 
          success: result.success, 
          message: result.message || result.error || 'Test completed' 
        } 
      }));
    } catch (error) {
      setTestResults(prev => ({ 
        ...prev, 
        [type]: { 
          success: false, 
          message: 'Test failed unexpectedly' 
        } 
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors = { stt: {}, llm: {}, tts: {} };
    
    // Validate STT
    const sttValidation = ProviderService.validateCredentials('stt', sttProvider, sttCredentials);
    if (!sttValidation.isValid) {
      newErrors.stt = sttValidation.errors;
    }
    
    // Validate LLM
    const llmValidation = ProviderService.validateCredentials('llm', llmProvider, llmCredentials);
    if (!llmValidation.isValid) {
      newErrors.llm = llmValidation.errors;
    }
    
    // Validate TTS
    const ttsValidation = ProviderService.validateCredentials('tts', ttsProvider, ttsCredentials);
    if (!ttsValidation.isValid) {
      newErrors.tts = ttsValidation.errors;
    }
    
    setErrors(newErrors);
    return Object.values(newErrors).every(typeErrors => Object.keys(typeErrors).length === 0);
  };

  const handleSave = async () => {
    if (!validateForm()) {
      toast.error('Please fix validation errors before saving');
      return;
    }
    
    setIsLoading(true);
    
    const config: ProviderConfig = {
      stt: {
        type: sttProvider as any,
        credentials: sttCredentials,
        config: sttConfig
      },
      llm: {
        type: llmProvider as any,
        credentials: llmCredentials,
        config: llmConfig
      },
      tts: {
        type: ttsProvider as any,
        credentials: ttsCredentials,
        config: ttsConfig
      }
    };
    
    try {
      const result = await ProviderService.saveProviderConfig(config);
      if (result.success) {
        setProviderConfig(config);
        toast.success('Provider configuration saved successfully!');
      } else {
        toast.error(result.error || 'Failed to save configuration');
      }
    } catch (error) {
      toast.error('Failed to save configuration');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="provider-configuration fade-in">
      <div className="config-header">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Provider Configuration
        </h2>
        <p className="text-gray-600 mb-6">
          Configure your Speech-to-Text, Large Language Model, and Text-to-Speech providers
        </p>
      </div>

      <div className="providers-container">
        {/* STT Configuration */}
        <ProviderSection
          type="stt"
          title="Speech-to-Text"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          }
          selectedProvider={sttProvider}
          onProviderChange={(providerId) => setSttProvider(providerId as any)}
          credentials={sttCredentials}
          onCredentialsChange={setSttCredentials}
          config={sttConfig}
          onConfigChange={setSttConfig}
          errors={errors.stt}
          isLoading={isLoading}
          onTest={() => handleTest('stt')}
          testResult={testResults.stt}
        />

        {/* LLM Configuration */}
        <ProviderSection
          type="llm"
          title="Large Language Model"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          }
          selectedProvider={llmProvider}
          onProviderChange={(providerId) => setLlmProvider(providerId as any)}
          credentials={llmCredentials}
          onCredentialsChange={setLlmCredentials}
          config={llmConfig}
          onConfigChange={setLlmConfig}
          errors={errors.llm}
          isLoading={isLoading}
          onTest={() => handleTest('llm')}
          testResult={testResults.llm}
        />

        {/* TTS Configuration */}
        <ProviderSection
          type="tts"
          title="Text-to-Speech"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5 7h4l5-5v20l-5-5H5a1 1 0 01-1-1V8a1 1 0 011-1z" />
            </svg>
          }
          selectedProvider={ttsProvider}
          onProviderChange={(providerId) => setTtsProvider(providerId as any)}
          credentials={ttsCredentials}
          onCredentialsChange={setTtsCredentials}
          config={ttsConfig}
          onConfigChange={setTtsConfig}
          errors={errors.tts}
          isLoading={isLoading}
          onTest={() => handleTest('tts')}
          testResult={testResults.tts}
        />
      </div>

      {/* Save Configuration */}
      <div className="save-section">
        <div className="card">
          <div className="card-footer">
            <button
              className="btn btn-primary btn-lg"
              onClick={handleSave}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="loading-spinner mr-2"></span>
                  Saving...
                </>
              ) : (
                'Save Configuration'
              )}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .provider-configuration {
          max-width: 1200px;
          margin: 0 auto;
        }

        .config-header {
          text-align: center;
          margin-bottom: var(--spacing-2xl);
        }

        .providers-container {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xl);
          margin-bottom: var(--spacing-xl);
        }

        .provider-section .card {
          border: 2px solid var(--gray-200);
          transition: all var(--transition-fast);
        }

        .provider-section .card:hover {
          border-color: var(--primary-color);
          box-shadow: var(--shadow-lg);
        }

        .provider-icon {
          background-color: var(--primary-light);
          color: var(--primary-color);
          padding: var(--spacing-md);
          border-radius: var(--radius-lg);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .provider-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: var(--spacing-md);
        }

        .provider-card {
          padding: var(--spacing-lg);
          border: 2px solid var(--gray-200);
          border-radius: var(--radius-lg);
          cursor: pointer;
          transition: all var(--transition-fast);
          background-color: var(--white);
        }

        .provider-card:hover {
          border-color: var(--primary-color);
          background-color: var(--primary-light);
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }

        .provider-card.selected {
          border-color: var(--primary-color);
          background-color: var(--primary-light);
          box-shadow: var(--shadow-md);
        }

        .provider-name {
          font-weight: 600;
          color: var(--gray-900);
          margin-bottom: var(--spacing-xs);
        }

        .provider-description {
          font-size: 0.875rem;
          color: var(--gray-600);
          line-height: 1.4;
        }

        .provider-config {
          margin-top: var(--spacing-xl);
        }

        .section-title {
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--gray-900);
          margin-bottom: var(--spacing-lg);
          padding-bottom: var(--spacing-sm);
          border-bottom: 2px solid var(--gray-200);
        }

        .config-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: var(--spacing-lg);
        }

        .test-section {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          margin-top: var(--spacing-xl);
          padding-top: var(--spacing-lg);
          border-top: 1px solid var(--gray-200);
        }

        .test-result {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          padding: var(--spacing-sm) var(--spacing-md);
          border-radius: var(--radius-md);
          font-size: 0.875rem;
          font-weight: 500;
        }

        .test-result.success {
          background-color: #ecfdf5;
          color: #065f46;
          border: 1px solid #a7f3d0;
        }

        .test-result.error {
          background-color: #fef2f2;
          color: #991b1b;
          border: 1px solid #fecaca;
        }

        .test-icon {
          font-weight: bold;
          font-size: 1rem;
        }

        .save-section {
          position: sticky;
          bottom: var(--spacing-lg);
          z-index: 10;
        }

        .save-section .card {
          box-shadow: var(--shadow-xl);
          border: 2px solid var(--primary-color);
        }

        .loading-spinner {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid transparent;
          border-top: 2px solid currentColor;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @media (max-width: 768px) {
          .config-grid {
            grid-template-columns: 1fr;
          }
          
          .provider-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default ProviderConfiguration;
