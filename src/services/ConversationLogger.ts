export interface ConversationEntry {
  timestamp: string;
  speaker: 'agent' | 'user';
  message: string;
  context?: {
    currentField?: string;
    fieldType?: string;
    isRequired?: boolean;
    attemptNumber?: number;
    recognitionConfidence?: number;
    speechDuration?: number;
    errorType?: string;
  };
  metadata?: {
    audioUrl?: string;
    recognizedText?: string;
    processingTime?: number;
    validationResult?: any;
  };
}

export interface ConversationSession {
  sessionId: string;
  toolId: string;
  toolName: string;
  startTime: string;
  endTime?: string;
  entries: ConversationEntry[];
  summary?: {
    totalDuration: number;
    totalEntries: number;
    userSpeechCount: number;
    agentSpeechCount: number;
    fieldsCompleted: number;
    totalFields: number;
    errors: string[];
    completionStatus: 'completed' | 'abandoned' | 'error';
  };
}

export class ConversationLogger {
  private static sessions: Map<string, ConversationSession> = new Map();
  private static readonly STORAGE_KEY = 'hva_conversation_logs';
  private static readonly MAX_SESSIONS = 50; // Keep last 50 sessions

  /**
   * Start a new conversation session
   */
  static startSession(sessionId: string, toolId: string, toolName: string): void {
    const session: ConversationSession = {
      sessionId,
      toolId,
      toolName,
      startTime: new Date().toISOString(),
      entries: []
    };

    this.sessions.set(sessionId, session);
    this.saveToStorage();
    
    console.log(`🎤️ Conversation logging started for session: ${sessionId}`);
    console.log(`📂 Session details: ${toolName} (${toolId})`);
  }

  /**
   * Log agent message (TTS output)
   */
  static logAgentMessage(
    sessionId: string, 
    message: string, 
    context?: ConversationEntry['context']
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn(`Session ${sessionId} not found for agent message logging`);
      return;
    }

    const entry: ConversationEntry = {
      timestamp: new Date().toISOString(),
      speaker: 'agent',
      message,
      context
    };

    session.entries.push(entry);
    this.saveToStorage();

