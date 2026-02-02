import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  ArrowLeft,
  Edit,
  Phone,
  Mail,
  MapPin,
  Building,
  Calendar,
  Users,
  FolderOpen,
  FileText,
  MessageSquare,
  DollarSign,
  Plus,
  ExternalLink,
} from 'lucide-react';
import { clientsAPI } from '../../services/api';
import toast from 'react-hot-toast';
import ClientModal from './ClientModal';

const ClientDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Fetch client data
  const {
    data: clientData,
    isLoading,
    error,
  } = useQuery(
    ['client', id],
    () => clientsAPI.getById(id),
    {
      enabled: !!id,
    }
  );

  const client = clientData?.data?.data;

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
      case 'completed':
      case 'paid':
        return 'success';
      case 'in_progress':
      case 'sent':
        return 'warning';
      case 'cancelled':
      case 'overdue':
      case 'inactive':
        return 'danger';
      case 'planning':
      case 'draft':
      case 'prospect':
        return 'secondary';
      default:
        return 'info';
    }
  };

  const getStatusText = (status) => {
    const statusText = status || 'active'; // Default to active if no status
    return statusText.charAt(0).toUpperCase() + statusText.slice(1).replace('_', ' ');
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
        <p className="text-gray-500">Failed to load client details</p>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Client not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/clients')}
            className="btn btn-outline btn-sm"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{client.full_name}</h1>
            {client.company_name && (
              <p className="text-gray-600">{client.company_name}</p>
            )}
          </div>
        </div>
        <button
          onClick={() => setIsEditModalOpen(true)}
          className="btn btn-primary"
        >
          <Edit className="h-4 w-4 mr-2" />
          Edit Client
        </button>
      </div>

      {/* Client Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Basic Information */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Basic Information</h3>
          </div>
          <div className="card-body space-y-4">
            <div className="flex items-center">
              <Mail className="h-5 w-5 text-gray-400 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-900">Email</p>
                <p className="text-sm text-gray-600">{client.email}</p>
              </div>
            </div>

            {client.phone && (
              <div className="flex items-center">
                <Phone className="h-5 w-5 text-gray-400 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Phone</p>
                  <p className="text-sm text-gray-600">{client.phone}</p>
                </div>
              </div>
            )}

            {client.whatsapp && (
              <div className="flex items-center">
                <Phone className="h-5 w-5 text-gray-400 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-900">WhatsApp</p>
                  <p className="text-sm text-gray-600">{client.whatsapp}</p>
                </div>
              </div>
            )}

            <div className="flex items-center">
              <Calendar className="h-5 w-5 text-gray-400 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-900">Onboarding Date</p>
                <p className="text-sm text-gray-600">
                  {formatDate(client.onboarding_date)}
                </p>
              </div>
            </div>

            <div className="flex items-center">
              <span className={`badge badge-${getStatusColor(client.status)}`}>
                {getStatusText(client.status)}
              </span>
            </div>
          </div>
        </div>

        {/* Business Information */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Business Information</h3>
          </div>
          <div className="card-body space-y-4">
            {client.business_type && (
              <div className="flex items-center">
                <Building className="h-5 w-5 text-gray-400 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Business Type</p>
                  <p className="text-sm text-gray-600">{client.business_type}</p>
                </div>
              </div>
            )}

            {client.gst_number && (
              <div>
                <p className="text-sm font-medium text-gray-900">GST Number</p>
                <p className="text-sm text-gray-600">{client.gst_number}</p>
              </div>
            )}

            {client.tax_id && (
              <div>
                <p className="text-sm font-medium text-gray-900">Tax ID</p>
                <p className="text-sm text-gray-600">{client.tax_id}</p>
              </div>
            )}
          </div>
        </div>

        {/* Address Information */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Address</h3>
          </div>
          <div className="card-body space-y-4">
            {client.address && (
              <div className="flex items-start">
                <MapPin className="h-5 w-5 text-gray-400 mr-3 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Full Address</p>
                  <p className="text-sm text-gray-600">{client.address}</p>
                </div>
              </div>
            )}

            {(client.city || client.state || client.country) && (
              <div>
                <p className="text-sm font-medium text-gray-900">Location</p>
                <p className="text-sm text-gray-600">
                  {[client.city, client.state, client.country]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              </div>
            )}

            {client.postal_code && (
              <div>
                <p className="text-sm font-medium text-gray-900">Postal Code</p>
                <p className="text-sm text-gray-600">{client.postal_code}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card">
          <div className="card-body text-center">
            <div className="flex items-center justify-center mb-2">
              <FolderOpen className="h-8 w-8 text-primary-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900">{client.project_count || 0}</h3>
            <p className="text-sm text-gray-600">Total Projects</p>
          </div>
        </div>

        <div className="card">
          <div className="card-body text-center">
            <div className="flex items-center justify-center mb-2">
              <FolderOpen className="h-8 w-8 text-success-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900">{client.active_projects || 0}</h3>
            <p className="text-sm text-gray-600">Active Projects</p>
          </div>
        </div>

        <div className="card">
          <div className="card-body text-center">
            <div className="flex items-center justify-center mb-2">
              <FolderOpen className="h-8 w-8 text-warning-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900">{client.completed_projects || 0}</h3>
            <p className="text-sm text-gray-600">Completed Projects</p>
          </div>
        </div>

        <div className="card">
          <div className="card-body text-center">
            <div className="flex items-center justify-center mb-2">
              <DollarSign className="h-8 w-8 text-danger-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900">
              {client.invoices?.length || 0}
            </h3>
            <p className="text-sm text-gray-600">Total Invoices</p>
          </div>
        </div>
      </div>

      {/* Projects */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Projects</h3>
            <button
              onClick={() => navigate('/projects', { state: { clientId: client.id } })}
              className="btn btn-primary btn-sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Project
            </button>
          </div>
        </div>
        <div className="card-body">
          {client.projects && client.projects.length > 0 ? (
            <div className="space-y-4">
              {client.projects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{project.title}</h4>
                    <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                      <span className="capitalize">{project.type.replace('_', ' ')}</span>
                      {project.start_date && (
                        <span>Started: {formatDate(project.start_date)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className={`badge badge-${getStatusColor(project.status)}`}>
                      {getStatusText(project.status)}
                    </span>
                    <ExternalLink className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FolderOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No projects found for this client</p>
              <button
                onClick={() => navigate('/projects', { state: { clientId: client.id } })}
                className="btn btn-primary mt-4"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add First Project
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Recent Invoices */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900">Recent Invoices</h3>
        </div>
        <div className="card-body">
          {client.invoices && client.invoices.length > 0 ? (
            <div className="space-y-4">
              {client.invoices.map((invoice) => (
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
              <p className="text-gray-500">No invoices found for this client</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Conversations */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900">Recent Conversations</h3>
        </div>
        <div className="card-body">
          {client.conversations && client.conversations.length > 0 ? (
            <div className="space-y-4">
              {client.conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className="p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className={`badge badge-${getStatusColor(conversation.conversation_type)}`}>
                          {getStatusText(conversation.conversation_type)}
                        </span>
                        {conversation.is_important && (
                          <span className="badge badge-warning">Important</span>
                        )}
                      </div>
                      {conversation.subject && (
                        <h4 className="font-medium text-gray-900 mb-1">
                          {conversation.subject}
                        </h4>
                      )}
                      <p className="text-sm text-gray-600 mb-2">
                        {conversation.message}
                      </p>
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span>{formatDate(conversation.created_at)}</span>
                        <span className="capitalize">{conversation.direction}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No conversations found for this client</p>
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      {client.notes && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Notes</h3>
          </div>
          <div className="card-body">
            <p className="text-gray-700 whitespace-pre-wrap">{client.notes}</p>
          </div>
        </div>
      )}

      {/* Edit Client Modal */}
      <ClientModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries(['client', id]);
          setIsEditModalOpen(false);
        }}
        client={client}
      />
    </div>
  );
};

export default ClientDetail;
