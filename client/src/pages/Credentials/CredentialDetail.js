import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, Eye, EyeOff, Copy, Check, Globe, Server, Database, Key, Cloud, Lock } from 'lucide-react';
import { credentialsAPI } from '../../services/api';
import toast from 'react-hot-toast';
import CredentialModal from './CredentialModal';
import DeleteConfirmModal from '../../components/Common/DeleteConfirmModal';

const CredentialDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  // Fetch credential details
  const {
    data: credentialData,
    isLoading,
    error,
    refetch,
  } = useQuery(
    ['credential', id],
    () => credentialsAPI.getById(id),
    {
      enabled: !!id,
    }
  );

  const credential = credentialData?.data?.data;

  const getCredentialIcon = (type) => {
    switch (type) {
      case 'admin_panel':
        return <Key className="h-8 w-8 text-blue-500" />;
      case 'hosting':
        return <Server className="h-8 w-8 text-green-500" />;
      case 'domain':
        return <Globe className="h-8 w-8 text-purple-500" />;
      case 'ftp':
        return <Cloud className="h-8 w-8 text-orange-500" />;
      case 'database':
        return <Database className="h-8 w-8 text-red-500" />;
      case 'api':
        return <Key className="h-8 w-8 text-indigo-500" />;
      default:
        return <Lock className="h-8 w-8 text-gray-500" />;
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

  const copyToClipboard = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleDelete = async () => {
    try {
      await credentialsAPI.delete(id);
      toast.success('Credential deleted successfully');
      navigate('/credentials');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete credential');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="card">
          <div className="card-body text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="text-gray-500 mt-4">Loading credential...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !credential) {
    return (
      <div className="space-y-6">
        <div className="card">
          <div className="card-body text-center py-8">
            <p className="text-red-500">Credential not found</p>
            <button
              onClick={() => navigate('/credentials')}
              className="btn btn-outline mt-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Credentials
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/credentials')}
            className="text-gray-400 hover:text-gray-600"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-3">
            {getCredentialIcon(credential.credential_type)}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{credential.title}</h1>
              <p className="text-gray-600">{getCredentialTypeLabel(credential.credential_type)}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="btn btn-outline"
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </button>
          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className="btn btn-danger"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </button>
        </div>
      </div>

      {/* Credential Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic Information */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold text-gray-900">Basic Information</h2>
          </div>
          <div className="card-body space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Title</label>
              <p className="mt-1 text-sm text-gray-900">{credential.title}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Type</label>
              <p className="mt-1 text-sm text-gray-900">
                {getCredentialTypeLabel(credential.credential_type)}
              </p>
            </div>
            {credential.client_name && (
              <div>
                <label className="text-sm font-medium text-gray-500">Client</label>
                <p className="mt-1 text-sm text-gray-900">{credential.client_name}</p>
                {credential.client_company && (
                  <p className="text-xs text-gray-500">{credential.client_company}</p>
                )}
              </div>
            )}
            {credential.project_title && (
              <div>
                <label className="text-sm font-medium text-gray-500">Project</label>
                <p className="mt-1 text-sm text-gray-900">{credential.project_title}</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-500">Created</label>
              <p className="mt-1 text-sm text-gray-900">
                {new Date(credential.created_at).toLocaleString()}
              </p>
            </div>
            {credential.updated_at && credential.updated_at !== credential.created_at && (
              <div>
                <label className="text-sm font-medium text-gray-500">Last Updated</label>
                <p className="mt-1 text-sm text-gray-900">
                  {new Date(credential.updated_at).toLocaleString()}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Access Information */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold text-gray-900">Access Information</h2>
          </div>
          <div className="card-body space-y-4">
            {credential.url && (
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-500">URL</label>
                  <button
                    onClick={() => copyToClipboard(credential.url, 'url')}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {copiedField === 'url' ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <a
                  href={credential.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 text-sm text-blue-600 hover:text-blue-800 break-all"
                >
                  {credential.url}
                </a>
              </div>
            )}
            {credential.ip_address && (
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-500">IP Address</label>
                  <button
                    onClick={() => copyToClipboard(credential.ip_address, 'ip')}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {copiedField === 'ip' ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="mt-1 text-sm text-gray-900">{credential.ip_address}</p>
              </div>
            )}
            {credential.username && (
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-500">Username</label>
                  <button
                    onClick={() => copyToClipboard(credential.username, 'username')}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {copiedField === 'username' ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="mt-1 text-sm text-gray-900">{credential.username}</p>
              </div>
            )}
            {credential.email && (
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-500">Email</label>
                  <button
                    onClick={() => copyToClipboard(credential.email, 'email')}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {copiedField === 'email' ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="mt-1 text-sm text-gray-900">{credential.email}</p>
              </div>
            )}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-500">Password</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyToClipboard(credential.password, 'password')}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {copiedField === 'password' ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <p className="mt-1 text-sm text-gray-900 font-mono">
                {showPassword ? credential.password : '••••••••'}
              </p>
            </div>
          </div>
        </div>

        {/* Notes */}
        {credential.notes && (
          <div className="card md:col-span-2">
            <div className="card-header">
              <h2 className="text-lg font-semibold text-gray-900">Notes</h2>
            </div>
            <div className="card-body">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{credential.notes}</p>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <CredentialModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          refetch();
        }}
        onSuccess={() => {
          setIsEditModalOpen(false);
          refetch();
        }}
        credential={credential}
      />

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Delete Credential"
        message={`Are you sure you want to delete "${credential.title}"? This action cannot be undone.`}
      />
    </div>
  );
};

export default CredentialDetail;
