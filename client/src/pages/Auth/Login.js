import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation } from 'react-router-dom';
import { Lock, User, Shield, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

const AUTH_BG_IMAGE = '/images/auth-panel2.jpg';

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [bgImageError, setBgImageError] = useState(false);
  const { login } = useAuth();
  const location = useLocation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const verified = params.get('verified');
    if (verified === '1') {
      toast.success('Your email has been verified. You can now log in.');
    } else if (verified === 'already') {
      toast.success('Your email is already verified. Please log in.');
    }
  }, [location.search]);

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
          toast.error(result.error || 'Please verify your email address before logging in.', { duration: 6000 });
        } else if (result.trialExpired) {
          toast.error(result.error || 'Your free trial has ended. Please contact sales to upgrade.', { duration: 8000 });
        } else {
          toast.error(result.error || 'Login failed');
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      if (error.response?.data?.requiresVerification) {
        toast.error(error.response.data.message || 'Please verify your email address before logging in.', { duration: 6000 });
      } else {
        toast.error(error.response?.data?.message || 'Login failed. Please check your credentials.' || 'An unexpected error occurred');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-page-bg">
        {!bgImageError && (
          <img
            src={AUTH_BG_IMAGE}
            alt=""
            onError={() => setBgImageError(true)}
          />
        )}
        {!bgImageError ? (
          <div className="auth-page-overlay" aria-hidden />
        ) : (
          <div className="auth-page-overlay-fallback" aria-hidden />
        )}
      </div>

      <div className="auth-glass-card">
        <div className="auth-panel-left">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-white/20 text-white shadow-lg">
              <Shield className="w-6 h-6" aria-hidden />
            </div>
            <span className="text-lg font-bold text-white tracking-tight">WT Project Management</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Welcome back</h1>
          <p className="mt-2 text-sm md:text-base text-white/80 leading-snug">
            Manage clients, projects, quotations, and invoices in one place. Sign in to access your workspace.
          </p>
          <p className="auth-footer-left">
            Built with ❤️ by <span>W | Technology</span>
          </p>
        </div>

        <div className="auth-form-panel">
          <h2 className="text-lg font-semibold text-gray-900">Sign in</h2>
          <p className="mt-0.5 text-xs text-gray-600">Enter your credentials to access your account.</p>

          {showTrialExpiredBanner && (
            <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 py-2 px-3 text-center text-amber-800 text-xs">
              Your free trial has ended. Please contact sales to upgrade.
            </div>
          )}

          <form className="mt-4 space-y-3" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label htmlFor="username" className="auth-label">
                Username or email
              </label>
              <div className="relative group">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-primary-600 pointer-events-none transition-colors" />
                <input
                  id="username"
                  type="text"
                  {...register('username', { required: 'Username or email is required' })}
                  placeholder="you@company.com"
                  className={`auth-input pl-9 pr-3 ${errors.username ? 'auth-input-error' : ''}`}
                />
                {errors.username && <p className="auth-error-msg">{errors.username.message}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="password" className="auth-label">
                Password
              </label>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-primary-600 pointer-events-none transition-colors" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  {...register('password', {
                    required: 'Password is required',
                    minLength: { value: 6, message: 'Password must be at least 6 characters' },
                  })}
                  placeholder="••••••••"
                  className={`auth-input pl-9 pr-12 py-2.5 ${errors.password ? 'auth-input-error' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-primary-600 hover:text-primary-700 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                {errors.password && <p className="auth-error-msg">{errors.password.message}</p>}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 cursor-pointer select-none text-gray-700">
                <input
                  type="checkbox"
                  {...register('rememberMe')}
                  className="h-3.5 w-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 bg-white"
                />
                Remember me
              </label>
              <Link to="/forgot-password" className="auth-link">
                Forgot password?
              </Link>
            </div>

            <div className="pt-0.5">
              <button
                type="submit"
                disabled={isLoading}
                className="auth-btn-primary"
              >
                {isLoading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Signing in...
                  </>
                ) : (
                  'Sign in'
                )}
              </button>
            </div>
          </form>

          <div className="mt-4 flex items-center gap-2">
            <span className="flex-1 h-px bg-gray-200" />
            <span className="text-xs font-medium text-gray-500 uppercase">or</span>
            <span className="flex-1 h-px bg-gray-200" />
          </div>

          <Link
            to="/register"
            className="mt-3 flex items-center justify-center w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-primary-600 bg-primary-50 border border-primary-200 hover:bg-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-500/30 transition-all"
          >
            Create an account
          </Link>

          <p className="mt-4 text-center text-xs text-gray-600">
            Need to verify your email?{' '}
            <Link to="/resend-verification" className="auth-link">
              Resend verification
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
