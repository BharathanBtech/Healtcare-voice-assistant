import { ProviderConfig, ApiResponse } from '@/types';
import { ProviderService } from './ProviderService';
import { StorageService } from './StorageService';
import axios from 'axios';

export interface STTResult {
  text: string;
  confidence: number;
  language?: string;
  alternatives?: Array<{
    text: string;
    confidence: number;
  }>;
}

export interface LLMResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;
  finishReason?: string;
}

export interface TTSResult {
  audioUrl: string;
  audioBuffer?: ArrayBuffer;
  format: string;
  duration?: number;
}

export class AIProviderService {
  private static providerConfig: ProviderConfig | null = null;

  /**
   * Initialize the AI providers with current configuration
   */
  static async initialize(): Promise<boolean> {
    try {
      this.providerConfig = await ProviderService.loadProviderConfig();
      return this.providerConfig !== null;
    } catch (error) {
      console.error('Failed to initialize AI providers:', error);
      return false;
    }
  }

  /**
   * Get current provider configuration
   */
  static getProviderConfig(): ProviderConfig | null {
    return this.providerConfig;
  }

  /**
   * Check if all required providers are configured
   */
  static areProvidersConfigured(): boolean {
    return !!(this.providerConfig?.stt && this.providerConfig?.llm && this.providerConfig?.tts);
  }

  // ==================== SPEECH-TO-TEXT METHODS ====================

  /**
   * Convert audio to text using configured STT provider
   */
  static async speechToText(audioBlob: Blob): Promise<ApiResponse<STTResult>> {
    if (!this.providerConfig?.stt) {
      return {
        success: false,
        error: 'STT provider not configured'
      };
    }

    const { type: provider, credentials, config } = this.providerConfig.stt;

    try {
      switch (provider) {
        case 'openai':
          return await this.openaiSTT(audioBlob, credentials, config);
        case 'azure':
          return await this.azureSTT(audioBlob, credentials, config);
        case 'google':
          return await this.googleSTT(audioBlob, credentials, config);
        case 'amazon':
          return await this.amazonSTT(audioBlob, credentials, config);
        default:
          return {
            success: false,
            error: `Unsupported STT provider: ${provider}`
          };
      }
    } catch (error: any) {
      console.error('STT processing error:', error);
      return {
        success: false,
        error: error.message || 'STT processing failed'
      };
    }
  }

