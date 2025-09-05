import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { LoginCredentials } from '@/types';
import { AuthService } from '@/services/AuthService';
import { useApp } from '../../App';

interface LoginFormData {
  username: string;
  password: string;
  rememberMe: boolean;
}

const LoginScreen: React.FC = () => {
  const navigate = useNavigate();
  const { setUser } = useApp();
  const [isLoading, setIsLoading] = useState(false);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError
  } = useForm<LoginFormData>();

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    
    try {
      const credentials: LoginCredentials = {
        username: data.username,
        password: data.password
      };

      const response = await AuthService.login(credentials);
      
      if (response.success && response.data) {
        setUser(response.data);
        toast.success('Login successful!');
        navigate('/dashboard');
      } else {
        setError('root', { 
          type: 'manual', 
          message: response.error || 'Login failed' 
        });
        toast.error(response.error || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('root', { 
        type: 'manual', 
        message: 'An unexpected error occurred' 
      });
      toast.error('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-container">
        {/* Branding Section */}
        <div className="login-header">
          <div className="logo">
            <div className="logo-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
              </svg>
            </div>
            <h1 className="logo-text">Healthcare Voice Agent</h1>
          </div>
          <p className="login-subtitle">
            Secure voice-powered healthcare solutions
          </p>
        </div>

        {/* Login Form */}
        <div className="login-form-container">
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Sign In</h2>
              <p className="text-sm text-gray-500">
                Access your healthcare voice agent platform
              </p>
            </div>
            
            <div className="card-body">
              <form onSubmit={handleSubmit(onSubmit)} className="login-form">
                {/* Username Field */}
                <div className="form-group">
                  <label htmlFor="username" className="form-label">
                    Username
                  </label>
                  <input
                    id="username"
                    type="text"
                    className={`form-input ${errors.username ? 'error' : ''}`}
                    placeholder="Enter your username"
                    {...register('username', {
                      required: 'Username is required',
                      minLength: {
                        value: 3,
                        message: 'Username must be at least 3 characters'
                      }
                    })}
                  />
                  {errors.username && (
                    <div className="form-error">{errors.username.message}</div>
                  )}
                </div>

                {/* Password Field */}
                <div className="form-group">
                  <label htmlFor="password" className="form-label">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    className={`form-input ${errors.password ? 'error' : ''}`}
                    placeholder="Enter your password"
                    {...register('password', {
                      required: 'Password is required',
                      minLength: {
                        value: 6,
                        message: 'Password must be at least 6 characters'
                      }
                    })}
                  />
                  {errors.password && (
                    <div className="form-error">{errors.password.message}</div>
                  )}
                </div>

                {/* Remember Me Checkbox */}
                <div className="form-group">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      className="mr-2"
                      {...register('rememberMe')}
                    />
                    <span className="text-sm text-gray-700">Remember me</span>
                  </label>
                </div>

                {/* Error Message */}
                {errors.root && (
                  <div className="alert alert-error">
                    {errors.root.message}
                  </div>
                )}

                {/* Submit Button */}
                <div className="form-group">
                  <button
                    type="submit"
                    className="btn btn-primary btn-lg w-full"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <span className="loading-spinner mr-2"></span>
                        Signing in...
                      </>
                    ) : (
                      'Sign In'
                    )}
                  </button>
                </div>
              </form>
            </div>

            <div className="card-footer">
              <div className="text-center">
                <a href="#" className="text-sm text-primary-color hover:underline">
                  Forgot your password?
                </a>
              </div>
            </div>
          </div>

          {/* Demo Credentials */}
          <div className="demo-credentials">
            <div className="card">
              <div className="card-body p-4">
                <h3 className="text-sm font-semibold mb-2 text-gray-700">Demo Credentials</h3>
                <div className="text-xs text-gray-500">
                  <div>Username: <strong>demo</strong></div>
                  <div>Password: <strong>demo123</strong></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="login-footer">
          <div className="text-center text-xs text-gray-500">
            © 2024 Healthcare Voice Agent. All rights reserved.
            <br />
            Secure • Compliant • Efficient
          </div>
        </div>
      </div>
      
      <style>{`
        .login-screen {
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--spacing-md);
        }

        .login-container {
          width: 100%;
          max-width: 420px;
          display: flex;
          flex-direction: column;
          gap: var(--spacing-lg);
        }

        .login-header {
          text-align: center;
          color: white;
        }

        .logo {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--spacing-sm);
          margin-bottom: var(--spacing-md);
        }

        .logo-icon {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 50%;
          padding: var(--spacing-md);
          backdrop-filter: blur(10px);
        }

        .logo-icon svg {
          color: white;
        }

        .logo-text {
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0;
        }

        .login-subtitle {
          font-size: 0.875rem;
          opacity: 0.9;
          margin: 0;
        }

        .login-form-container {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-md);
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-md);
        }

        .demo-credentials {
          animation: slideIn 0.5s ease-out 0.2s both;
        }

        .login-footer {
          text-align: center;
          color: rgba(255, 255, 255, 0.8);
        }

        .loading-spinner {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid transparent;
          border-top: 2px solid currentColor;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @media (max-width: 480px) {
          .login-container {
            max-width: 100%;
            padding: 0 var(--spacing-sm);
          }
          
          .login-screen {
            padding: var(--spacing-sm);
          }
        }

        /* Animation */
        .card {
          animation: slideIn 0.5s ease-out;
        }

        .login-header {
          animation: fadeIn 0.8s ease-out;
        }
      `}</style>
    </div>
  );
};

export default LoginScreen;
