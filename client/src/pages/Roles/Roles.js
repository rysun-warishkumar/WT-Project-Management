import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  Plus,
  Shield,
  Edit,
  Trash2,
  Save,
  X,
  CheckSquare,
  Square,
  Users,
  Key,
  RefreshCw,
} from 'lucide-react';
import { rolesAPI } from '../../services/api';
import toast from 'react-hot-toast';
import DeleteConfirmModal from '../../components/Common/DeleteConfirmModal';
import RoleModal from './RoleModal';
import PermissionManager from './PermissionManager';

const Roles = () => {
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState(null);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [deleteRole, setDeleteRole] = useState(null);
  const [showPermissions, setShowPermissions] = useState(false);

  // Fetch roles
  const {
    data: rolesData,
    isLoading: rolesLoading,
    error: rolesError,
  } = useQuery(
    ['roles'],
    () => rolesAPI.getAll(),
    {
      refetchOnMount: true,
      refetchOnWindowFocus: false,
    }
  );

  // Fetch permissions
  const {
    data: permissionsData,
    isLoading: permissionsLoading,
  } = useQuery(
    ['permissions'],
    () => rolesAPI.getPermissions(),
    {
      enabled: showPermissions || !!selectedRole,
    }
  );

  // Fetch selected role details with permissions
  const {
    data: roleDetailsData,
    isLoading: roleDetailsLoading,
  } = useQuery(
    ['role', selectedRole?.id],
    () => rolesAPI.getById(selectedRole.id),
    {
      enabled: !!selectedRole,
    }
  );

  const roles = rolesData?.data?.data || [];
  const permissions = permissionsData?.data?.data?.permissions || [];
  const groupedPermissions = permissionsData?.data?.data?.grouped || {};
  const roleDetails = roleDetailsData?.data?.data;

  // Delete role mutation
  const deleteMutation = useMutation(
    (id) => rolesAPI.delete(id),
    {
      onSuccess: () => {
        toast.success('Role deleted successfully');
        queryClient.invalidateQueries('roles');
        if (selectedRole?.id === deleteRole?.id) {
          setSelectedRole(null);
          setShowPermissions(false);
        }
        setDeleteRole(null);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to delete role');
      },
    }
  );

  const handleAddRole = () => {
    setEditingRole(null);
    setIsRoleModalOpen(true);
  };

  const handleEditRole = (role) => {
    setEditingRole(role);
    setIsRoleModalOpen(true);
  };

  const handleDeleteRole = (role) => {
    setDeleteRole(role);
  };

  const handleSelectRole = (role) => {
    setSelectedRole(role);
    setShowPermissions(true);
  };

  const confirmDelete = () => {
    if (deleteRole) {
      deleteMutation.mutate(deleteRole.id);
    }
  };

  const modules = Object.keys(groupedPermissions);

  if (rolesError) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error loading roles: {rolesError.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Roles & Permissions</h1>
          <p className="text-gray-600 mt-1">Manage user roles and their access permissions</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => queryClient.invalidateQueries('roles')}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden md:inline">Refresh</span>
          </button>
          <button
            onClick={handleAddRole}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            <span>Add Role</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Roles List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Roles</h2>
            </div>
            {rolesLoading ? (
              <div className="p-12 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              </div>
            ) : roles.length === 0 ? (
              <div className="p-12 text-center">
                <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No roles found</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200divide-gray-700">
                {roles.map((role) => (
                  <div
                    key={role.id}
                    className={`p-4 cursor-pointer transition-colors ${
                      selectedRole?.id === role.id
                        ? 'bg-primary-50 border-l-4 border-primary-600'
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => handleSelectRole(role)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Shield className="w-5 h-5 text-primary-600" />
                          <h3 className="font-medium text-gray-900">
                            {role.display_name}
                          </h3>
                          {role.name === 'admin' && (
                            <span className="text-xs px-2 py-0.5 bg-red-100 text-red-800 rounded">
                              Super Admin
                            </span>
                          )}
                          {role.is_system_role && role.name !== 'admin' && (
                            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                              System
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {role.description || 'No description'}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {role.user_count || 0} users
                          </span>
                          <span className="flex items-center gap-1">
                            <Key className="w-3 h-3" />
                            {role.permission_count || 0} permissions
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        {role.name !== 'admin' && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditRole(role);
                              }}
                              className="p-1 text-gray-400 hover:text-primary-600"
                              title="Edit role"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            {!role.is_system_role && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteRole(role);
                                }}
                                className="p-1 text-gray-400 hover:text-red-600"
                                title="Delete role"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Permissions Manager */}
        <div className="lg:col-span-2">
          {selectedRole ? (
            <PermissionManager
              role={roleDetails || selectedRole}
              permissions={permissions}
              groupedPermissions={groupedPermissions}
              modules={modules}
              isLoading={roleDetailsLoading || permissionsLoading}
              onSuccess={() => {
                queryClient.invalidateQueries(['role', selectedRole.id]);
                queryClient.invalidateQueries('roles');
              }}
            />
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Select a Role
              </h3>
              <p className="text-gray-600">
                Choose a role from the list to view and manage its permissions
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <RoleModal
        isOpen={isRoleModalOpen}
        onClose={() => {
          setIsRoleModalOpen(false);
          setEditingRole(null);
        }}
        onSuccess={() => {
          setIsRoleModalOpen(false);
          setEditingRole(null);
          queryClient.invalidateQueries('roles');
        }}
        role={editingRole}
        permissions={permissions}
      />

      <DeleteConfirmModal
        isOpen={!!deleteRole}
        onClose={() => setDeleteRole(null)}
        onConfirm={confirmDelete}
        title="Delete Role"
        message={`Are you sure you want to delete the role "${deleteRole?.display_name}"? This action cannot be undone.`}
        isLoading={deleteMutation.isLoading}
      />
    </div>
  );
};

export default Roles;
