import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  Trash2,
  Lock,
  RefreshCw,
  X,
  Key,
  Globe,
  Server,
  Database,
  Cloud,
} from 'lucide-react';
import { credentialsAPI, clientsAPI, projectsAPI } from '../../services/api';
import toast from 'react-hot-toast';
import CredentialModal from './CredentialModal';
import DeleteConfirmModal from '../../components/Common/DeleteConfirmModal';

const Credentials = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCredential, setEditingCredential] = useState(null);
  const [deleteCredential, setDeleteCredential] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch credentials data
  const {
    data: credentialsData,
    isLoading,
    error,
  } = useQuery(
    ['credentials', currentPage, searchTerm, typeFilter, clientFilter, projectFilter, refreshKey],
    () => {
      const params = {
        page: currentPage,
        limit: 10,
      };
      if (searchTerm) params.search = searchTerm;
      if (typeFilter) params.credential_type = typeFilter;
      if (clientFilter) params.client_id = clientFilter;
      if (projectFilter) params.project_id = projectFilter;
      return credentialsAPI.getAll(params);
    },
    {
      keepPreviousData: true,
      staleTime: 0,
      cacheTime: 0,
      refetchOnMount: true,
      refetchOnWindowFocus: false,
    }
  );

  // Fetch clients and projects for filters
  const { data: clientsData } = useQuery(
    ['clients', 'dropdown'],
    () => clientsAPI.getAll({ limit: 1000 }),
    { enabled: showFilters }
  );

  const { data: projectsData } = useQuery(
    ['projects', 'dropdown'],
    () => projectsAPI.getAll({ limit: 1000 }),
    { enabled: showFilters }
  );

  const clients = clientsData?.data?.data?.clients || [];
  const projects = projectsData?.data?.data?.projects || [];

  // Delete credential mutation
  const deleteMutation = useMutation(
    (id) => credentialsAPI.delete(id),
    {
      onSuccess: () => {
        toast.success('Credential deleted successfully');
        queryClient.invalidateQueries('credentials');
        setDeleteCredential(null);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to delete credential');
      },
    }
  );

  const credentials = credentialsData?.data?.data?.credentials || [];
  const pagination = credentialsData?.data?.data?.pagination || {};

  const getCredentialIcon = (type) => {
    switch (type) {
      case 'admin_panel':
        return <Key className="h-5 w-5 text-blue-500" />;
      case 'hosting':
        return <Server className="h-5 w-5 text-green-500" />;
      case 'domain':
        return <Globe className="h-5 w-5 text-purple-500" />;
      case 'ftp':
        return <Cloud className="h-5 w-5 text-orange-500" />;
      case 'database':
        return <Database className="h-5 w-5 text-red-500" />;
      case 'api':
        return <Key className="h-5 w-5 text-indigo-500" />;
      default:
        return <Lock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getCredentialTypeLabel = (type) => {
    const labels = {
      admin_panel: 'Admin Panel',
      hosting: 'Hosting',
      domain: 'Domain',
      ftp: 'FTP',
      database: 'Database',
      api: 'API',
      other: 'Other',
    };
    return labels[type] || type;
  };

  const handleEdit = (credential) => {
    setEditingCredential(credential);
    setIsModalOpen(true);
  };

  const handleDelete = (credential) => {
    setDeleteCredential(credential);
  };

  const handleView = (credential) => {
    navigate(`/credentials/${credential.id}`);
  };

  const confirmDelete = () => {
    if (deleteCredential) {
      deleteMutation.mutate(deleteCredential.id);
    }
  };

  const handleSuccess = () => {
    setIsModalOpen(false);
    setEditingCredential(null);
    queryClient.invalidateQueries('credentials');
  };

  const clearFilters = () => {
    setTypeFilter('');
    setClientFilter('');
    setProjectFilter('');
    setSearchTerm('');
    setCurrentPage(1);
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div className="card">
          <div className="card-body text-center py-8">
            <p className="text-red-500">Error loading credentials. Please try again.</p>
            <button
              onClick={() => setRefreshKey(prev => prev + 1)}
              className="btn btn-outline mt-4"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Credentials</h1>
          <p className="text-gray-600">Manage access credentials securely</p>
        </div>
        <button
          onClick={() => {
            setEditingCredential(null);
            setIsModalOpen(true);
          }}
          className="btn btn-primary"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Credential
        </button>
      </div>

      {/* Search and Filters */}
      <div className="card">
        <div className="card-body">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="text"
                  placeholder="Search credentials..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="form-input pl-10 w-full"
                />
              </div>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`btn ${showFilters ? 'btn-primary' : 'btn-outline'}`}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </button>
            {(typeFilter || clientFilter || projectFilter) && (
              <button
                onClick={clearFilters}
                className="btn btn-outline"
              >
                <X className="h-4 w-4 mr-2" />
                Clear
              </button>
            )}
          </div>

          {showFilters && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
              <div>
                <label className="form-label">Type</label>
                <select
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="form-select"
                >
                  <option value="">All Types</option>
                  <option value="admin_panel">Admin Panel</option>
                  <option value="hosting">Hosting</option>
                  <option value="domain">Domain</option>
                  <option value="ftp">FTP</option>
                  <option value="database">Database</option>
                  <option value="api">API</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="form-label">Client</label>
                <select
                  value={clientFilter}
                  onChange={(e) => {
                    setClientFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="form-select"
                >
                  <option value="">All Clients</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.full_name} {client.company_name && `(${client.company_name})`}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Project</label>
                <select
                  value={projectFilter}
                  onChange={(e) => {
                    setProjectFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="form-select"
                >
                  <option value="">All Projects</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Credentials List */}
      <div className="card">
        <div className="card-body">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
              <p className="text-gray-500 mt-4">Loading credentials...</p>
            </div>
          ) : credentials.length === 0 ? (
            <div className="text-center py-8">
              <Lock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No credentials found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Credential
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        URL/Info
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Client/Project
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {credentials.map((credential) => (
                      <tr key={credential.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {getCredentialIcon(credential.credential_type)}
                            <div className="ml-3">
                              <div className="text-sm font-medium text-gray-900">
                                {credential.title}
                              </div>
                              {credential.username && (
                                <div className="text-sm text-gray-500">
                                  User: {credential.username}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                            {getCredentialTypeLabel(credential.credential_type)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">
                            {credential.url && (
                              <a
                                href={credential.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 truncate max-w-xs block"
                              >
                                {credential.url}
                              </a>
                            )}
                            {credential.ip_address && (
                              <div className="text-xs text-gray-500">IP: {credential.ip_address}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div>
                            {credential.client_name && (
                              <div>{credential.client_name}</div>
                            )}
                            {credential.project_title && (
                              <div className="text-xs text-gray-400">{credential.project_title}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(credential.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleView(credential)}
                              className="text-blue-600 hover:text-blue-900"
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleEdit(credential)}
                              className="text-indigo-600 hover:text-indigo-900"
                              title="Edit"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(credential)}
                              className="text-red-600 hover:text-red-900"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
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
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                    {pagination.total} credentials
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={!pagination.hasPrev}
                      className="btn btn-outline btn-sm"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
                      disabled={!pagination.hasNext}
                      className="btn btn-outline btn-sm"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      <CredentialModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingCredential(null);
        }}
        onSuccess={handleSuccess}
        credential={editingCredential}
      />

      <DeleteConfirmModal
        isOpen={!!deleteCredential}
        onClose={() => setDeleteCredential(null)}
        onConfirm={confirmDelete}
        title="Delete Credential"
        message={`Are you sure you want to delete "${deleteCredential?.title}"? This action cannot be undone.`}
      />
    </div>
  );
};

export default Credentials;
