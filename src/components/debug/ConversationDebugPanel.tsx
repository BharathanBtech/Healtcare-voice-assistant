import React, { useState, useEffect } from 'react';
import { ConversationLogger, ConversationSession } from '@/services/ConversationLogger';

interface ConversationDebugPanelProps {
  sessionId?: string;
  isOpen: boolean;
  onClose: () => void;
}

const ConversationDebugPanel: React.FC<ConversationDebugPanelProps> = ({
  sessionId,
  isOpen,
  onClose
}) => {
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>(sessionId || '');
  const [viewMode, setViewMode] = useState<'transcript' | 'insights' | 'raw'>('transcript');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Refresh sessions data
  const refreshSessions = () => {
    const allSessions = ConversationLogger.getAllSessions();
    setSessions(allSessions);
    
    // Auto-select the latest session if none selected
    if (!selectedSessionId && allSessions.length > 0) {
      setSelectedSessionId(allSessions[0].sessionId);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshSessions();
      
      // Auto-refresh every 2 seconds if enabled
      if (autoRefresh) {
        const interval = setInterval(refreshSessions, 2000);
        return () => clearInterval(interval);
      }
    }
  }, [isOpen, autoRefresh, selectedSessionId]);

  useEffect(() => {
    if (sessionId) {
      setSelectedSessionId(sessionId);
    }
  }, [sessionId]);

  const selectedSession = sessions.find(s => s.sessionId === selectedSessionId);

  const handleDownloadTranscript = () => {
    if (selectedSessionId) {
      ConversationLogger.downloadSessionTranscript(selectedSessionId);
    }
  };

  const handleClearLogs = () => {
    if (confirm('Are you sure you want to clear all conversation logs? This action cannot be undone.')) {
      ConversationLogger.clearAll();
      refreshSessions();
    }
  };

  const getViewContent = () => {
    if (!selectedSession) {
      return <div className="debug-content-empty">No session selected</div>;
    }

    switch (viewMode) {
      case 'transcript':
        return (
          <pre className="debug-transcript">
            {ConversationLogger.exportSessionAsText(selectedSessionId)}
          </pre>
        );
      case 'insights':
        return (
          <pre className="debug-insights">
            {ConversationLogger.getDebugInsights(selectedSessionId)}
          </pre>
        );
      case 'raw':
        return (
          <pre className="debug-raw">
            {JSON.stringify(selectedSession, null, 2)}
          </pre>
        );
      default:
        return null;
    }
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.round(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
  };

  if (!isOpen) return null;

  return (
    <div className="debug-panel-overlay">
      <div className="debug-panel">
        {/* Header */}
        <div className="debug-panel-header">
          <h3>🐛 Voice Session Debug Panel</h3>
          <div className="debug-panel-controls">
            <button
              className="btn btn-sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              title={`Auto-refresh is ${autoRefresh ? 'ON' : 'OFF'}`}
            >
              {autoRefresh ? '⏸️' : '▶️'}
            </button>
            <button className="btn btn-sm" onClick={refreshSessions}>
              🔄 Refresh
            </button>
            <button className="btn btn-sm btn-danger" onClick={handleClearLogs}>
              🗑️ Clear All
            </button>
            <button className="btn btn-sm" onClick={onClose}>
              ✕ Close
            </button>
          </div>
        </div>

        <div className="debug-panel-body">
          {/* Sessions List */}
          <div className="debug-sessions-list">
            <div className="debug-section-header">
              <h4>Sessions ({sessions.length})</h4>
            </div>
            <div className="debug-sessions">
              {sessions.length === 0 ? (
                <div className="debug-empty">No conversation sessions recorded yet</div>
              ) : (
                sessions.map((session) => (
                  <div
                    key={session.sessionId}
                    className={`debug-session-item ${
                      selectedSessionId === session.sessionId ? 'selected' : ''
                    }`}
                    onClick={() => setSelectedSessionId(session.sessionId)}
                  >
                    <div className="debug-session-info">
                      <div className="debug-session-title">
                        {session.toolName}
                        {!session.endTime && <span className="debug-live-indicator">🔴 LIVE</span>}
                      </div>
                      <div className="debug-session-meta">
                        <span>{new Date(session.startTime).toLocaleTimeString()}</span>
                        {session.summary && (
                          <span>{formatDuration(session.summary.totalDuration)}</span>
                        )}
                        <span>{session.entries.length} entries</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Session Content */}
          <div className="debug-session-content">
            {selectedSession && (
              <>
                <div className="debug-section-header">
                  <h4>
                    {selectedSession.toolName}
                    <span className="debug-session-id">#{selectedSession.sessionId.substr(0, 8)}</span>
                  </h4>
                  <div className="debug-view-controls">
                    <select
                      value={viewMode}
                      onChange={(e) => setViewMode(e.target.value as any)}
                      className="debug-view-select"
                    >
                      <option value="transcript">📝 Transcript</option>
                      <option value="insights">💡 Insights</option>
                      <option value="raw">🔍 Raw Data</option>
                    </select>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={handleDownloadTranscript}
                    >
                      📥 Download
                    </button>
                  </div>
                </div>

                {/* Session Stats */}
                {selectedSession.summary && (
                  <div className="debug-session-stats">
                    <div className="debug-stat">
                      <span className="debug-stat-label">Status:</span>
                      <span className={`debug-stat-value status-${selectedSession.summary.completionStatus}`}>
                        {selectedSession.summary.completionStatus}
                      </span>
                    </div>
                    <div className="debug-stat">
                      <span className="debug-stat-label">Duration:</span>
                      <span className="debug-stat-value">
                        {formatDuration(selectedSession.summary.totalDuration)}
                      </span>
                    </div>
                    <div className="debug-stat">
                      <span className="debug-stat-label">Exchanges:</span>
                      <span className="debug-stat-value">{selectedSession.summary.totalEntries}</span>
                    </div>
                    {selectedSession.summary.errors.length > 0 && (
                      <div className="debug-stat">
                        <span className="debug-stat-label">Errors:</span>
                        <span className="debug-stat-value error">
                          {selectedSession.summary.errors.length}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Content */}
                <div className="debug-content">
                  {getViewContent()}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .debug-panel-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .debug-panel {
          background: white;
          border-radius: 12px;
          width: 95%;
          max-width: 1400px;
          height: 90%;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        }

        .debug-panel-header {
          padding: 16px 24px;
          border-bottom: 1px solid #e5e5e5;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #f8f9fa;
          border-radius: 12px 12px 0 0;
        }

        .debug-panel-header h3 {
          margin: 0;
          color: #333;
          font-size: 18px;
        }

        .debug-panel-controls {
          display: flex;
          gap: 8px;
        }

        .debug-panel-body {
          flex: 1;
          display: flex;
          min-height: 0;
        }

        .debug-sessions-list {
          width: 300px;
          border-right: 1px solid #e5e5e5;
          display: flex;
          flex-direction: column;
        }

        .debug-section-header {
          padding: 16px;
          border-bottom: 1px solid #e5e5e5;
          background: #f8f9fa;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .debug-section-header h4 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: #666;
        }

        .debug-sessions {
          flex: 1;
          overflow-y: auto;
        }

        .debug-session-item {
          padding: 12px 16px;
          border-bottom: 1px solid #eee;
          cursor: pointer;
          transition: background-color 0.15s;
        }

        .debug-session-item:hover {
          background: #f5f5f5;
        }

        .debug-session-item.selected {
          background: #e3f2fd;
          border-left: 3px solid #2196f3;
        }

        .debug-session-title {
          font-weight: 500;
          color: #333;
          margin-bottom: 4px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .debug-live-indicator {
          font-size: 10px;
          animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .debug-session-meta {
          font-size: 11px;
          color: #666;
          display: flex;
          gap: 12px;
        }

        .debug-session-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }

        .debug-session-id {
          font-size: 12px;
          color: #999;
          font-weight: normal;
        }

        .debug-view-controls {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .debug-view-select {
          padding: 4px 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 12px;
        }

        .debug-session-stats {
          padding: 12px 16px;
          background: #f9f9f9;
          border-bottom: 1px solid #eee;
          display: flex;
          gap: 24px;
          flex-wrap: wrap;
        }

        .debug-stat {
          display: flex;
          gap: 6px;
          font-size: 12px;
        }

        .debug-stat-label {
          color: #666;
          font-weight: 500;
        }

        .debug-stat-value {
          color: #333;
        }

        .debug-stat-value.status-completed {
          color: #4caf50;
          font-weight: 500;
        }

        .debug-stat-value.status-error {
          color: #f44336;
          font-weight: 500;
        }

        .debug-stat-value.status-abandoned {
          color: #ff9800;
          font-weight: 500;
        }

        .debug-stat-value.error {
          color: #f44336;
          font-weight: 500;
        }

        .debug-content {
          flex: 1;
          overflow: auto;
          padding: 0;
        }

        .debug-transcript,
        .debug-insights,
        .debug-raw {
          margin: 0;
          padding: 16px;
          font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
          font-size: 12px;
          line-height: 1.6;
          background: #f8f8f8;
          color: #333;
          white-space: pre-wrap;
          word-wrap: break-word;
          height: 100%;
          overflow: auto;
        }

        .debug-content-empty {
          padding: 40px;
          text-align: center;
          color: #999;
          font-style: italic;
        }

        .debug-empty {
          padding: 40px 16px;
          text-align: center;
          color: #999;
          font-style: italic;
          font-size: 14px;
        }

        .btn {
          padding: 6px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          background: white;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.15s;
        }

        .btn:hover {
          background: #f5f5f5;
        }

        .btn.btn-primary {
          background: #2196f3;
          color: white;
          border-color: #2196f3;
        }

        .btn.btn-primary:hover {
          background: #1976d2;
        }

        .btn.btn-danger {
          background: #f44336;
          color: white;
          border-color: #f44336;
        }

        .btn.btn-danger:hover {
          background: #d32f2f;
        }

        .btn.btn-sm {
          padding: 4px 8px;
          font-size: 11px;
        }

        @media (max-width: 768px) {
          .debug-panel {
            width: 100%;
            height: 100%;
            border-radius: 0;
          }
          
          .debug-panel-body {
            flex-direction: column;
          }
          
          .debug-sessions-list {
            width: 100%;
            max-height: 200px;
            border-right: none;
            border-bottom: 1px solid #e5e5e5;
          }
        }
      `}</style>
    </div>
  );
};

export default ConversationDebugPanel;
