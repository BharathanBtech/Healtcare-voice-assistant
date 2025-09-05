import { Tool, ToolField, VoiceSession, FieldValidationResult, VoiceInteractionState } from '@/types';
import { ProviderService } from './ProviderService';
import { validateField } from '@/validations';
import { DataHandoffService } from './DataHandoffService';

export interface TranscriptionResult {
  text: string;
  confidence: number;
  isFinal: boolean;
}

export interface SpeechSynthesisOptions {
  voice?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}

export interface VoiceInteractionConfig {
  autoAdvance: boolean;
  confirmationRequired: boolean;
  maxRetries: number;
  silenceTimeout: number;
  confidenceThreshold: number;
}

export interface SessionProgress {
  totalFields: number;
  completedFields: number;
  currentFieldIndex: number;
  fieldStatuses: Map<string, 'pending' | 'completed' | 'error'>;
  collectedData: Map<string, any>;
  validationErrors: Map<string, string[]>;
}

export class VoiceInteractionService {
  private static instance: VoiceInteractionService;
  private recognition: any = null;
  private synthesis: SpeechSynthesis | null = null;
  private isListening = false;
  private currentSession: VoiceSession | null = null;
  private onTranscriptionCallback?: (result: TranscriptionResult) => void;
  private onStateChangeCallback?: (state: VoiceInteractionState) => void;
  private sessionProgress: SessionProgress | null = null;

  private constructor() {
    this.initializeSpeechServices();
  }

  public static getInstance(): VoiceInteractionService {
    if (!VoiceInteractionService.instance) {
      VoiceInteractionService.instance = new VoiceInteractionService();
    }
    return VoiceInteractionService.instance;
  }

  private async initializeSpeechServices(): Promise<void> {
    try {
      // Initialize Speech Recognition
      if ('webkitSpeechRecognition' in window) {
        this.recognition = new (window as any).webkitSpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';
        this.setupRecognitionEvents();
      } else if ('SpeechRecognition' in window) {
        this.recognition = new (window as any).SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';
        this.setupRecognitionEvents();
      }

      // Initialize Speech Synthesis
      if ('speechSynthesis' in window) {
        this.synthesis = window.speechSynthesis;
      }
    } catch (error) {
      console.error('Failed to initialize speech services:', error);
    }
  }

  private setupRecognitionEvents(): void {
    if (!this.recognition) return;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.onStateChangeCallback?.('listening');
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.onStateChangeCallback?.('idle');
    };

