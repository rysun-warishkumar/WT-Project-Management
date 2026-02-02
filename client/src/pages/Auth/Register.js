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
  Users,
  FileText,
  BarChart3,
} from 'lucide-react';
import { authAPI } from '../../services/api';
import toast from 'react-hot-toast';

const STEPS = [
  {
    title: 'Register with your email',
    description:
      'Register your workspace and start managing your clients and projects.',
    icon: Users,
  },
  {
    title: 'Add clients & projects',
    description:
      'Add clients and projects. Link work to clients so every quote, invoice, and sprint stays connected.',
    icon: FileText,
  },
  {
    title: 'Track & grow',
    description:
      'Use reports and dashboards to see revenue, outstanding amounts, project status, sprint velocity, and burndown at a glance.',
    icon: BarChart3,
  },
];

const Register = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    mode: 'onChange',
  });

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
        const validationErrors = error.response.data.errors;
        validationErrors.forEach((err) => {
          toast.error(err.msg || err.message || 'Validation error');
        });
      } else {
        const msg = error.response?.data?.message;
        const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout');
        const isEmailFailure =
          msg?.toLowerCase().includes('email verification') || error.response?.status === 503;
        if (isTimeout || isEmailFailure) {
          toast.error(msg || 'Failed to send email verification. Please try again later.');
        } else {
          toast.error(
            msg || 'Registration failed. Please try again.' || 'An unexpected error occurred'
          );
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Success screen (100vh, no scroll)
  if (registrationSuccess) {
    return (
      <div className="h-screen flex flex-col overflow-hidden bg-white">
        <div className="flex-1 flex items-center justify-center overflow-y-auto px-4 py-6">
          <div className="max-w-md w-full bg-white rounded-lg text-center">
            <div className="inline-flex h-14 w-14 bg-success-100 rounded-full items-center justify-center mb-4">
              <CheckCircle className="h-7 w-7 text-success-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Registration Successful!</h2>
            <p className="text-sm text-gray-600 mb-4">
              We&apos;ve sent a verification email to your inbox. Please check your email and click
              the verification link to activate your account.
            </p>
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 mb-4 text-left">
              <p className="text-xs text-primary-800 font-medium">Didn&apos;t receive the email?</p>
              <p className="text-xs text-primary-700 mt-0.5">
                Check your spam folder or click the resend button below.
              </p>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => navigate('/login')}
                className="w-full py-2.5 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors duration-200"
              >
                Go to Login
              </button>
              <Link
                to="/login"
                className="block text-sm text-center text-primary-600 hover:text-primary-500"
              >
                Already verified? Sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const scrollToForm = () => {
    const el = document.getElementById('register-form');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="h-screen flex flex-col lg:flex-row overflow-hidden bg-white">
      {/* Left panel: Create Account + 3 steps (primary theme), glass card */}
      <div className="flex-shrink-0 lg:w-1/2 bg-primary-600 flex flex-col justify-center px-6 py-6 lg:py-8 order-1 overflow-y-auto relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/30 to-primary-700/50 pointer-events-none" aria-hidden />
        <div className="max-w-md w-full mx-auto relative z-10 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-xl px-6 py-8 lg:px-8 lg:py-10">
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">Let&apos;s get your started</h1>
          <p className="text-primary-200 text-xs sm:text-sm mb-6">
          All your clients, projects, and payments — in one place.
          </p>

          <p className="text-primary-200 text-xs font-medium uppercase tracking-wide mb-4">
            How it works
          </p>
          <h2 className="text-lg font-bold text-white mb-4">Three simple steps to a stress-free workflow</h2>
          <p className="text-primary-100 text-sm mb-6">
          No complicated setup. No learning curve.
          Just a smarter way to manage clients, projects, and deliveries from day one.
          </p>

          <div className="space-y-4">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={index} className="flex gap-3">
                  <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-primary-500/50 border border-primary-400 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-primary-300 text-xs font-medium">Step {index + 1}</p>
                    <h3 className="text-white font-semibold text-sm mt-0.5">{step.title}</h3>
                    <p className="text-primary-100 text-xs mt-1 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* <button
            type="button"
            onClick={scrollToForm}
            className="mt-6 inline-flex items-center justify-center px-6 py-2.5 border-2 border-white text-white text-sm font-medium rounded-lg hover:bg-white hover:text-primary-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white"
          >
            Sign up
          </button> */}
        </div>
      </div>

      {/* Right panel: Registration form — glass effect */}
      <div
        id="register-form"
        className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-gradient-to-b from-primary-50/30 to-white order-2 justify-center items-center"
      >
        <div className="flex flex-col justify-center w-full max-w-md mx-auto px-6 py-6 lg:py-8">
          <div className="text-center mb-4">
            <div className="inline-flex h-12 w-12 bg-primary-600 rounded-full items-center justify-center shadow-lg">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-gray-900">Create your account</h2>
            <p className="mt-1 text-sm text-gray-600">Start managing your clients and projects today</p>
          </div>

          <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/60 shadow-xl shadow-primary-900/5 px-5 py-5">
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label htmlFor="full_name" className="form-label text-sm">
                Full Name <span className="text-danger-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="full_name"
                  type="text"
                  {...register('full_name', {
                    required: 'Full name is required',
                    minLength: { value: 2, message: 'Full name must be at least 2 characters' },
                    maxLength: { value: 100, message: 'Full name must not exceed 100 characters' },
                    pattern: {
                      value: /^[a-zA-Z\s'-]+$/,
                      message: "Full name can only contain letters, spaces, hyphens, and apostrophes",
                    },
                  })}
                  className={`form-input pl-10 py-2 text-sm ${
                    errors.full_name ? 'border-danger-500' : ''
                  }`}
                  placeholder="Enter your full name"
                />
              </div>
              {errors.full_name && (
                <p className="form-error flex items-center text-xs mt-1">
                  <AlertCircle className="h-3.5 w-3.5 mr-1 flex-shrink-0" />
                  {errors.full_name.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="form-label text-sm">
                Email Address <span className="text-danger-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  type="email"
                  {...register('email', {
                    required: 'Email is required',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Please enter a valid email address',
                    },
                  })}
                  className={`form-input pl-10 py-2 text-sm ${errors.email ? 'border-danger-500' : ''}`}
                  placeholder="Enter your email address"
                />
              </div>
              {errors.email && (
                <p className="form-error flex items-center text-xs mt-1">
                  <AlertCircle className="h-3.5 w-3.5 mr-1 flex-shrink-0" />
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="workspace_name" className="form-label text-sm">
                Workspace Name <span className="text-danger-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Building2 className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="workspace_name"
                  type="text"
                  {...register('workspace_name', {
                    required: 'Workspace name is required',
                    minLength: {
                      value: 2,
                      message: 'Workspace name must be at least 2 characters',
                    },
                    maxLength: {
                      value: 100,
                      message: 'Workspace name must not exceed 100 characters',
                    },
                    pattern: {
                      value: /^[a-zA-Z0-9\s-]+$/,
                      message: 'Workspace name can only contain letters, numbers, spaces, and hyphens',
                    },
                  })}
                  className={`form-input pl-10 py-2 text-sm ${
                    errors.workspace_name ? 'border-danger-500' : ''
                  }`}
                  placeholder="Enter your workspace name"
                />
              </div>
              {errors.workspace_name && (
                <p className="form-error flex items-center text-xs mt-1">
                  <AlertCircle className="h-3.5 w-3.5 mr-1 flex-shrink-0" />
                  {errors.workspace_name.message}
                </p>
              )}
              <p className="mt-0.5 text-xs text-gray-500">This will be your organization&apos;s name in the system</p>
            </div>

            <div>
              <label htmlFor="password" className="form-label text-sm">
                Password <span className="text-danger-500">*</span>
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
                    minLength: { value: 6, message: 'Password must be at least 6 characters' },
                    maxLength: { value: 100, message: 'Password must not exceed 100 characters' },
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
                <p className="form-error flex items-center text-xs mt-1">
                  <AlertCircle className="h-3.5 w-3.5 mr-1 flex-shrink-0" />
                  {errors.password.message}
                </p>
              )}
              <p className="mt-0.5 text-xs text-gray-500">Must be at least 6 characters long</p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="form-label text-sm">
                Confirm Password <span className="text-danger-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  {...register('confirmPassword', {
                    required: 'Please confirm your password',
                    validate: (value) => value === password || 'Passwords do not match',
                  })}
                  className={`form-input pl-10 pr-10 py-2 text-sm ${
                    errors.confirmPassword ? 'border-danger-500' : ''
                  }`}
                  placeholder="Confirm your password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="form-error flex items-center text-xs mt-1">
                  <AlertCircle className="h-3.5 w-3.5 mr-1 flex-shrink-0" />
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            <div className="flex items-start">
              <input
                id="terms"
                type="checkbox"
                {...register('terms', {
                  required: 'You must accept the terms and conditions',
                })}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded mt-0.5"
              />
              <label htmlFor="terms" className="ml-2 block text-xs text-gray-700">
                I agree to the{' '}
                <Link to="/terms" className="text-primary-600 hover:text-primary-500 underline">
                  Terms &amp; Conditions
                </Link>{' '}
                and{' '}
                <Link to="/privacy" className="text-primary-600 hover:text-primary-500 underline">
                  Privacy Policy
                </Link>
                <span className="text-danger-500">*</span>
              </label>
            </div>
            {errors.terms && (
              <p className="form-error flex items-center text-xs -mt-2">
                <AlertCircle className="h-3.5 w-3.5 mr-1 flex-shrink-0" />
                {errors.terms.message}
              </p>
            )}

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creating account...
                  </div>
                ) : (
                  'Create Account'
                )}
              </button>
            </div>
          </form>
          </div>

          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-primary-600 hover:text-primary-500">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
