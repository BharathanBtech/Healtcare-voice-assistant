import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../../App';
import { AuthService } from '@/services/AuthService';
import toast from 'react-hot-toast';

const Layout: React.FC = () => {
  const { user, setUser, settings, setSettings } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleLogout = async () => {
    try {
      await AuthService.logout();
      setUser(null);
      toast.success('Logged out successfully');
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Error logging out');
    }
  };

  const toggleTheme = () => {
    const newTheme = settings.theme === 'light' ? 'dark' : 'light';
    setSettings({ ...settings, theme: newTheme });
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const navigationItems = [
    {
      path: '/dashboard',
      label: 'Dashboard',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2v0" />
        </svg>
      )
    },
    {
      path: '/providers',
      label: 'Providers',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    },
    {
      path: '/tools/create',
      label: 'Create Tool',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      )
    }
  ];

  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="logo-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
              </svg>
            </div>
            {!sidebarCollapsed && (
              <span className="logo-text">Healthcare VA</span>
            )}
          </div>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d={sidebarCollapsed ? "M9 5l7 7-7 7" : "M15 19l-7-7 7-7"} />
            </svg>
          </button>
        </div>

        <nav className="sidebar-nav">
          <ul className="nav-list">
            {navigationItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                  title={sidebarCollapsed ? item.label : ''}
                >
                  {item.icon}
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            {!sidebarCollapsed && (
              <div className="user-details">
                <div className="user-name">{user?.username}</div>
                <div className="user-role">{user?.role}</div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="main-content">
        {/* Header */}
        <header className="header">
          <div className="header-left">
            <h1 className="page-title">
              {location.pathname === '/dashboard' && 'Dashboard'}
              {location.pathname === '/providers' && 'Provider Configuration'}
              {location.pathname === '/tools/create' && 'Create New Tool'}
              {location.pathname.startsWith('/tools/edit') && 'Edit Tool'}
              {location.pathname.startsWith('/voice') && 'Voice Interaction'}
            </h1>
          </div>

          <div className="header-right">
            {/* Theme Toggle */}
            <button
              className="btn btn-secondary"
              onClick={toggleTheme}
              title={`Switch to ${settings.theme === 'light' ? 'dark' : 'light'} theme`}
            >
              {settings.theme === 'light' ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              )}
            </button>

            {/* Logout Button */}
            <button
              className="btn btn-secondary"
              onClick={handleLogout}
              title="Logout"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="content">
          <Outlet />
        </main>
      </div>

      <style>{`
        .sidebar {
          transition: width var(--transition-normal);
          display: flex;
          flex-direction: column;
          background-color: var(--white);
          border-right: 1px solid var(--gray-200);
        }

        .sidebar.collapsed {
          width: 80px;
        }

        .sidebar-header {
          padding: var(--spacing-lg);
          border-bottom: 1px solid var(--gray-200);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
        }

        .logo-icon {
          color: var(--primary-color);
          display: flex;
          align-items: center;
        }

        .logo-text {
          font-weight: 600;
          color: var(--gray-900);
          white-space: nowrap;
        }

        .sidebar-toggle {
          background: none;
          border: none;
          color: var(--gray-600);
          cursor: pointer;
          padding: var(--spacing-xs);
          border-radius: var(--radius-md);
          transition: all var(--transition-fast);
        }

        .sidebar-toggle:hover {
          background-color: var(--gray-100);
          color: var(--gray-900);
        }

        .sidebar-nav {
          flex: 1;
          padding: var(--spacing-md) 0;
        }

        .nav-list {
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          padding: var(--spacing-md) var(--spacing-lg);
          color: var(--gray-700);
          text-decoration: none;
          transition: all var(--transition-fast);
          border-right: 3px solid transparent;
        }

        .nav-item:hover {
          background-color: var(--gray-50);
          color: var(--gray-900);
        }

        .nav-item.active {
          background-color: var(--primary-light);
          color: var(--primary-color);
          border-right-color: var(--primary-color);
        }

        .sidebar-footer {
          padding: var(--spacing-lg);
          border-top: 1px solid var(--gray-200);
        }

        .user-info {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
        }

        .user-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background-color: var(--gray-100);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--gray-600);
        }

        .user-details {
          flex: 1;
          min-width: 0;
        }

        .user-name {
          font-weight: 500;
          color: var(--gray-900);
          font-size: 0.875rem;
        }

        .user-role {
          font-size: 0.75rem;
          color: var(--gray-500);
          text-transform: capitalize;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .header-left {
          flex: 1;
        }

        .page-title {
          font-size: 1.5rem;
          font-weight: 600;
          color: var(--gray-900);
          margin: 0;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
        }

        @media (max-width: 768px) {
          .sidebar {
            position: fixed;
            top: 0;
            left: 0;
            height: 100vh;
            z-index: 1000;
            transform: translateX(-100%);
          }

          .sidebar:not(.collapsed) {
            transform: translateX(0);
          }

          .main-content {
            margin-left: 0;
          }

          .page-title {
            font-size: 1.25rem;
          }
        }
      `}</style>
    </div>
  );
};

export default Layout;
