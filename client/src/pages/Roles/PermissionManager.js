import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from 'react-query';
import { Save, CheckSquare, Square, Shield, X } from 'lucide-react';
import { rolesAPI } from '../../services/api';
import toast from 'react-hot-toast';

const PermissionManager = ({ role, permissions, groupedPermissions, modules, isLoading, onSuccess }) => {
  const queryClient = useQueryClient();
  const [selectedPermissions, setSelectedPermissions] = useState(new Set());
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize selected permissions from role
  useEffect(() => {
    if (role?.permissions) {
      const rolePermissionIds = new Set(role.permissions.map(p => p.id));
      setSelectedPermissions(rolePermissionIds);
      setHasChanges(false);
    }
  }, [role]);

  const updateMutation = useMutation(
    (permissionIds) => rolesAPI.updatePermissions(role.id, permissionIds),
    {
      onSuccess: () => {
        toast.success('Permissions updated successfully');
        setHasChanges(false);
        onSuccess();
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update permissions');
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
    setHasChanges(true);
  };

  const handleModuleToggle = (modulePermissions) => {
    const modulePermissionIds = modulePermissions.map(p => p.id);
    const allSelected = modulePermissionIds.every(id => selectedPermissions.has(id));
    
    const newSelected = new Set(selectedPermissions);
    if (allSelected) {
      // Deselect all
      modulePermissionIds.forEach(id => newSelected.delete(id));
    } else {
      // Select all
      modulePermissionIds.forEach(id => newSelected.add(id));
    }
    setSelectedPermissions(newSelected);
    setHasChanges(true);
  };

  const handleSave = () => {
    const permissionIds = Array.from(selectedPermissions);
    updateMutation.mutate(permissionIds);
  };

  const handleReset = () => {
    if (role?.permissions) {
      const rolePermissionIds = new Set(role.permissions.map(p => p.id));
      setSelectedPermissions(rolePermissionIds);
      setHasChanges(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading permissions...</p>
      </div>
    );
  }

  const isSuperAdmin = role?.name === 'admin';

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary-600" />
              {role?.display_name} Permissions
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {role?.description || 'Manage permissions for this role'}
            </p>
          </div>
          {hasChanges && !isSuperAdmin && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800hover:text-gray-200"
              >
                Reset
              </button>
              <button
                onClick={handleSave}
                disabled={updateMutation.isLoading}
                className="px-4 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {updateMutation.isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Permissions List */}
      <div className="p-4 max-h-[calc(100vh-300px)] overflow-y-auto">
        {isSuperAdmin && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              ⚠️ This is the Super Admin role. Permissions cannot be modified. This role is protected for security reasons.
            </p>
          </div>
        )}

        {modules.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No permissions available</p>
          </div>
        ) : (
          <div className="space-y-6">
            {modules.map((module) => {
              const modulePermissions = groupedPermissions[module] || [];
              const modulePermissionIds = modulePermissions.map(p => p.id);
              const allSelected = modulePermissionIds.length > 0 && modulePermissionIds.every(id => selectedPermissions.has(id));
              const someSelected = modulePermissionIds.some(id => selectedPermissions.has(id));

              return (
                <div key={module} className="border border-gray-200 rounded-lg">
                  {/* Module Header */}
                  <div className="p-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => !isSuperAdmin && handleModuleToggle(modulePermissions)}
                        disabled={isSuperAdmin || modulePermissions.length === 0}
                        className="flex items-center gap-2 text-sm font-medium text-gray-900 hover:text-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {allSelected ? (
                          <CheckSquare className="w-5 h-5 text-primary-600" />
                        ) : someSelected ? (
                          <div className="w-5 h-5 border-2 border-primary-600 rounded flex items-center justify-center">
                            <div className="w-2 h-2 bg-primary-600 rounded"></div>
                          </div>
                        ) : (
                          <Square className="w-5 h-5 text-gray-400" />
                        )}
                        <span className="capitalize">{module}</span>
                      </button>
                      <span className="text-xs text-gray-500">
                        ({modulePermissions.filter(p => selectedPermissions.has(p.id)).length}/{modulePermissions.length})
                      </span>
                    </div>
                  </div>

                  {/* Module Permissions */}
                  <div className="p-3 space-y-2">
                    {modulePermissions.map((permission) => {
                      const isSelected = selectedPermissions.has(permission.id);
                      return (
                        <label
                          key={permission.id}
                          className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-primary-50'
                              : 'hover:bg-gray-50'
                          } ${isSuperAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => !isSuperAdmin && handlePermissionToggle(permission.id)}
                            disabled={isSuperAdmin}
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded disabled:opacity-50"
                          />
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900 capitalize">
                              {permission.action}
                            </div>
                            {permission.description && (
                              <div className="text-xs text-gray-500">
                                {permission.description}
                              </div>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default PermissionManager;
