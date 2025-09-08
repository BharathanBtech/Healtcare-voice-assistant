import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useApp } from '../../App';
import { ToolService } from '@/services/ToolService';
import { Tool } from '@/types';

const Dashboard: React.FC = () => {
  const { tools, setTools, settings } = useApp();
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; tool: Tool | null }>({ show: false, tool: null });
  const [deleting, setDeleting] = useState(false);

  const stats = {
    totalTools: tools.length,
    activeTools: tools.filter(tool => tool.fields.length > 0).length,
    recentSessions: 0, // This would come from session data
    averageSessionTime: '2m 30s' // Mock data
  };

  const recentTools = tools.slice(0, 5);

  const handleDeleteClick = (tool: Tool) => {
    setDeleteConfirm({ show: true, tool });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.tool) return;

    setDeleting(true);
    try {
      const result = await ToolService.deleteTool(deleteConfirm.tool.id);
      
      if (result.success) {
        // Remove from local tools list
        const updatedTools = tools.filter(t => t.id !== deleteConfirm.tool!.id);
        setTools(updatedTools);
        
        toast.success('Tool deleted successfully!');
      } else {
        toast.error(result.error || 'Failed to delete tool');
      }
    } catch (error) {
      console.error('Error deleting tool:', error);
      toast.error('Failed to delete tool');
    } finally {
      setDeleting(false);
      setDeleteConfirm({ show: false, tool: null });
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm({ show: false, tool: null });
  };

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
                <div className="getting-started-content">
                  <h4 className="empty-title">Welcome to Healthcare Voice Agent</h4>
                  <p className="empty-description">
                    Create powerful voice interaction tools for healthcare data collection. 
                    Your tools will help streamline patient interactions and improve data accuracy.
                  </p>
                  
                  <div className="feature-highlights">
                    <div className="feature-item">
                      <div className="feature-icon">🎤</div>
                      <div className="feature-text">
                        <strong>Voice Recognition</strong>
                        <span>Convert speech to structured data</span>
                      </div>
                    </div>
                    <div className="feature-item">
                      <div className="feature-icon">🤖</div>
                      <div className="feature-text">
                        <strong>AI-Powered</strong>
                        <span>Intelligent conversation handling</span>
                      </div>
                    </div>
                    <div className="feature-item">
                      <div className="feature-icon">📊</div>
                      <div className="feature-text">
                        <strong>Data Integration</strong>
                        <span>Seamless data handoff to systems</span>
                      </div>
                    </div>
                  </div>
                  
                  <Link to="/tools/create" className="btn btn-primary btn-lg mt-6">
                    Create Your First Tool
                  </Link>
                </div>
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
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDeleteClick(tool)}
                        title="Delete Tool"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">
              Delete Tool: {deleteConfirm.tool?.name}
            </h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this tool? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleDeleteCancel}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteConfirm}
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <div className="loading-spinner w-4 h-4"></div>
                    Deleting...
                  </>
                ) : (
                  'Delete Tool'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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

        .getting-started-content {
          max-width: 600px;
          margin: 0 auto;
        }

        .empty-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--gray-900);
          margin-bottom: var(--spacing-md);
        }

        .empty-description {
          color: var(--gray-600);
          margin-bottom: var(--spacing-xl);
          font-size: 1.1rem;
          line-height: 1.6;
        }

        .feature-highlights {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: var(--spacing-lg);
          margin-bottom: var(--spacing-xl);
          text-align: left;
        }

        .feature-item {
          display: flex;
          align-items: flex-start;
          gap: var(--spacing-md);
          padding: var(--spacing-md);
          background-color: var(--gray-50);
          border-radius: var(--radius-lg);
          border: 1px solid var(--gray-200);
        }

        .feature-icon {
          font-size: 1.5rem;
          flex-shrink: 0;
          margin-top: var(--spacing-xs);
        }

        .feature-text {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xs);
        }

        .feature-text strong {
          color: var(--gray-900);
          font-weight: 600;
          font-size: 0.95rem;
        }

        .feature-text span {
          color: var(--gray-600);
          font-size: 0.875rem;
          line-height: 1.4;
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
