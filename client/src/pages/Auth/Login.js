import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Lock, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const location = useLocation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  // Show a friendly message when redirected after successful email verification
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const verified = params.get('verified');

    if (verified === '1') {
      toast.success('Your email has been verified. You can now log in.');
    } else if (verified === 'already') {
      toast.success('Your email is already verified. Please log in.');
    }
  }, [location.search]);

  const onSubmit = async (data) => {
    setIsLoading(true);
    
    try {
      const result = await login(data);
      
      if (result.success) {
        toast.success('Login successful!');
      } else {
        // Handle email verification requirement
        if (result.requiresVerification) {
          toast.error(result.error || 'Please verify your email address before logging in.', {
            duration: 6000,
          });
        } else {
          toast.error(result.error || 'Login failed');
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      
      // Handle email verification requirement from API
      if (error.response?.data?.requiresVerification) {
        toast.error(
          error.response.data.message || 'Please verify your email address before logging in.',
          { duration: 6000 }
        );
      } else {
        toast.error(
          error.response?.data?.message || 
          'Login failed. Please check your credentials.' ||
          'An unexpected error occurred'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-primary-600 rounded-full flex items-center justify-center">
            <Lock className="h-8 w-8 text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Welcome back
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to your account to continue
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white py-8 px-6 shadow-soft rounded-lg">
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            {/* Username/Email Field */}
            <div>
              <label htmlFor="username" className="form-label">
                Username or Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="username"
                  type="text"
                  {...register('username', {
                    required: 'Username or email is required',
                  })}
                  className={`form-input pl-10 ${
                    errors.username ? 'border-danger-500' : ''
                  }`}
                  placeholder="Enter your username or email"
                />
              </div>
              {errors.username && (
                <p className="form-error">{errors.username.message}</p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  {...register('password', {
                    required: 'Password is required',
                    minLength: {
                      value: 6,
                      message: 'Password must be at least 6 characters',
                    },
                  })}
                  className={`form-input pl-10 pr-10 ${
                    errors.password ? 'border-danger-500' : ''
                  }`}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="form-error">{errors.password.message}</p>
              )}
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                  Remember me
                </label>
              </div>

              <div className="text-sm">
                <a href="#" className="font-medium text-primary-600 hover:text-primary-500">
                  Forgot your password?
                </a>
              </div>
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Signing in...
                  </div>
                ) : (
                  'Sign in'
                )}
              </button>
            </div>
          </form>

          {/* Demo Credentials */}
          {/* <div className="mt-6 p-4 bg-gray-50 rounded-md">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Demo Credentials:</h3>
            <div className="text-xs text-gray-600 space-y-1">
              <p><strong>Username:</strong> admin</p>
              <p><strong>Password:</strong> password</p>
            </div>
          </div> */}
        </div>

        {/* Footer */}
        <div className="text-center space-y-2">
          <p className="text-sm text-gray-600">
            Don't have an account?{' '}
            <Link
              to="/register"
              className="font-medium text-primary-600 hover:text-primary-500"
            >
              Create an account
            </Link>
          </p>
          <p className="text-sm text-gray-600">
            Need to verify your email?{' '}
            <Link
              to="/resend-verification"
              className="font-medium text-primary-600 hover:text-primary-500"
            >
              Resend verification
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
