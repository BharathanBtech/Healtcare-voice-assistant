import { AIProviderService, STTResult } from './AIProviderService';

export interface RecordingConfig {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  maxDuration: number; // in milliseconds
  silenceThreshold: number; // volume threshold for silence detection
  silenceDuration: number; // milliseconds of silence before stopping
}

export interface RecordingResult {
  audioBlob: Blob;
  duration: number;
  sampleRate: number;
}

export class VoiceRecordingService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;
  private audioChunks: Blob[] = [];
  private startTime: number = 0;
  private isRecording: boolean = false;
  private silenceTimer: NodeJS.Timeout | null = null;
  
  private config: RecordingConfig = {
    sampleRate: 16000,
    channels: 1,
    bitsPerSample: 16,
    maxDuration: 30000, // 30 seconds
    silenceThreshold: 0.01,
    silenceDuration: 2000 // 2 seconds
  };

  private onRecordingStart?: () => void;
  private onRecordingStop?: (result: RecordingResult) => void;
  private onRecordingError?: (error: Error) => void;
  private onTranscriptionResult?: (result: STTResult) => void;

  constructor(config?: Partial<RecordingConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Initialize the recording service and request microphone permissions
   */
  async initialize(): Promise<boolean> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Media recording is not supported in this browser');
      }

      // Request microphone access
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.config.sampleRate,
          channelCount: this.config.channels,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      return true;
    } catch (error) {
      console.error('Failed to initialize voice recording:', error);
      this.onRecordingError?.(error as Error);
      return false;
    }
  }

  /**
   * Start recording audio
   */
  async startRecording(): Promise<boolean> {
    if (this.isRecording) {
      console.warn('Recording is already in progress');
      return false;
    }

    if (!this.audioStream) {
      const initialized = await this.initialize();
      if (!initialized) {
        return false;
      }
    }

    try {
      // Create MediaRecorder
      this.mediaRecorder = new MediaRecorder(this.audioStream!, {
        mimeType: this.getSupportedMimeType()
      });

      // Reset audio chunks
      this.audioChunks = [];
      this.startTime = Date.now();
      this.isRecording = true;

      // Set up event handlers
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.handleRecordingComplete();
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        this.onRecordingError?.(new Error('Recording failed'));
        this.stopRecording();
      };

      // Start recording
      this.mediaRecorder.start(100); // Record in 100ms chunks
      this.onRecordingStart?.();

      // Set up silence detection
      this.setupSilenceDetection();

      // Set maximum duration timeout
      setTimeout(() => {
        if (this.isRecording) {
          this.stopRecording();
        }
      }, this.config.maxDuration);

      return true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.onRecordingError?.(error as Error);
      return false;
    }
  }

  /**
   * Stop recording audio
   */
  stopRecording(): void {
    if (!this.isRecording || !this.mediaRecorder) {
      return;
    }

    this.isRecording = false;
    this.mediaRecorder.stop();

    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  /**
   * Process recorded audio and get transcription
   */
  async processRecording(audioBlob: Blob): Promise<STTResult | null> {
    try {
      // Initialize AI providers if not already done
      const initialized = await AIProviderService.initialize();
      if (!initialized) {
        throw new Error('AI providers not configured');
      }

      // Convert audio to text using configured STT provider
      const sttResult = await AIProviderService.speechToText(audioBlob);
      
      if (sttResult.success && sttResult.data) {
        this.onTranscriptionResult?.(sttResult.data);
        return sttResult.data;
      } else {
        throw new Error(sttResult.error || 'STT processing failed');
      }
    } catch (error) {
      console.error('Failed to process recording:', error);
      this.onRecordingError?.(error as Error);
      return null;
    }
  }

  /**
   * Handle recording completion
   */
  private handleRecordingComplete(): void {
    const duration = Date.now() - this.startTime;
    
    // Create audio blob from chunks
    const audioBlob = new Blob(this.audioChunks, {
      type: this.getSupportedMimeType()
    });

    const result: RecordingResult = {
      audioBlob,
      duration,
      sampleRate: this.config.sampleRate
    };

    this.onRecordingStop?.(result);

    // Automatically process the recording for transcription
    this.processRecording(audioBlob);
  }

  /**
   * Set up silence detection to automatically stop recording
   */
  private setupSilenceDetection(): void {
    if (!this.audioStream) return;

    try {
      // Create audio context for volume analysis
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(this.audioStream);
      const analyser = audioContext.createAnalyser();
      
      analyser.fftSize = 256;
      source.connect(analyser);
      
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      const checkVolume = () => {
        if (!this.isRecording) {
          audioContext.close();
          return;
        }
        
        analyser.getByteFrequencyData(dataArray);
        
        // Calculate average volume
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength / 255; // Normalize to 0-1
        
        if (average < this.config.silenceThreshold) {
          // Start silence timer if not already running
          if (!this.silenceTimer) {
            this.silenceTimer = setTimeout(() => {
              if (this.isRecording) {
                console.log('Stopping recording due to silence');
                this.stopRecording();
              }
            }, this.config.silenceDuration);
          }
        } else {
          // Clear silence timer if there's sound
          if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
          }
        }
        
        // Continue monitoring
        requestAnimationFrame(checkVolume);
      };
      
      checkVolume();
    } catch (error) {
      console.warn('Silence detection not available:', error);
    }
  }

  /**
   * Get supported MIME type for recording
   */
  private getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/wav'
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return 'audio/webm'; // fallback
  }

  /**
   * Check if recording is currently active
   */
  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Get recording configuration
   */
  getConfig(): RecordingConfig {
    return { ...this.config };
  }

  /**
   * Update recording configuration
   */
  updateConfig(newConfig: Partial<RecordingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Set event handlers
   */
  setEventHandlers(handlers: {
    onRecordingStart?: () => void;
    onRecordingStop?: (result: RecordingResult) => void;
    onRecordingError?: (error: Error) => void;
    onTranscriptionResult?: (result: STTResult) => void;
  }): void {
    this.onRecordingStart = handlers.onRecordingStart;
    this.onRecordingStop = handlers.onRecordingStop;
    this.onRecordingError = handlers.onRecordingError;
    this.onTranscriptionResult = handlers.onTranscriptionResult;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.isRecording) {
      this.stopRecording();
    }

    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }

    this.mediaRecorder = null;
    this.audioChunks = [];
  }

  /**
   * Check if browser supports voice recording
   */
  static isSupported(): boolean {
    return !!(
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function' &&
      window.MediaRecorder
    );
  }

  /**
   * Request microphone permissions (without initializing)
   */
  static async requestPermissions(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error('Microphone permission denied:', error);
      return false;
    }
  }
}
