import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  Plus,
  Search,
  Filter,
  Download,
  Trash2,
  Eye,
  FileText,
  Image as ImageIcon,
  Archive,
  File,
  RefreshCw,
  X,
} from 'lucide-react';
import { filesAPI, clientsAPI, projectsAPI } from '../../services/api';
import toast from 'react-hot-toast';
import FileModal from './FileModal';
import DeleteConfirmModal from '../../components/Common/DeleteConfirmModal';

const Files = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [fileTypeFilter, setFileTypeFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFile, setEditingFile] = useState(null);
  const [deleteFile, setDeleteFile] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch files data
  const {
    data: filesData,
    isLoading,
    error,
  } = useQuery(
    ['files', currentPage, searchTerm, fileTypeFilter, clientFilter, projectFilter, refreshKey],
    () => {
      const params = {
        page: currentPage,
        limit: 10,
      };
      if (searchTerm) params.search = searchTerm;
      if (fileTypeFilter) params.file_type = fileTypeFilter;
      if (clientFilter) params.client_id = clientFilter;
      if (projectFilter) params.project_id = projectFilter;
      return filesAPI.getAll(params);
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

  // Delete file mutation
  const deleteMutation = useMutation(
    (id) => filesAPI.delete(id),
    {
      onSuccess: () => {
        toast.success('File deleted successfully');
        queryClient.invalidateQueries('files');
        setDeleteFile(null);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to delete file');
      },
    }
  );

  // Download file
  const handleDownload = async (file) => {
    try {
      const response = await filesAPI.download(file.id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', file.original_name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('File download started');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to download file');
    }
  };

  const files = filesData?.data?.data?.files || [];
  const pagination = filesData?.data?.data?.pagination || {};

  const getFileIcon = (fileType) => {
    switch (fileType) {
      case 'document':
        return <FileText className="h-5 w-5 text-blue-500" />;
      case 'image':
        return <ImageIcon className="h-5 w-5 text-green-500" />;
      case 'archive':
        return <Archive className="h-5 w-5 text-purple-500" />;
      default:
        return <File className="h-5 w-5 text-gray-500" />;
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleEdit = (file) => {
    setEditingFile(file);
    setIsModalOpen(true);
  };

  const handleDelete = (file) => {
    setDeleteFile(file);
  };

  const confirmDelete = () => {
    if (deleteFile) {
      deleteMutation.mutate(deleteFile.id);
    }
  };

  const handleSuccess = () => {
    setIsModalOpen(false);
    setEditingFile(null);
    queryClient.invalidateQueries('files');
  };

  const clearFilters = () => {
    setFileTypeFilter('');
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
            <p className="text-red-500">Error loading files. Please try again.</p>
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
          <h1 className="text-2xl font-bold text-gray-900">Files</h1>
          <p className="text-gray-600">Manage documents and files</p>
        </div>
        <button
          onClick={() => {
            setEditingFile(null);
            setIsModalOpen(true);
          }}
          className="btn btn-primary"
        >
          <Plus className="h-4 w-4 mr-2" />
          Upload File
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
                  placeholder="Search files..."
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
            {(fileTypeFilter || clientFilter || projectFilter) && (
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
                <label className="form-label">File Type</label>
                <select
                  value={fileTypeFilter}
                  onChange={(e) => {
                    setFileTypeFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="form-select"
                >
                  <option value="">All Types</option>
                  <option value="document">Document</option>
                  <option value="image">Image</option>
                  <option value="archive">Archive</option>
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

      {/* Files List */}
      <div className="card">
        <div className="card-body">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
              <p className="text-gray-500 mt-4">Loading files...</p>
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No files found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        File
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Size
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Client/Project
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Uploaded By
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {files.map((file) => (
                      <tr key={file.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {getFileIcon(file.file_type)}
                            <div className="ml-3">
                              <div className="text-sm font-medium text-gray-900">
                                {file.original_name}
                              </div>
                              {file.description && (
                                <div className="text-sm text-gray-500 truncate max-w-xs">
                                  {file.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 capitalize">
                            {file.file_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatFileSize(file.file_size)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div>
                            {file.client_name && (
                              <div>{file.client_name}</div>
                            )}
                            {file.project_title && (
                              <div className="text-xs text-gray-400">{file.project_title}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {file.uploaded_by_name || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(file.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleDownload(file)}
                              className="text-blue-600 hover:text-blue-900"
                              title="Download"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleEdit(file)}
                              className="text-indigo-600 hover:text-indigo-900"
                              title="Edit"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(file)}
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
                    {pagination.total} files
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
      <FileModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingFile(null);
        }}
        onSuccess={handleSuccess}
        file={editingFile}
      />

      <DeleteConfirmModal
        isOpen={!!deleteFile}
        onClose={() => setDeleteFile(null)}
        onConfirm={confirmDelete}
        title="Delete File"
        message={`Are you sure you want to delete "${deleteFile?.original_name}"? This action cannot be undone.`}
      />
    </div>
  );
};

export default Files;
