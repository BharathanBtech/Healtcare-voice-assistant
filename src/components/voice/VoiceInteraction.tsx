import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Tool, VoiceInteractionState } from '@/types';
import { ToolService } from '@/services/ToolService';
import VoiceInteractionService, { 
  TranscriptionResult, 
  VoiceInteractionConfig,
  SessionProgress 
} from '@/services/VoiceInteractionService';

interface VoiceInteractionProps {
  toolId?: string;
}

const VoiceInteraction: React.FC<VoiceInteractionProps> = ({ toolId: propToolId }) => {
  const navigate = useNavigate();
  const { toolId: paramToolId } = useParams<{ toolId: string }>();
  const toolId = propToolId || paramToolId;
  
  const [tool, setTool] = useState<Tool | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [interactionState, setInteractionState] = useState<VoiceInteractionState>('idle');
  const [transcription, setTranscription] = useState('');
  const [interimTranscription, setInterimTranscription] = useState('');
  const [sessionProgress, setSessionProgress] = useState<SessionProgress | null>(null);
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [isSessionActive, setIsSessionActive] = useState(false);
  
  const voiceService = useRef(VoiceInteractionService.getInstance());
  const transcriptionHistoryRef = useRef<string[]>([]);

  const defaultConfig: VoiceInteractionConfig = {
    autoAdvance: true,
    confirmationRequired: false,
    maxRetries: 3,
    silenceTimeout: 5000,
    confidenceThreshold: 0.7
  };

  useEffect(() => {
    if (!toolId) {
      toast.error('No tool ID provided');
      navigate('/dashboard');
      return;
    }

    loadTool();
    setupVoiceCallbacks();

    return () => {
      cleanupSession();
    };
  }, [toolId]);

  const loadTool = async () => {
    try {
      setIsLoading(true);
      const loadedTool = await ToolService.loadTool(toolId!);
      if (!loadedTool) {
        toast.error('Tool not found');
        navigate('/dashboard');
        return;
      }
      setTool(loadedTool);
    } catch (error) {
      console.error('Failed to load tool:', error);
      toast.error('Failed to load tool');
      navigate('/dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  const setupVoiceCallbacks = () => {
    const service = voiceService.current;
    
    service.setTranscriptionCallback((result: TranscriptionResult) => {
      if (result.isFinal) {
        setTranscription(result.text);
        setInterimTranscription('');
        transcriptionHistoryRef.current.push(result.text);
        
        // Process the input if confidence is high enough
        if (result.confidence >= defaultConfig.confidenceThreshold) {
          handleUserInput(result.text);
        }
      } else {
        setInterimTranscription(result.text);
      }
    });

    service.setStateChangeCallback((state: VoiceInteractionState) => {
      setInteractionState(state);
      
      // Update session progress when state changes
      const progress = service.getSessionProgress();
      if (progress) {
        setSessionProgress(progress);
      }
    });
  };

  const startSession = async () => {
    if (!tool) {
      toast.error('No tool loaded');
      return;
    }

    try {
      setIsSessionActive(true);
      setCurrentPrompt('Starting session...');
      
      const session = await voiceService.current.startSession(tool, defaultConfig);
      toast.success('Voice session started');
      
      // Start processing fields
      await voiceService.current.processNextField();
      
    } catch (error) {
      console.error('Failed to start session:', error);
      toast.error('Failed to start voice session');
      setIsSessionActive(false);
    }
  };

  const handleUserInput = async (input: string) => {
    try {
      await voiceService.current.processUserInput(input);
      setTranscription(''); // Clear transcription after processing
    } catch (error) {
      console.error('Failed to process user input:', error);
      toast.error('Failed to process your response');
    }
  };

  const pauseSession = () => {
    voiceService.current.stopListening();
    setInteractionState('paused');
  };

  const resumeSession = () => {
    voiceService.current.startListening();
    setInteractionState('listening');
  };

  const cancelSession = async () => {
    try {
      await voiceService.current.cancelSession();
      setIsSessionActive(false);
      setSessionProgress(null);
      setTranscription('');
      setInterimTranscription('');
      toast('Session cancelled', { icon: 'ℹ️' });
    } catch (error) {
      console.error('Failed to cancel session:', error);
      toast.error('Failed to cancel session');
    }
  };

  const cleanupSession = () => {
    if (isSessionActive) {
      voiceService.current.cancelSession();
    }
  };

  const getStateIcon = (): string => {
    switch (interactionState) {
      case 'listening':
        return '🎤';
      case 'processing':
        return '⚙️';
      case 'speaking':
        return '🔊';
      case 'error':
        return '❌';
      case 'completed':
        return '✅';
      case 'paused':
        return '⏸️';
      default:
        return '⏹️';
    }
  };

  const getStateText = (): string => {
    switch (interactionState) {
      case 'listening':
        return 'Listening...';
      case 'processing':
        return 'Processing...';
      case 'speaking':
        return 'Speaking...';
      case 'error':
        return 'Error occurred';
      case 'completed':
        return 'Session completed';
      case 'paused':
        return 'Session paused';
      case 'active':
        return 'Session active';
      default:
        return 'Ready to start';
    }
  };

  const getProgressPercentage = (): number => {
    if (!sessionProgress || sessionProgress.totalFields === 0) return 0;
    return (sessionProgress.completedFields / sessionProgress.totalFields) * 100;
  };

  if (isLoading) {
    return (
      <div className="voice-interaction-loading">
        <div className="loading-spinner"></div>
        <p>Loading voice interaction...</p>
      </div>
    );
  }

  if (!tool) {
    return (
      <div className="voice-interaction-error">
        <h2>Tool Not Found</h2>
        <p>The requested tool could not be loaded.</p>
        <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="voice-interaction">
      {/* Header */}
      <div className="voice-header">
        <div className="voice-header-content">
          <button 
            className="btn btn-secondary"
            onClick={() => navigate('/dashboard')}
          >
            ← Back to Dashboard
          </button>
          <div className="voice-title">
            <h1>{tool.name}</h1>
            <p>{tool.description}</p>
          </div>
        </div>
      </div>

      <div className="voice-content">
        <div className="voice-main">
          {/* Session Status */}
          <div className="session-status-card">
            <div className="status-header">
              <div className="status-indicator">
                <span className="status-icon">{getStateIcon()}</span>
                <span className="status-text">{getStateText()}</span>
              </div>
              <div className="voice-controls">
                {!isSessionActive ? (
                  <button 
                    className="btn btn-primary btn-lg"
                    onClick={startSession}
                    disabled={!voiceService.current.isSpeechRecognitionSupported()}
                  >
                    🎤 Start Voice Session
                  </button>
                ) : (
                  <div className="session-controls">
                    {interactionState === 'listening' ? (
                      <button 
                        className="btn btn-secondary"
                        onClick={pauseSession}
                      >
                        ⏸️ Pause
                      </button>
                    ) : interactionState === 'paused' ? (
                      <button 
                        className="btn btn-primary"
                        onClick={resumeSession}
                      >
                        ▶️ Resume
                      </button>
                    ) : null}
                    
                    <button 
                      className="btn btn-danger"
                      onClick={cancelSession}
                    >
                      🛑 Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            {sessionProgress && (
              <div className="progress-section">
                <div className="progress-info">
                  <span>Progress: {sessionProgress.completedFields} of {sessionProgress.totalFields} fields</span>
                  <span>{Math.round(getProgressPercentage())}%</span>
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${getProgressPercentage()}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Transcription Display */}
          <div className="transcription-card">
            <div className="card-header">
              <h3 className="card-title">Live Transcription</h3>
              {interactionState === 'listening' && (
                <div className="voice-indicator recording" />
              )}
            </div>
            <div className="transcription-content">
              {transcription && (
                <div className="final-transcription">
                  <strong>You said:</strong> {transcription}
                </div>
              )}
              {interimTranscription && (
                <div className="interim-transcription">
                  <em>Listening:</em> {interimTranscription}
                </div>
              )}
              {!transcription && !interimTranscription && (
                <div className="transcription-placeholder">
                  {isSessionActive 
                    ? 'Waiting for your voice input...' 
                    : 'Start a session to see transcription'
                  }
                </div>
              )}
            </div>
          </div>

          {/* Current Prompt Display */}
          {currentPrompt && (
            <div className="prompt-card">
              <div className="card-header">
                <h3 className="card-title">Current Question</h3>
              </div>
              <div className="prompt-content">
                <p>{currentPrompt}</p>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar with Field Status */}
        <div className="voice-sidebar">
          <div className="fields-status-card">
            <div className="card-header">
              <h3 className="card-title">Field Status</h3>
            </div>
            <div className="fields-list">
              {tool.fields?.map((field, index) => {
                const status = sessionProgress?.fieldStatuses.get(field.id) || 'pending';
                const isActive = sessionProgress?.currentFieldIndex === index;
                
                return (
                  <div 
                    key={field.id} 
                    className={`field-status-item ${status} ${isActive ? 'active' : ''}`}
                  >
                    <div className="field-info">
                      <span className="field-name">
                        {field.name}
                        {field.required && <span className="required-indicator">*</span>}
                      </span>
                      <span className="field-type">{field.type}</span>
                    </div>
                    <div className="status-badge">
                      {status === 'completed' && '✅'}
                      {status === 'error' && '❌'}
                      {status === 'pending' && (isActive ? '⏳' : '⏸️')}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Browser Capabilities */}
          <div className="capabilities-card">
            <div className="card-header">
              <h3 className="card-title">Browser Support</h3>
            </div>
            <div className="capabilities-list">
              <div className="capability">
                <span>Speech Recognition:</span>
                <span className={voiceService.current.isSpeechRecognitionSupported() ? 'supported' : 'unsupported'}>
                  {voiceService.current.isSpeechRecognitionSupported() ? '✅ Supported' : '❌ Unsupported'}
                </span>
              </div>
              <div className="capability">
                <span>Speech Synthesis:</span>
                <span className={voiceService.current.isSpeechSynthesisSupported() ? 'supported' : 'unsupported'}>
                  {voiceService.current.isSpeechSynthesisSupported() ? '✅ Supported' : '❌ Unsupported'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceInteraction;
