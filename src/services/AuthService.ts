import axios from 'axios';
import { User, LoginCredentials, ApiResponse } from '@/types';
import { StorageService } from './StorageService';
import { EncryptionService } from './EncryptionService';
import { apiClient } from '@/config/api';

export class AuthService {
  private static readonly TOKEN_KEY = 'hva_auth_token';
  private static readonly SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Authenticate user with credentials
   */
  static async login(credentials: LoginCredentials): Promise<ApiResponse<User>> {
    try {
      // Make API call to backend authentication endpoint
      const response = await axios.post('http://localhost:3001/api/auth/login', {
        username: credentials.username,
        password: credentials.password
      }, {
        timeout: 10000
      });

      if (response.data.success && response.data.user && response.data.token) {
        const user = response.data.user;
        const sessionToken = response.data.token;
        
        // Store session data
        const sessionData = {
          token: sessionToken,
          timestamp: Date.now(),
          userId: user.id
        };

        // Encrypt and store session
        const encryptedSession = EncryptionService.encrypt(JSON.stringify(sessionData));
        StorageService.setSecureItem(this.TOKEN_KEY, encryptedSession);
        
        // Store user data
        StorageService.saveUser(user);

        return {
          success: true,
          data: user,
          message: 'Authentication successful'
        };
      } else {
        return {
          success: false,
          error: response.data.error || 'Authentication failed'
        };
      }
    } catch (error: any) {
      console.error('Login error:', error);
      
      if (error.response?.status === 401) {
        return {
          success: false,
          error: 'Invalid username or password'
        };
      } else if (error.response?.status === 400) {
        return {
          success: false,
          error: error.response.data?.error || 'Invalid login data'
        };
      } else if (error.code === 'ECONNABORTED') {
        return {
          success: false,
          error: 'Connection timeout. Please try again.'
        };
      } else {
        return {
          success: false,
          error: 'Authentication failed. Please check your connection and try again.'
        };
      }
    }
  }

  /**
   * Logout user and clear session
   */
  static async logout(): Promise<void> {
    try {
      // Try to invalidate session on server
      const sessionToken = this.getSessionToken();
      if (sessionToken) {
        try {
          await axios.post('http://localhost:3001/api/auth/logout', {}, {
            headers: {
              'Authorization': `Bearer ${sessionToken}`
            },
            timeout: 5000
          });
        } catch (error) {
          console.warn('Failed to logout on server:', error);
          // Continue with local cleanup even if server logout fails
        }
      }
      
      // Clear stored session and user data
      StorageService.removeSecureItem(this.TOKEN_KEY);
      StorageService.clearUser();
      
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  /**
   * Check if current session is valid
   */
  static isValidSession(): boolean {
    try {
      const encryptedSession = StorageService.getSecureItem(this.TOKEN_KEY);
      if (!encryptedSession) {
        return false;
      }

      const decryptedSession = EncryptionService.decrypt(encryptedSession);
      const sessionData = JSON.parse(decryptedSession);

      // Check if session has expired
      const now = Date.now();
      const sessionAge = now - sessionData.timestamp;
      
      if (sessionAge > this.SESSION_TIMEOUT) {
        // Session expired, clean up
        this.logout();
        return false;
      }

      return true;
    } catch (error) {
      console.error('Session validation error:', error);
      return false;
    }
  }

  /**
   * Get current session token
   */
  static getSessionToken(): string | null {
    try {
      const encryptedSession = StorageService.getSecureItem(this.TOKEN_KEY);
      if (!encryptedSession) {
        return null;
      }

      const decryptedSession = EncryptionService.decrypt(encryptedSession);
      const sessionData = JSON.parse(decryptedSession);
      
      return sessionData.token;
    } catch (error) {
      console.error('Error getting session token:', error);
      return null;
    }
  }

  /**
   * Refresh session (extend expiration)
   */
  static refreshSession(): boolean {
    try {
      const encryptedSession = StorageService.getSecureItem(this.TOKEN_KEY);
      if (!encryptedSession) {
        return false;
      }

      const decryptedSession = EncryptionService.decrypt(encryptedSession);
      const sessionData = JSON.parse(decryptedSession);

      // Update timestamp
      sessionData.timestamp = Date.now();

      // Re-encrypt and store
      const updatedEncryptedSession = EncryptionService.encrypt(JSON.stringify(sessionData));
      StorageService.setSecureItem(this.TOKEN_KEY, updatedEncryptedSession);

      return true;
    } catch (error) {
      console.error('Session refresh error:', error);
      return false;
    }
  }

  /**
   * Setup axios interceptors for authentication
   * @deprecated Use the apiClient from @/config/api instead for API calls to our backend
   */
  static setupAxiosInterceptors(): void {
    // This method is deprecated - interceptors are now setup in @/config/api
    console.warn('AuthService.setupAxiosInterceptors() is deprecated. Use apiClient from @/config/api instead.');
  }

  /**
   * Validate password strength
   */
  static validatePasswordStrength(password: string): {
    isValid: boolean;
    message: string;
    score: number;
  } {
    let score = 0;
    const messages: string[] = [];

    // Length check
    if (password.length >= 8) {
      score += 1;
    } else {
      messages.push('At least 8 characters');
    }

    // Uppercase check
    if (/[A-Z]/.test(password)) {
      score += 1;
    } else {
      messages.push('At least one uppercase letter');
    }

    // Lowercase check
    if (/[a-z]/.test(password)) {
      score += 1;
    } else {
      messages.push('At least one lowercase letter');
    }

    // Number check
    if (/\d/.test(password)) {
      score += 1;
    } else {
      messages.push('At least one number');
    }

    // Special character check
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      score += 1;
    } else {
      messages.push('At least one special character');
    }

    const isValid = score >= 4;
    const message = isValid ? 'Password is strong' : `Password must have: ${messages.join(', ')}`;

    return { isValid, message, score };
  }
}
