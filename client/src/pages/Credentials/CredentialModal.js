import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation } from 'react-query';
import { X, Eye, EyeOff } from 'lucide-react';
import { credentialsAPI, clientsAPI, projectsAPI } from '../../services/api';
import toast from 'react-hot-toast';

const CredentialModal = ({ isOpen, onClose, onSuccess, credential }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Fetch clients and projects for dropdowns
  const { data: clientsData } = useQuery(
    ['clients', 'dropdown'],
    () => clientsAPI.getAll({ limit: 1000 }),
    { enabled: isOpen }
  );

  const { data: projectsData } = useQuery(
    ['projects', 'dropdown'],
    () => projectsAPI.getAll({ limit: 1000 }),
    { enabled: isOpen }
  );

  const clients = clientsData?.data?.data?.clients || [];
  const projects = projectsData?.data?.data?.projects || [];

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      title: '',
      client_id: '',
      project_id: '',
      credential_type: 'other',
      url: '',
      ip_address: '',
      username: '',
      email: '',
      password: '',
      notes: '',
    }
  });

  const watchedClientId = watch('client_id');

  // Filter projects by selected client
  const filteredProjects = watchedClientId
    ? projects.filter(p => p.client_id === parseInt(watchedClientId))
    : projects;

  // Fetch credential details if editing
  const { data: credentialData } = useQuery(
    ['credential', credential?.id],
    () => credentialsAPI.getById(credential.id),
    {
      enabled: !!credential && isOpen,
      onSuccess: (data) => {
        const cred = data.data.data;
        reset({
          title: cred.title || '',
          client_id: cred.client_id ? String(cred.client_id) : '',
          project_id: cred.project_id ? String(cred.project_id) : '',
          credential_type: cred.credential_type || 'other',
          url: cred.url || '',
          ip_address: cred.ip_address || '',
          username: cred.username || '',
          email: cred.email || '',
          password: cred.password || '', // Decrypted password from API
          notes: cred.notes || '',
        });
      },
    }
  );

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      reset({
        title: '',
        client_id: '',
        project_id: '',
        credential_type: 'other',
        url: '',
        ip_address: '',
        username: '',
        email: '',
        password: '',
        notes: '',
      });
      setShowPassword(false);
    } else if (!credential) {
      reset({
        title: '',
        client_id: '',
        project_id: '',
        credential_type: 'other',
        url: '',
        ip_address: '',
        username: '',
        email: '',
        password: '',
        notes: '',
      });
    }
  }, [isOpen, credential, reset]);

  // Create/Update mutation
  const mutation = useMutation(
    (data) => {
      if (credential) {
        return credentialsAPI.update(credential.id, data);
      } else {
        return credentialsAPI.create(data);
      }
    },
    {
      onSuccess: () => {
        toast.success(credential ? 'Credential updated successfully' : 'Credential created successfully');
        onSuccess();
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to save credential');
      },
      onSettled: () => {
        setIsSubmitting(false);
      },
    }
  );

  const onSubmit = (data) => {
    setIsSubmitting(true);

    const credentialData = {
      title: data.title,
      credential_type: data.credential_type,
      password: data.password,
      client_id: data.client_id && data.client_id !== '' ? parseInt(data.client_id) : null,
      project_id: data.project_id && data.project_id !== '' ? parseInt(data.project_id) : null,
      url: data.url && data.url.trim() !== '' ? data.url.trim() : null,
      ip_address: data.ip_address && data.ip_address.trim() !== '' ? data.ip_address.trim() : null,
      username: data.username && data.username.trim() !== '' ? data.username.trim() : null,
      email: data.email && data.email.trim() !== '' ? data.email.trim() : null,
      notes: data.notes && data.notes.trim() !== '' ? data.notes.trim() : null,
    };

    mutation.mutate(credentialData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {credential ? 'Edit Credential' : 'Add New Credential'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="form-label">Title *</label>
              <input
                {...register('title', { required: 'Title is required' })}
                className={`form-input ${errors.title ? 'border-red-500' : ''}`}
                placeholder="e.g., WordPress Admin"
              />
              {errors.title && (
                <p className="text-red-500 text-sm mt-1">{errors.title.message}</p>
              )}
            </div>

            <div>
              <label className="form-label">Client</label>
              <select
                {...register('client_id')}
                className="form-select"
              >
                <option value="">Select Client (Optional)</option>
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
                {...register('project_id')}
                className="form-select"
                disabled={!watchedClientId}
              >
                <option value="">Select Project (Optional)</option>
                {filteredProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
              {!watchedClientId && (
                <p className="mt-1 text-xs text-gray-500">Select a client first to filter projects</p>
              )}
            </div>

            <div>
              <label className="form-label">Credential Type *</label>
              <select
                {...register('credential_type', { required: 'Credential type is required' })}
                className={`form-select ${errors.credential_type ? 'border-red-500' : ''}`}
              >
                <option value="admin_panel">Admin Panel</option>
                <option value="hosting">Hosting</option>
                <option value="domain">Domain</option>
                <option value="ftp">FTP</option>
                <option value="database">Database</option>
                <option value="api">API</option>
                <option value="other">Other</option>
              </select>
              {errors.credential_type && (
                <p className="text-red-500 text-sm mt-1">{errors.credential_type.message}</p>
              )}
            </div>

            <div>
              <label className="form-label">URL</label>
              <input
                {...register('url')}
                type="url"
                className="form-input"
                placeholder="https://example.com"
              />
            </div>

            <div>
              <label className="form-label">IP Address</label>
              <input
                {...register('ip_address')}
                className="form-input"
                placeholder="192.168.1.1"
              />
            </div>

            <div>
              <label className="form-label">Username</label>
              <input
                {...register('username')}
                className="form-input"
                placeholder="username"
              />
            </div>

            <div>
              <label className="form-label">Email</label>
              <input
                {...register('email')}
                type="email"
                className="form-input"
                placeholder="email@example.com"
              />
            </div>

            <div className="md:col-span-2">
              <label className="form-label">Password *</label>
              <div className="relative">
                <input
                  {...register('password', { required: 'Password is required' })}
                  type={showPassword ? 'text' : 'password'}
                  className={`form-input pr-10 ${errors.password ? 'border-red-500' : ''}`}
                  placeholder="Enter password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="form-label">Notes</label>
              <textarea
                {...register('notes')}
                className="form-textarea"
                rows="3"
                placeholder="Additional notes..."
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-4 pt-4 border-t">
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
              {isSubmitting ? 'Saving...' : credential ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CredentialModal;
