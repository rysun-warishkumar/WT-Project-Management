import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, Shield } from 'lucide-react';
import { authAPI } from '../../services/api';
import toast from 'react-hot-toast';

const AUTH_BG_IMAGE = '/images/auth-panel2.jpg';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tokenFromUrl = searchParams.get('token') || '';
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [tokenInvalid, setTokenInvalid] = useState(false);
  const [bgImageError, setBgImageError] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({ mode: 'onChange' });
  const password = watch('newPassword');

  useEffect(() => {
    if (!tokenFromUrl || tokenFromUrl.trim() === '') {
      setTokenInvalid(true);
    }
  }, [tokenFromUrl]);

  const onSubmit = async (data) => {
    if (!tokenFromUrl.trim()) {
      toast.error('Invalid or missing reset link. Please request a new password reset.');
      return;
    }
    setIsLoading(true);
    try {
      const response = await authAPI.resetPassword({
        token: tokenFromUrl,
        newPassword: data.newPassword,
        confirmPassword: data.confirmPassword,
      });
      if (response.data.success) {
        setResetSuccess(true);
        toast.success(response.data.message || 'Password reset successfully. You can now sign in.');
        setTimeout(() => navigate('/login', { replace: true }), 2000);
      } else {
        toast.error(response.data.message || 'Failed to reset password.');
      }
    } catch (error) {
      const msg = error.response?.data?.message;
      if (error.response?.data?.errors?.length) {
        (error.response.data.errors || []).forEach((err) => {
          toast.error(err.msg || err.message || 'Validation error');
        });
      } else {
        toast.error(msg || 'Failed to reset password. Please try again or request a new link.');
      }
      if (msg && (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('already been used') || msg.toLowerCase().includes('invalid'))) {
        setTokenInvalid(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const AuthErrorView = () => (
    <div className="auth-page">
      <div className="auth-page-bg">
        {!bgImageError && <img src={AUTH_BG_IMAGE} alt="" onError={() => setBgImageError(true)} />}
        {!bgImageError ? <div className="auth-page-overlay" aria-hidden /> : <div className="auth-page-overlay-fallback" aria-hidden />}
      </div>
      <div className="auth-glass-card" style={{ maxWidth: '28rem' }}>
        <div className="auth-form-panel w-full">
          <div className="inline-flex h-12 w-12 bg-amber-100 rounded-full items-center justify-center mb-4">
            <AlertCircle className="h-6 w-6 text-amber-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Invalid or expired link</h2>
          <p className="text-sm text-gray-600 mb-4">
            This password reset link is invalid or has expired. Please request a new password reset link.
          </p>
          <Link to="/forgot-password" className="auth-btn-primary inline-flex justify-center mb-2">
            Request new reset link
          </Link>
          <Link to="/login" className="block text-center text-sm auth-link">
            Back to Sign in
          </Link>
        </div>
      </div>
    </div>
  );

  const AuthSuccessView = () => (
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
          <h2 className="text-xl font-bold text-gray-900 mb-2">Password reset successfully</h2>
          <p className="text-sm text-gray-600 mb-4">
            Your password has been reset. Redirecting you to sign in...
          </p>
          <Link to="/login" className="auth-btn-primary inline-flex justify-center">
            Go to Sign in
          </Link>
        </div>
      </div>
    </div>
  );

  if (tokenInvalid && !resetSuccess) return <AuthErrorView />;
  if (resetSuccess) return <AuthSuccessView />;

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
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Set new password</h1>
          <p className="mt-2 text-sm md:text-base text-white/80 leading-snug">
            Enter your new password below. Make sure it&apos;s at least 6 characters long.
          </p>
          <p className="auth-footer-left">
            Built with ❤️ by <span>W | Technology</span>
          </p>
        </div>

        <div className="auth-form-panel">
          <h2 className="text-lg font-semibold text-gray-900">Reset password</h2>
          <p className="mt-0.5 text-xs text-gray-600">Enter your new password and confirm it.</p>

          <form className="mt-4 space-y-3" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label htmlFor="newPassword" className="auth-label">New password <span className="text-red-500">*</span></label>
              <div className="auth-input-wrap">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  <input
                    id="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    {...register('newPassword', {
                      required: 'Password is required',
                      minLength: { value: 6, message: 'Password must be at least 6 characters' },
                      maxLength: { value: 100, message: 'Password must not exceed 100 characters' },
                    })}
                    placeholder="Enter new password"
                    className={`auth-input pl-9 pr-12 ${errors.newPassword ? 'auth-input-error' : ''}`}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-primary-600 hover:text-primary-700" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.newPassword && <p className="auth-error-msg">{errors.newPassword.message}</p>}
              </div>
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
                    placeholder="Confirm new password"
                    className={`auth-input pl-9 pr-12 ${errors.confirmPassword ? 'auth-input-error' : ''}`}
                  />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-primary-600 hover:text-primary-700" aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}>
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="auth-error-msg">{errors.confirmPassword.message}</p>}
              </div>
            </div>

            <button type="submit" disabled={isLoading} className="auth-btn-primary">
              {isLoading ? (
                <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Resetting...</>
              ) : (
                'Reset password'
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-gray-600">
            <Link to="/login" className="auth-link">Back to Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
