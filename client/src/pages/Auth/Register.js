import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import {
  Eye,
  EyeOff,
  Mail,
  User,
  Building2,
  Lock,
  CheckCircle,
  AlertCircle,
  Shield,
  UserPlus,
  FolderPlus,
  TrendingUp,
} from 'lucide-react';
import { authAPI } from '../../services/api';
import toast from 'react-hot-toast';

const AUTH_BG_IMAGE = '/images/auth-panel2.jpg';

const Register = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [bgImageError, setBgImageError] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({ mode: 'onChange' });

  const password = watch('password');

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      const response = await authAPI.register({
        email: data.email.trim().toLowerCase(),
        password: data.password,
        full_name: data.full_name.trim(),
        workspace_name: data.workspace_name.trim(),
      });
      if (response.data.success) {
        setRegistrationSuccess(true);
        toast.success('Registration successful! Please check your email to verify your account.');
      } else {
        toast.error(response.data.message || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      if (error.response?.data?.errors) {
        (error.response.data.errors || []).forEach((err) => {
          toast.error(err.msg || err.message || 'Validation error');
        });
      } else {
        const msg = error.response?.data?.message;
        const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout');
        const isEmailFailure = msg?.toLowerCase().includes('email verification') || error.response?.status === 503;
        if (isTimeout || isEmailFailure) {
          toast.error(msg || 'Failed to send email verification. Please try again later.');
        } else {
          toast.error(msg || 'Registration failed. Please try again.' || 'An unexpected error occurred');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (registrationSuccess) {
    return (
      <div className="auth-page">
        <div className="auth-page-bg">
          {!bgImageError && <img src={AUTH_BG_IMAGE} alt="" onError={() => setBgImageError(true)} />}
          {!bgImageError ? <div className="auth-page-overlay" aria-hidden /> : <div className="auth-page-overlay-fallback" aria-hidden />}
        </div>
        <div className="auth-glass-card" style={{ maxWidth: '28rem' }}>
          <div className="auth-form-panel w-full">
            <div className="inline-flex h-12 w-12 bg-success-100 rounded-full items-center justify-center mb-4">
              <CheckCircle className="h-6 w-6 text-success-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Registration Successful!</h2>
            <p className="text-sm text-gray-600 mb-4">
              We&apos;ve sent a verification email to your inbox. Please check your email and click the verification link to activate your account.
            </p>
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 mb-4 text-left">
              <p className="text-xs text-primary-800 font-medium">Didn&apos;t receive the email?</p>
              <p className="text-xs text-primary-700 mt-0.5">Check your spam folder or use the resend link below.</p>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => navigate('/login')}
                className="auth-btn-primary"
              >
                Go to Login
              </button>
              <Link to="/resend-verification" className="block text-center text-sm auth-link mt-2">
                Resend verification email
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-page-bg">
        {!bgImageError && <img src={AUTH_BG_IMAGE} alt="" onError={() => setBgImageError(true)} />}
        {!bgImageError ? <div className="auth-page-overlay" aria-hidden /> : <div className="auth-page-overlay-fallback" aria-hidden />}
      </div>

      <div className="auth-glass-card">
        <div className="auth-panel-left">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-white/20 text-white shadow-lg">
              <Shield className="w-6 h-6" aria-hidden />
            </div>
            <span className="text-lg font-bold text-white tracking-tight">WT Project Management</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Create your account</h1>
          <p className="mt-2 text-sm md:text-base text-white/80 leading-snug">
            Register your workspace and start managing clients, projects, quotations, and invoices in one place.
          </p>

          <ul className="mt-6 space-y-4" aria-label="How it works">
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg bg-white/15 text-white" aria-hidden>
                <UserPlus className="w-4 h-4" />
              </span>
              <div>
                <span className="text-sm font-semibold text-white block">1. Register</span>
                <span className="text-xs text-white/75 leading-snug">Create your workspace and verify your email.</span>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg bg-white/15 text-white" aria-hidden>
                <FolderPlus className="w-4 h-4" />
              </span>
              <div>
                <span className="text-sm font-semibold text-white block">2. Add clients & projects</span>
                <span className="text-xs text-white/75 leading-snug">Link work to clients; manage quotes and invoices in one place.</span>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg bg-white/15 text-white" aria-hidden>
                <TrendingUp className="w-4 h-4" />
              </span>
              <div>
                <span className="text-sm font-semibold text-white block">3. Track your growth</span>
                <span className="text-xs text-white/75 leading-snug">Use reports and dashboards for revenue, pipeline, and status.</span>
              </div>
            </li>
          </ul>

          <p className="auth-footer-left">
            Built with ❤️ by <span>W | Technology</span>
          </p>
        </div>

        <div className="auth-form-panel overflow-y-auto">
          <h2 className="text-lg font-semibold text-gray-900">Sign up</h2>
          <p className="mt-0.5 text-xs text-gray-600">Enter your details to create your workspace.</p>

          <form className="mt-4 space-y-3" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label htmlFor="full_name" className="auth-label">Full name <span className="text-red-500">*</span></label>
              <div className="auth-input-wrap">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  <input
                    id="full_name"
                    type="text"
                    {...register('full_name', {
                      required: 'Full name is required',
                      minLength: { value: 2, message: 'Full name must be at least 2 characters' },
                      maxLength: { value: 100, message: 'Full name must not exceed 100 characters' },
                      pattern: { value: /^[a-zA-Z\s'-]+$/, message: 'Full name can only contain letters, spaces, hyphens, and apostrophes' },
                    })}
                    placeholder="Enter your full name"
                    className={`auth-input pl-9 ${errors.full_name ? 'auth-input-error' : ''}`}
                  />
                </div>
                {errors.full_name && <p className="auth-error-msg flex items-center gap-1 mt-0.5"><AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />{errors.full_name.message}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="email" className="auth-label">Email address <span className="text-red-500">*</span></label>
              <div className="auth-input-wrap">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  <input
                    id="email"
                    type="email"
                    {...register('email', {
                      required: 'Email address is required',
                      pattern: { value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i, message: 'Please enter a valid email address' },
                    })}
                    placeholder="you@company.com"
                    className={`auth-input pl-9 ${errors.email ? 'auth-input-error' : ''}`}
                  />
                </div>
                {errors.email && <p className="auth-error-msg flex items-center gap-1 mt-0.5"><AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />{errors.email.message}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="workspace_name" className="auth-label">Workspace name <span className="text-red-500">*</span></label>
              <div className="auth-input-wrap">
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  <input
                    id="workspace_name"
                    type="text"
                    {...register('workspace_name', {
                      required: 'Workspace name is required',
                      minLength: { value: 2, message: 'Workspace name must be at least 2 characters' },
                      maxLength: { value: 100, message: 'Workspace name must not exceed 100 characters' },
                      pattern: { value: /^[a-zA-Z0-9\s-]+$/, message: 'Workspace name can only contain letters, numbers, spaces, and hyphens' },
                    })}
                    placeholder="Your organization name"
                    className={`auth-input pl-9 ${errors.workspace_name ? 'auth-input-error' : ''}`}
                  />
                </div>
                {errors.workspace_name && <p className="auth-error-msg flex items-center gap-1 mt-0.5"><AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />{errors.workspace_name.message}</p>}
              </div>
              <p className="mt-0.5 text-xs text-gray-500">This will be your organization&apos;s name in the system.</p>
            </div>

            <div>
              <label htmlFor="password" className="auth-label">Password <span className="text-red-500">*</span></label>
              <div className="auth-input-wrap">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    {...register('password', {
                      required: 'Password is required',
                      minLength: { value: 6, message: 'Password must be at least 6 characters' },
                      maxLength: { value: 100, message: 'Password must not exceed 100 characters' },
                    })}
                    placeholder="••••••••"
                    className={`auth-input pl-9 pr-12 ${errors.password ? 'auth-input-error' : ''}`}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-primary-600 hover:text-primary-700" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="auth-error-msg flex items-center gap-1 mt-0.5"><AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />{errors.password.message}</p>}
              </div>
              <p className="mt-0.5 text-xs text-gray-500">Must be at least 6 characters long.</p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="auth-label">Confirm password <span className="text-red-500">*</span></label>
              <div className="auth-input-wrap">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    {...register('confirmPassword', {
                      required: 'Please confirm your password',
                      validate: (value) => value === password || 'Passwords do not match',
                    })}
                    placeholder="••••••••"
                    className={`auth-input pl-9 pr-12 ${errors.confirmPassword ? 'auth-input-error' : ''}`}
                  />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-primary-600 hover:text-primary-700" aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}>
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="auth-error-msg flex items-center gap-1 mt-0.5"><AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />{errors.confirmPassword.message}</p>}
              </div>
            </div>

            <div className="flex items-start gap-2">
              <input
                id="terms"
                type="checkbox"
                {...register('terms', { required: 'You must accept the terms and conditions' })}
                className="h-4 w-4 mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="terms" className="text-xs text-gray-700">
                I agree to the <Link to="/terms" className="auth-link underline">Terms &amp; Conditions</Link> and <Link to="/privacy" className="auth-link underline">Privacy Policy</Link> <span className="text-red-500">*</span>
              </label>
            </div>
            {errors.terms && <p className="auth-error-msg flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />{errors.terms.message}</p>}

            <div className="pt-1">
              <button type="submit" disabled={isLoading} className="auth-btn-primary">
                {isLoading ? (
                  <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Creating account...</>
                ) : (
                  'Create account'
                )}
              </button>
            </div>
          </form>

          <p className="mt-4 text-center text-xs text-gray-600">
            Already have an account? <Link to="/login" className="auth-link">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
