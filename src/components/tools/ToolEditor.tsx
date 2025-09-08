import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Tool, ToolField, DataHandoffConfig } from '@/types';
import { ToolService } from '@/services/ToolService';
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
              {(field.type === 'text' || field.type === 'number') && (
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
              
              <div className="form-group col-span-2">
                <label className="form-label">Custom Regex Pattern</label>
                <input
                  type="text"
                  className="form-input"
                  value={field.validation?.clientSide?.regex || ''}
                  onChange={(e) => handleValidationChange('regex', e.target.value)}
                  placeholder="Custom regex pattern for validation"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ToolEditor: React.FC = () => {
  const { toolId } = useParams<{ toolId: string }>();
  const navigate = useNavigate();
  const { tools, setTools } = useApp();
  const [tool, setTool] = useState<Tool | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<ToolField[]>([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [apiTestResult, setApiTestResult] = useState<APITestResult | null>(null);
  const [dbTestResult, setDbTestResult] = useState<DatabaseTestResult | null>(null);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<ToolFormData>({});
  
  const watchedDataHandoffType = watch('dataHandoffType');
  const watchedApiEndpoint = watch('apiEndpoint');
  const watchedDbHostname = watch('dbHostname');

  // Load tool data on component mount
  useEffect(() => {
    const loadTool = async () => {
      if (!toolId) {
        navigate('/dashboard');
        return;
      }

      try {
        const loadedTool = await ToolService.loadTool(toolId);
        if (!loadedTool) {
          toast.error('Tool not found');
          navigate('/dashboard');
          return;
        }

        setTool(loadedTool);
        setFields(loadedTool.fields || []);
        
        // Set form values
        setValue('name', loadedTool.name);
        setValue('description', loadedTool.description);
        setValue('initialPrompt', loadedTool.initialPrompt);
        setValue('conclusionPrompt', loadedTool.conclusionPrompt);
        setValue('dataHandoffType', loadedTool.dataHandoff?.type || 'api');
        
        if (loadedTool.dataHandoff?.type === 'api' && loadedTool.dataHandoff.api) {
          setValue('apiEndpoint', loadedTool.dataHandoff.api.endpoint);
          setValue('apiMethod', loadedTool.dataHandoff.api.method);
        } else if (loadedTool.dataHandoff?.type === 'database' && loadedTool.dataHandoff.database) {
          setValue('dbHostname', loadedTool.dataHandoff.database.hostname);
          setValue('dbPort', loadedTool.dataHandoff.database.port);
          setValue('dbName', loadedTool.dataHandoff.database.database);
          setValue('dbUsername', loadedTool.dataHandoff.database.username);
          setValue('dbTable', loadedTool.dataHandoff.database.table);
        }

      } catch (error) {
        console.error('Error loading tool:', error);
        toast.error('Failed to load tool');
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };

    loadTool();
  }, [toolId, navigate, setValue]);

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
    setFields([...fields, newField]);
  };

  const updateField = (index: number, updatedField: ToolField) => {
    const newFields = [...fields];
    newFields[index] = updatedField;
    setFields(newFields);
  };

  const deleteField = (index: number) => {
    const newFields = fields.filter((_, i) => i !== index);
    setFields(newFields);
  };

  const testApiConnection = async () => {
    const endpoint = watchedApiEndpoint;
    if (!endpoint) {
      toast.error('Please enter an API endpoint first');
      return;
    }

    try {
      const result = await DataHandoffService.testAPIEndpoint({
        type: 'api',
        api: {
          endpoint,
          method: watch('apiMethod') || 'POST',
          headers: {},
          payloadStructure: {}
        }
      });
      setApiTestResult(result);
      
      if (result.success) {
        toast.success('API connection test successful!');
      } else {
        toast.error(`API test failed: ${result.message}`);
      }
    } catch (error) {
      toast.error('Failed to test API connection');
    }
  };

  const testDatabaseConnection = async () => {
    const hostname = watchedDbHostname;
    const dbName = watch('dbName');
    const username = watch('dbUsername');
    const password = watch('dbPassword');
    
    if (!hostname || !dbName || !username || !password) {
      toast.error('Please fill in all database connection fields first');
      return;
    }

    try {
      const result = await DataHandoffService.testDatabaseConnection({
        type: 'database',
        database: {
          type: 'postgresql',
          hostname,
          port: watch('dbPort') || 5432,
          database: dbName,
          username,
          password: await EncryptionService.encrypt(password),
          table: watch('dbTable') || 'default_table',
          fieldMapping: {}
        }
      });
      setDbTestResult(result);
      
      if (result.success) {
        toast.success('Database connection test successful!');
      } else {
        toast.error(`Database test failed: ${result.message}`);
      }
    } catch (error) {
      toast.error('Failed to test database connection');
    }
  };

  const onSubmit = async (data: ToolFormData) => {
    if (!tool) return;

    setSaving(true);
    try {
      // Build data handoff configuration
      let dataHandoff: DataHandoffConfig;
      
      if (data.dataHandoffType === 'api') {
        dataHandoff = {
          type: 'api',
          api: {
            endpoint: data.apiEndpoint || '',
            method: data.apiMethod || 'POST',
            headers: {},
            payloadStructure: {}
          }
        };
      } else {
        dataHandoff = {
          type: 'database',
          database: {
            type: 'postgresql',
            hostname: data.dbHostname || '',
            port: data.dbPort || 5432,
            database: data.dbName || '',
            username: data.dbUsername || '',
            password: data.dbPassword ? await EncryptionService.encrypt(data.dbPassword) : '',
            table: data.dbTable || '',
            fieldMapping: {}
          }
        };
      }

      const updatedTool: Tool = {
        ...tool,
        name: data.name,
        description: data.description,
        initialPrompt: data.initialPrompt,
        conclusionPrompt: data.conclusionPrompt,
        fields,
        dataHandoff,
        updatedAt: new Date()
      };

      const result = await ToolService.saveTool(updatedTool);
      
      if (result.success) {
        // Update local tools list
        const updatedTools = tools.map(t => t.id === tool.id ? result.data! : t);
        setTools(updatedTools);
        
        toast.success('Tool updated successfully!');
        navigate('/dashboard');
      } else {
        toast.error(result.error || 'Failed to update tool');
      }
    } catch (error) {
      console.error('Error updating tool:', error);
      toast.error('Failed to update tool');
    } finally {
      setSaving(false);
    }
  };


  if (loading) {
    return (
      <div className="tool-editor fade-in">
        <div className="text-center py-8">
          <div className="loading-spinner mx-auto mb-4"></div>
          <p>Loading tool...</p>
        </div>
      </div>
    );
  }

  if (!tool) {
    return (
      <div className="tool-editor fade-in">
        <div className="text-center py-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Tool Not Found
          </h3>
          <p className="text-gray-600 mb-4">
            The tool you're looking for doesn't exist or has been deleted.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/dashboard')}
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="tool-editor fade-in">
      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Header */}
        <div className="card mb-6">
          <div className="card-header">
            <div>
              <h2 className="card-title">Edit Tool: {tool.name}</h2>
              <p className="text-sm text-gray-500">
                Modify your voice interaction tool configuration
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate('/dashboard')}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <div className="loading-spinner w-4 h-4"></div>
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Tool Details */}
        <div className="card mb-6">
          <div className="card-header">
            <h3 className="card-title">Tool Details</h3>
          </div>
          <div className="card-body">
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Tool Name</label>
                <input
                  type="text"
                  className="form-input"
                  {...register('name', { required: 'Tool name is required' })}
                  placeholder="Enter tool name"
                />
                {errors.name && (
                  <div className="form-error">{errors.name.message}</div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <input
                  type="text"
                  className="form-input"
                  {...register('description', { required: 'Description is required' })}
                  placeholder="Brief description of this tool"
                />
                {errors.description && (
                  <div className="form-error">{errors.description.message}</div>
                )}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Initial Prompt</label>
              <textarea
                className="form-textarea"
                {...register('initialPrompt', { required: 'Initial prompt is required' })}
                placeholder="What the voice agent says to start the interaction"
                rows={3}
              />
              {errors.initialPrompt && (
                <div className="form-error">{errors.initialPrompt.message}</div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Conclusion Prompt</label>
              <textarea
                className="form-textarea"
                {...register('conclusionPrompt', { required: 'Conclusion prompt is required' })}
                placeholder="What the voice agent says to conclude the interaction"
                rows={3}
              />
              {errors.conclusionPrompt && (
                <div className="form-error">{errors.conclusionPrompt.message}</div>
              )}
            </div>
          </div>
        </div>

        {/* Fields Configuration */}
        <div className="card mb-6">
          <div className="card-header">
            <h3 className="card-title">Fields Configuration</h3>
            <button
              type="button"
              className="btn btn-primary"
              onClick={addField}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Field
            </button>
          </div>
          <div className="card-body">
            {fields.length === 0 ? (
              <div className="empty-fields">
                <p className="text-gray-500">No fields configured. Add your first field to get started.</p>
              </div>
            ) : (
              <div className="fields-list">
                {fields.map((field, index) => (
                  <FieldEditor
                    key={field.id}
                    field={field}
                    onUpdate={(updatedField) => updateField(index, updatedField)}
                    onDelete={() => deleteField(index)}
                    index={index}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Data Handoff Configuration */}
        <div className="card mb-6">
          <div className="card-header">
            <h3 className="card-title">Data Handoff Configuration</h3>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Handoff Type</label>
              <div className="radio-group">
                <label className="radio-option">
                  <input
                    type="radio"
                    value="api"
                    {...register('dataHandoffType')}
                  />
                  <span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                    </svg>
                    API Integration
                  </span>
                </label>
                <label className="radio-option">
                  <input
                    type="radio"
                    value="database"
                    {...register('dataHandoffType')}
                  />
                  <span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                    </svg>
                    Database Integration
                  </span>
                </label>
              </div>
            </div>

            {watchedDataHandoffType === 'api' && (
              <>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">API Endpoint</label>
                    <input
                      type="url"
                      className="form-input"
                      {...register('apiEndpoint')}
                      placeholder="https://api.example.com/endpoint"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">HTTP Method</label>
                    <select className="form-select" {...register('apiMethod')}>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="PATCH">PATCH</option>
                      <option value="GET">GET</option>
                    </select>
                  </div>
                </div>
                
                <div className="test-section">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={testApiConnection}
                  >
                    Test Connection
                  </button>
                  
                  {apiTestResult && (
                    <div className={`test-result ${apiTestResult.success ? 'success' : 'error'}`}>
                      <div className="test-header">
                        <span className="test-icon">
                          {apiTestResult.success ? '✓' : '✗'}
                        </span>
                        {apiTestResult.success ? 'Connection Successful' : 'Connection Failed'}
                      </div>
                      {apiTestResult.responseTime && (
                        <div className="test-details">
                          <span>Response Time: {apiTestResult.responseTime}ms</span>
                          <span>Status: {apiTestResult.statusCode}</span>
                        </div>
                      )}
                      {!apiTestResult.success && (
                        <div className="text-sm mt-2">{apiTestResult.message}</div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {watchedDataHandoffType === 'database' && (
              <>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Database Host</label>
                    <input
                      type="text"
                      className="form-input"
                      {...register('dbHostname')}
                      placeholder="localhost or database.example.com"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Port</label>
                    <input
                      type="number"
                      className="form-input"
                      {...register('dbPort', { valueAsNumber: true })}
                      placeholder="5432"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Database Name</label>
                    <input
                      type="text"
                      className="form-input"
                      {...register('dbName')}
                      placeholder="healthcare_db"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Table Name</label>
                    <input
                      type="text"
                      className="form-input"
                      {...register('dbTable')}
                      placeholder="patient_data"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Username</label>
                    <input
                      type="text"
                      className="form-input"
                      {...register('dbUsername')}
                      placeholder="database_user"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <input
                      type="password"
                      className="form-input"
                      {...register('dbPassword')}
                      placeholder="Enter database password"
                    />
                  </div>
                </div>
                
                <div className="test-section">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={testDatabaseConnection}
                  >
                    Test Connection
                  </button>
                  
                  {dbTestResult && (
                    <div className={`test-result ${dbTestResult.success ? 'success' : 'error'}`}>
                      <div className="test-header">
                        <span className="test-icon">
                          {dbTestResult.success ? '✓' : '✗'}
                        </span>
                        {dbTestResult.success ? 'Connection Successful' : 'Connection Failed'}
                      </div>
                      {dbTestResult.tables && (
                        <div className="test-details">
                          <span>Tables Found: {dbTestResult.tables.length}</span>
                          <span>Status: Connected</span>
                        </div>
                      )}
                      {!dbTestResult.success && (
                        <div className="text-sm mt-2">{dbTestResult.message}</div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </form>

    </div>
  );
};

export default ToolEditor;
