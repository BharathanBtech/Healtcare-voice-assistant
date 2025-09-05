import { VoiceSession, ApiResponse, Tool } from '@/types';
import { apiClient } from '@/config/api';
import { StorageService } from './StorageService';

export interface VoiceSessionData {
  id?: string;
  tool_id: string;
  session_state: 'initializing' | 'active' | 'paused' | 'completed' | 'cancelled' | 'error';
  collected_data: Record<string, any>;
  field_statuses: Record<string, 'pending' | 'completed' | 'error'>;
  transcript?: Array<{
    timestamp: Date;
    speaker: 'user' | 'system';
    text: string;
    confidence?: number;
  }>;
  start_time?: Date;
  end_time?: Date;
}

export class VoiceSessionService {
  /**
   * Create a new voice session in the database
   */
  static async createVoiceSession(sessionData: VoiceSessionData): Promise<ApiResponse<VoiceSession>> {
    try {
      const response = await apiClient.post('/api/voice-sessions', {
        tool_id: sessionData.tool_id,
        session_state: sessionData.session_state,
        collected_data: sessionData.collected_data,
        field_statuses: sessionData.field_statuses,
        transcript: sessionData.transcript || [],
        start_time: sessionData.start_time || new Date()
      });

      if (response.data.success) {
        const voiceSession = this.mapToVoiceSession(response.data.data);
        
        // Cache locally for offline access
        this.cacheSession(voiceSession);
        
        return {
          success: true,
          data: voiceSession,
          message: 'Voice session created successfully'
        };
      } else {
        return {
          success: false,
          error: response.data.error || 'Failed to create voice session'
        };
      }
    } catch (error: any) {
      console.error('Error creating voice session:', error);
      
      if (error.response?.status === 400) {
        return {
          success: false,
          error: error.response.data?.error || 'Invalid session data'
        };
      } else if (error.response?.status === 401) {
        return {
          success: false,
          error: 'Authentication required'
        };
      } else {
        return {
          success: false,
          error: 'Failed to create voice session. Please try again.'
        };
      }
    }
  }

  /**
   * Update an existing voice session
   */
  static async updateVoiceSession(sessionId: string, updateData: Partial<VoiceSessionData>): Promise<ApiResponse<VoiceSession>> {
    try {
      const response = await apiClient.put(`/api/voice-sessions/${sessionId}`, updateData);

      if (response.data.success) {
        const voiceSession = this.mapToVoiceSession(response.data.data);
        
        // Update cache
        this.cacheSession(voiceSession);
        
        return {
          success: true,
          data: voiceSession,
          message: 'Voice session updated successfully'
        };
      } else {
        return {
          success: false,
          error: response.data.error || 'Failed to update voice session'
        };
      }
    } catch (error: any) {
      console.error('Error updating voice session:', error);
      
      if (error.response?.status === 404) {
        return {
          success: false,
          error: 'Voice session not found'
        };
      } else if (error.response?.status === 401) {
        return {
          success: false,
          error: 'Authentication required'
        };
      } else {
        return {
          success: false,
          error: 'Failed to update voice session. Please try again.'
        };
      }
    }
  }

  /**
   * Save session progress (collected data, field statuses, transcript)
   */
  static async saveSessionProgress(
    sessionId: string,
    collectedData: Record<string, any>,
    fieldStatuses: Record<string, 'pending' | 'completed' | 'error'>,
    transcript?: Array<{ timestamp: Date; speaker: 'user' | 'system'; text: string; confidence?: number }>
  ): Promise<ApiResponse<VoiceSession>> {
    try {
      const updateData: Partial<VoiceSessionData> = {
        collected_data: collectedData,
        field_statuses: fieldStatuses,
        session_state: 'active'
      };

      if (transcript) {
        updateData.transcript = transcript;
      }

      return await this.updateVoiceSession(sessionId, updateData);
    } catch (error) {
      console.error('Error saving session progress:', error);
      return {
        success: false,
        error: 'Failed to save session progress'
      };
    }
  }

  /**
   * Complete a voice session
   */
  static async completeVoiceSession(
    sessionId: string,
    finalData: Record<string, any>,
    transcript: Array<{ timestamp: Date; speaker: 'user' | 'system'; text: string; confidence?: number }>
  ): Promise<ApiResponse<VoiceSession>> {
    try {
      const updateData: Partial<VoiceSessionData> = {
        session_state: 'completed',
        collected_data: finalData,
        transcript,
        end_time: new Date()
      };

      return await this.updateVoiceSession(sessionId, updateData);
    } catch (error) {
      console.error('Error completing voice session:', error);
      return {
        success: false,
        error: 'Failed to complete voice session'
      };
    }
  }

