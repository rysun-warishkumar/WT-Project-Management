import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from 'react-query';
import { X, Shield } from 'lucide-react';
import { rolesAPI } from '../../services/api';
import toast from 'react-hot-toast';

const RoleModal = ({ isOpen, onClose, onSuccess, role, permissions = [] }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState(new Set());

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: '',
      display_name: '',
      description: '',
    }
  });

  // Initialize form and permissions when editing
  useEffect(() => {
    if (role && isOpen) {
      reset({
        name: role.name || '',
        display_name: role.display_name || '',
        description: role.description || '',
      });
      if (role.permissions) {
        setSelectedPermissions(new Set(role.permissions.map(p => p.id)));
      }
    } else if (!role && isOpen) {
      reset({
        name: '',
        display_name: '',
        description: '',
      });
      setSelectedPermissions(new Set());
    }
  }, [role, isOpen, reset]);

  const createMutation = useMutation(
    (data) => rolesAPI.create(data),
    {
      onSuccess: () => {
        toast.success('Role created successfully');
        onSuccess();
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to create role');
      },
    }
  );

  const updateMutation = useMutation(
    (data) => rolesAPI.update(role.id, data),
    {
      onSuccess: () => {
        toast.success('Role updated successfully');
        onSuccess();
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update role');
      },
    }
  );

  const handlePermissionToggle = (permissionId) => {
    const newSelected = new Set(selectedPermissions);
    if (newSelected.has(permissionId)) {
      newSelected.delete(permissionId);
    } else {
      newSelected.add(permissionId);
    }
    setSelectedPermissions(newSelected);
  };

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      const submitData = {
        ...data,
        permission_ids: Array.from(selectedPermissions),
      };

      if (role) {
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

  // Group permissions by module
  const groupedPermissions = permissions.reduce((acc, perm) => {
    if (!acc[perm.module]) {
      acc[perm.module] = [];
    }
    acc[perm.module].push(perm);
    return acc;
  }, {});

  const modules = Object.keys(groupedPermissions);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose}></div>

        <div className="inline-block align-bottom bg-gray-50 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary-600" />
                {role ? 'Edit Role' : 'Create New Role'}
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="bg-gray-50">
            <div className="px-6 py-4 max-h-[calc(100vh-200px)] overflow-y-auto">
              <div className="space-y-4">
                {/* Role Name (only for new roles) */}
                {!role && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Role Name <span className="text-red-500">*</span>
                      <span className="text-gray-500 text-xs ml-2">(lowercase, no spaces, e.g., "project_manager")</span>
                    </label>
                    <input
                      type="text"
                      {...register('name', {
                        required: 'Role name is required',
                        pattern: {
                          value: /^[a-z0-9_]+$/,
                          message: 'Role name must be lowercase with underscores only'
                        },
                        minLength: {
                          value: 2,
                          message: 'Role name must be at least 2 characters'
                        },
                        maxLength: {
                          value: 50,
                          message: 'Role name must be less than 50 characters'
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-gray-900"
                      placeholder="e.g., project_manager"
                    />
                    {errors.name && (
                      <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                    )}
                  </div>
                )}

                {/* Display Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Display Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    {...register('display_name', {
                      required: 'Display name is required',
                      maxLength: {
                        value: 100,
                        message: 'Display name must be less than 100 characters'
                      }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-gray-900"
                    placeholder="e.g., Project Manager"
                  />
                  {errors.display_name && (
                    <p className="mt-1 text-sm text-red-600">{errors.display_name.message}</p>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    {...register('description')}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-gray-900 form-textarea"
                    placeholder="Enter role description"
                  />
                </div>

                {/* Permissions (only for new roles) */}
                {!role && permissions.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Permissions <span className="text-gray-500 text-xs">(Optional - can be set later)</span>
                    </label>
                    <div className="border border-gray-200border-gray-700 rounded-lg max-h-64 overflow-y-auto">
                      {modules.map((module) => (
                        <div key={module} className="border-b border-gray-200border-gray-700 last:border-b-0">
                          <div className="p-2 bg-gray-100">
                            <span className="text-sm font-medium text-gray-900 capitalize">
                              {module}
                            </span>
                          </div>
                          <div className="p-2 space-y-1">
                            {groupedPermissions[module].map((permission) => (
                              <label
                                key={permission.id}
                                className="flex items-center gap-2 p-1.5 hover:bg-gray-100 rounded cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedPermissions.has(permission.id)}
                                  onChange={() => handlePermissionToggle(permission.id)}
                                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                                />
                                <span className="text-sm text-gray-900 capitalize">
                                  {permission.action}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-100 px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
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
                    {role ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  role ? 'Update Role' : 'Create Role'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RoleModal;
