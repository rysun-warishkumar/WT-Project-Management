import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Calendar,
  FolderOpen,
  RefreshCw,
  ExternalLink,
  Kanban,
  Building2,
  ArrowLeft,
} from 'lucide-react';
import { projectsAPI, pmAPI } from '../../services/api';
import toast from 'react-hot-toast';
import ProjectModal from './ProjectModal';
import DeleteConfirmModal from '../../components/Common/DeleteConfirmModal';
import ProjectChatModal from './ProjectChatModal';
import ProjectChatButton from './ProjectChatButton';
import { useAuth } from '../../contexts/AuthContext';

const Projects = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSuperAdmin = Boolean(user?.is_super_admin || user?.isSuperAdmin);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [deleteProject, setDeleteProject] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [chatProject, setChatProject] = useState(null);
  const [viewMode, setViewMode] = useState('my_projects');

  const {
    data: projectsData,
    isLoading,
    error,
  } = useQuery(
    ['projects', currentPage, searchTerm, statusFilter, typeFilter, clientFilter, refreshKey, viewMode],
    () =>
      projectsAPI.getAll({
        page: currentPage,
        limit: 10,
        search: searchTerm,
        status: statusFilter,
        type: typeFilter,
        client_id: clientFilter,
        ...(viewMode === 'other_workspaces' && isSuperAdmin ? { view: 'all_workspaces' } : {}),
      }),
    {
      keepPreviousData: true,
      staleTime: 0,
      cacheTime: 0,
      refetchOnMount: true,
      refetchOnWindowFocus: false,
    }
  );

  // Delete project mutation
  const deleteMutation = useMutation(
    (projectId) => projectsAPI.delete(projectId),
    {
      onSuccess: () => {
        toast.success('Project deleted successfully');
        setRefreshKey(prev => prev + 1);
        setDeleteProject(null);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to delete project');
      },
    }
  );

  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1);
  };

  const handleFilterChange = () => {
    setCurrentPage(1);
  };

  const handleEdit = (project) => {
    setEditingProject(project);
    setIsModalOpen(true);
  };

  const handleDelete = (project) => {
    setDeleteProject(project);
  };

  const confirmDelete = () => {
    if (deleteProject) {
      deleteMutation.mutate(deleteProject.id);
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingProject(null);
  };

  const handleModalSuccess = () => {
    setRefreshKey(prev => prev + 1);
    handleModalClose();
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'in_progress':
        return 'warning';
      case 'review':
        return 'info';
      case 'planning':
        return 'info';
      case 'on_hold':
        return 'secondary';
      case 'cancelled':
        return 'danger';
      default:
        return 'info';
    }
  };

  const getStatusText = (status) => {
    return status ? status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ') : 'Unknown';
  };

  const getTypeText = (type) => {
    return type ? type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ') : 'Unknown';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Failed to load projects</p>
      </div>
    );
  }

  const projects = projectsData?.data?.data?.projects || [];
  const pagination = projectsData?.data?.data?.pagination || {};
  const isOtherWorkspacesView = viewMode === 'other_workspaces' && isSuperAdmin;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm sm:text-base text-gray-600">
            Manage your projects and track their progress
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:space-x-3">
          {isSuperAdmin &&
            (isOtherWorkspacesView ? (
              <button
                onClick={() => {
                  setViewMode('my_projects');
                  setCurrentPage(1);
                }}
                className="btn btn-outline flex-1 sm:flex-none justify-center"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                My projects
              </button>
            ) : (
              <button
                onClick={() => {
                  setViewMode('other_workspaces');
                  setCurrentPage(1);
                }}
                className="btn btn-outline flex-1 sm:flex-none justify-center"
              >
                <Building2 className="h-4 w-4 mr-2" />
                Projects of another workspace
              </button>
            ))}
          <button
            onClick={handleRefresh}
            className="btn btn-outline flex-1 sm:flex-none justify-center"
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {!isOtherWorkspacesView && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="btn btn-primary flex-1 sm:flex-none justify-center"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Project
            </button>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card">
        <div className="card-body">
          <form onSubmit={handleSearch} className="space-y-4">
            {/* Search Bar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search projects by title, description, or client..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="form-input pl-10 w-full"
                />
              </div>
              <button type="submit" className="btn btn-primary w-full sm:w-auto justify-center">
                Search
              </button>
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className="btn btn-secondary w-full sm:w-auto justify-center"
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </button>
            </div>

            {/* Filters */}
            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t">
                <div>
                  <label className="form-label">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      handleFilterChange();
                    }}
                    className="form-select"
                  >
                    <option value="">All Status</option>
                    <option value="planning">Planning</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="on_hold">On Hold</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Type</label>
                  <select
                    value={typeFilter}
                    onChange={(e) => {
                      setTypeFilter(e.target.value);
                      handleFilterChange();
                    }}
                    className="form-select"
                  >
                    <option value="">All Types</option>
                    <option value="website">Website</option>
                    <option value="ecommerce">E-commerce</option>
                    <option value="mobile_app">Mobile App</option>
                    <option value="web_app">Web App</option>
                    <option value="design">Design</option>
                    <option value="consulting">Consulting</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Client</label>
                  <input
                    type="text"
                    placeholder="Client name or company"
                    value={clientFilter}
                    onChange={(e) => {
                      setClientFilter(e.target.value);
                      handleFilterChange();
                    }}
                    className="form-input"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter('');
                      setTypeFilter('');
                      setClientFilter('');
                      handleFilterChange();
                    }}
                    className="btn btn-outline"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Projects List */}
      <div className="card">
        <div className="card-body">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="spinner h-8 w-8"></div>
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No projects found</h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || statusFilter || typeFilter || clientFilter
                  ? 'Try adjusting your search or filters'
                  : 'Get started by adding your first project'}
              </p>
              {!searchTerm && !statusFilter && !typeFilter && !clientFilter && (
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="btn btn-primary"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Project
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Project
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Client
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Timeline
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {projects.map((project) => (
                    <tr key={project.id} className="hover:bg-gray-50">
                      {isOtherWorkspacesView && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {project.workspace_name || '—'}
                        </td>
                      )}
                      <td
                        className="px-6 py-4 whitespace-nowrap cursor-pointer"
                        onClick={() => navigate(`/projects/${project.id}`)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            navigate(`/projects/${project.id}`);
                          }
                        }}
                      >
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                              <FolderOpen className="h-5 w-5 text-primary-600" />
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {project.title}
                            </div>
                            {project.description && (
                              <div className="text-sm text-gray-500 truncate max-w-xs">
                                {project.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          <div className="font-medium">{project.client_name}</div>
                          {project.client_company && (
                            <div className="text-sm text-gray-500">
                              {project.client_company}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">
                          {getTypeText(project.type)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`badge badge-${getStatusColor(project.status)}`}>
                          {getStatusText(project.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 text-gray-400 mr-1" />
                            {formatDate(project.start_date)}
                          </div>
                          {project.end_date && (
                            <div className="text-xs text-gray-500">
                              to {formatDate(project.end_date)}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <ProjectChatButton project={project} />
                          <button
                            onClick={async () => {
                              const projectId = project?.id != null ? Number(project.id) : NaN;
                              if (!Number.isInteger(projectId) || projectId <= 0) {
                                toast.error('Project management is not available for this project.');
                                return;
                              }
                              try {
                                const response = await pmAPI.getWorkspaceByProject(project.id);
                                if (response.data.success) {
                                  const workspace = response.data.data;
                                  if (workspace?.id != null && Number(workspace.id) !== 0) {
                                    window.open(`/project-management/${workspace.id}`, '_blank');
                                  } else {
                                    toast.error('Project workspace not found.');
                                  }
                                }
                              } catch (error) {
                                toast.error(error?.response?.data?.message || 'Failed to open project management workspace');
                                console.error('Error opening PM workspace:', error);
                              }
                            }}
                            className="text-primary-600 hover:text-primary-900"
                            title="Manage Project"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(project)}
                            className="text-warning-600 hover:text-warning-900"
                            title="Edit Project"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(project)}
                            className="text-danger-600 hover:text-danger-900"
                            title="Delete Project"
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
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-gray-700">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} results
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="btn btn-outline btn-sm disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-700">
                  Page {currentPage} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === pagination.totalPages}
                  className="btn btn-outline btn-sm disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Project Modal */}
      <ProjectModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
        project={editingProject}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!deleteProject}
        onClose={() => setDeleteProject(null)}
        onConfirm={confirmDelete}
        title="Delete Project"
        message={`Are you sure you want to delete "${deleteProject?.title}"? This action cannot be undone.`}
        isLoading={deleteMutation.isLoading}
      />

      {/* Project Chat Modal */}
      {chatProject && (
        <ProjectChatModal
          isOpen={!!chatProject}
          onClose={() => setChatProject(null)}
          project={chatProject}
          workspace={chatProject.workspace}
        />
      )}
    </div>
  );
};

export default Projects;
