import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useAuth } from '../../contexts/AuthContext';
import { authAPI } from '../../services/api';
import toast from 'react-hot-toast';
import {
  User,
  Mail,
  Lock,
  Save,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  Info,
  Loader,
  UserCircle,
  Shield,
  Calendar,
  Clock,
} from 'lucide-react';

const Settings = () => {
  const { user, updateProfile, changePassword } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('profile');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [profileErrors, setProfileErrors] = useState({});
  const [passwordErrors, setPasswordErrors] = useState({});

  // Profile form
  const {
    register: registerProfile,
    handleSubmit: handleSubmitProfile,
    formState: { errors: profileFormErrors, isSubmitting: isSubmittingProfile },
    reset: resetProfile,
    watch: watchProfile,
  } = useForm({
    defaultValues: {
      full_name: '',
      email: '',
      username: '',
    },
  });

  // Password form
  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    formState: { errors: passwordFormErrors, isSubmitting: isSubmittingPassword },
    reset: resetPassword,
    watch: watchPassword,
  } = useForm();

  // Fetch user profile
  const { data: profileData, isLoading: isLoadingProfile } = useQuery(
    'userProfile',
    async () => {
      const response = await authAPI.getProfile();
      return response.data.data;
    },
    {
      onSuccess: (data) => {
        resetProfile({
          full_name: data.full_name || '',
          email: data.email || '',
          username: data.username || '',
        });
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to load profile');
      },
    }
  );

  // Update profile mutation
  const updateProfileMutation = useMutation(
    async (data) => {
      const result = await updateProfile(data);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('userProfile');
        toast.success('Profile updated successfully');
        setProfileErrors({});
      },
      onError: (error) => {
        const errorMessage = error.message || 'Failed to update profile';
        toast.error(errorMessage);
        setProfileErrors({ general: errorMessage });
      },
    }
  );

  // Change password mutation
  const changePasswordMutation = useMutation(
    async (data) => {
      const result = await changePassword(data);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result;
    },
    {
      onSuccess: () => {
        resetPassword();
        toast.success('Password changed successfully');
        setPasswordErrors({});
      },
      onError: (error) => {
        const errorMessage = error.message || 'Failed to change password';
        toast.error(errorMessage);
        setPasswordErrors({ general: errorMessage });
      },
    }
  );

  // Handle profile form submission
  const onSubmitProfile = async (data) => {
    setProfileErrors({});
    
    // Client-side validation
    if (!data.full_name || data.full_name.trim().length < 2) {
      setProfileErrors({ full_name: 'Full name must be at least 2 characters' });
      return;
    }

    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      setProfileErrors({ email: 'Please enter a valid email address' });
      return;
    }

    if (!data.username || data.username.trim().length < 3) {
      setProfileErrors({ username: 'Username must be at least 3 characters' });
      return;
    }

    // Check if anything changed
    if (
      data.full_name === profileData?.full_name &&
      data.email === profileData?.email &&
      data.username === profileData?.username
    ) {
      toast.error('No changes detected');
      return;
    }

    try {
      await updateProfileMutation.mutateAsync({
        full_name: data.full_name.trim(),
        email: data.email.trim(),
        username: data.username.trim(),
      });
    } catch (error) {
      // Error handled in mutation
    }
  };

  // Handle password form submission
  const onSubmitPassword = async (data) => {
    setPasswordErrors({});

    // Client-side validation
    if (!data.currentPassword || data.currentPassword.trim().length === 0) {
      setPasswordErrors({ currentPassword: 'Current password is required' });
      return;
    }

    if (!data.newPassword || data.newPassword.length < 6) {
      setPasswordErrors({ newPassword: 'New password must be at least 6 characters' });
      return;
    }

    if (data.newPassword !== data.confirmPassword) {
      setPasswordErrors({ confirmPassword: 'Passwords do not match' });
      return;
    }

    if (data.currentPassword === data.newPassword) {
      setPasswordErrors({ newPassword: 'New password must be different from current password' });
      return;
    }

    try {
      await changePasswordMutation.mutateAsync({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
    } catch (error) {
      // Error handled in mutation
    }
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get role display name
  const getRoleDisplayName = (role) => {
    const roleMap = {
      admin: 'Administrator',
      po: 'Project Owner',
      manager: 'Manager',
      accountant: 'Accountant',
      client: 'Client',
      viewer: 'Viewer',
    };
    return roleMap[role] || role;
  };

  if (isLoadingProfile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-1">Manage your account settings and preferences</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex flex-wrap -mb-px space-x-1 sm:space-x-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'profile'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <User className="inline-block h-4 w-4 mr-2" />
            Profile Settings
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'password'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Lock className="inline-block h-4 w-4 mr-2" />
            Change Password
          </button>
          <button
            onClick={() => setActiveTab('account')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'account'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Info className="inline-block h-4 w-4 mr-2" />
            Account Information
          </button>
        </nav>
      </div>

      {/* Profile Settings Tab */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Profile Information</h2>
            <p className="text-sm text-gray-600 mt-1">
              Update your personal information and account details
            </p>
          </div>

          {profileErrors.general && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
              <p className="text-sm text-red-800">{profileErrors.general}</p>
            </div>
          )}

          <form onSubmit={handleSubmitProfile(onSubmitProfile)} className="space-y-6">
            {/* Full Name */}
            <div>
              <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-2">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="full_name"
                {...registerProfile('full_name', {
                  required: 'Full name is required',
                  minLength: {
                    value: 2,
                    message: 'Full name must be at least 2 characters',
                  },
                  maxLength: {
                    value: 100,
                    message: 'Full name must not exceed 100 characters',
                  },
                })}
                className={`form-input w-full ${
                  profileFormErrors.full_name || profileErrors.full_name
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500'
                }`}
                placeholder="Enter your full name"
              />
              {(profileFormErrors.full_name || profileErrors.full_name) && (
                <p className="mt-1 text-sm text-red-600">
                  {profileFormErrors.full_name?.message || profileErrors.full_name}
                </p>
              )}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                id="email"
                {...registerProfile('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: 'Please enter a valid email address',
                  },
                })}
                className={`form-input w-full ${
                  profileFormErrors.email || profileErrors.email
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500'
                }`}
                placeholder="Enter your email address"
              />
              {(profileFormErrors.email || profileErrors.email) && (
                <p className="mt-1 text-sm text-red-600">
                  {profileFormErrors.email?.message || profileErrors.email}
                </p>
              )}
            </div>

            {/* Username */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                Username <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="username"
                {...registerProfile('username', {
                  required: 'Username is required',
                  minLength: {
                    value: 3,
                    message: 'Username must be at least 3 characters',
                  },
                  maxLength: {
                    value: 50,
                    message: 'Username must not exceed 50 characters',
                  },
                  pattern: {
                    value: /^[a-zA-Z0-9_]+$/,
                    message: 'Username can only contain letters, numbers, and underscores',
                  },
                })}
                className={`form-input w-full ${
                  profileFormErrors.username || profileErrors.username
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500'
                }`}
                placeholder="Enter your username"
              />
              {(profileFormErrors.username || profileErrors.username) && (
                <p className="mt-1 text-sm text-red-600">
                  {profileFormErrors.username?.message || profileErrors.username}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Username can only contain letters, numbers, and underscores
              </p>
            </div>

            {/* Submit Button */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
              <button
                type="submit"
                disabled={isSubmittingProfile || updateProfileMutation.isLoading}
                className="btn btn-primary flex items-center justify-center"
              >
                {isSubmittingProfile || updateProfileMutation.isLoading ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  resetProfile({
                    full_name: profileData?.full_name || '',
                    email: profileData?.email || '',
                    username: profileData?.username || '',
                  });
                  setProfileErrors({});
                }}
                className="btn btn-secondary"
                disabled={isSubmittingProfile || updateProfileMutation.isLoading}
              >
                Reset
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Change Password Tab */}
      {activeTab === 'password' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Change Password</h2>
            <p className="text-sm text-gray-600 mt-1">
              Update your password to keep your account secure
            </p>
          </div>

          {passwordErrors.general && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
              <p className="text-sm text-red-800">{passwordErrors.general}</p>
            </div>
          )}

          <form onSubmit={handleSubmitPassword(onSubmitPassword)} className="space-y-6">
            {/* Current Password */}
            <div>
              <label
                htmlFor="currentPassword"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Current Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  id="currentPassword"
                  {...registerPassword('currentPassword', {
                    required: 'Current password is required',
                  })}
                  className={`form-input w-full pr-10 ${
                    passwordFormErrors.currentPassword || passwordErrors.currentPassword
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                      : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500'
                  }`}
                  placeholder="Enter your current password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showCurrentPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              {(passwordFormErrors.currentPassword || passwordErrors.currentPassword) && (
                <p className="mt-1 text-sm text-red-600">
                  {passwordFormErrors.currentPassword?.message || passwordErrors.currentPassword}
                </p>
              )}
            </div>

            {/* New Password */}
            <div>
              <label
                htmlFor="newPassword"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                New Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  id="newPassword"
                  {...registerPassword('newPassword', {
                    required: 'New password is required',
                    minLength: {
                      value: 6,
                      message: 'New password must be at least 6 characters',
                    },
                    maxLength: {
                      value: 100,
                      message: 'New password must not exceed 100 characters',
                    },
                  })}
                  className={`form-input w-full pr-10 ${
                    passwordFormErrors.newPassword || passwordErrors.newPassword
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                      : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500'
                  }`}
                  placeholder="Enter your new password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showNewPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              {(passwordFormErrors.newPassword || passwordErrors.newPassword) && (
                <p className="mt-1 text-sm text-red-600">
                  {passwordFormErrors.newPassword?.message || passwordErrors.newPassword}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Password must be at least 6 characters long
              </p>
            </div>

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Confirm New Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  {...registerPassword('confirmPassword', {
                    required: 'Please confirm your new password',
                    validate: (value) =>
                      value === watchPassword('newPassword') || 'Passwords do not match',
                  })}
                  className={`form-input w-full pr-10 ${
                    passwordFormErrors.confirmPassword || passwordErrors.confirmPassword
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                      : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500'
                  }`}
                  placeholder="Confirm your new password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              {(passwordFormErrors.confirmPassword || passwordErrors.confirmPassword) && (
                <p className="mt-1 text-sm text-red-600">
                  {passwordFormErrors.confirmPassword?.message || passwordErrors.confirmPassword}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
              <button
                type="submit"
                disabled={isSubmittingPassword || changePasswordMutation.isLoading}
                className="btn btn-primary flex items-center justify-center"
              >
                {isSubmittingPassword || changePasswordMutation.isLoading ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin mr-2" />
                    Changing Password...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    Change Password
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  resetPassword();
                  setPasswordErrors({});
                }}
                className="btn btn-secondary"
                disabled={isSubmittingPassword || changePasswordMutation.isLoading}
              >
                Reset
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Account Information Tab */}
      {activeTab === 'account' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Account Information</h2>
            <p className="text-sm text-gray-600 mt-1">
              View your account details and activity information
            </p>
          </div>

          <div className="space-y-6">
            {/* User Avatar/Profile Picture */}
            <div className="flex items-center space-x-4 pb-6 border-b border-gray-200">
              <div className="flex-shrink-0">
                {profileData?.avatar ? (
                  <img
                    src={profileData.avatar}
                    alt={profileData.full_name}
                    className="h-20 w-20 rounded-full object-cover border-2 border-gray-200"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-full bg-gray-100 flex items-center justify-center border-2 border-gray-200">
                    <UserCircle className="h-10 w-10 text-gray-400" />
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {profileData?.full_name || 'User'}
                </h3>
                <p className="text-sm text-gray-600">{profileData?.email || ''}</p>
              </div>
            </div>

            {/* Account Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Username */}
              <div className="space-y-2">
                <div className="flex items-center text-sm text-gray-600">
                  <User className="h-4 w-4 mr-2" />
                  <span className="font-medium">Username</span>
                </div>
                <p className="text-gray-900 font-medium pl-6">{profileData?.username || 'N/A'}</p>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <div className="flex items-center text-sm text-gray-600">
                  <Mail className="h-4 w-4 mr-2" />
                  <span className="font-medium">Email Address</span>
                </div>
                <p className="text-gray-900 font-medium pl-6">{profileData?.email || 'N/A'}</p>
              </div>

              {/* Role */}
              <div className="space-y-2">
                <div className="flex items-center text-sm text-gray-600">
                  <Shield className="h-4 w-4 mr-2" />
                  <span className="font-medium">Role</span>
                </div>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary-100 text-primary-800 ml-6">
                  {getRoleDisplayName(profileData?.role || 'viewer')}
                </span>
              </div>

              {/* Account Status */}
              <div className="space-y-2">
                <div className="flex items-center text-sm text-gray-600">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  <span className="font-medium">Account Status</span>
                </div>
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ml-6 ${
                    profileData?.is_active
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {profileData?.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Last Login */}
              <div className="space-y-2">
                <div className="flex items-center text-sm text-gray-600">
                  <Clock className="h-4 w-4 mr-2" />
                  <span className="font-medium">Last Login</span>
                </div>
                <p className="text-gray-900 font-medium pl-6">
                  {formatDate(profileData?.last_login)}
                </p>
              </div>

              {/* Account Created */}
              <div className="space-y-2">
                <div className="flex items-center text-sm text-gray-600">
                  <Calendar className="h-4 w-4 mr-2" />
                  <span className="font-medium">Account Created</span>
                </div>
                <p className="text-gray-900 font-medium pl-6">
                  {formatDate(profileData?.created_at)}
                </p>
              </div>
            </div>

            {/* Security Note */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start">
                <Info className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-medium text-blue-900 mb-1">Security Information</h4>
                  <p className="text-sm text-blue-800">
                    For security reasons, some account information cannot be changed here. If you
                    need to update your role or account status, please contact your administrator.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
