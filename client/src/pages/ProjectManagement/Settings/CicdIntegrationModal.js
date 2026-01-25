import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from 'react-query';
import { X, AlertCircle, Info } from 'lucide-react';
import { pmAPI } from '../../../services/api';
import toast from 'react-hot-toast';

const CicdIntegrationModal = ({ workspace, integration, isOpen, onClose }) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    provider: 'github_actions',
    api_url: '',
    api_token: '',
    webhook_url: '',
    is_active: true,
  });
  const [errors, setErrors] = useState({});
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    if (integration) {
      setFormData({
        name: integration.name || '',
        provider: integration.provider || 'github_actions',
        api_url: integration.api_url || '',
        api_token: '', // Don't show existing token
        webhook_url: integration.webhook_url || '',
        is_active: integration.is_active !== undefined ? integration.is_active : true,
      });
    } else {
      setFormData({
        name: '',
        provider: 'github_actions',
        api_url: '',
        api_token: '',
        webhook_url: '',
        is_active: true,
      });
    }
    setErrors({});
    setShowToken(false);
  }, [integration, isOpen]);

  const createMutation = useMutation(
    (data) => pmAPI.createCicdIntegration({
      ...data,
      workspace_id: workspace.id,
    }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['pm-cicd-integrations', workspace.id]);
        toast.success('CI/CD integration created successfully');
        onClose();
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || 'Failed to create CI/CD integration';
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

  const updateMutation = useMutation(
    (data) => pmAPI.updateCicdIntegration(integration.id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['pm-cicd-integrations', workspace.id]);
        toast.success('CI/CD integration updated successfully');
        onClose();
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || 'Failed to update CI/CD integration';
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

    // Validation
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (formData.api_url && !isValidUrl(formData.api_url)) {
      newErrors.api_url = 'Invalid URL format';
    }
    if (formData.webhook_url && !isValidUrl(formData.webhook_url)) {
      newErrors.webhook_url = 'Invalid URL format';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Prepare data (only send api_token if it's being updated)
    const submitData = {
      name: formData.name.trim(),
      provider: formData.provider,
      api_url: formData.api_url.trim() || null,
      webhook_url: formData.webhook_url.trim() || null,
      is_active: formData.is_active,
    };

    // Only include api_token if it's provided (not empty)
    if (formData.api_token.trim()) {
      submitData.api_token = formData.api_token.trim();
    }

    if (integration) {
      updateMutation.mutate(submitData);
    } else {
      createMutation.mutate(submitData);
    }
  };

  const isValidUrl = (string) => {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  };

  const getWebhookUrl = () => {
    if (!workspace?.id) return '';
    const baseUrl = window.location.origin;
    return `${baseUrl}/api/pm/cicd/webhook/${integration?.id || '[INTEGRATION_ID]'}`;
  };

  const providers = [
    { value: 'github_actions', label: 'GitHub Actions', icon: '🐙' },
    { value: 'gitlab_ci', label: 'GitLab CI', icon: '🦊' },
    { value: 'jenkins', label: 'Jenkins', icon: '⚙️' },
    { value: 'azure_devops', label: 'Azure DevOps', icon: '☁️' },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              {integration ? 'Edit CI/CD Integration' : 'Add CI/CD Integration'}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Integration Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                errors.name ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="e.g., Production Pipeline"
              required
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name}</p>
            )}
          </div>

          {/* Provider */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              CI/CD Provider <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.provider}
              onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            >
              {providers.map((provider) => (
                <option key={provider.value} value={provider.value}>
                  {provider.icon} {provider.label}
                </option>
              ))}
            </select>
          </div>

          {/* API URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API URL
            </label>
            <input
              type="url"
              value={formData.api_url}
              onChange={(e) => setFormData({ ...formData, api_url: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                errors.api_url ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="https://api.github.com or https://jenkins.example.com"
            />
            {errors.api_url && (
              <p className="mt-1 text-sm text-red-600">{errors.api_url}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Base URL for the CI/CD provider API
            </p>
          </div>

          {/* API Token */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API Token {integration && '(leave empty to keep existing)'}
            </label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={formData.api_token}
                onChange={(e) => setFormData({ ...formData, api_token: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent pr-10"
                placeholder="Enter API token or access key"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showToken ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Token will be encrypted and stored securely
            </p>
          </div>

          {/* Webhook URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Webhook URL
            </label>
            <input
              type="url"
              value={formData.webhook_url}
              onChange={(e) => setFormData({ ...formData, webhook_url: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                errors.webhook_url ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="https://your-ci-cd.com/webhook"
            />
            {errors.webhook_url && (
              <p className="mt-1 text-sm text-red-600">{errors.webhook_url}</p>
            )}
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-blue-800">
                  <p className="font-medium mb-1">Webhook Endpoint (for receiving updates):</p>
                  <code className="bg-white px-2 py-1 rounded text-xs break-all">
                    {getWebhookUrl()}
                  </code>
                  <p className="mt-2">Configure this URL in your CI/CD provider to receive build status updates.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Active Status */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
              Active (receive webhook updates)
            </label>
          </div>

          {/* Error Alert */}
          {Object.keys(errors).length > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-800">
                  <p className="font-medium mb-1">Please fix the following errors:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {Object.values(errors).map((error, idx) => (
                      <li key={idx}>{error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isLoading || updateMutation.isLoading}
              className="px-4 py-2 text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {createMutation.isLoading || updateMutation.isLoading
                ? 'Saving...'
                : integration
                ? 'Update'
                : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CicdIntegrationModal;
