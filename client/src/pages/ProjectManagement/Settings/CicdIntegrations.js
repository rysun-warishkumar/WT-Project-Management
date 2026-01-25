import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Plus, Settings, Trash2, Edit2, ExternalLink, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { pmAPI } from '../../../services/api';
import toast from 'react-hot-toast';
import CicdIntegrationModal from './CicdIntegrationModal';

const CicdIntegrations = ({ workspace }) => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState(null);

  // Fetch integrations
  const { data: integrationsData, isLoading, error } = useQuery(
    ['pm-cicd-integrations', workspace?.id],
    () => pmAPI.getCicdIntegrations(workspace?.id),
    {
      enabled: !!workspace?.id,
    }
  );

  const integrations = integrationsData?.data?.data || [];

  // Delete mutation
  const deleteMutation = useMutation(
    (id) => pmAPI.deleteCicdIntegration(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['pm-cicd-integrations', workspace?.id]);
        toast.success('CI/CD integration deleted successfully');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to delete CI/CD integration');
      },
    }
  );

  const handleEdit = (integration) => {
    setEditingIntegration(integration);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setEditingIntegration(null);
    setIsModalOpen(true);
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setEditingIntegration(null);
  };

  const handleDelete = (id, name) => {
    if (window.confirm(`Are you sure you want to delete the integration "${name}"? This will also remove all associated build links.`)) {
      deleteMutation.mutate(id);
    }
  };

  const getProviderIcon = (provider) => {
    switch (provider) {
      case 'github_actions':
        return '🐙';
      case 'gitlab_ci':
        return '🦊';
      case 'jenkins':
        return '⚙️';
      case 'azure_devops':
        return '☁️';
      default:
        return '🔗';
    }
  };

  const getProviderName = (provider) => {
    const names = {
      github_actions: 'GitHub Actions',
      gitlab_ci: 'GitLab CI',
      jenkins: 'Jenkins',
      azure_devops: 'Azure DevOps'
    };
    return names[provider] || provider;
  };

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-8">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">Failed to load CI/CD integrations</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">CI/CD Integrations</h3>
          <p className="text-sm text-gray-600 mt-1">
            Connect your CI/CD pipelines to track build and deployment status
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Integration
        </button>
      </div>

      {/* Integrations List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : integrations.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Settings className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">No CI/CD Integrations</h4>
          <p className="text-gray-600 mb-6">
            Connect your CI/CD pipelines to automatically track build and deployment status
          </p>
          <button
            onClick={handleAdd}
            className="btn btn-primary"
          >
            Add Your First Integration
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {integrations.map((integration) => (
            <div
              key={integration.id}
              className="bg-white rounded-lg shadow border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{getProviderIcon(integration.provider)}</span>
                  <div>
                    <h4 className="font-semibold text-gray-900">{integration.name}</h4>
                    <p className="text-sm text-gray-600">{getProviderName(integration.provider)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {integration.is_active ? (
                    <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                      <CheckCircle className="h-3 w-3" />
                      Active
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
                      <XCircle className="h-3 w-3" />
                      Inactive
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2 mb-4">
                {integration.api_url && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <ExternalLink className="h-4 w-4" />
                    <a
                      href={integration.api_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-primary-600 truncate"
                    >
                      {integration.api_url}
                    </a>
                  </div>
                )}
                {integration.webhook_url && (
                  <div className="text-xs text-gray-500">
                    Webhook: {integration.webhook_url.substring(0, 50)}...
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-200">
                <button
                  onClick={() => handleEdit(integration)}
                  className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1"
                >
                  <Edit2 className="h-4 w-4" />
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(integration.id, integration.name)}
                  className="px-3 py-1.5 text-sm text-red-700 border border-red-300 rounded-lg hover:bg-red-50 flex items-center gap-1"
                  disabled={deleteMutation.isLoading}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <CicdIntegrationModal
          workspace={workspace}
          integration={editingIntegration}
          isOpen={isModalOpen}
          onClose={handleClose}
        />
      )}
    </div>
  );
};

export default CicdIntegrations;
