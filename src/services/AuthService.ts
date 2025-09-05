import axios from 'axios';
import { User, LoginCredentials, ApiResponse } from '@/types';
import { StorageService } from './StorageService';
import { EncryptionService } from './EncryptionService';

export class AuthService {
  private static readonly TOKEN_KEY = 'hva_auth_token';
  private static readonly SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Authenticate user with credentials
   */
  static async login(credentials: LoginCredentials): Promise<ApiResponse<User>> {
    try {
      // For demo purposes, we'll simulate authentication
      // In production, this would make an API call to your authentication server
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock authentication logic
      if (credentials.username === 'demo' && credentials.password === 'demo123') {
        const user: User = {
          id: '1',
          username: credentials.username,
          email: 'demo@healthcare.com',
          role: 'admin',
          organizationId: 'org_1'
        };

        // Generate and store session token
        const sessionToken = EncryptionService.generateSessionToken();
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
          error: 'Invalid username or password'
        };
      }
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: 'Authentication failed. Please try again.'
      };
    }
  }

  /**
   * Logout user and clear session
   */
  static async logout(): Promise<void> {
    try {
      // Clear stored session and user data
      StorageService.removeSecureItem(this.TOKEN_KEY);
      StorageService.clearUser();
      
      // In production, you might also want to invalidate the token on the server
      // await axios.post('/api/auth/logout');
      
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
   */
  static setupAxiosInterceptors(): void {
    // Request interceptor to add auth token
    axios.interceptors.request.use(
      (config) => {
        const token = this.getSessionToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle auth errors
    axios.interceptors.response.use(
      (response) => {
        return response;
      },
      (error) => {
        if (error.response?.status === 401) {
          // Unauthorized, logout user
          this.logout();
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
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
