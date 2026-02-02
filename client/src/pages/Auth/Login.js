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

  // Show trial-expired message when redirected after session expiry
  const [showTrialExpiredBanner, setShowTrialExpiredBanner] = useState(false);
  useEffect(() => {
    if (sessionStorage.getItem('trial_expired') === '1') {
      sessionStorage.removeItem('trial_expired');
      setShowTrialExpiredBanner(true);
    }
  }, []);

  const onSubmit = async (data) => {
    setIsLoading(true);

    try {
      const result = await login(data);

      if (result.success) {
        toast.success('Login successful!');
      } else {
        if (result.requiresVerification) {
          toast.error(result.error || 'Please verify your email address before logging in.', {
            duration: 6000,
          });
        } else if (result.trialExpired) {
          toast.error(result.error || 'Your free trial has ended. Please contact sales to upgrade.', {
            duration: 8000,
          });
        } else {
          toast.error(result.error || 'Login failed');
        }
      }
    } catch (error) {
      console.error('Login error:', error);

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

  const scrollToForm = () => {
    const el = document.getElementById('login-form');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="h-screen flex flex-col lg:flex-row overflow-hidden bg-white">
      {/* Left panel: Welcome + tagline (primary theme), glass card, built-by at bottom */}
      <div className="flex-shrink-0 lg:w-1/2 bg-primary-600 flex flex-col justify-between items-center px-6 sm:px-8 lg:px-10 py-6 lg:py-8 order-1 lg:order-1 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/30 to-primary-700/50 pointer-events-none" aria-hidden />
        <div className="max-w-sm w-full text-center text-white flex-1 flex flex-col justify-center relative z-10 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-xl px-6 py-8 lg:px-8 lg:py-10">
          <h1 className="text-2xl sm:text-3xl font-bold mb-3">Good to see you again</h1>
          <p className="text-primary-100 text-sm sm:text-base mb-4">
            Your work deserves clarity, not chaos.
          </p>
          <p className="text-primary-100 text-sm sm:text-base mb-6">
            Growing with <span className="font-semibold text-white">W | Technology</span>
          </p>
          <ul className="text-primary-100 text-sm sm:text-base space-y-2 list-none mx-auto inline-flex flex-col items-center justify-center">
            <li className="flex items-center justify-center gap-2 w-full">
              <span className="text-primary-300 flex-shrink-0" aria-hidden></span>
              <span>Simple, Secure , Built for freelancers &amp; agencies</span>
            </li>
            <li className="flex items-center justify-center gap-2 w-full">
              <span className="text-primary-300 flex-shrink-0" aria-hidden></span>
              <span></span>
            </li>
            <li className="flex items-center justify-center gap-2 w-full">
              <span className="text-primary-300 flex-shrink-0" aria-hidden></span>
              <span></span>
            </li>
          </ul>
        </div>
        <p className="text-primary-200 text-xs sm:text-sm pt-4 border-t border-white/20 mt-4 flex-shrink-0 text-center w-full max-w-sm relative z-10">
          Built with ❤️ by <span className="font-semibold text-white">W | Technology</span>
        </p>
      </div>

      {/* Right panel: Login form — centered, glass effect */}
      <div
        id="login-form"
        className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-gradient-to-b from-primary-50/30 to-white order-2 lg:order-2 justify-center items-center"
      >
        <div className="flex flex-col w-full max-w-md mx-auto px-6 py-6 lg:py-8">
          <div className="text-center mb-5">
            <div className="inline-flex h-12 w-12 bg-primary-600 rounded-full items-center justify-center shadow-lg">
              <Lock className="h-6 w-6 text-white" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-gray-900">Sign in to your account</h2>
            <p className="mt-1 text-sm text-gray-600">Enter your credentials below</p>
          </div>

          {showTrialExpiredBanner && (
            <div className="rounded-lg bg-amber-50/90 backdrop-blur-sm border border-amber-200 py-3 px-4 text-center text-amber-800 text-sm mb-4">
              Your free trial has ended. Please contact sales to upgrade and continue using the platform.
            </div>
          )}

          <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/60 shadow-xl shadow-primary-900/5 px-5 py-5">
            <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label htmlFor="username" className="form-label text-sm">
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
                  className={`form-input pl-10 py-2 text-sm ${
                    errors.username ? 'border-danger-500' : ''
                  }`}
                  placeholder="Enter your username or email"
                />
              </div>
              {errors.username && (
                <p className="form-error text-xs mt-1">{errors.username.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="form-label text-sm">
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
                  className={`form-input pl-10 pr-10 py-2 text-sm ${
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
                <p className="form-error text-xs mt-1">{errors.password.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-gray-700">
                  Remember me
                </label>
              </div>
              <a href="#" className="font-medium text-primary-600 hover:text-primary-500">
                Forgot password?
              </a>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
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
          </div>

          <div className="mt-5 text-center space-y-1 text-sm">
            <p className="text-gray-600">
              Don&apos;t have an account?{' '}
              <Link to="/register" className="font-medium text-primary-600 hover:text-primary-500">
                Create an account
              </Link>
            </p>
            <p className="text-gray-600">
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
    </div>
  );
};

export default Login;
