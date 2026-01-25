import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation } from 'react-query';
import { X, Eye, EyeOff, Key } from 'lucide-react';
import { usersAPI, clientsAPI } from '../../services/api';
import toast from 'react-hot-toast';

const UserModal = ({ isOpen, onClose, onSuccess, user }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [generatePassword, setGeneratePassword] = useState(!user); // Auto-generate for new users

  // Fetch clients for dropdown
  const { data: clientsData } = useQuery(
    ['clients', 'dropdown'],
    () => clientsAPI.getAll({ limit: 1000 }),
    { enabled: isOpen }
  );

  const clients = clientsData?.data?.data?.clients || [];

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      full_name: '',
      email: '',
      username: '',
      password: '',
      role: 'viewer',
      client_id: '',
      is_active: true,
      send_credentials_email: false,
    }
  });

  const watchedRole = watch('role');
  const watchedPassword = watch('password');

  // Fetch user details if editing
  useQuery(
    ['user', user?.id],
    () => usersAPI.getById(user.id),
    {
      enabled: !!user && isOpen,
      onSuccess: (data) => {
        const userData = data.data.data;
        reset({
          full_name: userData.full_name || '',
          email: userData.email || '',
          username: userData.username || '',
          password: '', // Don't pre-fill password
          role: userData.role || 'viewer',
          client_id: userData.client_id ? String(userData.client_id) : '',
          is_active: userData.is_active !== undefined ? userData.is_active : true,
          send_credentials_email: false,
        });
        setGeneratePassword(false);
      },
    }
  );

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      reset({
        full_name: '',
        email: '',
        username: '',
        password: '',
        role: 'viewer',
        client_id: '',
        is_active: true,
        send_credentials_email: false,
      });
      setGeneratePassword(!user);
      setShowPassword(false);
    }
  }, [isOpen, user, reset]);

  const createMutation = useMutation(
    (data) => usersAPI.create(data),
    {
      onSuccess: (response) => {
        toast.success(response.data.message || 'User created successfully');
        if (response.data.credentials) {
          toast.success(
            `Credentials: Email: ${response.data.credentials.email}, Password: ${response.data.credentials.password}`,
            { duration: 10000 }
          );
        }
        onSuccess();
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to create user');
      },
    }
  );

  const updateMutation = useMutation(
    (data) => usersAPI.update(user.id, data),
    {
      onSuccess: () => {
        toast.success('User updated successfully');
        onSuccess();
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update user');
      },
    }
  );

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      const submitData = {
        full_name: data.full_name,
        email: data.email,
        role: data.role,
        is_active: data.is_active,
      };

      // Only include username if provided
      if (data.username) {
        submitData.username = data.username;
      }

      // Only include password if provided or if generating
      if (generatePassword || data.password) {
        submitData.password = data.password || undefined;
      }

      // Only include client_id if provided and role is client
      if (data.client_id && (data.role === 'client' || data.client_id)) {
        submitData.client_id = data.client_id || null;
      } else {
        submitData.client_id = null;
      }

      // Only include send_credentials_email for new users
      if (!user && generatePassword) {
        submitData.send_credentials_email = data.send_credentials_email;
      }

      if (user) {
        await updateMutation.mutateAsync(submitData);
      } else {
        await createMutation.mutateAsync(submitData);
      }
    } catch (error) {
      // Error handled by mutation
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose}></div>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          <div className="bg-white px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">
                {user ? 'Edit User' : 'Add New User'}
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="bg-white">
            <div className="px-6 py-4 max-h-[calc(100vh-200px)] overflow-y-auto">
              <div className="space-y-4">
                {/* Full Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    {...register('full_name', { required: 'Full name is required' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-gray-900"
                    placeholder="Enter full name"
                  />
                  {errors.full_name && (
                    <p className="mt-1 text-sm text-red-600">{errors.full_name.message}</p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    {...register('email', {
                      required: 'Email is required',
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: 'Invalid email address'
                      }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-gray-900"
                    placeholder="Enter email address"
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                  )}
                </div>

                {/* Username */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Username <span className="text-gray-500 text-xs">(Optional - auto-generated if not provided)</span>
                  </label>
                  <input
                    type="text"
                    {...register('username', {
                      minLength: {
                        value: 3,
                        message: 'Username must be at least 3 characters'
                      },
                      maxLength: {
                        value: 50,
                        message: 'Username must be less than 50 characters'
                      }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-gray-900"
                    placeholder="Enter username (optional)"
                  />
                  {errors.username && (
                    <p className="mt-1 text-sm text-red-600">{errors.username.message}</p>
                  )}
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password {!user && <span className="text-gray-500 text-xs">(Optional - auto-generated if not provided)</span>}
                    {user && <span className="text-gray-500 text-xs">(Leave blank to keep current password)</span>}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      {...register('password', {
                        minLength: {
                          value: 6,
                          message: 'Password must be at least 6 characters'
                        },
                        validate: (value) => {
                          if (user && !value) return true; // Allow empty for updates
                          if (!user && !generatePassword && !value) {
                            return 'Password is required or enable auto-generation';
                          }
                          return true;
                        }
                      })}
                      disabled={generatePassword && !user}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-gray-900 disabled:opacity-50"
                      placeholder={generatePassword && !user ? "Password will be auto-generated" : "Enter password"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-500"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                  )}
                  {!user && (
                    <div className="mt-2 flex items-center">
                      <input
                        type="checkbox"
                        id="generatePassword"
                        checked={generatePassword}
                        onChange={(e) => {
                          setGeneratePassword(e.target.checked);
                          if (e.target.checked) {
                            // Clear password field when auto-generating
                          }
                        }}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <label htmlFor="generatePassword" className="ml-2 text-sm text-gray-700">
                        Auto-generate secure password
                      </label>
                    </div>
                  )}
                </div>

                {/* Role */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role <span className="text-red-500">*</span>
                  </label>
                  <select
                    {...register('role', { required: 'Role is required' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-gray-900 form-select"
                  >
                    <option value="admin">Administrator</option>
                    <option value="po">Project Owner</option>
                    <option value="manager">Manager</option>
                    <option value="accountant">Accountant</option>
                    <option value="client">Client</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  {errors.role && (
                    <p className="mt-1 text-sm text-red-600">{errors.role.message}</p>
                  )}
                </div>

                {/* Client (only show if role is client or if editing) */}
                {(watchedRole === 'client' || user?.role === 'client' || user?.client_id) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Client <span className="text-gray-500 text-xs">(Optional)</span>
                    </label>
                    <select
                      {...register('client_id')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-gray-900 form-select"
                    >
                      <option value="">Select a client (optional)</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.full_name} {client.company_name ? `(${client.company_name})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Active Status */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_active"
                    {...register('is_active')}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
                    User is active
                  </label>
                </div>

                {/* Send Credentials Email (only for new users with auto-generated password) */}
                {!user && generatePassword && (
                  <div className="flex items-center p-3 bg-blue-50bg-blue-900/20 rounded-lg border border-blue-200border-blue-800">
                    <input
                      type="checkbox"
                      id="send_credentials_email"
                      {...register('send_credentials_email')}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label htmlFor="send_credentials_email" className="ml-2 text-sm text-gray-700">
                      Send credentials via email to user
                    </label>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-50bg-gray-900 px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || createMutation.isLoading || updateMutation.isLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isSubmitting || createMutation.isLoading || updateMutation.isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    {user ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  user ? 'Update User' : 'Create User'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UserModal;
