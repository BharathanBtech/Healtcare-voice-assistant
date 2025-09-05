import React, { useState, useEffect, createContext, useContext } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { User, ProviderConfig, Tool, AppSettings } from '@/types';
import { AuthService } from '@/services/AuthService';
import { StorageService } from '@/services/StorageService';
import { ToolService } from '@/services/ToolService';

// Components
import LoginScreen from '@/components/auth/LoginScreen';
import Dashboard from '@/components/dashboard/Dashboard';
import ProviderConfiguration from '@/components/providers/ProviderConfiguration';
import ToolCreator from '@/components/tools/ToolCreator';
import ToolEditor from '@/components/tools/ToolEditor';
import VoiceInteraction from '@/components/voice/VoiceInteraction';
import Layout from '@/components/common/Layout';

// Context for global state management
interface AppContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  providerConfig: ProviderConfig | null;
  setProviderConfig: (config: ProviderConfig | null) => void;
  tools: Tool[];
  setTools: (tools: Tool[]) => void;
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
  isAuthenticated: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

// Protected Route Component
interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated } = useApp();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [providerConfig, setProviderConfig] = useState<ProviderConfig | null>(null);
  const [tools, setTools] = useState<Tool[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    summarizationEnabled: true,
    theme: 'light',
    language: 'en',
    autoSave: true,
  });
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  // Initialize app state from storage
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Check for existing session
        const storedUser = StorageService.getUser();
        if (storedUser && AuthService.isValidSession()) {
          setUser(storedUser);
        }

        // Load provider configuration
        const config = StorageService.getProviderConfig();
        if (config) {
          setProviderConfig(config);
        }

        // Load tools from API if authenticated, otherwise from storage
        if (storedUser && AuthService.isValidSession()) {
          try {
            const apiTools = await ToolService.loadAllTools();
            setTools(apiTools);
          } catch (error) {
            console.warn('Failed to load tools from API, using local storage:', error);
            const storedTools = StorageService.getTools();
            setTools(storedTools);
          }
        } else {
          const storedTools = StorageService.getTools();
          setTools(storedTools);
        }

        // Load settings
        const storedSettings = StorageService.getSettings();
        if (storedSettings) {
          setSettings(storedSettings);
        }
      } catch (error) {
        console.error('Failed to initialize app:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeApp();
  }, []);

  // Save settings to storage whenever they change
  useEffect(() => {
    StorageService.saveSettings(settings);
  }, [settings]);

  // Save tools to storage whenever they change
  useEffect(() => {
    StorageService.saveTools(tools);
  }, [tools]);

  // Save provider config to storage whenever it changes
  useEffect(() => {
    if (providerConfig) {
      StorageService.saveProviderConfig(providerConfig);
    }
  }, [providerConfig]);

  const contextValue: AppContextType = {
    user,
    setUser,
    providerConfig,
    setProviderConfig,
    tools,
    setTools,
    settings,
    setSettings,
    isAuthenticated,
  };

  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <p>Loading Healthcare Voice Agent...</p>
      </div>
    );
  }

  return (
    <AppContext.Provider value={contextValue}>
      <div className="app">
        <Routes>
          {/* Public Routes */}
          <Route 
            path="/login" 
            element={
              isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginScreen />
            } 
          />
          
          {/* Protected Routes */}
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="providers" element={<ProviderConfiguration />} />
            <Route path="tools/create" element={<ToolCreator />} />
            <Route path="tools/edit/:toolId" element={<ToolEditor />} />
            <Route path="voice/:toolId" element={<VoiceInteraction />} />
          </Route>

          {/* Catch all route */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </AppContext.Provider>
  );
};

export default App;
