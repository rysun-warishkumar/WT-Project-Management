import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from 'react-query';
import { useForm } from 'react-hook-form';
import { X, Save, Loader } from 'lucide-react';
import { projectsAPI, clientsAPI } from '../../services/api';
import toast from 'react-hot-toast';

const ProjectModal = ({ isOpen, onClose, onSuccess, project }) => {
  const queryClient = useQueryClient();
  const [clients, setClients] = useState([]);
  const [isLoadingClients, setIsLoadingClients] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    watch,
  } = useForm();

  const isEditing = !!project;
  const statusValue = watch('status');

  // Fetch clients for dropdown
  useEffect(() => {
    if (isOpen) {
      fetchClients();
    }
  }, [isOpen]);

  // Reset form when project changes
  useEffect(() => {
    if (isOpen) {
      if (project) {
        reset({
          title: project.title || '',
          client_id: project.client_id || '',
          type: project.type || 'website',
          status: project.status || 'planning',
          description: project.description || '',
          tech_stack: Array.isArray(project.technology_stack) 
            ? project.technology_stack.join('\n') 
            : (project.technology_stack || ''),
          start_date: project.start_date ? project.start_date.split('T')[0] : '',
          end_date: project.end_date ? project.end_date.split('T')[0] : '',
          budget: project.budget || '',
          admin_url: project.admin_url || '',
          delivery_link: project.delivery_link || '',
          notes: project.notes || '',
        });
      } else {
        reset({
          title: '',
          client_id: '',
          type: 'website',
          status: 'planning',
          description: '',
          tech_stack: '',
          start_date: '',
          end_date: '',
          budget: '',
          admin_url: '',
          delivery_link: '',
          notes: '',
        });
      }
    }
  }, [isOpen, project, reset]);

  const fetchClients = async () => {
    try {
      setIsLoadingClients(true);
      const response = await clientsAPI.getAll({ limit: 1000 });
      setClients(response.data.data.clients || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast.error('Failed to load clients');
    } finally {
      setIsLoadingClients(false);
    }
  };

  const createMutation = useMutation(
    (data) => projectsAPI.create(data),
    {
      onSuccess: () => {
        toast.success('Project created successfully');
        queryClient.invalidateQueries('projects');
        onSuccess();
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to create project');
      },
    }
  );

  const updateMutation = useMutation(
    (data) => projectsAPI.update(project.id, data),
    {
      onSuccess: () => {
        toast.success('Project updated successfully');
        queryClient.invalidateQueries('projects');
        queryClient.invalidateQueries(['project', project.id]);
        onSuccess();
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update project');
      },
    }
  );

  const onSubmit = (data) => {
    const projectData = {
      ...data,
      budget: data.budget ? parseFloat(data.budget) : null,
      // Clean up URLs - remove trailing slashes and ensure proper format
      admin_url: data.admin_url ? data.admin_url.trim() : '',
      delivery_link: data.delivery_link ? data.delivery_link.trim() : '',
      // Clean up tech stack - remove empty lines
      tech_stack: data.tech_stack ? data.tech_stack.trim() : '',
    };

    if (isEditing) {
      updateMutation.mutate(projectData);
    } else {
      createMutation.mutate(projectData);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {isEditing ? 'Edit Project' : 'Add New Project'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Project Title */}
            <div className="md:col-span-2">
              <label className="form-label">Project Title *</label>
              <input
                type="text"
                {...register('title', { required: 'Project title is required' })}
                className={`form-input ${errors.title ? 'border-red-500' : ''}`}
                placeholder="Enter project title"
              />
              {errors.title && (
                <p className="text-red-500 text-sm mt-1">{errors.title.message}</p>
              )}
            </div>

            {/* Client */}
            <div>
              <label className="form-label">Client *</label>
              <select
                {...register('client_id', { required: 'Client is required' })}
                className={`form-select ${errors.client_id ? 'border-red-500' : ''}`}
                disabled={isLoadingClients}
              >
                <option value="">Select a client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.company_name || client.full_name}
                  </option>
                ))}
              </select>
              {errors.client_id && (
                <p className="text-red-500 text-sm mt-1">{errors.client_id.message}</p>
              )}
            </div>

            {/* Project Type */}
            <div>
              <label className="form-label">Project Type *</label>
              <select
                {...register('type', { required: 'Project type is required' })}
                className={`form-select ${errors.type ? 'border-red-500' : ''}`}
              >
                <option value="website">Website</option>
                <option value="ecommerce">E-commerce</option>
                <option value="mobile_app">Mobile App</option>
                <option value="web_app">Web App</option>
                <option value="design">Design</option>
                <option value="consulting">Consulting</option>
                <option value="maintenance">Maintenance</option>
                <option value="other">Other</option>
              </select>
              {errors.type && (
                <p className="text-red-500 text-sm mt-1">{errors.type.message}</p>
              )}
            </div>

            {/* Status */}
            <div>
              <label className="form-label">Status *</label>
              <select
                {...register('status', { required: 'Status is required' })}
                className={`form-select ${errors.status ? 'border-red-500' : ''}`}
              >
                <option value="planning">Planning</option>
                <option value="in_progress">In Progress</option>
                <option value="review">Review</option>
                <option value="completed">Completed</option>
                <option value="on_hold">On Hold</option>
                <option value="cancelled">Cancelled</option>
              </select>
              {errors.status && (
                <p className="text-red-500 text-sm mt-1">{errors.status.message}</p>
              )}
            </div>

            {/* Budget */}
            <div>
              <label className="form-label">Budget</label>
              <input
                type="number"
                step="0.01"
                min="0"
                {...register('budget', {
                  min: { value: 0, message: 'Budget must be positive' }
                })}
                className={`form-input ${errors.budget ? 'border-red-500' : ''}`}
                placeholder="0.00"
              />
              {errors.budget && (
                <p className="text-red-500 text-sm mt-1">{errors.budget.message}</p>
              )}
            </div>

            {/* Start Date */}
            <div>
              <label className="form-label">Start Date</label>
              <input
                type="date"
                {...register('start_date')}
                className="form-input"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="form-label">End Date</label>
              <input
                type="date"
                {...register('end_date', {
                  validate: (value) => {
                    if (statusValue === 'completed' && !value) {
                      return 'End date is required when status is completed';
                    }
                    return true;
                  },
                })}
                className={`form-input ${errors.end_date ? 'border-red-500' : ''}`}
              />
              {errors.end_date && (
                <p className="text-red-500 text-sm mt-1">{errors.end_date.message}</p>
              )}
            </div>

            {/* Admin URL */}
            <div>
              <label className="form-label">Admin URL</label>
              <input
                type="url"
                {...register('admin_url', {
                  pattern: {
                    value: /^https?:\/\/.+/,
                    message: 'Please enter a valid URL starting with http:// or https://'
                  }
                })}
                className={`form-input ${errors.admin_url ? 'border-red-500' : ''}`}
                placeholder="https://admin.example.com"
              />
              {errors.admin_url && (
                <p className="text-red-500 text-sm mt-1">{errors.admin_url.message}</p>
              )}
            </div>

            {/* Delivery Link */}
            <div>
              <label className="form-label">Delivery Link</label>
              <input
                type="url"
                {...register('delivery_link', {
                  pattern: {
                    value: /^https?:\/\/.+/,
                    message: 'Please enter a valid URL starting with http:// or https://'
                  }
                })}
                className={`form-input ${errors.delivery_link ? 'border-red-500' : ''}`}
                placeholder="https://delivery.example.com"
              />
              {errors.delivery_link && (
                <p className="text-red-500 text-sm mt-1">{errors.delivery_link.message}</p>
              )}
            </div>

            {/* Tech Stack */}
            <div className="md:col-span-2">
              <label className="form-label">Technology Stack</label>
              <textarea
                {...register('tech_stack')}
                className="form-textarea"
                rows="3"
                placeholder="Enter technologies (one per line):&#10;React&#10;Node.js&#10;MySQL&#10;AWS"
              />
              <p className="text-sm text-gray-500 mt-1">
                Enter each technology on a separate line
              </p>
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="form-label">Description</label>
              <textarea
                {...register('description')}
                className="form-textarea"
                rows="4"
                placeholder="Describe the project requirements and objectives"
              />
            </div>

            {/* Notes */}
            <div className="md:col-span-2">
              <label className="form-label">Notes</label>
              <textarea
                {...register('notes')}
                className="form-textarea"
                rows="3"
                placeholder="Additional notes or comments"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end space-x-3 pt-6 border-t">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-outline"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader className="h-4 w-4 mr-2 animate-spin" />
                  {isEditing ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {isEditing ? 'Update Project' : 'Create Project'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProjectModal;