    console.log(`🤖 Agent: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`);
  }

  /**
   * Log user message (STT input)
   */
  static logUserMessage(
    sessionId: string, 
    message: string, 
    context?: ConversationEntry['context'],
    metadata?: ConversationEntry['metadata']
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn(`Session ${sessionId} not found for user message logging`);
      return;
    }

    const entry: ConversationEntry = {
      timestamp: new Date().toISOString(),
      speaker: 'user',
      message,
      context,
      metadata
    };

    session.entries.push(entry);
    this.saveToStorage();

    console.log(`👤 User: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}" ${context?.recognitionConfidence ? `(${Math.round(context.recognitionConfidence * 100)}% confidence)` : ''}`);
  }

  /**
   * Log system events (errors, field transitions, etc.)
   */
  static logSystemEvent(
    sessionId: string, 
    event: string, 
    context?: ConversationEntry['context']
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn(`Session ${sessionId} not found for system event logging`);
      return;
    }

    const entry: ConversationEntry = {
      timestamp: new Date().toISOString(),
      speaker: 'agent',
      message: `[SYSTEM] ${event}`,
      context
    };

    session.entries.push(entry);
    this.saveToStorage();

    console.log(`⚙️ System: ${event}`);
  }

  /**
   * End conversation session and generate summary
   */
  static endSession(sessionId: string, completionStatus: 'completed' | 'abandoned' | 'error' = 'completed'): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn(`Session ${sessionId} not found for ending`);
      return;
    }

    session.endTime = new Date().toISOString();
    
    // Generate summary
    const startTime = new Date(session.startTime);
    const endTime = new Date(session.endTime);
    const totalDuration = endTime.getTime() - startTime.getTime();
    
    const userSpeechCount = session.entries.filter(e => e.speaker === 'user' && !e.message.startsWith('[SYSTEM]')).length;
    const agentSpeechCount = session.entries.filter(e => e.speaker === 'agent' && !e.message.startsWith('[SYSTEM]')).length;
    const errors = session.entries.filter(e => e.context?.errorType).map(e => e.context!.errorType!);
    
    // Count unique fields that were attempted
    const fieldsAttempted = new Set(
      session.entries
        .filter(e => e.context?.currentField)
        .map(e => e.context!.currentField!)
    );

    session.summary = {
      totalDuration,
      totalEntries: session.entries.length,
      userSpeechCount,
      agentSpeechCount,
      fieldsCompleted: fieldsAttempted.size, // This is an approximation
      totalFields: 0, // Could be passed from the tool configuration
      errors: Array.from(new Set(errors)),
      completionStatus
    };

    this.saveToStorage();
    console.log(`🏁 Session ${sessionId} ended. Duration: ${Math.round(totalDuration / 1000)}s, Entries: ${session.entries.length}`);
  }

  /**
   * Get conversation session
   */
  static getSession(sessionId: string): ConversationSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all sessions
   */
  static getAllSessions(): ConversationSession[] {
    return Array.from(this.sessions.values()).sort((a, b) => 
      new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
  }

  /**
   * Export session as readable text
   */
  static exportSessionAsText(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return `Session ${sessionId} not found`;
    }

    let output = '';
    output += `=== VOICE SESSION TRANSCRIPT ===\n`;
    output += `Session ID: ${session.sessionId}\n`;
    output += `Tool: ${session.toolName} (${session.toolId})\n`;
    output += `Start Time: ${session.startTime}\n`;
    output += `End Time: ${session.endTime || 'In Progress'}\n`;
    
    if (session.summary) {
      output += `Duration: ${Math.round(session.summary.totalDuration / 1000)} seconds\n`;
      output += `Total Exchanges: ${session.summary.totalEntries}\n`;
      output += `User Messages: ${session.summary.userSpeechCount}\n`;
      output += `Agent Messages: ${session.summary.agentSpeechCount}\n`;
      output += `Status: ${session.summary.completionStatus}\n`;
      if (session.summary.errors.length > 0) {
        output += `Errors: ${session.summary.errors.join(', ')}\n`;
      }
    }
    
    output += `\n=== CONVERSATION ===\n`;

    session.entries.forEach((entry, index) => {
      const time = new Date(entry.timestamp).toLocaleTimeString();
      const speaker = entry.speaker === 'agent' ? '🤖 AGENT' : '👤 USER';
      
      output += `\n[${time}] ${speaker}: ${entry.message}\n`;
      
      if (entry.context) {
        const context = [];
        if (entry.context.currentField) context.push(`Field: ${entry.context.currentField}`);
        if (entry.context.fieldType) context.push(`Type: ${entry.context.fieldType}`);
        if (entry.context.isRequired !== undefined) context.push(`Required: ${entry.context.isRequired}`);
        if (entry.context.attemptNumber) context.push(`Attempt: ${entry.context.attemptNumber}`);
        if (entry.context.recognitionConfidence) context.push(`Confidence: ${Math.round(entry.context.recognitionConfidence * 100)}%`);
        if (entry.context.speechDuration) context.push(`Duration: ${entry.context.speechDuration}ms`);
        if (entry.context.errorType) context.push(`Error: ${entry.context.errorType}`);
        
        if (context.length > 0) {
          output += `    Context: ${context.join(', ')}\n`;
        }
      }
      
      if (entry.metadata) {
        const metadata = [];
        if (entry.metadata.processingTime) metadata.push(`Processing: ${entry.metadata.processingTime}ms`);
        if (entry.metadata.recognizedText && entry.metadata.recognizedText !== entry.message) {
          metadata.push(`Raw Recognition: "${entry.metadata.recognizedText}"`);
        }
        
        if (metadata.length > 0) {
          output += `    Metadata: ${metadata.join(', ')}\n`;
        }
      }
    });

    output += `\n=== END TRANSCRIPT ===\n`;
    return output;
  }

  /**
   * Export all sessions as JSON
   */
  static exportAllSessionsAsJSON(): string {
    const sessions = this.getAllSessions();
    return JSON.stringify(sessions, null, 2);
  }

  /**
   * Download session transcript as file
   */
  static downloadSessionTranscript(sessionId: string): void {
    const transcript = this.exportSessionAsText(sessionId);
    const session = this.sessions.get(sessionId);
    const filename = `voice-session-${sessionId}-${session?.toolName?.replace(/\s+/g, '-') || 'unknown'}.txt`;
    
    const blob = new Blob([transcript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Save sessions to localStorage
   */
  private static saveToStorage(): void {
    try {
      const sessions = Array.from(this.sessions.entries());
      // Keep only the most recent sessions to avoid storage overflow
      const recentSessions = sessions.slice(-this.MAX_SESSIONS);
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(recentSessions));
    } catch (error) {
      console.error('Failed to save conversation logs to storage:', error);
    }
  }

  /**
   * Load sessions from localStorage
   */
  static loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const sessions: [string, ConversationSession][] = JSON.parse(stored);
        this.sessions = new Map(sessions);
        console.log(`📚 Loaded ${sessions.length} conversation logs from storage`);
      }
    } catch (error) {
      console.error('Failed to load conversation logs from storage:', error);
    }
  }

  /**
   * Clear all conversation logs
   */
  static clearAll(): void {
    this.sessions.clear();
    localStorage.removeItem(this.STORAGE_KEY);
    console.log('🗑️ All conversation logs cleared');
  }

  /**
   * Get debugging insights from a session
   */
  static getDebugInsights(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return `Session ${sessionId} not found`;
    }

    let insights = `=== DEBUGGING INSIGHTS FOR SESSION ${sessionId} ===\n\n`;

    // Timeline analysis
    insights += `⏱️ TIMELINE ANALYSIS:\n`;
    const entries = session.entries;
    if (entries.length > 0) {
      const startTime = new Date(entries[0].timestamp).getTime();
      entries.forEach((entry, index) => {
        const elapsed = new Date(entry.timestamp).getTime() - startTime;
        const speaker = entry.speaker === 'agent' ? 'AGENT' : 'USER ';
        insights += `  ${Math.round(elapsed / 1000).toString().padStart(3)}s | ${speaker} | ${entry.message.substring(0, 60)}\n`;
      });
    }

    // Error analysis
    const errors = entries.filter(e => e.context?.errorType);
    if (errors.length > 0) {
      insights += `\n❌ ERROR ANALYSIS:\n`;
      errors.forEach((error, index) => {
        insights += `  ${index + 1}. ${error.context?.errorType} - ${error.message}\n`;
      });
    }

    // Field completion analysis
    const fieldAttempts = entries.filter(e => e.context?.currentField);
    const fieldStats = fieldAttempts.reduce((acc, entry) => {
      const field = entry.context!.currentField!;
      if (!acc[field]) {
        acc[field] = { attempts: 0, errors: 0, completed: false };
      }
      acc[field].attempts++;
      if (entry.context?.errorType) {
        acc[field].errors++;
      }
      return acc;
    }, {} as Record<string, { attempts: number; errors: number; completed: boolean }>);

    if (Object.keys(fieldStats).length > 0) {
      insights += `\n📝 FIELD COMPLETION ANALYSIS:\n`;
      Object.entries(fieldStats).forEach(([field, stats]) => {
        insights += `  ${field}: ${stats.attempts} attempts, ${stats.errors} errors\n`;
      });
    }

    // Speech recognition analysis
    const userMessages = entries.filter(e => e.speaker === 'user' && !e.message.startsWith('[SYSTEM]'));
    const avgConfidence = userMessages
      .filter(m => m.context?.recognitionConfidence)
      .reduce((sum, m, _, arr) => sum + (m.context!.recognitionConfidence! / arr.length), 0);

    if (avgConfidence > 0) {
      insights += `\n🎤 SPEECH RECOGNITION ANALYSIS:\n`;
      insights += `  Average Confidence: ${Math.round(avgConfidence * 100)}%\n`;
      insights += `  Low Confidence Messages: ${userMessages.filter(m => m.context?.recognitionConfidence && m.context.recognitionConfidence < 0.7).length}\n`;
    }

    insights += `\n=== END INSIGHTS ===\n`;
    return insights;
  }
}

// Load existing logs when the service initializes
ConversationLogger.loadFromStorage();
