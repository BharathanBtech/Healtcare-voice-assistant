import axios from 'axios';
import { AuthService } from '@/services/AuthService';

// Configure axios defaults
export const API_BASE_URL = 'http://localhost:3001';

// Create axios instance with base configuration
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Setup interceptors for authentication
apiClient.interceptors.request.use(
  (config) => {
    const token = AuthService.getSessionToken();
    console.log('🔍 API Request Debug - Token:', token);
    console.log('🔍 API Request Debug - Token type:', typeof token);
    console.log('🔍 API Request Debug - Token length:', token ? token.length : 'null');
    console.log('🔍 API Request Debug - Token parts:', token ? token.split('.').length : 'null');
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('🔍 API Request Debug - Authorization header:', config.headers.Authorization);
    } else {
      console.log('❌ No token available for request');
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Unauthorized, logout user
      AuthService.logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
