// Authentication types
export interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  organizationId?: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

// Provider configuration types
export interface ProviderConfig {
  stt: STTProvider;
  llm: LLMProvider;
  tts: TTSProvider;
}

export interface STTProvider {
  type: 'openai' | 'azure' | 'google' | 'amazon';
  credentials: Record<string, string>;
  config: Record<string, any>;
}

export interface LLMProvider {
  type: 'openai' | 'azure' | 'google' | 'amazon' | 'anthropic';
  credentials: Record<string, string>;
  config: Record<string, any>;
}

export interface TTSProvider {
  type: 'openai' | 'azure' | 'google' | 'amazon';
  credentials: Record<string, string>;
  config: Record<string, any>;
}

// Tool configuration types
export interface Tool {
  id: string;
  name: string;
  description: string;
  initialPrompt: string;
  conclusionPrompt: string;
  intermediatePrompts?: IntermediatePrompt[];
  fields: ToolField[];
  dataHandoff: DataHandoffConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface IntermediatePrompt {
  id: string;
  trigger: string;
  prompt: string;
  order: number;
}

export interface ToolField {
  id: string;
  name: string;
  required: boolean;
  type: 'text' | 'number' | 'email' | 'phone' | 'ssn' | 'date' | 'select';
  validation: FieldValidation;
  instructionalPrompt: string;
  options?: string[]; // for select type
}

export interface FieldValidation {
  clientSide: ClientValidation;
  serverSide?: ServerValidation;
}

export interface ClientValidation {
  regex?: string;
  minLength?: number;
  maxLength?: number;
  format?: 'email' | 'phone' | 'ssn' | 'date';
}

export interface ServerValidation {
  endpoint?: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  validation: 'database' | 'api';
}

// Data handoff types
export interface DataHandoffConfig {
  type: 'api' | 'database';
  api?: APIConfig;
  database?: DatabaseConfig;
}

export interface APIConfig {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH';
  headers: Record<string, string>;
  payloadStructure: Record<string, any>;
  authentication?: {
    type: 'bearer' | 'basic' | 'api-key';
    credentials: Record<string, string>;
  };
}

export interface DatabaseConfig {
  type: 'mysql' | 'postgresql' | 'sqlite' | 'mssql';
  hostname: string;
  port: number;
  database: string;
  username: string;
  password: string;
  table: string;
  fieldMapping: Record<string, string>;
}

// Voice interaction types
export type VoiceInteractionState = 
  | 'idle' 
  | 'initializing' 
  | 'active' 
  | 'listening' 
  | 'processing' 
  | 'speaking' 
  | 'paused' 
  | 'completed' 
  | 'cancelled' 
  | 'error';

export interface VoiceSession {
  id: string;
  toolId: string;
  startTime: Date;
  endTime?: Date;
  state: VoiceInteractionState;
  currentField: ToolField | null;
  collectedData: Record<string, any>;
  fieldStatuses: Record<string, 'pending' | 'completed' | 'error'>;
  config: any;
}

export interface TranscriptEntry {
  id: string;
  timestamp: Date;
  type: 'user' | 'agent';
  text: string;
  confidence?: number;
}

export interface FieldValidationResult {
  isValid: boolean;
  value?: any;
  errors: string[];
  field?: ToolField;
}

// Validation results
export interface ValidationResult {
  isValid: boolean;
  message?: string;
  field?: string;
}

// Application state
export interface AppState {
  user?: User;
  providerConfig?: ProviderConfig;
  tools: Tool[];
  currentSession?: VoiceSession;
  settings: AppSettings;
}

export interface AppSettings {
  summarizationEnabled: boolean;
  theme: 'light' | 'dark';
  language: string;
  autoSave: boolean;
}

// API response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Form types
export interface FormField {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  placeholder?: string;
  validation?: any;
}

// Notification types
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  timestamp: Date;
  duration?: number;
}
