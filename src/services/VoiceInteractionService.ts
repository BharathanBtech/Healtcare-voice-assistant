import { Tool, ToolField, VoiceSession, FieldValidationResult, VoiceInteractionState } from '@/types';
import { ProviderService } from './ProviderService';
import { validateField } from '@/validations';
import { RealTimeDataHandoffService, DataHandoffResult } from './RealTimeDataHandoffService';
import { VoiceSessionService } from './VoiceSessionService';
import { AIProviderService, STTResult, LLMResponse, TTSResult } from './AIProviderService';
import { VoiceRecordingService, RecordingResult } from './VoiceRecordingService';
import { ConversationLogger } from './ConversationLogger';

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
  private voiceRecorder: VoiceRecordingService | null = null;
  private isListening = false;
  private currentSession: VoiceSession | null = null;
  private onTranscriptionCallback?: (result: TranscriptionResult) => void;
  private onStateChangeCallback?: (state: VoiceInteractionState) => void;
  private sessionProgress: SessionProgress | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private listeningTimeout: NodeJS.Timeout | null = null;
  private readonly MAX_LISTENING_TIME = 5000; // 5 seconds max - shorter timeout
  private speechTimeoutId: NodeJS.Timeout | null = null;
  private silenceTimeoutId: NodeJS.Timeout | null = null;
  private speechRecognition: any = null; // Browser SpeechRecognition
  private performanceMode = false; // Set to true to disable LLM processing for faster response
  private conversationSessionId: string = ''; // For conversation logging

  private constructor() {
    this.initializeAIServices();
  }

  public static getInstance(): VoiceInteractionService {
    if (!VoiceInteractionService.instance) {
      VoiceInteractionService.instance = new VoiceInteractionService();
    }
    return VoiceInteractionService.instance;
  }

  private async initializeAIServices(): Promise<void> {
    try {
      // Initialize AI Provider Service
      await AIProviderService.initialize();
      
      // Initialize Voice Recording Service
      this.voiceRecorder = new VoiceRecordingService({
        maxDuration: 30000, // 30 seconds max
        silenceThreshold: 0.01,
        silenceDuration: 2000 // 2 seconds of silence
      });
      
      this.setupRecordingEvents();
    } catch (error) {
      console.error('Failed to initialize AI services:', error);
    }
  }

  private setupRecordingEvents(): void {
    if (!this.voiceRecorder) return;

    this.voiceRecorder.setEventHandlers({
      onRecordingStart: () => {
        this.isListening = true;
        this.onStateChangeCallback?.('listening');
      },
      
      onRecordingStop: async (result: RecordingResult) => {
        this.isListening = false;
        this.onStateChangeCallback?.('processing');
        console.log(`Recording completed: ${result.duration}ms`);
      },
      
      onRecordingError: (error: Error) => {
        console.error('Recording error:', error);
        this.isListening = false;
        this.onStateChangeCallback?.('error');
      },
      
      onTranscriptionResult: async (result: STTResult) => {
        // Log user message
        if (this.conversationSessionId && result.text && result.text.trim()) {
          const currentField = await this.getCurrentField();
          ConversationLogger.logUserMessage(
            this.conversationSessionId,
            result.text,
            {
              currentField: currentField?.name,
              fieldType: currentField?.type,
              isRequired: currentField?.required,
              recognitionConfidence: result.confidence
            },
            {
              recognizedText: result.text,
              processingTime: Date.now()
            }
          );
        }
        
        // Use original result immediately, enhance in background
        this.onTranscriptionCallback?.({
          text: result.text,
          confidence: result.confidence,
          isFinal: true
        });
        this.onStateChangeCallback?.('idle');
        
        // Enhance transcription in background for future use (non-blocking)
        if (result.confidence < 0.8) {
          this.enhanceTranscriptionInBackground(result);
        }
      }
    });
  }

  public async startSession(tool: Tool, config: VoiceInteractionConfig): Promise<VoiceSession> {
    if (this.currentSession) {
      throw new Error('A voice session is already active');
    }

    const sessionId = VoiceSessionService.generateSessionId();
    
    // Create session in database
    const dbSessionResult = await VoiceSessionService.createVoiceSession({
      tool_id: tool.id,
      session_state: 'initializing',
      collected_data: {},
      field_statuses: {},
      transcript: [],
      start_time: new Date()
    });

    if (!dbSessionResult.success || !dbSessionResult.data) {
      throw new Error(`Failed to create voice session: ${dbSessionResult.error}`);
    }

    const session = dbSessionResult.data;
    this.currentSession = session;
    this.initializeSessionProgress(tool);
    
    // Start conversation logging
    this.conversationSessionId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    ConversationLogger.startSession(this.conversationSessionId, tool.id, tool.name);
    ConversationLogger.logSystemEvent(this.conversationSessionId, 'Voice session started', {
      currentField: tool.fields?.[0]?.name,
      fieldType: tool.fields?.[0]?.type,
      isRequired: tool.fields?.[0]?.required
    });

    // Add initial prompt to transcript
    const initialPrompt = tool.initialPrompt || `Let's start collecting information for ${tool.name}.`;
    await VoiceSessionService.addTranscriptEntry(session.id, {
      speaker: 'system',
      text: initialPrompt
    });

    // Update session state to active immediately
    session.state = 'active';
    this.onStateChangeCallback?.('active');
    
    // Start with the initial prompt (non-blocking database update)
    const speakPromise = this.speak(initialPrompt);
    const updatePromise = VoiceSessionService.updateVoiceSession(session.id, {
      session_state: 'active'
    });
    
    // Wait for speech to complete, but don't block on database update
    await speakPromise;
    
    // Start first field immediately after initial prompt
    setTimeout(() => {
      this.processNextFieldWithTimeout();
    }, 500); // Small delay to let initial prompt finish
    
    // Database update happens in background
    updatePromise.catch(error => {
      console.error('Background session update failed:', error);
    });

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

    // Ask for the field using intelligent prompt generation
    const prompt = await this.generateIntelligentPrompt(currentField);
    
    await this.speak(prompt);
    this.startListening();
  }

  private async generateIntelligentPrompt(field: ToolField): Promise<string> {
    // Use default prompt immediately for performance, but try LLM with timeout
    const defaultPrompt = this.generateDefaultPrompt(field);
    
    // Skip LLM in performance mode or if not configured
    if (this.performanceMode || !AIProviderService.areProvidersConfigured()) {
      return defaultPrompt;
    }
    
    // Use LLM to generate contextual prompts if available, with timeout
    if (AIProviderService.areProvidersConfigured()) {
      try {
        // Race between LLM response and timeout (3 seconds max)
        const llmPromise = this.generateLLMPrompt(field);
        const timeoutPromise = new Promise<string>((resolve) => {
          setTimeout(() => resolve(defaultPrompt), 3000); // 3 second timeout
        });
        
        const result = await Promise.race([llmPromise, timeoutPromise]);
        return result || defaultPrompt;
      } catch (error) {
        console.error('Error generating intelligent prompt:', error);
      }
    }
    
    // Fallback to enhanced default prompt
    return defaultPrompt;
  }
  
  private async generateLLMPrompt(field: ToolField): Promise<string> {
    const tool = await this.getCurrentTool();
    const conversationContext = await this.getConversationContext();
    
    const systemMessage = `You are a healthcare voice assistant. Generate a brief, conversational prompt (max 25 words) for collecting this field. Be warm and clear.`;
    
    const prompt = `Field: ${field.name} (${field.type}), Required: ${field.required}. ${field.instructionalPrompt ? `Current: ${field.instructionalPrompt}` : ''}

Generate a brief, natural prompt to ask for this information:`;
    
    const llmResponse = await AIProviderService.processWithLLM(prompt, '', systemMessage);
    
    if (llmResponse.success && llmResponse.data) {
      const generatedPrompt = llmResponse.data.text.trim();
      // Ensure prompt isn't too long for TTS
      if (generatedPrompt.length > 0 && generatedPrompt.length < 200) {
        return generatedPrompt;
      }
    }
    
    return this.generateDefaultPrompt(field);
  }
  
  private async getConversationContext(): Promise<{
    recentInteractions: string[];
    completedFields: number;
    totalFields: number;
    hasErrors: boolean;
  }> {
    const context = {
      recentInteractions: [] as string[],
      completedFields: this.sessionProgress?.completedFields || 0,
      totalFields: this.sessionProgress?.totalFields || 0,
      hasErrors: false
    };
    
    if (this.currentSession && this.currentSession.transcript) {
      // Get last few interactions for context
      const recentTranscript = this.currentSession.transcript.slice(-6); // Last 6 entries
      context.recentInteractions = recentTranscript.map(entry => 
        `${entry.speaker}: ${entry.text}`
      );
      
      // Check for recent errors
      context.hasErrors = recentTranscript.some(entry => 
        entry.speaker === 'system' && 
        (entry.text.includes('sorry') || entry.text.includes('try again'))
      );
    }
    
    return context;
  }
  
  private generateDefaultPrompt(field: ToolField): string {
    const requiredText = field.required ? 'required' : 'optional';
    
    // Enhanced default prompts with better voice interaction guidance
    switch (field.type) {
      case 'text':
        return `Please tell me your ${field.name}. This is ${requiredText}.`;
      case 'number':
        return `What is your ${field.name}? Please say it as a number. This is ${requiredText}.`;
      case 'email':
        return `Please spell out your ${field.name} email address clearly. This is ${requiredText}.`;
      case 'phone':
        return `What's your ${field.name} phone number? You can say the digits in groups. This is ${requiredText}.`;
      case 'date':
        return `What is your ${field.name}? You can say it like "September 30, 1994" or "30 September 1994". This is ${requiredText}.`;
      case 'select':
        const options = field.options?.join(', ') || '';
        return `Please choose your ${field.name} from these options: ${options}. This is ${requiredText}.`;
      default:
        return `Please provide your ${field.name}. This is ${requiredText}.`;
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

    // Handle empty or whitespace-only input
    const trimmedInput = input.trim();
    if (trimmedInput.length === 0) {
      console.log('🔇 Empty input received - asking user to repeat');
      
      if (!currentField.required) {
        // Skip optional field
        console.log(`⏭️ Skipping optional field: ${currentField.name}`);
        this.sessionProgress.fieldStatuses.set(currentField.id, 'completed');
        this.sessionProgress.collectedData.set(currentField.name, null);
        this.sessionProgress.completedFields++;
        this.sessionProgress.currentFieldIndex++;
        
        const skipMessage = `Skipping ${currentField.name}.`;
        await this.speak(skipMessage);
        
        // Move to next field quickly
        setTimeout(() => {
          this.processNextFieldWithTimeout();
        }, 300);
        
        return { isValid: true, value: null, errors: [] };
      } else {
        // Ask for required field again
        const retryMessage = `I didn't hear anything. Please tell me your ${currentField.name}.`;
        await this.speak(retryMessage);
        
        // Retry same field quickly
        setTimeout(() => {
          this.startListening();
        }, 300);
        
        return { isValid: false, value: null, errors: ['No input detected'] };
      }
    }

    // Validate the input
    const validation = await this.validateFieldInput(currentField, trimmedInput);
    
    if (validation.isValid) {
      // Store the validated value immediately for performance
      console.log(`✅ Field validation successful - ${currentField.name}: "${validation.value}"`);
      this.sessionProgress.collectedData.set(currentField.name, validation.value);
      this.sessionProgress.fieldStatuses.set(currentField.id, 'completed');
      this.currentSession.collectedData[currentField.name] = validation.value;
      
      // Perform healthcare context validation in background (non-blocking)
      this.performHealthcareValidationInBackground(currentField, validation.value);
      
      // Continue with confirmation
      // Add user input to transcript
      await VoiceSessionService.addTranscriptEntry(this.currentSession.id, {
        speaker: 'user',
        text: input,
        confidence: 0.9 // Default confidence
      });
      
      // Confirm the input with better formatting for dates
      // Ensure we have a valid value to display (not placeholder text)
      let displayValue = validation.value;
      if (!displayValue || 
          displayValue === 'processedValue' || 
          displayValue === 'cleaned and formatted value' ||
          typeof displayValue !== 'string') {
        console.warn('Invalid validation value, using original input for confirmation');
        displayValue = trimmedInput;
      }
      
      let confirmationText = `Got it, ${currentField.name}: ${displayValue}`;
      console.log(`💬 Confirmation message: "${confirmationText}"`);
      
      if (currentField.type === 'date' && displayValue) {
        // Format date for confirmation (YYYY-MM-DD -> more readable format)
        const dateMatch = displayValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (dateMatch) {
          const [, year, month, day] = dateMatch;
          const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                            'July', 'August', 'September', 'October', 'November', 'December'];
          const monthName = monthNames[parseInt(month) - 1];
          const dayNum = parseInt(day);
          confirmationText = `Got it, ${currentField.name}: ${monthName} ${dayNum}, ${year}`;
        }
      }
      await this.speak(confirmationText);
      
      // Add confirmation to transcript
      await VoiceSessionService.addTranscriptEntry(this.currentSession.id, {
        speaker: 'system',
        text: confirmationText
      });
      
      // Healthcare validation warnings will be handled in background
      
      // Move to next field
      this.sessionProgress.completedFields++;
      this.sessionProgress.currentFieldIndex++;
      
      // Save progress to database in background
      this.saveSessionProgress().catch(error => {
        console.error('Background progress save failed:', error);
      });
      
      // Move to next field immediately with minimal delay
      setTimeout(() => {
        this.processNextFieldWithTimeout();
      }, 300); // Very brief pause for better UX
    } else {
      // Handle validation errors
      this.sessionProgress.fieldStatuses.set(currentField.id, 'error');
      this.sessionProgress.validationErrors.set(currentField.id, validation.errors);
      
      // Generate contextual error message with timeout
      const errorMessagePromise = this.generateContextualErrorMessage(currentField, input, validation.errors);
      const timeoutPromise = new Promise<string>(resolve => {
        setTimeout(() => resolve(`I'm sorry, ${validation.errors[0]}. Please try again.`), 2000);
      });
      
      const errorMessage = await Promise.race([errorMessagePromise, timeoutPromise]);
      await this.speak(errorMessage);
      
      // Ask for the field again with minimal delay
      setTimeout(() => {
        this.processNextFieldWithTimeout();
      }, 200); // Very quick recovery
    }

    return validation;
  }

  private async getCurrentTool(): Promise<Tool | null> {
    if (!this.currentSession) return null;
    
    try {
      const { ToolService } = await import('./ToolService');
      return await ToolService.loadTool(this.currentSession.toolId);
    } catch (error) {
      console.error('Failed to get current tool:', error);
      return null;
    }
  }
  
  private async getCurrentField(): Promise<ToolField | null> {
    if (!this.sessionProgress) return null;
    
    const tool = await this.getCurrentTool();
    if (!tool || !tool.fields) return null;
    
    const currentIndex = this.sessionProgress.currentFieldIndex;
    return tool.fields[currentIndex] || null;
  }

  private async saveSessionProgress(): Promise<void> {
    if (!this.currentSession || !this.sessionProgress) return;
    
    try {
      // Convert Maps to objects for database storage
      const collectedData = Object.fromEntries(this.sessionProgress.collectedData);
      const fieldStatuses: Record<string, 'pending' | 'completed' | 'error'> = {};
      
      this.sessionProgress.fieldStatuses.forEach((status, fieldId) => {
        fieldStatuses[fieldId] = status;
      });
      
      await VoiceSessionService.saveSessionProgress(
        this.currentSession.id,
        collectedData,
        fieldStatuses
      );
    } catch (error) {
      console.error('Failed to save session progress:', error);
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
    
    // Add conclusion to transcript
    await VoiceSessionService.addTranscriptEntry(this.currentSession.id, {
      speaker: 'system',
      text: conclusionPrompt
    });

    // Submit data if configured
    if (tool.dataHandoff) {
      try {
        this.onStateChangeCallback?.('processing');
        const processingMessage = 'Processing your information...';
        await this.speak(processingMessage);
        
        await VoiceSessionService.addTranscriptEntry(this.currentSession.id, {
          speaker: 'system',
          text: processingMessage
        });
        
        // Prepare data for handoff (add session metadata)
        const dataToSubmit = Object.fromEntries(this.sessionProgress.collectedData);
        dataToSubmit._sessionId = this.currentSession.id;
        dataToSubmit._toolId = tool.id;
        dataToSubmit._timestamp = new Date().toISOString();
        
        // Execute handoff using the new service
        const handoffResult: DataHandoffResult = await RealTimeDataHandoffService.executeHandoff(
          this.currentSession,
          tool,
          dataToSubmit
        );
        
        if (handoffResult.success) {
          const successMessage = handoffResult.submissionId 
            ? `Your information has been successfully submitted. Reference ID: ${handoffResult.submissionId}.`
            : 'Your information has been successfully submitted.';
          await this.speak(successMessage);
          await VoiceSessionService.addTranscriptEntry(this.currentSession.id, {
            speaker: 'system',
            text: successMessage
          });
        } else {
          throw new Error(handoffResult.message || 'Data handoff failed');
        }
      } catch (error) {
        console.error('Data submission failed:', error);
        const errorMessage = 'There was an issue submitting your information. Please contact support.';
        await this.speak(errorMessage);
        await VoiceSessionService.addTranscriptEntry(this.currentSession.id, {
          speaker: 'system',
          text: errorMessage
        });
      }
    }

    // Generate intelligent session summary
    const sessionSummary = await this.generateSessionSummary();
    if (sessionSummary) {
      await VoiceSessionService.addTranscriptEntry(this.currentSession.id, {
        speaker: 'system',
        text: `Session Summary: ${sessionSummary}`
      });
    }
    
    // Complete the session in database
    const finalData = Object.fromEntries(this.sessionProgress.collectedData);
    const transcript = this.currentSession.transcript || [];
    
    // Add session summary to final data if generated
    if (sessionSummary) {
      finalData._sessionSummary = sessionSummary;
    }
    
    await VoiceSessionService.completeVoiceSession(
      this.currentSession.id,
      finalData,
      transcript
    );

    // Update local session state
    this.currentSession.endTime = new Date();
    this.currentSession.state = 'completed';
    this.onStateChangeCallback?.('completed');
    
    // Log session completion
    if (this.conversationSessionId) {
      ConversationLogger.logSystemEvent(this.conversationSessionId, 'Session completed successfully');
      ConversationLogger.endSession(this.conversationSessionId, 'completed');
    }
    
    this.cleanup();
  }

  public async cancelSession(): Promise<void> {
    if (!this.currentSession) return;

    // Log session cancellation
    if (this.conversationSessionId) {
      ConversationLogger.logSystemEvent(this.conversationSessionId, 'Session cancelled by user');
      ConversationLogger.endSession(this.conversationSessionId, 'abandoned');
    }

    // FIRST: Stop all audio/speech immediately
    this.stopAllAudio();
    this.stopListening();
    
    const cancelMessage = 'Session cancelled.';
    
    // Add cancellation to transcript (without speaking it)
    await VoiceSessionService.addTranscriptEntry(this.currentSession.id, {
      speaker: 'system',
      text: cancelMessage
    });
    
    // Update session in database
    await VoiceSessionService.cancelVoiceSession(this.currentSession.id);
    
    // Update local session state
    this.currentSession.state = 'cancelled';
    this.currentSession.endTime = new Date();
    this.onStateChangeCallback?.('cancelled');
    
    this.cleanup();
  }

  private cleanup(): void {
    this.stopAllAudio();
    this.stopListening();
    this.currentSession = null;
    this.sessionProgress = null;
    this.conversationSessionId = ''; // Clear conversation logging session
  }
  
  private stopAllAudio(): void {
    // Stop any current TTS audio
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.src = '';
      this.currentAudio = null;
    }
    
    // Stop browser speech synthesis
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    
    // Stop browser speech recognition
    if (this.speechRecognition) {
      this.speechRecognition.stop();
      this.speechRecognition = null;
    }
  }
  
  private startBrowserSpeechRecognition(): boolean {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.log('Browser speech recognition not available');
      return false;
    }
    
    try {
      this.speechRecognition = new SpeechRecognition();
      this.speechRecognition.continuous = false; // Single utterance mode for better reliability
      this.speechRecognition.interimResults = true; // Show interim results for user feedback
      this.speechRecognition.lang = 'en-US';
      this.speechRecognition.maxAlternatives = 3; // Get multiple alternatives for better accuracy
      
      this.speechRecognition.onstart = () => {
        console.log('🎤 Browser speech recognition started');
        this.isListening = true;
        this.onStateChangeCallback?.('listening');
        
        // Set overall timeout to automatically stop listening
        this.speechTimeoutId = setTimeout(() => {
          console.log('⏰ Speech recognition timeout - no speech detected');
          this.stopListening();
          this.onStateChangeCallback?.('idle');
          // Provide empty response to continue flow
          this.onTranscriptionCallback?.({
            text: '',
            confidence: 0,
            isFinal: true
          });
        }, this.MAX_LISTENING_TIME);
      };
      
      this.speechRecognition.onresult = async (event: any) => {
        const results = event.results;
        let finalTranscript = '';
        let highestConfidence = 0;
        let interimTranscript = '';
        
        // Process all results to get both interim and final results
        for (let i = event.resultIndex; i < results.length; i++) {
          const result = results[i];
          const transcript = result[0].transcript.trim();
          const confidence = result[0].confidence || 0.9;
          
          if (result.isFinal) {
            if (transcript.length > 0) {
              finalTranscript = transcript;
              highestConfidence = confidence;
              
              console.log(`🎯 Final speech result: "${transcript}" (confidence: ${confidence})`);
              
              // Log user message from browser speech recognition
              if (this.conversationSessionId && transcript.trim()) {
                const currentField = await this.getCurrentField();
                ConversationLogger.logUserMessage(
                  this.conversationSessionId,
                  transcript,
                  {
                    currentField: currentField?.name,
                    fieldType: currentField?.type,
                    isRequired: currentField?.required,
                    recognitionConfidence: confidence
                  },
                  {
                    recognizedText: transcript,
                    processingTime: Date.now()
                  }
                );
              }
              
              // Clear timeouts since we got final speech
              if (this.silenceTimeoutId) {
                clearTimeout(this.silenceTimeoutId);
                this.silenceTimeoutId = null;
              }
              if (this.speechTimeoutId) {
                clearTimeout(this.speechTimeoutId);
                this.speechTimeoutId = null;
              }
              
              // Process the final result
              this.stopListening();
              this.onStateChangeCallback?.('processing');
              
              this.onTranscriptionCallback?.({
                text: finalTranscript,
                confidence: highestConfidence,
                isFinal: true
              });
              
              return; // Exit early after processing final result
            }
          } else {
            // Handle interim results
            if (transcript.length > 0) {
              interimTranscript = transcript;
              console.log(`🎤 Interim: "${transcript}"`);
              
              // Show interim transcription to user
              this.onTranscriptionCallback?.({
                text: interimTranscript,
                confidence: confidence,
                isFinal: false
              });
            }
          }
        }
        
        // Reset silence timeout on any speech activity
        if (this.silenceTimeoutId) {
          clearTimeout(this.silenceTimeoutId);
        }
        
        // Set up silence detection for final results
        this.silenceTimeoutId = setTimeout(() => {
          console.log('🔇 Silence detected after speech - finalizing');
          this.stopListening();
          
          // If we have interim text but no final, use the interim as final
          if (!finalTranscript && interimTranscript) {
            console.log(`📝 Using interim as final: "${interimTranscript}"`);
            this.onTranscriptionCallback?.({
              text: interimTranscript,
              confidence: 0.8, // Lower confidence since it was interim
              isFinal: true
            });
          } else if (!finalTranscript) {
            // No speech detected at all
            console.log('❌ No speech detected');
            this.onTranscriptionCallback?.({
              text: '',
              confidence: 0,
              isFinal: true
            });
          }
        }, 1500); // Reduced to 1.5 seconds for faster response
      };
      
      this.speechRecognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        this.isListening = false;
        
        // Handle specific error types
        if (event.error === 'not-allowed' || event.error === 'permission-denied') {
          console.error('Microphone permission denied');
          this.onStateChangeCallback?.('error');
          // Try to provide a fallback transcription callback to continue the session
          setTimeout(() => {
            this.onTranscriptionCallback?.({
              text: '',
              confidence: 0,
              isFinal: true
            });
          }, 100);
        } else if (event.error === 'no-speech') {
          console.log('No speech detected - this is normal');
          // Don't treat no-speech as an error, just continue
          this.onTranscriptionCallback?.({
            text: '',
            confidence: 0,
            isFinal: true
          });
        } else {
          console.error(`Speech recognition error: ${event.error}`);
          this.onStateChangeCallback?.('error');
          // Provide empty transcription to continue session flow
          this.onTranscriptionCallback?.({
            text: '',
            confidence: 0,
            isFinal: true
          });
        }
      };
      
      this.speechRecognition.onend = () => {
        console.log('🎤 Speech recognition ended');
        this.isListening = false;
        
        // Clear all timeouts
        if (this.speechTimeoutId) {
          clearTimeout(this.speechTimeoutId);
          this.speechTimeoutId = null;
        }
        if (this.silenceTimeoutId) {
          clearTimeout(this.silenceTimeoutId);
          this.silenceTimeoutId = null;
        }
        if (this.listeningTimeout) {
          clearTimeout(this.listeningTimeout);
          this.listeningTimeout = null;
        }
      };
      
      this.speechRecognition.start();
      return true;
    } catch (error) {
      console.error('Failed to start browser speech recognition:', error);
      return false;
    }
  }

  public async startListening(): Promise<void> {
    if (this.isListening) {
      console.warn('Already listening');
      return;
    }
    
    // Clear any existing timeout
    if (this.listeningTimeout) {
      clearTimeout(this.listeningTimeout);
    }
    
    // Check microphone permissions first
    try {
      const hasPermission = await this.requestMicrophonePermission();
      if (!hasPermission) {
        console.error('Microphone permission denied');
        this.onStateChangeCallback?.('error');
        // Still provide empty transcription to continue flow
        this.onTranscriptionCallback?.({
          text: '',
          confidence: 0,
          isFinal: true
        });
        return;
      }
    } catch (error) {
      console.error('Error requesting microphone permission:', error);
    }
    
    // Try browser speech recognition first if available
    if (this.startBrowserSpeechRecognition()) {
      return;
    }
    
    // Fallback to voice recorder service
    if (this.voiceRecorder) {
      this.voiceRecorder.startRecording().then(success => {
        if (success) {
          console.log('🎤 Voice recording started');
          this.isListening = true;
          this.onStateChangeCallback?.('listening');
          
          // Set timeout to automatically stop listening
          this.listeningTimeout = setTimeout(() => {
            console.log('⏰ Listening timeout - stopping recording');
            this.stopListening();
            this.onTranscriptionCallback?.({
              text: '',
              confidence: 0,
              isFinal: true
            });
            this.onStateChangeCallback?.('idle');
          }, this.MAX_LISTENING_TIME);
        }
      }).catch(error => {
        console.error('Failed to start voice recording:', error);
        this.onStateChangeCallback?.('error');
      });
    } else {
      console.error('No speech recognition available');
      this.onStateChangeCallback?.('error');
    }
  }

  public stopListening(): void {
    if (!this.isListening) return;
    
    // Clear all timeouts
    if (this.listeningTimeout) {
      clearTimeout(this.listeningTimeout);
      this.listeningTimeout = null;
    }
    if (this.speechTimeoutId) {
      clearTimeout(this.speechTimeoutId);
      this.speechTimeoutId = null;
    }
    if (this.silenceTimeoutId) {
      clearTimeout(this.silenceTimeoutId);
      this.silenceTimeoutId = null;
    }
    
    // Stop browser speech recognition
    if (this.speechRecognition) {
      this.speechRecognition.stop();
      this.speechRecognition = null;
    }
    
    // Stop voice recorder service
    if (this.voiceRecorder) {
      this.voiceRecorder.stopRecording();
    }
    
    this.isListening = false;
  }

  public async speak(text: string, options?: SpeechSynthesisOptions): Promise<void> {
    try {
      // Log agent message
      if (this.conversationSessionId && text && !text.includes('[SYSTEM]')) {
        const currentField = await this.getCurrentField();
        ConversationLogger.logAgentMessage(
          this.conversationSessionId,
          text,
          {
            currentField: currentField?.name,
            fieldType: currentField?.type,
            isRequired: currentField?.required
          }
        );
      }
      
      this.onStateChangeCallback?.('speaking');
      
      // Use AI TTS provider if available
      if (AIProviderService.areProvidersConfigured()) {
        const ttsResult = await AIProviderService.textToSpeech(text);
        
        if (ttsResult.success && ttsResult.data) {
          return new Promise((resolve, reject) => {
            // Stop any current audio
            if (this.currentAudio) {
              this.currentAudio.pause();
              this.currentAudio.src = '';
            }
            
            // Create and play audio
            this.currentAudio = new Audio(ttsResult.data!.audioUrl);
            this.currentAudio.onended = () => {
              this.onStateChangeCallback?.('idle');
              resolve();
            };
            this.currentAudio.onerror = (error) => {
              console.error('TTS audio playback error:', error);
              this.onStateChangeCallback?.('error');
              reject(error);
            };
            
            this.currentAudio.play().catch(reject);
          });
        } else {
          console.warn('TTS failed, falling back to browser synthesis:', ttsResult.error);
        }
      }
      
      // Fallback to browser speech synthesis
      if ('speechSynthesis' in window) {
        return new Promise((resolve, reject) => {
          const utterance = new SpeechSynthesisUtterance(text);
          
          // Apply options
          if (options) {
            if (options.rate) utterance.rate = options.rate;
            if (options.pitch) utterance.pitch = options.pitch;
            if (options.volume) utterance.volume = options.volume;
          }

          utterance.onend = () => {
            this.onStateChangeCallback?.('idle');
            resolve();
          };
          utterance.onerror = (error) => {
            this.onStateChangeCallback?.('error');
            reject(error);
          };

          window.speechSynthesis.speak(utterance);
        });
      } else {
        console.warn('No TTS available');
        this.onStateChangeCallback?.('idle');
      }
    } catch (error) {
      console.error('Speech synthesis error:', error);
      this.onStateChangeCallback?.('error');
    }
  }

  public getCurrentSession(): VoiceSession | null {
    return this.currentSession;
  }

  public getSessionProgress(): SessionProgress | null {
    return this.sessionProgress;
  }
  
  public getConversationSessionId(): string {
    return this.conversationSessionId;
  }

  public setTranscriptionCallback(callback: (result: TranscriptionResult) => void): void {
    this.onTranscriptionCallback = (result: TranscriptionResult) => {
      // Validate that this is actually user speech, not system prompts
      if (this.isValidUserTranscription(result.text)) {
        console.log(`🎤 Valid user transcription: "${result.text}" (confidence: ${result.confidence})`);
        callback(result);
      } else {
        console.warn(`⚠️ Rejected invalid transcription: "${result.text}" - appears to be system prompt`);
      }
    };
  }
  
  private isValidUserTranscription(text: string): boolean {
    if (!text || text.trim().length === 0) {
      return false;
    }
    
    // Be more lenient with transcription validation to capture user input
    // Only block obvious system prompts, not user responses that might contain similar words
    const strictSystemPromptPatterns = [
      /^please tell me your/i,
      /^what is your/i,
      /^please provide your/i,
      /^please spell out/i,
      /^please choose/i,
      /^let's start collecting/i,
      /^starting session/i,
      /^got it,/i,
      /session started/i,
      /session completed/i,
      /^thank you.*collected/i,
      /processing your information/i
    ];
    
    // Check if text starts with system prompt patterns (more precise matching)
    const isSystemPrompt = strictSystemPromptPatterns.some(pattern => pattern.test(text));
    
    if (isSystemPrompt) {
      console.log(`🚫 Rejected system prompt: "${text}"`);
      return false;
    }
    
    // Allow longer user input for voice recognition accuracy
    if (text.length > 500) {
      console.warn('Transcription very long, likely not user input');
      return false;
    }
    
    console.log(`✅ Accepted user transcription: "${text}"`);
    return true;
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
    if (!('speechSynthesis' in window)) return [];
    return window.speechSynthesis.getVoices();
  }

  public isSpeechRecognitionSupported(): boolean {
    // Check browser speech recognition first
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      return true;
    }
    
    // Check if AI providers are configured or voice recorder is supported
    return AIProviderService.areProvidersConfigured() || VoiceRecordingService.isSupported();
  }

  public isSpeechSynthesisSupported(): boolean {
    // Check if either AI providers are configured or browser API is available
    return AIProviderService.areProvidersConfigured() || ('speechSynthesis' in window);
  }

  public areAIProvidersConfigured(): boolean {
    return AIProviderService.areProvidersConfigured();
  }
  
  public setPerformanceMode(enabled: boolean): void {
    this.performanceMode = enabled;
    console.log(`🚀 Performance mode ${enabled ? 'enabled' : 'disabled'} - LLM processing ${enabled ? 'disabled' : 'enabled'}`);
  }
  
  public isPerformanceModeEnabled(): boolean {
    return this.performanceMode;
  }

  private async validateFieldInput(field: ToolField, input: string): Promise<FieldValidationResult> {
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

    // Use LLM for intelligent input processing if available
    if (AIProviderService.areProvidersConfigured()) {
      try {
        const llmResult = await this.processInputWithLLM(field, input);
        if (llmResult.success && llmResult.processedValue && llmResult.processedValue !== 'processedValue') {
          processedValue = llmResult.processedValue;
          if (llmResult.errors.length > 0) {
            errors.push(...llmResult.errors);
          }
          console.log(`🤖 LLM processed "${input}" -> "${processedValue}"`);
        } else {
          console.warn('LLM processing failed or returned invalid value, falling back to basic validation:', llmResult.error);
          // Fall back to basic processing
          processedValue = await this.processInputBasic(field, input, errors);
        }
      } catch (error) {
        console.warn('LLM processing threw error, falling back to basic validation:', error);
        processedValue = await this.processInputBasic(field, input, errors);
      }
    } else {
      // Use basic processing if LLM is not available
      console.log(`📝 Using basic processing for "${input}"`);
      processedValue = await this.processInputBasic(field, input, errors);
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

  private async processInputWithLLM(field: ToolField, input: string): Promise<{
    success: boolean;
    processedValue: string;
    errors: string[];
    error?: string;
  }> {
    try {
      const tool = await this.getCurrentTool();
      const toolContext = tool ? `Tool: ${tool.name}\nDescription: ${tool.description}` : '';
      
      let fieldDescription = `Field Name: ${field.name}\nType: ${field.type}\nRequired: ${field.required}`;
      if (field.description) {
        fieldDescription += `\nDescription: ${field.description}`;
      }
      if (field.options && field.options.length > 0) {
        fieldDescription += `\nValid options: ${field.options.join(', ')}`;
      }
      
      const systemMessage = `You are a healthcare voice assistant helping to process user input for medical forms. 
You need to:
1. Clean and normalize the input text
2. Extract the intended value based on field requirements
3. Handle speech recognition errors and common mistakes
4. Understand medical terminology and context
5. Return the processed value in the correct format
6. Identify any validation errors

For dates: Always return in YYYY-MM-DD format
For emails: Clean up spacing and ensure proper format
For phones: Format consistently and extract digits
For select fields: Match to the closest valid option
For medical terms: Use proper spelling and formatting`;
      
      const prompt = `Process this voice input for a healthcare form field:

${toolContext}

${fieldDescription}

User said: "${input}"

Please respond in JSON format:
{
  "processedValue": "cleaned and formatted value",
  "confidence": 0.95,
  "errors": ["list of any validation errors"],
  "reasoning": "brief explanation of processing"
}

If the input is unclear or invalid, still provide your best interpretation but include appropriate errors.`;
      
      const llmResponse = await AIProviderService.processWithLLM(prompt, '', systemMessage);
      
      if (!llmResponse.success || !llmResponse.data) {
        return {
          success: false,
          processedValue: input.trim(),
          errors: [],
          error: llmResponse.error || 'LLM processing failed'
        };
      }
      
      // Parse the JSON response
      try {
        const result = JSON.parse(llmResponse.data.text.trim());
        
        // Validate that we got a meaningful processed value, not the template placeholder
        let finalProcessedValue = result.processedValue;
        if (!finalProcessedValue || 
            finalProcessedValue === 'processedValue' || 
            finalProcessedValue === 'cleaned and formatted value' ||
            finalProcessedValue.includes('processedValue')) {
          console.warn('LLM returned placeholder value, using original input');
          finalProcessedValue = input.trim();
        }
        
        return {
          success: true,
          processedValue: finalProcessedValue,
          errors: result.errors || [],
        };
      } catch (parseError) {
        console.error('Failed to parse LLM response:', parseError);
        console.log('Raw LLM response:', llmResponse.data.text);
        
        // Try to extract value from non-JSON response
        const fallbackValue = this.extractValueFromLLMResponse(llmResponse.data.text, field);
        return {
          success: true,
          processedValue: fallbackValue || input.trim(),
          errors: []
        };
      }
    } catch (error) {
      console.error('LLM input processing error:', error);
      return {
        success: false,
        processedValue: input.trim(),
        errors: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  private extractValueFromLLMResponse(response: string, field: ToolField): string {
    // Simple fallback to extract value when JSON parsing fails
    console.log('Extracting value from non-JSON LLM response:', response);
    
    const lines = response.split('\n');
    for (const line of lines) {
      if (line.toLowerCase().includes('value') || line.toLowerCase().includes('result')) {
        // Try to extract a reasonable value
        const match = line.match(/["']([^"']+)["']/);
        if (match && match[1] !== 'processedValue' && match[1] !== 'cleaned and formatted value') {
          console.log('Extracted value from line:', match[1]);
          return match[1];
        }
      }
    }
    
    // Look for any quoted content that might be the processed value
    const quotedMatches = response.match(/["']([^"']{2,})["']/g);
    if (quotedMatches) {
      for (const quotedMatch of quotedMatches) {
        const value = quotedMatch.replace(/["']/g, '');
        if (value !== 'processedValue' && 
            value !== 'cleaned and formatted value' &&
            value.length > 1) {
          console.log('Extracted quoted value:', value);
          return value;
        }
      }
    }
    
    console.log('Could not extract meaningful value, returning original response');
    return response.trim();
  }
  
  private async processInputBasic(field: ToolField, input: string, errors: string[]): Promise<string> {
    let processedValue = input.trim();
    
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
        processedValue = await this.processDateInput(processedValue, field, errors);
        break;
      case 'select':
        processedValue = this.processSelectInput(processedValue, field, errors);
        break;
    }
    
    return processedValue;
  }

  private processTextInput(input: string, field: ToolField, errors: string[]): string {
    const cleanValue = input.trim();
    console.log(`📝 Text input processed: "${input}" -> "${cleanValue}"`);
    return cleanValue;
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

  private async processDateInput(input: string, field: ToolField, errors: string[]): Promise<string> {
    // First try standard date patterns
    const standardResult = this.processStandardDateFormats(input);
    if (standardResult) {
      return standardResult;
    }
    
    // If standard parsing fails, try natural language processing with LLM
    const llmResult = await this.processNaturalLanguageDate(input);
    if (llmResult) {
      return llmResult;
    }
    
    errors.push(`${field.name} must be a valid date. Try formats like "30 September 1994" or "09/30/1994"`);
    return input;
  }
  
  private processStandardDateFormats(input: string): string | null {
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
    
    return null;
  }
  
  private async processNaturalLanguageDate(input: string): Promise<string | null> {
    try {
      // Clean up the input (speech recognition might add extra characters)
      const cleanInput = input.replace(/[+\-\*\/]/g, ' ').replace(/\s+/g, ' ').trim();
      console.log(`🧠 Processing natural language date: "${cleanInput}"`);
      
      // Try local date parsing first (faster)
      const localResult = this.parseNaturalDateLocally(cleanInput);
      if (localResult) {
        console.log(`✅ Local date parsing successful: ${localResult}`);
        return localResult;
      }
      
      // Fallback to LLM if available and local parsing fails
      if (AIProviderService.areProvidersConfigured()) {
        console.log('🤖 Using LLM for date parsing...');
        const llmResult = await this.parseNaturalDateWithLLM(cleanInput);
        if (llmResult) {
          console.log(`✅ LLM date parsing successful: ${llmResult}`);
          return llmResult;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Natural language date processing error:', error);
      return null;
    }
  }
  
  private parseNaturalDateLocally(input: string): string | null {
    // Common month name mappings
    const monthNames: Record<string, string> = {
      'january': '01', 'jan': '01',
      'february': '02', 'feb': '02',
      'march': '03', 'mar': '03',
      'april': '04', 'apr': '04',
      'may': '05',
      'june': '06', 'jun': '06',
      'july': '07', 'jul': '07',
      'august': '08', 'aug': '08',
      'september': '09', 'sep': '09', 'sept': '09',
      'october': '10', 'oct': '10',
      'november': '11', 'nov': '11',
      'december': '12', 'dec': '12'
    };
    
    const lowerInput = input.toLowerCase();
    
    // Pattern: "30 September 1994" or "September 30 1994"
    const patterns = [
      /^(\d{1,2})\s+(\w+)\s+(\d{4})$/, // Day Month Year
      /^(\w+)\s+(\d{1,2})\s+(\d{4})$/, // Month Day Year
      /^(\d{1,2})\s+(\w+)\s+(\d{2})$/,  // Day Month YY
      /^(\w+)\s+(\d{1,2})\s+(\d{2})$/   // Month Day YY
    ];
    
    for (let i = 0; i < patterns.length; i++) {
      const match = lowerInput.match(patterns[i]);
      if (match) {
        let day, month, year;
        
        if (i % 2 === 0) { // Day Month Year patterns
          [, day, month, year] = match;
        } else { // Month Day Year patterns
          [, month, day, year] = match;
        }
        
        // Convert month name to number
        const monthNum = monthNames[month];
        if (!monthNum) continue;
        
        // Handle 2-digit years
        if (year.length === 2) {
          const yearNum = parseInt(year);
          year = yearNum < 50 ? `20${year}` : `19${year}`;
        }
        
        // Validate the date
        const dayNum = parseInt(day);
        const monthNumInt = parseInt(monthNum);
        const yearNum = parseInt(year);
        
        if (dayNum >= 1 && dayNum <= 31 && monthNumInt >= 1 && monthNumInt <= 12 && yearNum >= 1900 && yearNum <= 2100) {
          const testDate = new Date(yearNum, monthNumInt - 1, dayNum);
          if (testDate.getDate() === dayNum && testDate.getMonth() === monthNumInt - 1 && testDate.getFullYear() === yearNum) {
            return `${year}-${monthNum}-${dayNum.toString().padStart(2, '0')}`;
          }
        }
      }
    }
    
    return null;
  }
  
  private async parseNaturalDateWithLLM(input: string): Promise<string | null> {
    try {
      const prompt = `Parse the following natural language date and return ONLY the date in YYYY-MM-DD format. If you cannot parse it, return "INVALID".

Input: "${input}"

Examples:
- "30 September 1994" → "1994-09-30"
- "March 15 1985" → "1985-03-15"
- "12/25/1990" → "1990-12-25"

Output:`;

      const llmResponse = await AIProviderService.processWithLLM(prompt);
      
      if (llmResponse.success && llmResponse.data) {
        const result = llmResponse.data.text.trim();
        
        // Validate the LLM response format
        if (/^\d{4}-\d{2}-\d{2}$/.test(result) && result !== "INVALID") {
          return result;
        }
      }
      
      return null;
    } catch (error) {
      console.error('LLM date parsing error:', error);
      return null;
    }
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

  private async generateContextualErrorMessage(field: ToolField, userInput: string, errors: string[]): Promise<string> {
    // If LLM is not available, fall back to basic error message
    if (!AIProviderService.areProvidersConfigured()) {
      return `I'm sorry, ${errors.join('. ')}. Please try again.`;
    }

    try {
      const tool = await this.getCurrentTool();
      const toolContext = tool ? `Tool: ${tool.name}\nDescription: ${tool.description}` : '';
      
      const systemMessage = `You are a helpful healthcare voice assistant. When users make mistakes in voice input, you should:
1. Be empathetic and encouraging
2. Clearly explain what went wrong
3. Provide specific, actionable guidance
4. Use conversational, friendly language
5. Give examples when helpful
6. Keep responses concise but helpful

Avoid technical jargon and make the user feel comfortable to try again.`;
      
      const prompt = `The user tried to provide input for a healthcare form field but there were validation errors.

${toolContext}

Field Information:
- Name: ${field.name}
- Type: ${field.type}
- Required: ${field.required}
${field.description ? `- Description: ${field.description}` : ''}
${field.options ? `- Valid options: ${field.options.join(', ')}` : ''}

What the user said: "${userInput}"

Validation errors: ${errors.join('; ')}

Generate a helpful, conversational error message that:
1. Acknowledges what the user tried to do
2. Explains the issue clearly
3. Guides them on what to say next
4. Is encouraging and friendly

Keep it under 50 words and make it sound natural for voice interaction.`;
      
      const llmResponse = await AIProviderService.processWithLLM(prompt, '', systemMessage);
      
      if (llmResponse.success && llmResponse.data) {
        const generatedMessage = llmResponse.data.text.trim();
        // Ensure the message isn't too long for TTS
        if (generatedMessage.length < 300) {
          return generatedMessage;
        }
      }
    } catch (error) {
      console.error('Error generating contextual error message:', error);
    }
    
    // Fallback to basic error message
    return `I'm sorry, ${errors.join('. ')}. Please try again.`;
  }
  
  private async enhanceTranscriptionWithLLM(result: STTResult): Promise<STTResult> {
    // Only enhance if LLM is available and confidence is below threshold
    if (!AIProviderService.areProvidersConfigured() || result.confidence > 0.9) {
      return result;
    }
    
    try {
      const tool = await this.getCurrentTool();
      const currentField = this.currentSession?.currentField;
      
      const systemMessage = `You are a healthcare voice assistant that corrects speech-to-text transcription errors. Your job is to:
1. Fix obvious speech recognition mistakes
2. Correct medical terminology and drug names
3. Handle homophones (e.g., "to" vs "two", "there" vs "their")
4. Maintain the original meaning and intent
5. Only make corrections when you're confident
6. Preserve proper nouns and specific details

Do not change the fundamental meaning or add information not present.`;
      
      let contextInfo = '';
      if (tool) {
        contextInfo += `Tool context: ${tool.name}\n`;
      }
      if (currentField) {
        contextInfo += `Current field: ${currentField.name} (${currentField.type})\n`;
        if (currentField.options) {
          contextInfo += `Valid options: ${currentField.options.join(', ')}\n`;
        }
      }
      
      const prompt = `${contextInfo}
Original transcription: "${result.text}"
Confidence: ${result.confidence}

Please review and correct this transcription if needed. Return only the corrected text, or the original if no corrections are needed. Do not include explanations or additional text.`;
      
      const llmResponse = await AIProviderService.processWithLLM(prompt, '', systemMessage);
      
      if (llmResponse.success && llmResponse.data) {
        const enhancedText = llmResponse.data.text.trim();
        // Only use the enhanced text if it's reasonable (not too different in length)
        const lengthRatio = enhancedText.length / result.text.length;
        if (lengthRatio > 0.5 && lengthRatio < 2.0 && enhancedText.length > 0) {
          return {
            ...result,
            text: enhancedText,
            confidence: Math.min(0.95, result.confidence + 0.1) // Slight confidence boost
          };
        }
      }
    } catch (error) {
      console.error('Error enhancing transcription with LLM:', error);
    }
    
    return result;
  }
  
  private async performHealthcareContextValidation(field: ToolField, value: string): Promise<{
    isValid: boolean;
    warnings: string[];
    suggestions: string[];
  }> {
    if (!AIProviderService.areProvidersConfigured()) {
      return { isValid: true, warnings: [], suggestions: [] };
    }
    
    try {
      const tool = await this.getCurrentTool();
      const systemMessage = `You are a healthcare data validation assistant. Analyze user input for medical forms and identify potential issues:
1. Medical terminology accuracy
2. Common data entry errors
3. Unrealistic values (dates, measurements, etc.)
4. Potential safety concerns
5. Data consistency issues

Provide helpful warnings and suggestions without being overly restrictive. Focus on obvious errors or safety concerns.`;
      
      const prompt = `Validate this healthcare form input:

${tool ? `Tool: ${tool.name}\nTool Description: ${tool.description}\n` : ''}
Field: ${field.name} (${field.type})
${field.description ? `Field Description: ${field.description}\n` : ''}
User Input: "${value}"

Analyze for:
- Medical terminology correctness
- Realistic values and ranges
- Common input errors
- Potential safety concerns

Respond in JSON format:
{
  "isValid": true/false,
  "warnings": ["list of warnings if any"],
  "suggestions": ["list of improvement suggestions"]
}

Only flag serious concerns. Minor issues should be warnings, not validation failures.`;
      
      const llmResponse = await AIProviderService.processWithLLM(prompt, '', systemMessage);
      
      if (llmResponse.success && llmResponse.data) {
        try {
          const result = JSON.parse(llmResponse.data.text.trim());
          return {
            isValid: result.isValid !== false, // Default to valid if parsing fails
            warnings: result.warnings || [],
            suggestions: result.suggestions || []
          };
        } catch (parseError) {
          console.error('Failed to parse healthcare validation response:', parseError);
        }
      }
    } catch (error) {
      console.error('Error performing healthcare context validation:', error);
    }
    
    return { isValid: true, warnings: [], suggestions: [] };
  }
  
  public async generateSessionSummary(): Promise<string | null> {
    if (!AIProviderService.areProvidersConfigured() || !this.currentSession || !this.sessionProgress) {
      return null;
    }
    
    try {
      const tool = await this.getCurrentTool();
      const collectedData = Object.fromEntries(this.sessionProgress.collectedData);
      const transcript = this.currentSession.transcript || [];
      
      const systemMessage = `You are a healthcare assistant that generates session summaries. Create a concise, professional summary that:
1. Highlights key information collected
2. Notes any potential concerns or inconsistencies
3. Suggests follow-up actions if needed
4. Uses appropriate medical language
5. Maintains patient confidentiality
6. Is useful for healthcare providers`;
      
      const prompt = `Generate a session summary for this healthcare voice interaction:

${tool ? `Tool: ${tool.name}\nPurpose: ${tool.description}\n` : ''}
Session Duration: ${this.getSessionDuration()}
Completed Fields: ${this.sessionProgress.completedFields}/${this.sessionProgress.totalFields}

Collected Data:
${Object.entries(collectedData).map(([key, value]) => `- ${key}: ${value}`).join('\n')}

Conversation Quality:
- Total exchanges: ${transcript.length}
- User interactions: ${transcript.filter(t => t.speaker === 'user').length}
- Error corrections: ${transcript.filter(t => t.speaker === 'system' && t.text.includes('sorry')).length}

Generate a professional summary (150-200 words) that a healthcare provider would find useful. Focus on the medical information collected and any notable aspects of the interaction.`;
      
      const llmResponse = await AIProviderService.processWithLLM(prompt, '', systemMessage);
      
      if (llmResponse.success && llmResponse.data) {
        return llmResponse.data.text.trim();
      }
    } catch (error) {
      console.error('Error generating session summary:', error);
    }
    
    return null;
  }
  
  private getSessionDuration(): string {
    if (!this.currentSession?.startTime) return 'Unknown';
    
    const start = new Date(this.currentSession.startTime);
    const now = new Date();
    const durationMs = now.getTime() - start.getTime();
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  
  // Background processing methods for performance optimization
  
  private enhanceTranscriptionInBackground(result: STTResult): void {
    // Don't await this - let it run in background
    this.enhanceTranscriptionWithLLM(result).then(enhancedResult => {
      if (enhancedResult.text !== result.text) {
        console.log(`🔄 Enhanced transcription: "${result.text}" → "${enhancedResult.text}"`);
        // Could potentially update UI or store for future reference
      }
    }).catch(error => {
      console.error('Background transcription enhancement failed:', error);
    });
  }
  
  private performHealthcareValidationInBackground(field: ToolField, value: string): void {
    // Don't await this - let it run in background
    this.performHealthcareContextValidation(field, value).then(validation => {
      if (validation.warnings.length > 0) {
        console.log(`⚠️ Healthcare validation warnings for ${field.name}:`, validation.warnings);
        // Could potentially show non-blocking notifications to user
      }
      if (validation.suggestions.length > 0) {
        console.log(`💡 Healthcare validation suggestions for ${field.name}:`, validation.suggestions);
      }
    }).catch(error => {
      console.error('Background healthcare validation failed:', error);
    });
  }
  
  // Add a method to manually skip to next field with timeout
  public async processNextFieldWithTimeout(): Promise<void> {
    const timeout = new Promise<void>((resolve) => {
      setTimeout(() => {
        console.log('⏰ Field processing timeout, moving to next field');
        resolve();
      }, 2000); // 2 second max for field processing
    });
    
    const fieldProcessing = this.processNextField();
    
    try {
      await Promise.race([fieldProcessing, timeout]);
    } catch (error) {
      console.error('Error in field processing:', error);
      // Continue anyway
    }
  }
  
  private async requestMicrophonePermission(): Promise<boolean> {
    try {
      // Test microphone access by requesting media stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // If successful, stop the stream immediately since we only needed to test permissions
      stream.getTracks().forEach(track => track.stop());
      
      console.log('✅ Microphone permission granted');
      return true;
    } catch (error: any) {
      console.error('Microphone permission error:', error);
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        console.error('User denied microphone permission');
      } else if (error.name === 'NotFoundError') {
        console.error('No microphone found');
      } else {
        console.error('Other microphone error:', error.message);
      }
      
      return false;
    }
  }
}
export default VoiceInteractionService;