  /**
   * Cancel a voice session
   */
  static async cancelVoiceSession(sessionId: string): Promise<ApiResponse<VoiceSession>> {
    try {
      const updateData: Partial<VoiceSessionData> = {
        session_state: 'cancelled',
        end_time: new Date()
      };

      return await this.updateVoiceSession(sessionId, updateData);
    } catch (error) {
      console.error('Error cancelling voice session:', error);
      return {
        success: false,
        error: 'Failed to cancel voice session'
      };
    }
  }

  /**
   * Pause a voice session
   */
  static async pauseVoiceSession(
    sessionId: string,
    currentData: Record<string, any>,
    fieldStatuses: Record<string, 'pending' | 'completed' | 'error'>
  ): Promise<ApiResponse<VoiceSession>> {
    try {
      const updateData: Partial<VoiceSessionData> = {
        session_state: 'paused',
        collected_data: currentData,
        field_statuses: fieldStatuses
      };

      return await this.updateVoiceSession(sessionId, updateData);
    } catch (error) {
      console.error('Error pausing voice session:', error);
      return {
        success: false,
        error: 'Failed to pause voice session'
      };
    }
  }

  /**
   * Resume a voice session
   */
  static async resumeVoiceSession(sessionId: string): Promise<ApiResponse<VoiceSession>> {
    try {
      const updateData: Partial<VoiceSessionData> = {
        session_state: 'active'
      };

      return await this.updateVoiceSession(sessionId, updateData);
    } catch (error) {
      console.error('Error resuming voice session:', error);
      return {
        success: false,
        error: 'Failed to resume voice session'
      };
    }
  }

  /**
   * Add transcript entry to a session
   */
  static async addTranscriptEntry(
    sessionId: string,
    entry: { speaker: 'user' | 'system'; text: string; confidence?: number }
  ): Promise<void> {
    try {
      // Get current session from cache
      const cachedSession = this.getCachedSession(sessionId);
      if (cachedSession) {
        const transcript = cachedSession.transcript || [];
        transcript.push({
          timestamp: new Date(),
          ...entry
        });

        // Update session with new transcript
        await this.updateVoiceSession(sessionId, {
          transcript
        });
      }
    } catch (error) {
      console.error('Error adding transcript entry:', error);
    }
  }

  /**
   * Get voice sessions for a tool
   */
  static async getVoiceSessionsForTool(toolId: string): Promise<VoiceSession[]> {
    try {
      // For now, return cached sessions. In a full implementation,
      // this would make an API call to get sessions from the database
      const cachedSessions = this.getAllCachedSessions();
      return cachedSessions.filter(session => session.toolId === toolId);
    } catch (error) {
      console.error('Error getting voice sessions for tool:', error);
      return [];
    }
  }

  /**
   * Map database response to VoiceSession type
   */
  private static mapToVoiceSession(sessionData: any): VoiceSession {
    return {
      id: sessionData.id,
      toolId: sessionData.tool_id,
      startTime: new Date(sessionData.start_time || sessionData.created_at),
      endTime: sessionData.end_time ? new Date(sessionData.end_time) : undefined,
      state: sessionData.session_state,
      currentField: null, // Will be populated from field_statuses if needed
      collectedData: sessionData.collected_data || {},
      fieldStatuses: sessionData.field_statuses || {},
      transcript: sessionData.transcript || [],
      config: {
        autoAdvance: true,
        confirmationRequired: false,
        maxRetries: 3,
        silenceTimeout: 5000,
        confidenceThreshold: 0.7
      }
    };
  }

  /**
   * Cache session locally for offline access
   */
  private static cacheSession(session: VoiceSession): void {
    try {
      const cachedSessions = this.getAllCachedSessions();
      const existingIndex = cachedSessions.findIndex(s => s.id === session.id);
      
      if (existingIndex >= 0) {
        cachedSessions[existingIndex] = session;
      } else {
        cachedSessions.push(session);
      }
      
      StorageService.setItem('voice_sessions', cachedSessions);
    } catch (error) {
      console.error('Error caching session:', error);
    }
  }

  /**
   * Get cached session by ID
   */
  private static getCachedSession(sessionId: string): VoiceSession | null {
    try {
      const cachedSessions = this.getAllCachedSessions();
      return cachedSessions.find(s => s.id === sessionId) || null;
    } catch (error) {
      console.error('Error getting cached session:', error);
      return null;
    }
  }

  /**
   * Get all cached sessions
   */
  private static getAllCachedSessions(): VoiceSession[] {
    try {
      return StorageService.getItem<VoiceSession[]>('voice_sessions') || [];
    } catch (error) {
      console.error('Error getting all cached sessions:', error);
      return [];
    }
  }

  /**
   * Clear session cache
   */
  static clearSessionCache(): void {
    try {
      StorageService.removeItem('voice_sessions');
    } catch (error) {
      console.error('Error clearing session cache:', error);
    }
  }

  /**
   * Generate a unique session ID
   */
  static generateSessionId(): string {
    return `vs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
