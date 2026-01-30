import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  Trash2,
  User,
  Mail,
  Phone,
  Building,
  CheckCircle,
  XCircle,
  RefreshCw,
  X,
  Shield,
} from 'lucide-react';
import { usersAPI, clientsAPI } from '../../services/api';
import toast from 'react-hot-toast';
import UserModal from './UserModal';
import DeleteConfirmModal from '../../components/Common/DeleteConfirmModal';
import { useAuth } from '../../contexts/AuthContext';

const Users = () => {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.is_super_admin === true || currentUser?.isSuperAdmin === true;
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deleteUser, setDeleteUser] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch users data
  const {
    data: usersData,
    isLoading,
    error,
  } = useQuery(
    ['users', currentPage, searchTerm, roleFilter, clientFilter, statusFilter, refreshKey],
    () => {
      const params = {
        page: currentPage,
        limit: 10,
      };
      if (searchTerm) params.search = searchTerm;
      if (roleFilter) params.role = roleFilter;
      if (clientFilter) params.client_id = clientFilter;
      if (statusFilter !== '') params.is_active = statusFilter === 'active';
      return usersAPI.getAll(params);
    },
    {
      keepPreviousData: true,
      staleTime: 0,
      cacheTime: 0,
      refetchOnMount: true,
      refetchOnWindowFocus: false,
    }
  );

  // Fetch clients for filters
  const { data: clientsData } = useQuery(
    ['clients', 'dropdown'],
    () => clientsAPI.getAll({ limit: 1000 }),
    { enabled: showFilters }
  );

  const clients = clientsData?.data?.data?.clients || [];

  // Delete user mutation
  const deleteMutation = useMutation(
    (id) => usersAPI.delete(id),
    {
      onSuccess: () => {
        toast.success('User deleted successfully');
        queryClient.invalidateQueries('users');
        setDeleteUser(null);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to delete user');
      },
    }
  );

  const users = usersData?.data?.data?.users || [];
  const pagination = usersData?.data?.data?.pagination || {};

  const getRoleBadgeColor = (role) => {
    const colors = {
      admin: 'bg-red-100 text-red-800',
      po: 'bg-blue-100 text-blue-800',
      manager: 'bg-purple-100 text-purple-800',
      accountant: 'bg-green-100 text-green-800',
      client: 'bg-yellow-100 text-yellow-800',
      viewer: 'bg-gray-100 text-gray-800',
    };
    return colors[role] || colors.viewer;
  };

  const getRoleDisplayName = (role) => {
    const names = {
      admin: 'Administrator',
      po: 'Project Owner',
      manager: 'Manager',
      accountant: 'Accountant',
      client: 'Client',
      viewer: 'Viewer',
    };
    return names[role] || role;
  };

  const handleAdd = () => {
    setEditingUser(null);
    setIsModalOpen(true);
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const handleDelete = (user) => {
    setDeleteUser(user);
  };

  const confirmDelete = () => {
    if (deleteUser) {
      deleteMutation.mutate(deleteUser.id);
    }
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    toast.success('Users list refreshed');
  };

  const clearFilters = () => {
    setSearchTerm('');
    setRoleFilter('');
    setClientFilter('');
    setStatusFilter('');
    setCurrentPage(1);
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error loading users: {error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Users</h1>
          <p className="text-gray-600 mt-1">Manage system users and their access</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden md:inline">Refresh</span>
          </button>
          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name, email, or username..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-gray-900"
            />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            <span>Filters</span>
            {(roleFilter || clientFilter || statusFilter !== '') && (
              <span className="bg-primary-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                {(roleFilter ? 1 : 0) + (clientFilter ? 1 : 0) + (statusFilter !== '' ? 1 : 0)}
              </span>
            )}
          </button>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role
              </label>
              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-gray-900 form-select"
              >
                <option value="">All Roles</option>
                <option value="admin">Administrator</option>
                <option value="po">Project Owner</option>
                <option value="manager">Manager</option>
                <option value="accountant">Accountant</option>
                <option value="client">Client</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Client
              </label>
              <select
                value={clientFilter}
                onChange={(e) => {
                  setClientFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-gray-900 form-select"
              >
                <option value="">All Clients</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.full_name} {client.company_name ? `(${client.company_name})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-gray-900 form-select"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {(roleFilter || clientFilter || statusFilter !== '') && (
              <div className="md:col-span-3 flex justify-end">
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading users...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center">
            <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No users found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    {isSuperAdmin && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Workspace
                      </th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Client
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Projects
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Login
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                            <User className="w-5 h-5 text-primary-600" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {user.full_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {user.email}
                            </div>
                            <div className="text-xs text-gray-400">
                              @{user.username}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                          <Shield className="w-3 h-3 mr-1" />
                          {getRoleDisplayName(user.role)}
                        </span>
                      </td>
                      {isSuperAdmin && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {user.workspace_name || '—'}
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {user.client_name ? (
                          <div>
                            <div className="text-sm text-gray-900">{user.client_name}</div>
                            {user.client_company && (
                              <div className="text-xs text-gray-500">{user.client_company}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">
                          {user.project_count || 0}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {user.is_active ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <XCircle className="w-3 h-3 mr-1" />
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.last_login
                          ? new Date(user.last_login).toLocaleDateString()
                          : 'Never'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(user)}
                            className="text-primary-600 hover:text-primary-900"
                            title="Edit user"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(user)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete user"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing <span className="font-medium">{(pagination.page - 1) * pagination.limit + 1}</span> to{' '}
                  <span className="font-medium">
                    {Math.min(pagination.page * pagination.limit, pagination.total)}
                  </span>{' '}
                  of <span className="font-medium">{pagination.total}</span> users
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={!pagination.hasPrev}
                    className="px-4 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 text-gray-700"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                    disabled={!pagination.hasNext}
                    className="px-4 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 text-gray-700"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      <UserModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingUser(null);
        }}
        onSuccess={() => {
          setIsModalOpen(false);
          setEditingUser(null);
          queryClient.invalidateQueries('users');
        }}
        user={editingUser}
      />

      <DeleteConfirmModal
        isOpen={!!deleteUser}
        onClose={() => setDeleteUser(null)}
        onConfirm={confirmDelete}
        title="Delete User"
        message={`Are you sure you want to delete user "${deleteUser?.full_name}"? This action cannot be undone.`}
        isLoading={deleteMutation.isLoading}
      />
    </div>
  );
};

export default Users;
