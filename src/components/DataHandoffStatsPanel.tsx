import React, { useState, useEffect } from 'react';
import { RealTimeDataHandoffService, DataHandoffAttempt } from '@/services/RealTimeDataHandoffService';
import './DataHandoffStatsPanel.css';

interface DataHandoffStatsPanelProps {
  sessionId?: string; // If provided, show stats for specific session
  toolId?: string;    // If provided, show stats for specific tool
  className?: string;
}

interface HandoffStats {
  total: number;
  successful: number;
  failed: number;
  successRate: number;
  averageTransmissionTime: number;
}

export const DataHandoffStatsPanel: React.FC<DataHandoffStatsPanelProps> = ({
  sessionId,
  toolId,
  className = ''
}) => {
  const [stats, setStats] = useState<HandoffStats | null>(null);
  const [history, setHistory] = useState<DataHandoffAttempt[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [retryingAttemptId, setRetryingAttemptId] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
    loadHistory();
  }, [sessionId, toolId]);

  const loadStats = () => {
    try {
      const globalStats = RealTimeDataHandoffService.getHandoffStats();
      setStats(globalStats);
    } catch (error) {
      console.error('Failed to load handoff stats:', error);
    }
  };

  const loadHistory = () => {
    try {
      let attempts: DataHandoffAttempt[] = [];
      
      if (sessionId) {
        attempts = RealTimeDataHandoffService.getHandoffHistory(sessionId);
      } else {
        // Get all attempts and filter by toolId if provided
        const allStats = RealTimeDataHandoffService.getHandoffStats();
        // Note: This would need to be enhanced to store and filter by toolId
        // For now, we'll show all attempts
        attempts = [];
      }
      
      setHistory(attempts);
    } catch (error) {
      console.error('Failed to load handoff history:', error);
    }
  };

  const handleRetryAttempt = async (attemptId: string) => {
    setRetryingAttemptId(attemptId);
    
    try {
      await RealTimeDataHandoffService.retryHandoff(attemptId);
      // Reload stats and history after retry
      loadStats();
      loadHistory();
    } catch (error) {
      console.error('Failed to retry handoff:', error);
    } finally {
      setRetryingAttemptId(null);
    }
  };

  const formatTransmissionTime = (time?: number): string => {
    if (!time) return 'N/A';
    if (time < 1000) return `${time}ms`;
    return `${(time / 1000).toFixed(1)}s`;
  };

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getSuccessRateColor = (rate: number): string => {
    if (rate >= 90) return '#22543d'; // Green
    if (rate >= 70) return '#d69e2e'; // Yellow
    return '#e53e3e'; // Red
  };

  const renderStatsCards = () => {
    if (!stats) return null;

    return (
      <div className="stats-cards">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Attempts</div>
        </div>
        
        <div className="stat-card success">
          <div className="stat-value">{stats.successful}</div>
          <div className="stat-label">Successful</div>
        </div>
        
        <div className="stat-card error">
          <div className="stat-value">{stats.failed}</div>
          <div className="stat-label">Failed</div>
        </div>
        
        <div className="stat-card">
          <div 
            className="stat-value"
            style={{ color: getSuccessRateColor(stats.successRate) }}
          >
            {stats.successRate.toFixed(1)}%
          </div>
          <div className="stat-label">Success Rate</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-value">
            {formatTransmissionTime(stats.averageTransmissionTime)}
          </div>
          <div className="stat-label">Avg Response Time</div>
        </div>
      </div>
    );
  };

  const renderHistoryTable = () => {
    if (history.length === 0) {
      return (
        <div className="no-history">
          <p>No data handoff attempts found{sessionId ? ' for this session' : ''}.</p>
        </div>
      );
    }

    return (
      <div className="history-table">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Tool</th>
              <th>Type</th>
              <th>Status</th>
              <th>Response Time</th>
              <th>Message</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {history.map((attempt) => (
              <tr key={attempt.id} className={attempt.result.success ? 'success-row' : 'error-row'}>
                <td className="time-cell">
                  {formatDate(attempt.attemptTime)}
                </td>
                <td className="tool-cell">
                  {attempt.toolId}
                </td>
                <td className="type-cell">
                  {attempt.handoffConfig.type}
                </td>
                <td className="status-cell">
                  <span className={`status-badge ${attempt.result.success ? 'success' : 'error'}`}>
                    {attempt.result.success ? '✅ Success' : '❌ Failed'}
                  </span>
                </td>
                <td className="time-cell">
                  {formatTransmissionTime(attempt.result.transmissionTime)}
                </td>
                <td className="message-cell" title={attempt.result.message}>
                  {attempt.result.message}
                </td>
                <td className="actions-cell">
                  {!attempt.result.success && (
                    <button
                      className="retry-btn"
                      onClick={() => handleRetryAttempt(attempt.id)}
                      disabled={retryingAttemptId === attempt.id}
                    >
                      {retryingAttemptId === attempt.id ? 'Retrying...' : 'Retry'}
                    </button>
                  )}
                  {attempt.result.submissionId && (
                    <span className="submission-id" title="Submission ID">
                      ID: {attempt.result.submissionId}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className={`data-handoff-stats-panel ${className}`}>
      <div className="panel-header">
        <h3>Data Handoff Statistics</h3>
        {sessionId && <p>Statistics for session: {sessionId}</p>}
        {toolId && !sessionId && <p>Statistics for tool: {toolId}</p>}
      </div>

      {renderStatsCards()}

      <div className="history-section">
        <div className="history-header">
          <h4>Recent Attempts</h4>
          <button
            className="toggle-history-btn"
            onClick={() => setShowHistory(!showHistory)}
          >
            {showHistory ? 'Hide Details' : 'Show Details'}
          </button>
        </div>

        {showHistory && renderHistoryTable()}
      </div>

      {stats && stats.total === 0 && (
        <div className="no-data">
          <div className="no-data-icon">📊</div>
          <h4>No Data Handoff Activity</h4>
          <p>Complete a voice session with a tool that has data handoff configured to see statistics here.</p>
        </div>
      )}
    </div>
  );
};

export default DataHandoffStatsPanel;
