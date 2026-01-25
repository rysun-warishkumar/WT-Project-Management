import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  ArrowLeft,
  Edit,
  Calendar,
  DollarSign,
  Building,
  FolderOpen,
  FileText,
  MessageSquare,
  ExternalLink,
  Plus,
  Download,
  Trash2,
} from 'lucide-react';
import { projectsAPI, filesAPI } from '../../services/api';
import toast from 'react-hot-toast';
import ProjectModal from './ProjectModal';

const ProjectDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Fetch project data
  const {
    data: projectData,
    isLoading,
    error,
  } = useQuery(
    ['project', id],
    () => projectsAPI.getById(id),
    {
      enabled: !!id,
    }
  );

  const project = projectData?.data?.data;

  // File handling functions
  const handleDownloadFile = async (fileId) => {
    try {
      const response = await filesAPI.download(fileId);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'file');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Failed to download file');
    }
  };

  const handleDeleteFile = async (fileId) => {
    if (window.confirm('Are you sure you want to delete this file?')) {
      try {
        await filesAPI.delete(fileId);
        toast.success('File deleted successfully');
        queryClient.invalidateQueries(['project', id]);
      } catch (error) {
        toast.error('Failed to delete file');
      }
    }
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
    const statusText = status || 'planning';
    return statusText.charAt(0).toUpperCase() + statusText.slice(1).replace('_', ' ');
  };

  const getTypeText = (type) => {
    return type ? type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ') : 'Unknown';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount) => {
    if (!amount) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner h-8 w-8"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Failed to load project details</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Project not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/projects')}
            className="btn btn-outline btn-sm"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{project.title}</h1>
            <p className="text-gray-600">
              {project.client_name} {project.client_company && `• ${project.client_company}`}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {project.admin_url && (
            <a
              href={project.admin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Admin Panel
            </a>
          )}
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="btn btn-primary"
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit Project
          </button>
        </div>
      </div>

      {/* Project Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Basic Information */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Basic Information</h3>
          </div>
          <div className="card-body space-y-4">
            <div className="flex items-center">
              <Building className="h-5 w-5 text-gray-400 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-900">Type</p>
                <p className="text-sm text-gray-600">{getTypeText(project.type)}</p>
              </div>
            </div>

            <div className="flex items-center">
              <span className={`badge badge-${getStatusColor(project.status)}`}>
                {getStatusText(project.status)}
              </span>
            </div>

            {project.start_date && (
              <div className="flex items-center">
                <Calendar className="h-5 w-5 text-gray-400 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Start Date</p>
                  <p className="text-sm text-gray-600">{formatDate(project.start_date)}</p>
                </div>
              </div>
            )}

            {project.end_date && (
              <div className="flex items-center">
                <Calendar className="h-5 w-5 text-gray-400 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-900">End Date</p>
                  <p className="text-sm text-gray-600">{formatDate(project.end_date)}</p>
                </div>
              </div>
            )}

            {project.budget && (
              <div className="flex items-center">
                <DollarSign className="h-5 w-5 text-gray-400 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Budget</p>
                  <p className="text-sm text-gray-600">{formatCurrency(project.budget)}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Client Information */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Client Information</h3>
          </div>
          <div className="card-body space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-900">Client Name</p>
              <p className="text-sm text-gray-600">{project.client_name}</p>
            </div>

            {project.client_company && (
              <div>
                <p className="text-sm font-medium text-gray-900">Company</p>
                <p className="text-sm text-gray-600">{project.client_company}</p>
              </div>
            )}

            {project.client_email && (
              <div>
                <p className="text-sm font-medium text-gray-900">Email</p>
                <p className="text-sm text-gray-600">{project.client_email}</p>
              </div>
            )}

            {project.client_phone && (
              <div>
                <p className="text-sm font-medium text-gray-900">Phone</p>
                <p className="text-sm text-gray-600">{project.client_phone}</p>
              </div>
            )}
          </div>
        </div>

        {/* Financial Summary */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Financial Summary</h3>
          </div>
          <div className="card-body space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-900">Total Billed</p>
              <p className="text-lg font-bold text-gray-900">
                {formatCurrency(project.total_billed)}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-900">Total Paid</p>
              <p className="text-lg font-bold text-success-600">
                {formatCurrency(project.total_paid)}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-900">Outstanding</p>
              <p className="text-lg font-bold text-warning-600">
                {formatCurrency(project.total_billed - project.total_paid)}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-900">Invoices</p>
              <p className="text-sm text-gray-600">{project.invoice_count || 0} total</p>
            </div>
          </div>
        </div>
      </div>

      {/* Project Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Description */}
        {project.description && (
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900">Description</h3>
            </div>
            <div className="card-body">
              <p className="text-gray-700 whitespace-pre-wrap">{project.description}</p>
            </div>
          </div>
        )}

                 {/* Technology Stack */}
         {project.technology_stack && (
           <div className="card">
             <div className="card-header">
               <h3 className="text-lg font-medium text-gray-900">Technology Stack</h3>
             </div>
             <div className="card-body">
               {Array.isArray(project.technology_stack) ? (
                 <div className="flex flex-wrap gap-2">
                   {project.technology_stack.map((tech, index) => (
                     <span
                       key={index}
                       className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
                     >
                       {tech}
                     </span>
                   ))}
                 </div>
               ) : (
                 <div className="flex flex-wrap gap-2">
                   {project.technology_stack.split('\n').map((tech, index) => (
                     tech.trim() && (
                       <span
                         key={index}
                         className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
                       >
                         {tech.trim()}
                       </span>
                     )
                   ))}
                 </div>
               )}
             </div>
           </div>
         )}
      </div>

      {/* Links */}
      {(project.admin_url || project.delivery_link) && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Project Links</h3>
          </div>
          <div className="card-body">
            <div className="space-y-3">
              {project.admin_url && (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Admin Panel</p>
                    <p className="text-sm text-gray-600">{project.admin_url}</p>
                  </div>
                  <a
                    href={project.admin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-outline btn-sm"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open
                  </a>
                </div>
              )}

              {project.delivery_link && (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Delivery Link</p>
                    <p className="text-sm text-gray-600">{project.delivery_link}</p>
                  </div>
                  <a
                    href={project.delivery_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-outline btn-sm"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Related Invoices */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Related Invoices</h3>
            <button
              onClick={() => navigate('/invoices', { state: { projectId: project.id } })}
              className="btn btn-primary btn-sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Invoice
            </button>
          </div>
        </div>
        <div className="card-body">
          {project.invoices && project.invoices.length > 0 ? (
            <div className="space-y-4">
              {project.invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                  onClick={() => navigate(`/invoices/${invoice.id}`)}
                >
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{invoice.invoice_number}</h4>
                    <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                      <span>Date: {formatDate(invoice.invoice_date)}</span>
                      {invoice.due_date && (
                        <span>Due: {formatDate(invoice.due_date)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="font-medium text-gray-900">
                      {formatCurrency(invoice.total_amount)}
                    </span>
                    <span className={`badge badge-${getStatusColor(invoice.status)}`}>
                      {getStatusText(invoice.status)}
                    </span>
                    <ExternalLink className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No invoices found for this project</p>
              <button
                onClick={() => navigate('/invoices', { state: { projectId: project.id } })}
                className="btn btn-primary mt-4"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add First Invoice
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Project Files */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Project Files</h3>
            <button
              onClick={() => navigate('/files', { state: { projectId: project.id } })}
              className="btn btn-primary btn-sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Upload File
            </button>
          </div>
        </div>
        <div className="card-body">
          {project.files && project.files.length > 0 ? (
            <div className="space-y-4">
              {project.files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{file.original_name}</h4>
                    <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                      <span>{file.file_type}</span>
                      <span>{formatFileSize(file.file_size)}</span>
                      <span>{formatDate(file.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleDownloadFile(file.id)}
                      className="btn btn-outline btn-sm"
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteFile(file.id)}
                      className="btn btn-outline btn-sm text-danger-600"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FolderOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No files uploaded for this project</p>
              <button
                onClick={() => navigate('/files', { state: { projectId: project.id } })}
                className="btn btn-primary mt-4"
              >
                <Plus className="h-4 w-4 mr-2" />
                Upload First File
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      {project.notes && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Notes</h3>
          </div>
          <div className="card-body">
            <p className="text-gray-700 whitespace-pre-wrap">{project.notes}</p>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      <ProjectModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries(['project', id]);
          setIsEditModalOpen(false);
        }}
        project={project}
      />
    </div>
  );
};

// Helper function to format file size
const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default ProjectDetail;
