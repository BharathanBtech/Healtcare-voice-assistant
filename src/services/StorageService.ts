import { User, ProviderConfig, Tool, AppSettings } from '@/types';
import { EncryptionService } from './EncryptionService';

export class StorageService {
  private static readonly KEYS = {
    USER: 'hva_user',
    PROVIDER_CONFIG: 'hva_provider_config',
    TOOLS: 'hva_tools',
    SETTINGS: 'hva_settings',
    SECURE_PREFIX: 'hva_secure_'
  };

  /**
   * Generic storage methods
   */
  static setItem(key: string, value: any): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }

  static getItem<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return null;
    }
  }

  static removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing from localStorage:', error);
    }
  }

  /**
   * Secure storage methods (encrypted)
   */
  static setSecureItem(key: string, value: string): void {
    try {
      const encryptedValue = EncryptionService.encrypt(value);
      localStorage.setItem(this.KEYS.SECURE_PREFIX + key, encryptedValue);
    } catch (error) {
      console.error('Error saving encrypted item:', error);
    }
  }

  static getSecureItem(key: string): string | null {
    try {
      const encryptedValue = localStorage.getItem(this.KEYS.SECURE_PREFIX + key);
      if (!encryptedValue) return null;
      
      return EncryptionService.decrypt(encryptedValue);
    } catch (error) {
      console.error('Error reading encrypted item:', error);
      return null;
    }
  }

  static removeSecureItem(key: string): void {
    try {
      localStorage.removeItem(this.KEYS.SECURE_PREFIX + key);
    } catch (error) {
      console.error('Error removing encrypted item:', error);
    }
  }

  /**
   * User management
   */
  static saveUser(user: User): void {
    this.setItem(this.KEYS.USER, user);
  }

  static getUser(): User | null {
    return this.getItem<User>(this.KEYS.USER);
  }

  static clearUser(): void {
    this.removeItem(this.KEYS.USER);
  }

  /**
   * Provider configuration management
   */
  static saveProviderConfig(config: ProviderConfig): void {
    // Encrypt sensitive credential data
    const encryptedConfig = {
      ...config,
      stt: {
        ...config.stt,
        credentials: this.encryptCredentials(config.stt.credentials)
      },
      llm: {
        ...config.llm,
        credentials: this.encryptCredentials(config.llm.credentials)
      },
      tts: {
        ...config.tts,
        credentials: this.encryptCredentials(config.tts.credentials)
      }
    };
    
    this.setItem(this.KEYS.PROVIDER_CONFIG, encryptedConfig);
  }

  static getProviderConfig(): ProviderConfig | null {
    const config = this.getItem<any>(this.KEYS.PROVIDER_CONFIG);
    if (!config) return null;

    // Decrypt sensitive credential data
    try {
      return {
        ...config,
        stt: {
          ...config.stt,
          credentials: this.decryptCredentials(config.stt.credentials)
        },
        llm: {
          ...config.llm,
          credentials: this.decryptCredentials(config.llm.credentials)
        },
        tts: {
          ...config.tts,
          credentials: this.decryptCredentials(config.tts.credentials)
        }
      };
    } catch (error) {
      console.error('Error decrypting provider config:', error);
      return null;
    }
  }

  static clearProviderConfig(): void {
    this.removeItem(this.KEYS.PROVIDER_CONFIG);
  }

  /**
   * Tools management
   */
  static saveTools(tools: Tool[]): void {
    this.setItem(this.KEYS.TOOLS, tools);
  }

  static getTools(): Tool[] {
    const tools = this.getItem<Tool[]>(this.KEYS.TOOLS);
    return tools || [];
  }

  static saveTool(tool: Tool): void {
    const tools = this.getTools();
    const existingIndex = tools.findIndex(t => t.id === tool.id);
    
    if (existingIndex >= 0) {
      tools[existingIndex] = tool;
    } else {
      tools.push(tool);
    }
    
    this.saveTools(tools);
  }

  static deleteTool(toolId: string): void {
    const tools = this.getTools();
    const filteredTools = tools.filter(t => t.id !== toolId);
    this.saveTools(filteredTools);
  }

  static getTool(toolId: string): Tool | null {
    const tools = this.getTools();
    return tools.find(t => t.id === toolId) || null;
  }

  /**
   * Settings management
   */
  static saveSettings(settings: AppSettings): void {
    this.setItem(this.KEYS.SETTINGS, settings);
  }

  static getSettings(): AppSettings | null {
    return this.getItem<AppSettings>(this.KEYS.SETTINGS);
  }

  /**
   * Utility methods for credential encryption/decryption
   */
  private static encryptCredentials(credentials: Record<string, string>): Record<string, string> {
    const encrypted: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(credentials)) {
      encrypted[key] = EncryptionService.encrypt(value);
    }
    
    return encrypted;
  }

  private static decryptCredentials(credentials: Record<string, string>): Record<string, string> {
    const decrypted: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(credentials)) {
      decrypted[key] = EncryptionService.decrypt(value);
    }
    
    return decrypted;
  }

  /**
   * Clear all application data
   */
  static clearAllData(): void {
    this.clearUser();
    this.clearProviderConfig();
    this.removeItem(this.KEYS.TOOLS);
    this.removeItem(this.KEYS.SETTINGS);
    
    // Clear all secure items
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(this.KEYS.SECURE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  }

  /**
   * Export data for backup/migration
   */
  static exportData(): string {
    const data = {
      user: this.getUser(),
      settings: this.getSettings(),
      tools: this.getTools(),
      exportDate: new Date().toISOString()
    };
    
    return JSON.stringify(data, null, 2);
  }

  /**
   * Import data from backup
   */
  static importData(jsonData: string): boolean {
    try {
      const data = JSON.parse(jsonData);
      
      if (data.user) {
        this.saveUser(data.user);
      }
      
      if (data.settings) {
        this.saveSettings(data.settings);
      }
      
      if (data.tools && Array.isArray(data.tools)) {
        this.saveTools(data.tools);
      }
      
      return true;
    } catch (error) {
      console.error('Error importing data:', error);
      return false;
    }
  }

  /**
   * Get storage usage statistics
   */
  static getStorageStats(): {
    used: number;
    total: number;
    percentage: number;
    items: number;
  } {
    let used = 0;
    let items = 0;
    
    try {
      for (const key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          used += localStorage.getItem(key)?.length || 0;
          items++;
        }
      }
    } catch (error) {
      console.error('Error calculating storage stats:', error);
    }
    
    // Estimate total available space (varies by browser, typically 5-10MB)
    const total = 5 * 1024 * 1024; // 5MB estimate
    const percentage = (used / total) * 100;
    
    return { used, total, percentage, items };
  }
}
