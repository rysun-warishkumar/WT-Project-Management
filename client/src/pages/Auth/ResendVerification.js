import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { authAPI } from '../../services/api';
import toast from 'react-hot-toast';

const ResendVerification = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
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
      
      // Handle validation errors
      if (error.response?.data?.errors) {
        const validationErrors = error.response.data.errors;
        validationErrors.forEach((err) => {
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

  // Success screen
  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="bg-white py-8 px-6 shadow-soft rounded-lg text-center">
            <div className="mx-auto h-16 w-16 bg-success-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-success-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Email Sent!
            </h2>
            <p className="text-gray-600 mb-6">
              We've sent a new verification email to your inbox. Please check your email and click the verification link to activate your account.
            </p>
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-primary-800">
                <strong>Didn't receive the email?</strong>
              </p>
              <ul className="text-sm text-primary-700 mt-2 text-left list-disc list-inside space-y-1">
                <li>Check your spam or junk folder</li>
                <li>Wait a few minutes and check again</li>
                <li>Make sure you entered the correct email address</li>
              </ul>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => navigate('/login')}
                className="w-full py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors duration-200"
              >
                Go to Login
              </button>
              <button
                onClick={() => setEmailSent(false)}
                className="w-full py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors duration-200"
              >
                Send Another Email
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-primary-600 rounded-full flex items-center justify-center">
            <Mail className="h-8 w-8 text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Resend Verification Email
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Enter your email address to receive a new verification link
          </p>
        </div>

        {/* Form */}
        <div className="bg-white py-8 px-6 shadow-soft rounded-lg">
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="form-label">
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
                  className={`form-input pl-10 ${
                    errors.email ? 'border-danger-500' : ''
                  }`}
                  placeholder="Enter your email address"
                />
              </div>
              {errors.email && (
                <p className="form-error flex items-center mt-1">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {errors.email.message}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                We'll send a new verification link to this email address
              </p>
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
                    Sending...
                  </div>
                ) : (
                  'Send Verification Email'
                )}
              </button>
            </div>
          </form>

          {/* Footer */}
          <div className="mt-6 space-y-3">
            <Link
              to="/login"
              className="flex items-center justify-center text-sm text-primary-600 hover:text-primary-500"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Login
            </Link>
            <p className="text-center text-sm text-gray-600">
              Don't have an account?{' '}
              <Link
                to="/register"
                className="font-medium text-primary-600 hover:text-primary-500"
              >
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResendVerification;
