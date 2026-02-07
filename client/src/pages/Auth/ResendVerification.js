import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, AlertCircle, CheckCircle, ArrowLeft, Shield } from 'lucide-react';
import { authAPI } from '../../services/api';
import toast from 'react-hot-toast';

const AUTH_BG_IMAGE = '/images/auth-panel2.jpg';

const ResendVerification = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [bgImageError, setBgImageError] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      const response = await authAPI.resendVerification(data.email.trim().toLowerCase());
      if (response.data.success) {
        setEmailSent(true);
        toast.success('Verification email sent! Please check your inbox.');
      } else {
        toast.error(response.data.message || 'Failed to send verification email');
      }
    } catch (error) {
      console.error('Resend verification error:', error);
      if (error.response?.data?.errors?.length) {
        (error.response.data.errors || []).forEach((err) => {
          toast.error(err.msg || err.message || 'Validation error');
        });
      } else {
        toast.error(
          error.response?.data?.message ||
          'Failed to send verification email. Please try again.' ||
          'An unexpected error occurred'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
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
            <h2 className="text-xl font-bold text-gray-900 mb-2">Email sent!</h2>
            <p className="text-sm text-gray-600 mb-4">
              We&apos;ve sent a new verification email to your inbox. Please check your email and click the verification link to activate your account.
            </p>
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-primary-800 font-medium">Didn&apos;t receive the email?</p>
              <ul className="text-sm text-primary-700 mt-2 text-left list-disc list-inside space-y-1">
                <li>Check your spam or junk folder</li>
                <li>Wait a few minutes and check again</li>
                <li>Make sure you entered the correct email address</li>
              </ul>
            </div>
            <div className="space-y-3">
              <button onClick={() => navigate('/login')} className="auth-btn-primary">
                Go to Login
              </button>
              <button
                onClick={() => setEmailSent(false)}
                className="w-full py-2.5 px-4 rounded-lg text-sm font-medium text-gray-700 bg-white border-2 border-gray-200 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500/30 transition-all"
              >
                Send another email
              </button>
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
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Resend verification</h1>
          <p className="mt-2 text-sm md:text-base text-white/80 leading-snug">
            Enter your email address to receive a new verification link and activate your account.
          </p>
          <p className="auth-footer-left">
            Built with ❤️ by <span>W | Technology</span>
          </p>
        </div>

        <div className="auth-form-panel">
          <h2 className="text-lg font-semibold text-gray-900">Resend verification email</h2>
          <p className="mt-0.5 text-xs text-gray-600">Enter your email address to receive a new verification link.</p>

          <form className="mt-4 space-y-3" onSubmit={handleSubmit(onSubmit)}>
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
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: 'Please enter a valid email address',
                      },
                    })}
                    placeholder="you@company.com"
                    className={`auth-input pl-9 ${errors.email ? 'auth-input-error' : ''}`}
                  />
                </div>
                {errors.email && <p className="auth-error-msg flex items-center gap-1 mt-0.5"><AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />{errors.email.message}</p>}
              </div>
              <p className="mt-0.5 text-xs text-gray-500">We&apos;ll send a new verification link to this email address.</p>
            </div>

            <button type="submit" disabled={isLoading} className="auth-btn-primary">
              {isLoading ? (
                <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Sending...</>
              ) : (
                'Send verification email'
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-gray-600">
            <Link to="/login" className="inline-flex items-center auth-link">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResendVerification;
