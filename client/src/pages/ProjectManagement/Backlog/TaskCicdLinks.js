import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Plus, ExternalLink, Trash2, X } from 'lucide-react';
import { pmAPI } from '../../../services/api';
import toast from 'react-hot-toast';
import BuildStatusBadge from './BuildStatusBadge';

const TaskCicdLinks = ({ task, workspace }) => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch CI/CD links
  const { data: linksData, isLoading } = useQuery(
    ['pm-task-cicd-links', task.id],
    () => pmAPI.getTaskCicdLinks(task.id),
    {
      enabled: !!task?.id,
    }
  );

  const links = linksData?.data?.data || [];

  // Fetch integrations for dropdown
  const { data: integrationsData } = useQuery(
    ['pm-cicd-integrations', workspace?.id],
    () => pmAPI.getCicdIntegrations(workspace?.id),
    {
      enabled: !!workspace?.id && isModalOpen,
    }
  );

  const integrations = integrationsData?.data?.data || [];

  // Delete mutation
  const deleteMutation = useMutation(
    (linkId) => pmAPI.deleteTaskCicdLink(linkId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['pm-task-cicd-links', task.id]);
        toast.success('CI/CD link removed');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to remove CI/CD link');
      },
    }
  );

  const handleDelete = (linkId) => {
    if (window.confirm('Are you sure you want to remove this CI/CD link?')) {
      deleteMutation.mutate(linkId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-900">CI/CD Builds</h4>
        <button
          onClick={() => setIsModalOpen(true)}
          className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
        >
          <Plus className="h-3 w-3" />
          Link Build
        </button>
      </div>

      {links.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">
          No CI/CD builds linked to this task
        </p>
      ) : (
        <div className="space-y-2">
          {links.map((link) => (
            <div
              key={link.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <BuildStatusBadge status={link.build_status} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {link.integration_name}
                    </span>
                    {link.build_id && (
                      <span className="text-xs text-gray-500">
                        #{link.build_id}
                      </span>
                    )}
                  </div>
                  {link.environment && (
                    <span className="text-xs text-gray-500">
                      {link.environment}
                    </span>
                  )}
                </div>
                {link.build_url && (
                  <a
                    href={link.build_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:text-primary-700 flex-shrink-0"
                    title="View build"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
              <button
                onClick={() => handleDelete(link.id)}
                className="ml-2 text-gray-400 hover:text-red-600 flex-shrink-0"
                title="Remove link"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Link Modal */}
      {isModalOpen && (
        <LinkBuildModal
          task={task}
          workspace={workspace}
          integrations={integrations}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
};

// Simple modal for linking builds
const LinkBuildModal = ({ task, workspace, integrations, isOpen, onClose }) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    integration_id: '',
    build_id: '',
    build_url: '',
    build_status: 'pending',
    environment: '',
  });
  const [errors, setErrors] = useState({});

  const createMutation = useMutation(
    (data) => pmAPI.createTaskCicdLink(task.id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['pm-task-cicd-links', task.id]);
        toast.success('CI/CD build linked successfully');
        onClose();
        setFormData({
          integration_id: '',
          build_id: '',
          build_url: '',
          build_status: 'pending',
          environment: '',
        });
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || 'Failed to link CI/CD build';
        const validationErrors = error.response?.data?.errors;
        if (validationErrors) {
          const errorMap = {};
          validationErrors.forEach(err => {
            errorMap[err.param] = err.msg;
          });
          setErrors(errorMap);
        } else {
          toast.error(errorMessage);
        }
      },
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrors({});

    if (!formData.integration_id) {
      setErrors({ integration_id: 'Please select an integration' });
      return;
    }

    createMutation.mutate(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Link CI/CD Build</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Integration <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.integration_id}
              onChange={(e) => setFormData({ ...formData, integration_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            >
              <option value="">Select integration</option>
              {integrations
                .filter(i => i.is_active)
                .map((integration) => (
                  <option key={integration.id} value={integration.id}>
                    {integration.name} ({integration.provider})
                  </option>
                ))}
            </select>
            {errors.integration_id && (
              <p className="mt-1 text-sm text-red-600">{errors.integration_id}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Build ID
            </label>
            <input
              type="text"
              value={formData.build_id}
              onChange={(e) => setFormData({ ...formData, build_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="e.g., 123 or abc123"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Build URL
            </label>
            <input
              type="url"
              value={formData.build_url}
              onChange={(e) => setFormData({ ...formData, build_url: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Build Status
            </label>
            <select
              value={formData.build_status}
              onChange={(e) => setFormData({ ...formData, build_status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="pending">Pending</option>
              <option value="running">Running</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Environment
            </label>
            <input
              type="text"
              value={formData.environment}
              onChange={(e) => setFormData({ ...formData, environment: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="e.g., production, staging"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isLoading}
              className="px-4 py-2 text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {createMutation.isLoading ? 'Linking...' : 'Link Build'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskCicdLinks;
