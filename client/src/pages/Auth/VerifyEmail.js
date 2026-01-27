import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { CheckCircle, XCircle, Mail, AlertCircle, Loader } from 'lucide-react';
import { authAPI } from '../../services/api';
import toast from 'react-hot-toast';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying'); // verifying, success, error, expired
  const [errorMessage, setErrorMessage] = useState('');
  const verificationSucceeded = useRef(false); // Track if verification already succeeded
  const token = searchParams.get('token');

  useEffect(() => {
    const verifyEmail = async () => {
      // Prevent duplicate verification attempts if already succeeded
      if (verificationSucceeded.current) {
        return;
      }

      if (!token) {
        setStatus('error');
        setErrorMessage('Verification token is missing');
        return;
      }

      try {
        const response = await authAPI.verifyEmail(token);
        
        // Check if response is successful
        if (response && response.data && response.data.success) {
          verificationSucceeded.current = true; // Mark as succeeded
          setStatus('success');
          toast.success('Email verified successfully! You can now log in.');
          
          // Redirect to login after 3 seconds
          setTimeout(() => {
            navigate('/login');
          }, 3000);
          return; // Exit early to prevent any further processing
        } else {
          // Response exists but success is false
          setStatus('error');
          setErrorMessage(response?.data?.message || 'Verification failed');
        }
      } catch (error) {
        console.error('Email verification error:', error);
        
        // Only process error if verification hasn't already succeeded
        if (!verificationSucceeded.current) {
          const errorMsg = error.response?.data?.message || error.message || 'Verification failed. Please try again.';
          const lowerErrorMsg = errorMsg.toLowerCase();
          
          // If email is already verified, treat it as success
          if (lowerErrorMsg.includes('already verified')) {
            verificationSucceeded.current = true;
            setStatus('success');
            toast.success('Email already verified! You can log in.');
            setTimeout(() => {
              navigate('/login');
            }, 3000);
            return;
          }
          
          // Check if token is expired or invalid
          if (lowerErrorMsg.includes('expired') || 
              lowerErrorMsg.includes('invalid') || 
              lowerErrorMsg.includes('not found')) {
            setStatus('expired');
            setErrorMessage(errorMsg);
          } else {
            setStatus('error');
            setErrorMessage(errorMsg);
          }
        }
        // If verification already succeeded, ignore the error (might be a duplicate request)
      }
    };

    verifyEmail();
  }, [token, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="bg-white py-8 px-6 shadow-soft rounded-lg text-center">
          {/* Verifying State */}
          {status === 'verifying' && (
            <>
              <div className="mx-auto h-16 w-16 bg-primary-100 rounded-full flex items-center justify-center mb-4">
                <Loader className="h-8 w-8 text-primary-600 animate-spin" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Verifying your email...
              </h2>
              <p className="text-gray-600">
                Please wait while we verify your email address.
              </p>
            </>
          )}

          {/* Success State */}
          {status === 'success' && (
            <>
              <div className="mx-auto h-16 w-16 bg-success-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="h-8 w-8 text-success-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Email Verified!
              </h2>
              <p className="text-gray-600 mb-6">
                Your email has been successfully verified. You can now log in to your account.
              </p>
              <div className="space-y-3">
                <Link
                  to="/login"
                  className="block w-full py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors duration-200"
                >
                  Go to Login
                </Link>
                <p className="text-xs text-gray-500">
                  Redirecting to login page in 3 seconds...
                </p>
              </div>
            </>
          )}

          {/* Error State */}
          {status === 'error' && (
            <>
              <div className="mx-auto h-16 w-16 bg-danger-100 rounded-full flex items-center justify-center mb-4">
                <XCircle className="h-8 w-8 text-danger-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Verification Failed
              </h2>
              <p className="text-gray-600 mb-4">
                {errorMessage || 'We couldn\'t verify your email address. Please try again.'}
              </p>
              <div className="bg-danger-50 border border-danger-200 rounded-lg p-4 mb-6">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 text-danger-600 mr-2 mt-0.5" />
                  <div className="text-sm text-danger-800">
                    <p className="font-medium mb-1">What to do next:</p>
                    <ul className="list-disc list-inside space-y-1 text-left">
                      <li>Check if the verification link has expired</li>
                      <li>Request a new verification email</li>
                      <li>Contact support if the problem persists</li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <Link
                  to="/login"
                  className="block w-full py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors duration-200"
                >
                  Go to Login
                </Link>
                <Link
                  to="/resend-verification"
                  className="block text-sm text-center text-primary-600 hover:text-primary-500"
                >
                  Resend verification email
                </Link>
              </div>
            </>
          )}

          {/* Expired State */}
          {status === 'expired' && (
            <>
              <div className="mx-auto h-16 w-16 bg-warning-100 rounded-full flex items-center justify-center mb-4">
                <Mail className="h-8 w-8 text-warning-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Verification Link Expired
              </h2>
              <p className="text-gray-600 mb-6">
                This verification link has expired. Please request a new verification email.
              </p>
              <div className="bg-warning-50 border border-warning-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-warning-800">
                  <strong>Note:</strong> Verification links are valid for 24 hours. If you need a new link, please use the resend option.
                </p>
              </div>
              <div className="space-y-3">
                <Link
                  to="/resend-verification"
                  className="block w-full py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors duration-200"
                >
                  Resend Verification Email
                </Link>
                <Link
                  to="/login"
                  className="block text-sm text-center text-primary-600 hover:text-primary-500"
                >
                  Back to Login
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