    this.recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      this.isListening = false;
      this.onStateChangeCallback?.('error');
    };

    this.recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        this.onTranscriptionCallback?.({
          text: finalTranscript,
          confidence: event.results[event.resultIndex][0].confidence || 0.9,
          isFinal: true
        });
      } else if (interimTranscript) {
        this.onTranscriptionCallback?.({
          text: interimTranscript,
          confidence: 0,
          isFinal: false
        });
      }
    };
  }

  public async startSession(tool: Tool, config: VoiceInteractionConfig): Promise<VoiceSession> {
    if (this.currentSession) {
      throw new Error('A voice session is already active');
    }

    const session: VoiceSession = {
      id: this.generateSessionId(),
      toolId: tool.id,
      startTime: new Date(),
      state: 'initializing',
      currentField: null,
      collectedData: {},
      fieldStatuses: {},
      config
    };

    this.currentSession = session;
    this.initializeSessionProgress(tool);

    // Start with the initial prompt
    await this.speak(tool.initialPrompt || `Let's start collecting information for ${tool.name}.`);
    
    session.state = 'active';
    this.onStateChangeCallback?.('active');

    return session;
  }

  private initializeSessionProgress(tool: Tool): void {
    const fieldStatuses = new Map<string, 'pending' | 'completed' | 'error'>();
    tool.fields?.forEach(field => {
      fieldStatuses.set(field.id, 'pending');
    });

    this.sessionProgress = {
      totalFields: tool.fields?.length || 0,
      completedFields: 0,
      currentFieldIndex: 0,
      fieldStatuses,
      collectedData: new Map(),
      validationErrors: new Map()
    };
  }

  public async processNextField(): Promise<void> {
    if (!this.currentSession || !this.sessionProgress) return;

    const tool = await this.getCurrentTool();
    if (!tool || !tool.fields) return;

    const currentField = tool.fields[this.sessionProgress.currentFieldIndex];
    if (!currentField) {
      await this.completeSession();
      return;
    }

    this.currentSession.currentField = currentField;
    this.sessionProgress.fieldStatuses.set(currentField.id, 'pending');

    // Ask for the field
    const prompt = currentField.instructionalPrompt || 
                  this.generateDefaultPrompt(currentField);
    
    await this.speak(prompt);
    this.startListening();
  }

  private generateDefaultPrompt(field: ToolField): string {
    const requiredText = field.required ? 'required' : 'optional';
    
    switch (field.type) {
      case 'text':
        return `Please provide your ${field.name}. This is a ${requiredText} field.`;
      case 'number':
        return `Please say the ${field.name} as a number. This is a ${requiredText} field.`;
      case 'email':
        return `Please spell out your ${field.name} email address. This is a ${requiredText} field.`;
      case 'phone':
        return `Please say your ${field.name} phone number. This is a ${requiredText} field.`;
      case 'date':
        return `Please say the ${field.name} date. This is a ${requiredText} field.`;
      case 'select':
        const options = field.options?.join(', ') || '';
        return `Please choose your ${field.name} from the following options: ${options}. This is a ${requiredText} field.`;
      default:
        return `Please provide your ${field.name}. This is a ${requiredText} field.`;
    }
  }

  public async processUserInput(input: string): Promise<FieldValidationResult> {
    if (!this.currentSession || !this.sessionProgress) {
      throw new Error('No active session');
    }

    const tool = await this.getCurrentTool();
    if (!tool || !tool.fields) {
      throw new Error('Tool not found or has no fields');
    }

    const currentField = tool.fields[this.sessionProgress.currentFieldIndex];
    if (!currentField) {
      throw new Error('No current field');
    }

    // Validate the input
    const validation = this.validateFieldInput(currentField, input);
    
    if (validation.isValid) {
      // Store the validated value
      this.sessionProgress.collectedData.set(currentField.name, validation.value);
      this.sessionProgress.fieldStatuses.set(currentField.id, 'completed');
      this.currentSession.collectedData[currentField.name] = validation.value;
      
      // Confirm the input
      await this.speak(`Got it, ${currentField.name}: ${validation.value}`);
      
      // Move to next field
      this.sessionProgress.completedFields++;
      this.sessionProgress.currentFieldIndex++;
      
      await new Promise(resolve => setTimeout(resolve, 1000)); // Brief pause
      await this.processNextField();
    } else {
      // Handle validation errors
      this.sessionProgress.fieldStatuses.set(currentField.id, 'error');
      this.sessionProgress.validationErrors.set(currentField.id, validation.errors);
      
      const errorMessage = validation.errors.join('. ');
      await this.speak(`I'm sorry, ${errorMessage}. Please try again.`);
      
      // Ask for the field again
      await new Promise(resolve => setTimeout(resolve, 1000)); // Brief pause
      await this.processNextField();
    }

    return validation;
  }

  private async getCurrentTool(): Promise<Tool | null> {
    if (!this.currentSession) return null;
    
    try {
      const { ToolService } = await import('./ToolService');
      return ToolService.loadTool(this.currentSession.toolId);
    } catch (error) {
      console.error('Failed to get current tool:', error);
      return null;
    }
  }

  public async completeSession(): Promise<void> {
    if (!this.currentSession || !this.sessionProgress) return;

    const tool = await this.getCurrentTool();
    if (!tool) return;

    // Speak conclusion
    const conclusionPrompt = tool.conclusionPrompt || 
                           'Thank you! I have collected all the required information.';
    await this.speak(conclusionPrompt);

    // Submit data if configured
    if (tool.dataHandoff) {
      try {
        this.onStateChangeCallback?.('processing');
        await this.speak('Processing your information...');
        
        const dataToSubmit = Object.fromEntries(this.sessionProgress.collectedData);
        await DataHandoffService.submitData(tool.dataHandoff, dataToSubmit);
        
        await this.speak('Your information has been successfully submitted.');
      } catch (error) {
        console.error('Data submission failed:', error);
        await this.speak('There was an issue submitting your information. Please contact support.');
      }
    }

    // Complete the session
    this.currentSession.endTime = new Date();
    this.currentSession.state = 'completed';
    this.onStateChangeCallback?.('completed');
    
    this.cleanup();
  }

  public async cancelSession(): Promise<void> {
    if (!this.currentSession) return;

    await this.speak('Session cancelled.');
    this.currentSession.state = 'cancelled';
    this.currentSession.endTime = new Date();
    this.onStateChangeCallback?.('cancelled');
    
    this.cleanup();
  }

  private cleanup(): void {
    this.stopListening();
    this.currentSession = null;
    this.sessionProgress = null;
  }

  public startListening(): void {
    if (!this.recognition || this.isListening) return;
    
    try {
      this.recognition.start();
    } catch (error) {
      console.error('Failed to start listening:', error);
    }
  }

  public stopListening(): void {
    if (!this.recognition || !this.isListening) return;
    
    try {
      this.recognition.stop();
    } catch (error) {
      console.error('Failed to stop listening:', error);
    }
  }

  public async speak(text: string, options?: SpeechSynthesisOptions): Promise<void> {
    if (!this.synthesis) {
      console.warn('Speech synthesis not available');
      return;
    }

    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Apply options
      if (options) {
        if (options.rate) utterance.rate = options.rate;
        if (options.pitch) utterance.pitch = options.pitch;
        if (options.volume) utterance.volume = options.volume;
      }

      utterance.onend = () => resolve();
      utterance.onerror = (error) => reject(error);

      if (this.synthesis) {
        this.synthesis.speak(utterance);
      } else {
        reject(new Error('Speech synthesis not available'));
      }
    });
  }

  public getCurrentSession(): VoiceSession | null {
    return this.currentSession;
  }

  public getSessionProgress(): SessionProgress | null {
    return this.sessionProgress;
  }

  public setTranscriptionCallback(callback: (result: TranscriptionResult) => void): void {
    this.onTranscriptionCallback = callback;
  }

  public setStateChangeCallback(callback: (state: VoiceInteractionState) => void): void {
    this.onStateChangeCallback = callback;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public isSessionActive(): boolean {
    return this.currentSession !== null && this.currentSession.state === 'active';
  }

  public getSupportedVoices(): SpeechSynthesisVoice[] {
    if (!this.synthesis) return [];
    return this.synthesis.getVoices();
  }

  public isSpeechRecognitionSupported(): boolean {
    return this.recognition !== null;
  }

  public isSpeechSynthesisSupported(): boolean {
    return this.synthesis !== null;
  }

  private validateFieldInput(field: ToolField, input: string): FieldValidationResult {
    const errors: string[] = [];
    let processedValue = input.trim();

    // Required field validation
    if (field.required && !processedValue) {
      errors.push(`${field.name} is required`);
      return { isValid: false, errors, field };
    }

    // Skip other validations if field is empty and not required
    if (!processedValue && !field.required) {
      return { isValid: true, value: '', errors: [], field };
    }

    // Type-specific validation and processing
    switch (field.type) {
      case 'text':
        processedValue = this.processTextInput(processedValue, field, errors);
        break;
      case 'number':
        processedValue = this.processNumberInput(processedValue, field, errors);
        break;
      case 'email':
        processedValue = this.processEmailInput(processedValue, field, errors);
        break;
      case 'phone':
        processedValue = this.processPhoneInput(processedValue, field, errors);
        break;
      case 'date':
        processedValue = this.processDateInput(processedValue, field, errors);
        break;
      case 'select':
        processedValue = this.processSelectInput(processedValue, field, errors);
        break;
    }

    // Additional validation rules
    if (field.validation?.clientSide) {
      const clientValidation = field.validation.clientSide;
      
      if (clientValidation.minLength && processedValue.length < clientValidation.minLength) {
        errors.push(`${field.name} must be at least ${clientValidation.minLength} characters`);
      }
      
      if (clientValidation.maxLength && processedValue.length > clientValidation.maxLength) {
        errors.push(`${field.name} must be no more than ${clientValidation.maxLength} characters`);
      }
      
      if (clientValidation.regex) {
        const regex = new RegExp(clientValidation.regex);
        if (!regex.test(processedValue)) {
          errors.push(`${field.name} format is invalid`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      value: processedValue,
      errors,
      field
    };
  }

  private processTextInput(input: string, field: ToolField, errors: string[]): string {
    return input.trim();
  }

  private processNumberInput(input: string, field: ToolField, errors: string[]): string {
    const numericValue = parseFloat(input.replace(/[^\d.-]/g, ''));
    if (isNaN(numericValue)) {
      errors.push(`${field.name} must be a valid number`);
      return input;
    }
    return numericValue.toString();
  }

  private processEmailInput(input: string, field: ToolField, errors: string[]): string {
    const email = input.toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.push(`${field.name} must be a valid email address`);
    }
    return email;
  }

  private processPhoneInput(input: string, field: ToolField, errors: string[]): string {
    // Extract only digits
    const digits = input.replace(/\D/g, '');
    
    if (digits.length < 10) {
      errors.push(`${field.name} must be a valid phone number with at least 10 digits`);
      return input;
    }
    
    // Format as (XXX) XXX-XXXX
    if (digits.length === 10) {
      return `(${digits.substr(0, 3)}) ${digits.substr(3, 3)}-${digits.substr(6, 4)}`;
    } else if (digits.length === 11 && digits[0] === '1') {
      return `+1 (${digits.substr(1, 3)}) ${digits.substr(4, 3)}-${digits.substr(7, 4)}`;
    }
    
    return digits;
  }

  private processDateInput(input: string, field: ToolField, errors: string[]): string {
    // Try to parse various date formats
    const datePatterns = [
      /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/,  // MM/DD/YYYY or MM-DD-YYYY
      /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/,  // YYYY/MM/DD or YYYY-MM-DD
      /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/   // MM/DD/YY or MM-DD-YY
    ];
    
    for (const pattern of datePatterns) {
      const match = input.match(pattern);
      if (match) {
        let [, part1, part2, part3] = match;
        let year, month, day;
        
        if (pattern === datePatterns[1]) { // YYYY-MM-DD format
          [year, month, day] = [part1, part2, part3];
        } else { // MM-DD-YYYY or MM-DD-YY format
          [month, day, year] = [part1, part2, part3];
          if (year.length === 2) {
            year = parseInt(year) < 50 ? `20${year}` : `19${year}`;
          }
        }
        
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        if (!isNaN(date.getTime())) {
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
      }
    }
    
    errors.push(`${field.name} must be a valid date (MM/DD/YYYY format preferred)`);
    return input;
  }

  private processSelectInput(input: string, field: ToolField, errors: string[]): string {
    if (!field.options || field.options.length === 0) {
      errors.push(`${field.name} has no available options`);
      return input;
    }
    
    const normalizedInput = input.toLowerCase().trim();
    
    // Try exact match first
    const exactMatch = field.options.find(option => 
      option.toLowerCase() === normalizedInput
    );
    if (exactMatch) {
      return exactMatch;
    }
    
    // Try partial match
    const partialMatch = field.options.find(option => 
      option.toLowerCase().includes(normalizedInput) || 
      normalizedInput.includes(option.toLowerCase())
    );
    if (partialMatch) {
      return partialMatch;
    }
    
    errors.push(`${field.name} must be one of: ${field.options.join(', ')}`);
    return input;
  }
}

export default VoiceInteractionService;
