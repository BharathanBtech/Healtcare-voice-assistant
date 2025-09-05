import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Tool, ToolField, DataHandoffConfig } from '@/types';
import { ToolService, ToolTemplate } from '@/services/ToolService';
import { DataHandoffService, FieldMapping, APITestResult, DatabaseTestResult } from '@/services/DataHandoffService';
import { EncryptionService } from '@/services/EncryptionService';
import { useApp } from '../../App';

interface ToolFormData {
  name: string;
  description: string;
  initialPrompt: string;
  conclusionPrompt: string;
  fields: ToolField[];
  dataHandoffType: 'api' | 'database';
  apiEndpoint?: string;
  apiMethod?: 'GET' | 'POST' | 'PUT' | 'PATCH';
  dbHostname?: string;
  dbPort?: number;
  dbName?: string;
  dbUsername?: string;
  dbPassword?: string;
  dbTable?: string;
}

interface FieldEditorProps {
  field: ToolField;
  onUpdate: (field: ToolField) => void;
  onDelete: () => void;
  index: number;
}

const FieldEditor: React.FC<FieldEditorProps> = ({ field, onUpdate, onDelete, index }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleChange = (key: keyof ToolField, value: any) => {
    onUpdate({ ...field, [key]: value });
  };

  const handleValidationChange = (validationKey: string, value: any) => {
    const newValidation = {
      ...field.validation,
      clientSide: {
        ...field.validation?.clientSide,
        [validationKey]: value
      }
    };
    onUpdate({ ...field, validation: newValidation });
  };

  const addOption = () => {
    const newOptions = [...(field.options || []), ''];
    onUpdate({ ...field, options: newOptions });
  };

  const updateOption = (optionIndex: number, value: string) => {
    const newOptions = [...(field.options || [])];
    newOptions[optionIndex] = value;
    onUpdate({ ...field, options: newOptions });
  };

  const removeOption = (optionIndex: number) => {
    const newOptions = (field.options || []).filter((_, i) => i !== optionIndex);
    onUpdate({ ...field, options: newOptions });
  };

  return (
    <div className="field-editor">
      <div className="field-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="field-summary">
          <h4 className="field-name">
            {field.name || `Field ${index + 1}`}
            {field.required && <span className="required-indicator">*</span>}
          </h4>
          <span className="field-type">{field.type}</span>
        </div>
        <div className="field-controls">
          <button
            type="button"
            className="btn-icon"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            <svg className={`w-5 h-5 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                 fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button
            type="button"
            className="btn-icon text-error"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="field-details">
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Field Name</label>
              <input
                type="text"
                className="form-input"
                value={field.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="e.g., firstName, phoneNumber"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Field Type</label>
              <select
                className="form-select"
                value={field.type}
                onChange={(e) => handleChange('type', e.target.value)}
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="ssn">SSN</option>
                <option value="date">Date</option>
                <option value="select">Select (Dropdown)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(e) => handleChange('required', e.target.checked)}
                  className="mr-2"
                />
                <span className="form-label mb-0">Required Field</span>
              </label>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Instructional Prompt</label>
            <textarea
              className="form-textarea"
              value={field.instructionalPrompt}
              onChange={(e) => handleChange('instructionalPrompt', e.target.value)}
              placeholder="What the voice agent should say to collect this field"
              rows={2}
            />
            <div className="form-help">
              This is what the voice agent will say when asking for this information.
            </div>
          </div>

          {field.type === 'select' && (
            <div className="form-group">
              <label className="form-label">Options</label>
              <div className="options-list">
                {(field.options || []).map((option, optionIndex) => (
                  <div key={optionIndex} className="option-row">
                    <input
                      type="text"
                      className="form-input"
                      value={option}
                      onChange={(e) => updateOption(optionIndex, e.target.value)}
                      placeholder={`Option ${optionIndex + 1}`}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => removeOption(optionIndex)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={addOption}
                >
                  Add Option
                </button>
              </div>
            </div>
          )}

          <div className="validation-section">
            <h5 className="section-subtitle">Validation Rules</h5>
            <div className="form-grid">
              {field.type === 'text' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Min Length</label>
                    <input
                      type="number"
                      className="form-input"
                      value={field.validation?.clientSide?.minLength || ''}
                      onChange={(e) => handleValidationChange('minLength', parseInt(e.target.value) || undefined)}
                      min="0"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Max Length</label>
                    <input
                      type="number"
                      className="form-input"
                      value={field.validation?.clientSide?.maxLength || ''}
                      onChange={(e) => handleValidationChange('maxLength', parseInt(e.target.value) || undefined)}
                      min="1"
                    />
                  </div>
                </>
              )}
              <div className="form-group">
                <label className="form-label">Custom Regex Pattern</label>
                <input
                  type="text"
                  className="form-input"
                  value={field.validation?.clientSide?.regex || ''}
                  onChange={(e) => handleValidationChange('regex', e.target.value)}
                  placeholder="^[A-Z0-9]+$"
                />
                <div className="form-help">
                  Optional: Custom validation pattern (advanced users)
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ToolCreator: React.FC = () => {
  const navigate = useNavigate();
  const { tools, setTools } = useApp();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState<{
    api?: APITestResult;
    database?: DatabaseTestResult;
  }>({});
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [availableTables, setAvailableTables] = useState<string[]>([]);
  const [availableColumns, setAvailableColumns] = useState<Record<string, any[]>>({});
  const [tool, setTool] = useState<Partial<Tool>>({
    name: '',
    description: '',
    initialPrompt: '',
    conclusionPrompt: '',
    fields: [],
    dataHandoff: {
      type: 'api',
      api: {
        endpoint: '',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        payloadStructure: {}
      }
    }
  });

  const templates = ToolService.getToolTemplates();

  const handleTemplateSelect = (templateId: string | null) => {
    // console.log('🔍 Template selected:', templateId);
    setSelectedTemplate(templateId);
    
    if (templateId === 'custom') {
      // Start with blank template
      setTool({
        name: '',
        description: '',
        initialPrompt: 'Hello! I\'m here to help you with this process.',
        conclusionPrompt: 'Thank you! Your information has been recorded.',
        fields: [],
        dataHandoff: {
          type: 'api',
          api: {
            endpoint: '',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            payloadStructure: {}
          }
        }
      });
    } else if (templateId) {
      const template = ToolService.getToolTemplate(templateId);
      if (template) {
        const newTool = ToolService.createToolFromTemplate(templateId);
        if (newTool) {
          setTool(newTool);
        }
      }
    }
  };

  const handleBasicInfoChange = (field: keyof Tool, value: any) => {
    setTool(prev => ({ ...prev, [field]: value }));
  };

  const addField = () => {
    const newField: ToolField = {
      id: EncryptionService.generateSecureUUID(),
      name: '',
      required: false,
      type: 'text',
      validation: {
        clientSide: {}
      },
      instructionalPrompt: ''
    };
    
    setTool(prev => ({
      ...prev,
      fields: [...(prev.fields || []), newField]
    }));
  };

  const updateField = (index: number, updatedField: ToolField) => {
    setTool(prev => ({
      ...prev,
      fields: prev.fields?.map((field, i) => i === index ? updatedField : field) || []
    }));
  };

  const removeField = (index: number) => {
    setTool(prev => ({
      ...prev,
      fields: prev.fields?.filter((_, i) => i !== index) || []
    }));
  };

  const handleDataHandoffChange = (field: string, value: any) => {
    setTool(prev => ({
      ...prev,
      dataHandoff: {
        ...prev.dataHandoff!,
        [field]: value
      }
    }));
  };

  const handleApiConfigChange = (field: string, value: any) => {
    setTool(prev => ({
      ...prev,
      dataHandoff: {
        ...prev.dataHandoff!,
        api: {
          ...prev.dataHandoff!.api!,
          [field]: value
        }
      }
    }));
  };

  const handleDatabaseConfigChange = (field: string, value: any) => {
    setTool(prev => ({
      ...prev,
      dataHandoff: {
        ...prev.dataHandoff!,
        database: {
          ...prev.dataHandoff!.database!,
          [field]: value
        }
      }
    }));
  };

  const validateCurrentStep = (): boolean => {
    let isValid = false;
    switch (currentStep) {
      case 1:
        isValid = selectedTemplate !== null;
        // console.log('🔍 Step 1 validation - selectedTemplate:', selectedTemplate, 'isValid:', isValid);
        return isValid;
      case 2:
        isValid = !!(tool.name && tool.description && tool.initialPrompt && tool.conclusionPrompt);
       //  console.log('🔍 Step 2 validation - isValid:', isValid);
        return isValid;
      case 3:
        isValid = (tool.fields?.length || 0) > 0;
        // console.log('🔍 Step 3 validation - fields length:', tool.fields?.length, 'isValid:', isValid);
        return isValid;
      case 4:
        if (tool.dataHandoff?.type === 'api') {
          isValid = !!(tool.dataHandoff.api?.endpoint);
        } else if (tool.dataHandoff?.type === 'database') {
          isValid = !!(tool.dataHandoff.database?.hostname && tool.dataHandoff.database?.database);
        } else {
          isValid = true;
        }
        // console.log('🔍 Step 4 validation - isValid:', isValid);
        return isValid;
      default:
        return true;
    }
  };

  const nextStep = () => {
    // console.log('🔍 Next button clicked - currentStep:', currentStep, 'validateCurrentStep():', validateCurrentStep());
    if (validateCurrentStep() && currentStep < 4) {
      // console.log('🔍 Moving to next step:', currentStep + 1);
      setCurrentStep(currentStep + 1);
    } else {
      // console.log('🔍 Cannot move to next step - validation failed or at last step');
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const saveTool = async () => {
    if (!tool.name || !tool.description) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    
    try {
      const completeTool = ToolService.createTool(tool);
      const result = await ToolService.saveTool(completeTool);
      
      if (result.success) {
        setTools([...tools, completeTool]);
        toast.success('Tool created successfully!');
        navigate('/dashboard');
      } else {
        toast.error(result.error || 'Failed to create tool');
      }
    } catch (error) {
      console.error('Error saving tool:', error);
      toast.error('Failed to create tool');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="tool-creator fade-in">
      {/* Progress Steps */}
      <div className="steps-header">
        <div className="steps-container">
          {[1, 2, 3, 4].map(step => (
            <div key={step} className={`step ${currentStep >= step ? 'active' : ''} ${currentStep > step ? 'completed' : ''}`}>
              <div className="step-circle">
                {currentStep > step ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  step
                )}
              </div>
              <div className="step-label">
                {step === 1 && 'Template'}
                {step === 2 && 'Basic Info'}
                {step === 3 && 'Fields'}
                {step === 4 && 'Data Handoff'}
              </div>
              {step < 4 && <div className="step-connector" />}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="step-content">
        {currentStep === 1 && (
          <div className="template-selection">
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Choose a Template</h2>
                <p className="text-sm text-gray-500">
                  Start with a pre-built template or create from scratch
                </p>
              </div>
              <div className="card-body">
                <div className="templates-grid">
                  <div
                    className={`template-card ${selectedTemplate === 'custom' ? 'selected' : ''}`}
                    onClick={() => handleTemplateSelect('custom')}
                  >
                    <div className="template-icon">🎨</div>
                    <h3 className="template-name">Custom Tool</h3>
                    <p className="template-description">
                      Start from scratch and build your own custom voice interaction tool
                    </p>
                  </div>
                  {templates.map(template => (
                    <div
                      key={template.id}
                      className={`template-card ${selectedTemplate === template.id ? 'selected' : ''}`}
                      onClick={() => handleTemplateSelect(template.id)}
                    >
                      <div className="template-icon">{template.icon}</div>
                      <h3 className="template-name">{template.name}</h3>
                      <p className="template-description">{template.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="basic-info">
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Basic Information</h2>
                <p className="text-sm text-gray-500">
                  Configure the basic details of your voice interaction tool
                </p>
              </div>
              <div className="card-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Tool Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={tool.name || ''}
                      onChange={(e) => handleBasicInfoChange('name', e.target.value)}
                      placeholder="e.g., Patient Registration"
                    />
                  </div>

                  <div className="form-group col-span-2">
                    <label className="form-label">Description *</label>
                    <textarea
                      className="form-textarea"
                      value={tool.description || ''}
                      onChange={(e) => handleBasicInfoChange('description', e.target.value)}
                      placeholder="Brief description of what this tool does"
                      rows={3}
                    />
                  </div>

                  <div className="form-group col-span-2">
                    <label className="form-label">Initial Prompt *</label>
                    <textarea
                      className="form-textarea"
                      value={tool.initialPrompt || ''}
                      onChange={(e) => handleBasicInfoChange('initialPrompt', e.target.value)}
                      placeholder="What the voice agent says when starting the conversation"
                      rows={3}
                    />
                    <div className="form-help">
                      This is the first thing users will hear when they start using this tool.
                    </div>
                  </div>

                  <div className="form-group col-span-2">
                    <label className="form-label">Conclusion Prompt *</label>
                    <textarea
                      className="form-textarea"
                      value={tool.conclusionPrompt || ''}
                      onChange={(e) => handleBasicInfoChange('conclusionPrompt', e.target.value)}
                      placeholder="What the voice agent says when completing the process"
                      rows={3}
                    />
                    <div className="form-help">
                      This is what users will hear after successfully completing all fields.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="fields-configuration">
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Configure Fields</h2>
                <p className="text-sm text-gray-500">
                  Add and configure the data fields your tool will collect
                </p>
              </div>
              <div className="card-body">
                <div className="fields-list">
                  {(tool.fields || []).map((field, index) => (
                    <FieldEditor
                      key={field.id}
                      field={field}
                      onUpdate={(updatedField) => updateField(index, updatedField)}
                      onDelete={() => removeField(index)}
                      index={index}
                    />
                  ))}
                  
                  {(tool.fields?.length || 0) === 0 && (
                    <div className="empty-fields">
                      <p className="text-gray-500 text-center py-8">
                        No fields configured yet. Add your first field to get started.
                      </p>
                    </div>
                  )}
                  
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={addField}
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add Field
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="data-handoff">
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Data Handoff Configuration</h2>
                <p className="text-sm text-gray-500">
                  Configure where the collected data should be sent
                </p>
              </div>
              <div className="card-body">
                <div className="form-group">
                  <label className="form-label">Data Handoff Type</label>
                  <div className="radio-group">
                    <label className="radio-option">
                      <input
                        type="radio"
                        name="handoffType"
                        value="api"
                        checked={tool.dataHandoff?.type === 'api'}
                        onChange={() => {
                          handleDataHandoffChange('type', 'api');
                          setTestResults({});
                        }}
                      />
                      <span>📡 API Endpoint</span>
                    </label>
                    <label className="radio-option">
                      <input
                        type="radio"
                        name="handoffType"
                        value="database"
                        checked={tool.dataHandoff?.type === 'database'}
                        onChange={() => {
                          handleDataHandoffChange('type', 'database');
                          setTestResults({});
                          setAvailableTables([]);
                          setAvailableColumns({});
                        }}
                      />
                      <span>🗄️ Database</span>
                    </label>
                  </div>
                </div>

                {tool.dataHandoff?.type === 'api' && (
                  <div className="api-config">
                    <h3 className="section-subtitle">API Configuration</h3>
                    <div className="form-grid">
                      <div className="form-group col-span-2">
                        <label className="form-label">Endpoint URL *</label>
                        <input
                          type="url"
                          className="form-input"
                          value={tool.dataHandoff.api?.endpoint || ''}
                          onChange={(e) => handleApiConfigChange('endpoint', e.target.value)}
                          placeholder="https://api.healthcare.com/patients"
                        />
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label">HTTP Method</label>
                        <select
                          className="form-select"
                          value={tool.dataHandoff.api?.method || 'POST'}
                          onChange={(e) => handleApiConfigChange('method', e.target.value)}
                        >
                          {DataHandoffService.getHttpMethods().map(method => (
                            <option key={method.value} value={method.value}>
                              {method.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Content Type</label>
                        <select
                          className="form-select"
                          value={tool.dataHandoff.api?.headers?.['Content-Type'] || 'application/json'}
                          onChange={(e) => {
                            const newHeaders = { 
                              ...tool.dataHandoff?.api?.headers, 
                              'Content-Type': e.target.value 
                            };
                            handleApiConfigChange('headers', newHeaders);
                          }}
                        >
                          <option value="application/json">application/json</option>
                          <option value="application/xml">application/xml</option>
                          <option value="application/x-www-form-urlencoded">application/x-www-form-urlencoded</option>
                        </select>
                      </div>
                    </div>

                    {/* API Headers */}
                    <div className="form-group">
                      <label className="form-label">Additional Headers (Optional)</label>
                      <div className="headers-list">
                        {Object.entries(tool.dataHandoff.api?.headers || {}).map(([key, value]) => {
                          if (key === 'Content-Type') return null;
                          return (
                            <div key={key} className="header-row">
                              <input
                                type="text"
                                className="form-input"
                                value={key}
                                onChange={(e) => {
                                  const newHeaders = { ...tool.dataHandoff?.api?.headers };
                                  delete newHeaders[key];
                                  newHeaders[e.target.value] = value;
                                  handleApiConfigChange('headers', newHeaders);
                                }}
                                placeholder="Header Name"
                              />
                              <input
                                type="text"
                                className="form-input"
                                value={value}
                                onChange={(e) => {
                                  const newHeaders = { 
                                    ...tool.dataHandoff?.api?.headers,
                                    [key]: e.target.value
                                  };
                                  handleApiConfigChange('headers', newHeaders);
                                }}
                                placeholder="Header Value"
                              />
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                  const newHeaders = { ...tool.dataHandoff?.api?.headers };
                                  delete newHeaders[key];
                                  handleApiConfigChange('headers', newHeaders);
                                }}
                              >
                                Remove
                              </button>
                            </div>
                          );
                        })}
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            const newHeaders = {
                              ...tool.dataHandoff?.api?.headers,
                              '': ''
                            };
                            handleApiConfigChange('headers', newHeaders);
                          }}
                        >
                          Add Header
                        </button>
                      </div>
                    </div>

                    {/* Test API Button */}
                    <div className="test-section">
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={async () => {
                          if (!tool.dataHandoff?.api?.endpoint) {
                            toast.error('Please enter an API endpoint URL');
                            return;
                          }
                          
                          setIsTesting(true);
                          try {
                            const result = await DataHandoffService.testAPIEndpoint(tool.dataHandoff!);
                            setTestResults(prev => ({ ...prev, api: result }));
                            
                            if (result.success) {
                              toast.success('API connection test successful!');
                            } else {
                              toast.error(`API test failed: ${result.message}`);
                            }
                          } catch (error) {
                            toast.error('API test failed unexpectedly');
                          } finally {
                            setIsTesting(false);
                          }
                        }}
                        disabled={isTesting}
                      >
                        {isTesting ? (
                          <>
                            <span className="loading-spinner mr-2"></span>
                            Testing...
                          </>
                        ) : (
                          'Test API Connection'
                        )}
                      </button>

                      {testResults.api && (
                        <div className={`test-result ${testResults.api.success ? 'success' : 'error'}`}>
                          <div className="test-header">
                            <span className="test-icon">
                              {testResults.api.success ? '✅' : '❌'}
                            </span>
                            <span className="test-message">{testResults.api.message}</span>
                          </div>
                          {testResults.api.responseTime && (
                            <div className="test-details">
                              <span>Response Time: {testResults.api.responseTime}ms</span>
                              {testResults.api.statusCode && (
                                <span>Status: {testResults.api.statusCode}</span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {tool.dataHandoff?.type === 'database' && (
                  <div className="database-config">
                    <h3 className="section-subtitle">Database Configuration</h3>
                    <div className="form-grid">
                      <div className="form-group">
                        <label className="form-label">Database Type *</label>
                        <select
                          className="form-select"
                          value={tool.dataHandoff.database?.type || 'postgresql'}
                          onChange={(e) => {
                            const selectedType = DataHandoffService.getSupportedDatabaseTypes()
                              .find(type => type.value === e.target.value);
                            handleDatabaseConfigChange('type', e.target.value);
                            if (selectedType) {
                              handleDatabaseConfigChange('port', selectedType.port);
                            }
                          }}
                        >
                          {DataHandoffService.getSupportedDatabaseTypes().map(type => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Hostname *</label>
                        <input
                          type="text"
                          className="form-input"
                          value={tool.dataHandoff.database?.hostname || ''}
                          onChange={(e) => handleDatabaseConfigChange('hostname', e.target.value)}
                          placeholder="localhost or db.healthcare.com"
                        />
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label">Port</label>
                        <input
                          type="number"
                          className="form-input"
                          value={tool.dataHandoff.database?.port || ''}
                          onChange={(e) => handleDatabaseConfigChange('port', parseInt(e.target.value) || 5432)}
                          placeholder="5432"
                        />
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label">Database Name *</label>
                        <input
                          type="text"
                          className="form-input"
                          value={tool.dataHandoff.database?.database || ''}
                          onChange={(e) => handleDatabaseConfigChange('database', e.target.value)}
                          placeholder="healthcare_db"
                        />
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label">Username</label>
                        <input
                          type="text"
                          className="form-input"
                          value={tool.dataHandoff.database?.username || ''}
                          onChange={(e) => handleDatabaseConfigChange('username', e.target.value)}
                          placeholder="db_user"
                        />
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label">Password</label>
                        <input
                          type="password"
                          className="form-input"
                          value={tool.dataHandoff.database?.password || ''}
                          onChange={(e) => handleDatabaseConfigChange('password', e.target.value)}
                          placeholder="••••••••"
                        />
                      </div>
                    </div>

                    {/* Test Database Button */}
                    <div className="test-section">
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={async () => {
                          if (!tool.dataHandoff?.database?.hostname || !tool.dataHandoff?.database?.database) {
                            toast.error('Please enter hostname and database name');
                            return;
                          }
                          
                          setIsTesting(true);
                          try {
                            const result = await DataHandoffService.testDatabaseConnection(tool.dataHandoff!);
                            setTestResults(prev => ({ ...prev, database: result }));
                            
                            if (result.success) {
                              toast.success('Database connection successful!');
                              if (result.tables) {
                                setAvailableTables(result.tables);
                              }
                              if (result.columns) {
                                setAvailableColumns(result.columns);
                              }
                            } else {
                              toast.error(`Database test failed: ${result.message}`);
                            }
                          } catch (error) {
                            toast.error('Database test failed unexpectedly');
                          } finally {
                            setIsTesting(false);
                          }
                        }}
                        disabled={isTesting}
                      >
                        {isTesting ? (
                          <>
                            <span className="loading-spinner mr-2"></span>
                            Testing...
                          </>
                        ) : (
                          'Test Database Connection'
                        )}
                      </button>

                      {testResults.database && (
                        <div className={`test-result ${testResults.database.success ? 'success' : 'error'}`}>
                          <div className="test-header">
                            <span className="test-icon">
                              {testResults.database.success ? '✅' : '❌'}
                            </span>
                            <span className="test-message">{testResults.database.message}</span>
                          </div>
                          {testResults.database.success && testResults.database.tables && (
                            <div className="test-details">
                              <span>Found {testResults.database.tables.length} tables</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Table Selection */}
                    {availableTables.length > 0 && (
                      <div className="form-group">
                        <label className="form-label">Target Table</label>
                        <select
                          className="form-select"
                          value={tool.dataHandoff.database?.table || ''}
                          onChange={(e) => {
                            handleDatabaseConfigChange('table', e.target.value);
                            
                            // Auto-generate field mappings
                            if (tool.fields && e.target.value) {
                              const toolFields = tool.fields.map(f => f.name);
                              const targetColumns = availableColumns[e.target.value]?.map(col => col.name) || [];
                              const mappings = DataHandoffService.generateFieldMappings(toolFields, targetColumns);
                              setFieldMappings(mappings);
                            }
                          }}
                        >
                          <option value="">Select a table</option>
                          {availableTables.map(table => (
                            <option key={table} value={table}>{table}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {/* Field Mapping Section */}
                {((tool.dataHandoff?.type === 'database' && tool.dataHandoff?.database?.table) ||
                  (tool.dataHandoff?.type === 'api' && tool.dataHandoff?.api?.endpoint)) &&
                  tool.fields && tool.fields.length > 0 && (
                  <div className="field-mapping-section">
                    <h3 className="section-subtitle">Field Mapping</h3>
                    <p className="form-help mb-4">
                      Map your tool fields to {tool.dataHandoff?.type === 'api' ? 'API payload' : 'database columns'}
                    </p>
                    
                    <div className="mapping-list">
                      {tool.fields.map((field, index) => {
                        const mapping = fieldMappings.find(m => m.toolFieldName === field.name) || {
                          toolFieldName: field.name,
                          targetFieldName: field.name,
                          dataTransformation: { type: 'none' as const },
                          required: field.required
                        };
                        
                        return (
                          <div key={field.id} className="mapping-row">
                            <div className="source-field">
                              <span className="field-label">{field.name}</span>
                              <span className="field-type">{field.type}</span>
                            </div>
                            
                            <div className="mapping-arrow">→</div>
                            
                            <div className="target-field">
                              <input
                                type="text"
                                className="form-input"
                                value={mapping.targetFieldName}
                                onChange={(e) => {
                                  const newMappings = [...fieldMappings];
                                  const mappingIndex = newMappings.findIndex(m => m.toolFieldName === field.name);
                                  
                                  if (mappingIndex >= 0) {
                                    newMappings[mappingIndex] = {
                                      ...newMappings[mappingIndex],
                                      targetFieldName: e.target.value
                                    };
                                  } else {
                                    newMappings.push({
                                      toolFieldName: field.name,
                                      targetFieldName: e.target.value,
                                      dataTransformation: { type: 'none' },
                                      required: field.required
                                    });
                                  }
                                  
                                  setFieldMappings(newMappings);
                                }}
                                placeholder={`Target ${tool.dataHandoff?.type === 'api' ? 'field' : 'column'}`}
                              />
                            </div>
                            
                            <div className="transformation-field">
                              <select
                                className="form-select"
                                value={mapping.dataTransformation?.type || 'none'}
                                onChange={(e) => {
                                  const newMappings = [...fieldMappings];
                                  const mappingIndex = newMappings.findIndex(m => m.toolFieldName === field.name);
                                  
                                  if (mappingIndex >= 0) {
                                    newMappings[mappingIndex] = {
                                      ...newMappings[mappingIndex],
                                      dataTransformation: {
                                        ...newMappings[mappingIndex].dataTransformation,
                                        type: e.target.value as any
                                      }
                                    };
                                  } else {
                                    newMappings.push({
                                      toolFieldName: field.name,
                                      targetFieldName: mapping.targetFieldName,
                                      dataTransformation: { type: e.target.value as any },
                                      required: field.required
                                    });
                                  }
                                  
                                  setFieldMappings(newMappings);
                                }}
                              >
                                {DataHandoffService.getTransformationTypes().map(transform => (
                                  <option key={transform.value} value={transform.value}>
                                    {transform.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {fieldMappings.length > 0 && (
                      <div className="mapping-actions">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => {
                            const toolFields = tool.fields?.map(f => f.name) || [];
                            const targetFields = tool.dataHandoff?.type === 'database' && tool.dataHandoff?.database?.table
                              ? availableColumns[tool.dataHandoff.database.table]?.map(col => col.name) || []
                              : toolFields;
                            
                            const autoMappings = DataHandoffService.generateFieldMappings(toolFields, targetFields);
                            setFieldMappings(autoMappings);
                            toast.success('Field mappings auto-generated!');
                          }}
                        >
                          Auto-Map Fields
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="navigation-section" style={{ marginTop: '20px', padding: '20px', backgroundColor: '#f8f9fa', border: '2px solid #007bff', borderRadius: '8px' }}>
        <div className="card">
          <div className="card-footer">
            <div className="flex justify-between">
              <div>
                {currentStep > 1 && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={prevStep}
                  >
                    Previous
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                {currentStep < 4 ? (
                  <button
                    type="button"
                    className={`btn btn-primary ${!validateCurrentStep() ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={nextStep}
                    disabled={!validateCurrentStep()}
                    style={{ 
                      padding: '12px 24px', 
                      fontSize: '16px', 
                      fontWeight: 'bold',
                      backgroundColor: validateCurrentStep() ? '#007bff' : '#6c757d',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: validateCurrentStep() ? 'pointer' : 'not-allowed'
                    }}
                  >
                    Next
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-success btn-lg create-tool-btn"
                    onClick={saveTool}
                    disabled={isLoading || !validateCurrentStep()}
                  >
                    {isLoading ? (
                      <>
                        <span className="loading-spinner mr-2"></span>
                        Creating Tool...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Create Your Tool
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .tool-creator {
          max-width: 1000px;
          margin: 0 auto;
        }

        .steps-header {
          margin-bottom: var(--spacing-xl);
        }

        .steps-container {
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--white);
          padding: var(--spacing-lg);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-sm);
        }

        .step {
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
        }

        .step-circle {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 0.875rem;
          background: var(--gray-200);
          color: var(--gray-500);
          transition: all var(--transition-fast);
        }

        .step.active .step-circle {
          background: var(--primary-color);
          color: var(--white);
        }

        .step.completed .step-circle {
          background: var(--success);
          color: var(--white);
        }

        .step-label {
          margin-top: var(--spacing-sm);
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--gray-600);
        }

        .step.active .step-label {
          color: var(--primary-color);
        }

        .step-connector {
          position: absolute;
          top: 20px;
          left: 50px;
          width: 60px;
          height: 2px;
          background: var(--gray-200);
        }

        .step.completed .step-connector {
          background: var(--success);
        }

        .step-content {
          margin-bottom: var(--spacing-xl);
        }

        .templates-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: var(--spacing-lg);
        }

        .template-card {
          padding: var(--spacing-lg);
          border: 2px solid var(--gray-200);
          border-radius: var(--radius-lg);
          cursor: pointer;
          transition: all var(--transition-fast);
          text-align: center;
        }

        .template-card:hover {
          border-color: var(--primary-color);
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }

        .template-card.selected {
          border-color: var(--primary-color);
          background-color: var(--primary-light);
          box-shadow: var(--shadow-md);
        }

        .template-icon {
          font-size: 2rem;
          margin-bottom: var(--spacing-md);
        }

        .template-name {
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--gray-900);
          margin-bottom: var(--spacing-sm);
        }

        .template-description {
          color: var(--gray-600);
          font-size: 0.875rem;
          line-height: 1.4;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: var(--spacing-lg);
        }

        .col-span-2 {
          grid-column: span 2;
        }

        .fields-list {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-md);
        }

        .field-editor {
          border: 2px solid var(--gray-200);
          border-radius: var(--radius-lg);
          background: var(--white);
        }

        .field-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--spacing-md);
          cursor: pointer;
          border-bottom: 1px solid var(--gray-200);
        }

        .field-summary {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
        }

        .field-name {
          font-weight: 600;
          color: var(--gray-900);
        }

        .required-indicator {
          color: var(--error);
          margin-left: var(--spacing-xs);
        }

        .field-type {
          background: var(--primary-light);
          color: var(--primary-color);
          padding: var(--spacing-xs) var(--spacing-sm);
          border-radius: var(--radius-sm);
          font-size: 0.75rem;
          font-weight: 500;
        }

        .field-controls {
          display: flex;
          gap: var(--spacing-sm);
        }

        .btn-icon {
          background: none;
          border: none;
          color: var(--gray-600);
          cursor: pointer;
          padding: var(--spacing-xs);
          border-radius: var(--radius-md);
          transition: all var(--transition-fast);
        }

        .btn-icon:hover {
          background: var(--gray-100);
          color: var(--gray-900);
        }

        .btn-icon.text-error {
          color: var(--error);
        }

        .btn-icon.text-error:hover {
          background: #fee2e2;
          color: var(--error);
        }

        .field-details {
          padding: var(--spacing-lg);
        }

        .section-subtitle {
          font-size: 1rem;
          font-weight: 600;
          color: var(--gray-900);
          margin-bottom: var(--spacing-md);
          padding-bottom: var(--spacing-sm);
          border-bottom: 1px solid var(--gray-200);
        }

        .validation-section {
          margin-top: var(--spacing-lg);
          padding-top: var(--spacing-lg);
          border-top: 1px solid var(--gray-200);
        }

        .options-list {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-sm);
        }

        .option-row {
          display: flex;
          gap: var(--spacing-sm);
          align-items: center;
        }

        .radio-group {
          display: flex;
          gap: var(--spacing-lg);
        }

        .radio-option {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          cursor: pointer;
        }

        .navigation-section {
          position: sticky;
          bottom: var(--spacing-lg);
          z-index: 10;
        }

        .navigation-section .card {
          box-shadow: var(--shadow-xl);
          border: 2px solid var(--primary-color);
        }

        .create-tool-btn {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          border: none;
          box-shadow: 0 4px 14px 0 rgba(16, 185, 129, 0.3);
          font-weight: 600;
          letter-spacing: 0.025em;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }

        .create-tool-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #059669 0%, #047857 100%);
          box-shadow: 0 6px 20px 0 rgba(16, 185, 129, 0.4);
          transform: translateY(-2px);
        }

        .create-tool-btn:active:not(:disabled) {
          transform: translateY(0);
          box-shadow: 0 2px 8px 0 rgba(16, 185, 129, 0.3);
        }

        .create-tool-btn:disabled {
          background: #9ca3af;
          box-shadow: none;
          transform: none;
          cursor: not-allowed;
        }

        .create-tool-btn::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
          transition: left 0.5s;
        }

        .create-tool-btn:hover:not(:disabled)::before {
          left: 100%;
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
          .form-grid {
            grid-template-columns: 1fr;
          }
          
          .col-span-2 {
            grid-column: span 1;
          }
          
          .templates-grid {
            grid-template-columns: 1fr;
          }
          
          .steps-container {
            flex-direction: column;
            gap: var(--spacing-sm);
          }
          
          .step-connector {
            display: none;
          }
        }
      `}</style>
    </div>
  );
};

export default ToolCreator;