  private static async openaiSTT(audioBlob: Blob, credentials: any, config: any): Promise<ApiResponse<STTResult>> {
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.wav');
    formData.append('model', config.model || 'whisper-1');
    if (config.language) {
      formData.append('language', config.language);
    }

    const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
      headers: {
        'Authorization': `Bearer ${credentials.apiKey}`,
        'Content-Type': 'multipart/form-data'
      },
      timeout: 30000
    });

    return {
      success: true,
      data: {
        text: response.data.text,
        confidence: 0.9, // OpenAI doesn't provide confidence scores
        language: config.language || 'en'
      }
    };
  }

  private static async azureSTT(audioBlob: Blob, credentials: any, config: any): Promise<ApiResponse<STTResult>> {
    const arrayBuffer = await audioBlob.arrayBuffer();
    
    const response = await axios.post(
      `https://${credentials.region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`,
      arrayBuffer,
      {
        headers: {
          'Ocp-Apim-Subscription-Key': credentials.subscriptionKey,
          'Content-Type': 'audio/wav',
        },
        params: {
          language: config.language || 'en-US'
        },
        timeout: 30000
      }
    );

    return {
      success: true,
      data: {
        text: response.data.DisplayText || response.data.RecognitionStatus,
        confidence: response.data.Confidence || 0.8,
        language: config.language || 'en-US'
      }
    };
  }

  private static async googleSTT(audioBlob: Blob, credentials: any, config: any): Promise<ApiResponse<STTResult>> {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBytes = Buffer.from(arrayBuffer).toString('base64');

    const requestBody = {
      config: {
        encoding: 'WEBM_OPUS',
        sampleRateHertz: 16000,
        languageCode: config.languageCode || 'en-US',
        model: config.model || 'default'
      },
      audio: {
        content: audioBytes
      }
    };

    const response = await axios.post(
      `https://speech.googleapis.com/v1/speech:recognize?key=${credentials.apiKey}`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const result = response.data.results?.[0];
    if (!result) {
      return {
        success: false,
        error: 'No transcription results'
      };
    }

    return {
      success: true,
      data: {
        text: result.alternatives[0].transcript,
        confidence: result.alternatives[0].confidence || 0.8,
        language: config.languageCode || 'en-US',
        alternatives: result.alternatives.slice(1).map((alt: any) => ({
          text: alt.transcript,
          confidence: alt.confidence || 0.5
        }))
      }
    };
  }

  private static async amazonSTT(audioBlob: Blob, credentials: any, config: any): Promise<ApiResponse<STTResult>> {
    // Amazon Transcribe requires more complex setup with AWS SDK
    // For now, return a placeholder implementation
    return {
      success: false,
      error: 'Amazon Transcribe integration not yet implemented'
    };
  }

  // ==================== LARGE LANGUAGE MODEL METHODS ====================

  /**
   * Process text using configured LLM provider
   */
  static async processWithLLM(
    prompt: string,
    context?: string,
    systemMessage?: string
  ): Promise<ApiResponse<LLMResponse>> {
    if (!this.providerConfig?.llm) {
      return {
        success: false,
        error: 'LLM provider not configured'
      };
    }

    const { type: provider, credentials, config } = this.providerConfig.llm;

    try {
      switch (provider) {
        case 'openai':
          return await this.openaiLLM(prompt, credentials, config, context, systemMessage);
        case 'azure':
          return await this.azureLLM(prompt, credentials, config, context, systemMessage);
        case 'anthropic':
          return await this.anthropicLLM(prompt, credentials, config, context, systemMessage);
        default:
          return {
            success: false,
            error: `Unsupported LLM provider: ${provider}`
          };
      }
    } catch (error: any) {
      console.error('LLM processing error:', error);
      return {
        success: false,
        error: error.message || 'LLM processing failed'
      };
    }
  }

  private static async openaiLLM(
    prompt: string,
    credentials: any,
    config: any,
    context?: string,
    systemMessage?: string
  ): Promise<ApiResponse<LLMResponse>> {
    const messages: Array<{ role: string; content: string }> = [];

    if (systemMessage) {
      messages.push({ role: 'system', content: systemMessage });
    }

    if (context) {
      messages.push({ role: 'user', content: context });
    }

    messages.push({ role: 'user', content: prompt });

    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: config.model || 'gpt-4',
      messages,
      temperature: config.temperature || 0.7,
      max_tokens: config.maxTokens || 1000
    }, {
      headers: {
        'Authorization': `Bearer ${credentials.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    const choice = response.data.choices[0];
    return {
      success: true,
      data: {
        text: choice.message.content,
        usage: {
          promptTokens: response.data.usage.prompt_tokens,
          completionTokens: response.data.usage.completion_tokens,
          totalTokens: response.data.usage.total_tokens
        },
        model: response.data.model,
        finishReason: choice.finish_reason
      }
    };
  }

  private static async azureLLM(
    prompt: string,
    credentials: any,
    config: any,
    context?: string,
    systemMessage?: string
  ): Promise<ApiResponse<LLMResponse>> {
    const messages: Array<{ role: string; content: string }> = [];

    if (systemMessage) {
      messages.push({ role: 'system', content: systemMessage });
    }

    if (context) {
      messages.push({ role: 'user', content: context });
    }

    messages.push({ role: 'user', content: prompt });

    const endpoint = credentials.endpoint.replace(/\/+$/, ''); // Remove trailing slashes
    const url = `${endpoint}/openai/deployments/${credentials.deploymentName}/chat/completions?api-version=${config.apiVersion}`;

    const response = await axios.post(url, {
      messages,
      temperature: config.temperature || 0.7,
      max_tokens: 1000
    }, {
      headers: {
        'api-key': credentials.apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    const choice = response.data.choices[0];
    return {
      success: true,
      data: {
        text: choice.message.content,
        usage: {
          promptTokens: response.data.usage.prompt_tokens,
          completionTokens: response.data.usage.completion_tokens,
          totalTokens: response.data.usage.total_tokens
        },
        model: response.data.model,
        finishReason: choice.finish_reason
      }
    };
  }

  private static async anthropicLLM(
    prompt: string,
    credentials: any,
    config: any,
    context?: string,
    systemMessage?: string
  ): Promise<ApiResponse<LLMResponse>> {
    let fullPrompt = prompt;
    if (context) {
      fullPrompt = `Context: ${context}\n\nUser: ${prompt}`;
    }
    if (systemMessage) {
      fullPrompt = `${systemMessage}\n\n${fullPrompt}`;
    }

    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: config.model || 'claude-3-opus-20240229',
      max_tokens: config.maxTokens || 1000,
      messages: [{ role: 'user', content: fullPrompt }]
    }, {
      headers: {
        'x-api-key': credentials.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    return {
      success: true,
      data: {
        text: response.data.content[0].text,
        usage: {
          promptTokens: response.data.usage.input_tokens,
          completionTokens: response.data.usage.output_tokens,
          totalTokens: response.data.usage.input_tokens + response.data.usage.output_tokens
        },
        model: response.data.model,
        finishReason: response.data.stop_reason
      }
    };
  }

  // ==================== TEXT-TO-SPEECH METHODS ====================

  /**
   * Convert text to speech using configured TTS provider
   */
  static async textToSpeech(text: string): Promise<ApiResponse<TTSResult>> {
    if (!this.providerConfig?.tts) {
      return {
        success: false,
        error: 'TTS provider not configured'
      };
    }

    const { type: provider, credentials, config } = this.providerConfig.tts;

    try {
      switch (provider) {
        case 'openai':
          return await this.openaiTTS(text, credentials, config);
        case 'azure':
          return await this.azureTTS(text, credentials, config);
        case 'google':
          return await this.googleTTS(text, credentials, config);
        case 'amazon':
          return await this.amazonTTS(text, credentials, config);
        default:
          return {
            success: false,
            error: `Unsupported TTS provider: ${provider}`
          };
      }
    } catch (error: any) {
      console.error('TTS processing error:', error);
      return {
        success: false,
        error: error.message || 'TTS processing failed'
      };
    }
  }

  private static async openaiTTS(text: string, credentials: any, config: any): Promise<ApiResponse<TTSResult>> {
    const response = await axios.post('https://api.openai.com/v1/audio/speech', {
      model: config.model || 'tts-1',
      input: text,
      voice: config.voice || 'alloy'
    }, {
      headers: {
        'Authorization': `Bearer ${credentials.apiKey}`,
        'Content-Type': 'application/json'
      },
      responseType: 'arraybuffer',
      timeout: 30000
    });

    // Create blob URL for audio playback
    const audioBlob = new Blob([response.data], { type: 'audio/mpeg' });
    const audioUrl = URL.createObjectURL(audioBlob);

    return {
      success: true,
      data: {
        audioUrl,
        audioBuffer: response.data,
        format: 'mp3'
      }
    };
  }

  private static async azureTTS(text: string, credentials: any, config: any): Promise<ApiResponse<TTSResult>> {
    const ssml = `
      <speak version='1.0' xml:lang='en-US'>
        <voice name='${config.voice || 'en-US-JennyNeural'}'>
          <prosody style='${config.style || 'neutral'}'>
            ${text}
          </prosody>
        </voice>
      </speak>
    `;

    const response = await axios.post(
      `https://${credentials.region}.tts.speech.microsoft.com/cognitiveservices/v1`,
      ssml,
      {
        headers: {
          'Ocp-Apim-Subscription-Key': credentials.subscriptionKey,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3'
        },
        responseType: 'arraybuffer',
        timeout: 30000
      }
    );

    const audioBlob = new Blob([response.data], { type: 'audio/mpeg' });
    const audioUrl = URL.createObjectURL(audioBlob);

    return {
      success: true,
      data: {
        audioUrl,
        audioBuffer: response.data,
        format: 'mp3'
      }
    };
  }

  private static async googleTTS(text: string, credentials: any, config: any): Promise<ApiResponse<TTSResult>> {
    const requestBody = {
      input: { text },
      voice: {
        languageCode: config.languageCode || 'en-US',
        name: config.voiceName || 'en-US-Wavenet-D'
      },
      audioConfig: {
        audioEncoding: 'MP3'
      }
    };

    const response = await axios.post(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${credentials.apiKey}`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const audioBuffer = Buffer.from(response.data.audioContent, 'base64');
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
    const audioUrl = URL.createObjectURL(audioBlob);

    return {
      success: true,
      data: {
        audioUrl,
        audioBuffer: audioBuffer.buffer,
        format: 'mp3'
      }
    };
  }

  private static async amazonTTS(text: string, credentials: any, config: any): Promise<ApiResponse<TTSResult>> {
    // Amazon Polly requires AWS SDK setup
    // For now, return a placeholder implementation
    return {
      success: false,
      error: 'Amazon Polly integration not yet implemented'
    };
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Test all configured providers
   */
  static async testAllProviders(): Promise<{
    stt: boolean;
    llm: boolean;
    tts: boolean;
  }> {
    const results = {
      stt: false,
      llm: false,
      tts: false
    };

    // Test STT (we need an audio blob, so we'll skip for now)
    // results.stt = await this.testSTT();

    // Test LLM
    try {
      const llmResult = await this.processWithLLM('Hello, this is a test.');
      results.llm = llmResult.success;
    } catch (error) {
      console.error('LLM test failed:', error);
    }

    // Test TTS
    try {
      const ttsResult = await this.textToSpeech('Hello, this is a test.');
      results.tts = ttsResult.success;
    } catch (error) {
      console.error('TTS test failed:', error);
    }

    return results;
  }

  /**
   * Refresh provider configuration
   */
  static async refreshConfig(): Promise<boolean> {
    return await this.initialize();
  }
}
