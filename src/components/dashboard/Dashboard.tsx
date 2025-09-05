import React from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../App';

const Dashboard: React.FC = () => {
  const { tools, settings } = useApp();

  const stats = {
    totalTools: tools.length,
    activeTools: tools.filter(tool => tool.fields.length > 0).length,
    recentSessions: 0, // This would come from session data
    averageSessionTime: '2m 30s' // Mock data
  };

  const recentTools = tools.slice(0, 5);

  return (
    <div className="dashboard fade-in">
      {/* Welcome Section */}
      <div className="welcome-section mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Welcome to Healthcare Voice Agent
        </h2>
        <p className="text-gray-600">
          Manage your voice-powered healthcare tools and monitor performance.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid mb-6">
        <div className="stat-card">
          <div className="stat-icon">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 9.172V5L8 4z" />
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalTools}</div>
            <div className="stat-label">Total Tools</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.activeTools}</div>
            <div className="stat-label">Active Tools</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.recentSessions}</div>
            <div className="stat-label">Recent Sessions</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.averageSessionTime}</div>
            <div className="stat-label">Avg Session</div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions mb-6">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Quick Actions</h3>
          </div>
          <div className="card-body">
            <div className="action-grid">
              <Link to="/tools/create" className="action-card">
                <div className="action-icon">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <div>
                  <h4 className="action-title">Create New Tool</h4>
                  <p className="action-description">Build a new voice interaction tool</p>
                </div>
              </Link>

              <Link to="/providers" className="action-card">
                <div className="action-icon">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h4 className="action-title">Configure Providers</h4>
                  <p className="action-description">Set up STT, LLM, and TTS services</p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Tools Overview */}
      <div className="tools-overview">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Your Tools</h3>
            <Link to="/tools/create" className="btn btn-primary">
              Create New Tool
            </Link>
          </div>
          <div className="card-body">
            {tools.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} 
                          d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 9.172V5L8 4z" />
                  </svg>
                </div>
                <h4 className="empty-title">No tools created yet</h4>
                <p className="empty-description">
                  Get started by creating your first voice interaction tool.
                </p>
                <Link to="/tools/create" className="btn btn-primary mt-4">
                  Create Your First Tool
                </Link>
              </div>
            ) : (
              <div className="tools-list">
                {recentTools.map((tool) => (
                  <div key={tool.id} className="tool-item">
                    <div className="tool-info">
                      <h4 className="tool-name">{tool.name}</h4>
                      <p className="tool-description">{tool.description}</p>
                      <div className="tool-meta">
                        <span className="tool-fields">{tool.fields.length} fields</span>
                        <span className="tool-date">
                          Created {new Date(tool.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="tool-actions">
                      <Link 
                        to={`/voice/${tool.id}`}
                        className="btn btn-success btn-sm"
                      >
                        Launch
                      </Link>
                      <Link 
                        to={`/tools/edit/${tool.id}`}
                        className="btn btn-secondary btn-sm"
                      >
                        Edit
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: var(--spacing-lg);
        }

        .stat-card {
          background-color: var(--white);
          border: 1px solid var(--gray-200);
          border-radius: var(--radius-lg);
          padding: var(--spacing-lg);
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          box-shadow: var(--shadow-sm);
          transition: all var(--transition-fast);
        }

        .stat-card:hover {
          box-shadow: var(--shadow-md);
          transform: translateY(-2px);
        }

        .stat-icon {
          background-color: var(--primary-light);
          color: var(--primary-color);
          padding: var(--spacing-md);
          border-radius: var(--radius-lg);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .stat-value {
          font-size: 1.875rem;
          font-weight: 700;
          color: var(--gray-900);
          line-height: 1;
        }

        .stat-label {
          font-size: 0.875rem;
          color: var(--gray-500);
          margin-top: var(--spacing-xs);
        }

        .action-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: var(--spacing-lg);
        }

        .action-card {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          padding: var(--spacing-lg);
          border: 2px solid var(--gray-200);
          border-radius: var(--radius-lg);
          text-decoration: none;
          transition: all var(--transition-fast);
        }

        .action-card:hover {
          border-color: var(--primary-color);
          background-color: var(--primary-light);
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }

        .action-icon {
          color: var(--primary-color);
          flex-shrink: 0;
        }

        .action-title {
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--gray-900);
          margin: 0 0 var(--spacing-xs) 0;
        }

        .action-description {
          font-size: 0.875rem;
          color: var(--gray-600);
          margin: 0;
        }

        .empty-state {
          text-align: center;
          padding: var(--spacing-2xl) var(--spacing-lg);
        }

        .empty-icon {
          color: var(--gray-400);
          margin-bottom: var(--spacing-lg);
        }

        .empty-title {
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--gray-900);
          margin-bottom: var(--spacing-sm);
        }

        .empty-description {
          color: var(--gray-600);
          margin-bottom: var(--spacing-lg);
        }

        .tools-list {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-md);
        }

        .tool-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--spacing-lg);
          border: 1px solid var(--gray-200);
          border-radius: var(--radius-lg);
          background-color: var(--gray-50);
        }

        .tool-name {
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--gray-900);
          margin: 0 0 var(--spacing-xs) 0;
        }

        .tool-description {
          color: var(--gray-600);
          margin: 0 0 var(--spacing-sm) 0;
        }

        .tool-meta {
          display: flex;
          gap: var(--spacing-md);
          font-size: 0.75rem;
          color: var(--gray-500);
        }

        .tool-actions {
          display: flex;
          gap: var(--spacing-sm);
          flex-shrink: 0;
        }

        @media (max-width: 768px) {
          .stats-grid {
            grid-template-columns: 1fr 1fr;
          }

          .action-grid {
            grid-template-columns: 1fr;
          }

          .tool-item {
            flex-direction: column;
            gap: var(--spacing-md);
            align-items: stretch;
          }

          .tool-actions {
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
