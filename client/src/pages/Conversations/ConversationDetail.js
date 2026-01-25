import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, Star, StarOff, Mail, Phone, Users, MessageSquare, FileText, ArrowUpRight, ArrowDownLeft, ArrowLeftRight, Calendar } from 'lucide-react';
import { conversationsAPI } from '../../services/api';
import toast from 'react-hot-toast';
import ConversationModal from './ConversationModal';
import DeleteConfirmModal from '../../components/Common/DeleteConfirmModal';

const ConversationDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Fetch conversation details
  const {
    data: conversationData,
    isLoading,
    error,
    refetch,
  } = useQuery(
    ['conversation', id],
    () => conversationsAPI.getById(id),
    {
      enabled: !!id,
    }
  );

  const conversation = conversationData?.data?.data;

  // Toggle important mutation
  const toggleImportantMutation = useMutation(
    (data) => conversationsAPI.update(id, { is_important: !data.is_important }),
    {
      onSuccess: () => {
        toast.success('Conversation updated successfully');
        refetch();
        queryClient.invalidateQueries('conversations');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update conversation');
      },
    }
  );

  // Delete mutation
  const deleteMutation = useMutation(
    () => conversationsAPI.delete(id),
    {
      onSuccess: () => {
        toast.success('Conversation deleted successfully');
        navigate('/conversations');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to delete conversation');
      },
    }
  );

  const getConversationIcon = (type) => {
    switch (type) {
      case 'email':
        return <Mail className="h-8 w-8 text-blue-500" />;
      case 'call':
        return <Phone className="h-8 w-8 text-green-500" />;
      case 'meeting':
        return <Users className="h-8 w-8 text-purple-500" />;
      case 'chat':
        return <MessageSquare className="h-8 w-8 text-orange-500" />;
      case 'note':
        return <FileText className="h-8 w-8 text-gray-500" />;
      default:
        return <MessageSquare className="h-8 w-8 text-gray-500" />;
    }
  };

  const getDirectionIcon = (direction) => {
    switch (direction) {
      case 'inbound':
        return <ArrowDownLeft className="h-5 w-5 text-green-600" />;
      case 'outbound':
        return <ArrowUpRight className="h-5 w-5 text-blue-600" />;
      case 'internal':
        return <ArrowLeftRight className="h-5 w-5 text-gray-600" />;
      default:
        return null;
    }
  };

  const getTypeLabel = (type) => {
    const labels = {
      email: 'Email',
      call: 'Call',
      meeting: 'Meeting',
      chat: 'Chat',
      note: 'Note',
    };
    return labels[type] || type;
  };

  const getDirectionLabel = (direction) => {
    const labels = {
      inbound: 'Inbound',
      outbound: 'Outbound',
      internal: 'Internal',
    };
    return labels[direction] || direction;
  };

  const handleToggleImportant = () => {
    if (conversation) {
      toggleImportantMutation.mutate({
        is_important: conversation.is_important,
      });
    }
  };

  const handleDelete = () => {
    deleteMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="card">
          <div className="card-body text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="text-gray-500 mt-4">Loading conversation...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !conversation) {
    return (
      <div className="space-y-6">
        <div className="card">
          <div className="card-body text-center py-8">
            <p className="text-red-500">Conversation not found</p>
            <button
              onClick={() => navigate('/conversations')}
              className="btn btn-outline mt-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Conversations
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/conversations')}
            className="text-gray-400 hover:text-gray-600"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-3">
            {getConversationIcon(conversation.conversation_type)}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {conversation.subject || 'No Subject'}
              </h1>
              <p className="text-gray-600">
                {getTypeLabel(conversation.conversation_type)} • {getDirectionLabel(conversation.direction)}
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleToggleImportant}
            className={`btn ${conversation.is_important ? 'btn-warning' : 'btn-outline'}`}
          >
            {conversation.is_important ? (
              <>
                <Star className="h-4 w-4 mr-2 fill-current" />
                Important
              </>
            ) : (
              <>
                <StarOff className="h-4 w-4 mr-2" />
                Mark Important
              </>
            )}
          </button>
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

      {/* Conversation Details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="md:col-span-2 space-y-6">
          {/* Message */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-semibold text-gray-900">Message</h2>
            </div>
            <div className="card-body">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{conversation.message}</p>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Basic Information */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-semibold text-gray-900">Details</h2>
            </div>
            <div className="card-body space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Type</label>
                <div className="mt-1 flex items-center gap-2">
                  {getConversationIcon(conversation.conversation_type)}
                  <span className="text-sm text-gray-900">
                    {getTypeLabel(conversation.conversation_type)}
                  </span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Direction</label>
                <div className="mt-1 flex items-center gap-2">
                  {getDirectionIcon(conversation.direction)}
                  <span className="text-sm text-gray-900">
                    {getDirectionLabel(conversation.direction)}
                  </span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Status</label>
                <div className="mt-1">
                  {conversation.is_important ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      <Star className="h-3 w-3 mr-1 fill-current" />
                      Important
                    </span>
                  ) : (
                    <span className="text-sm text-gray-500">Normal</span>
                  )}
                </div>
              </div>
              {conversation.follow_up_date && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Follow-up Date</label>
                  <div className="mt-1 flex items-center gap-2 text-sm text-orange-600">
                    <Calendar className="h-4 w-4" />
                    {new Date(conversation.follow_up_date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Client Information */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-semibold text-gray-900">Client</h2>
            </div>
            <div className="card-body space-y-2">
              <div>
                <label className="text-sm font-medium text-gray-500">Name</label>
                <p className="mt-1 text-sm text-gray-900">{conversation.client_name}</p>
                {conversation.client_company && (
                  <p className="text-xs text-gray-500">{conversation.client_company}</p>
                )}
              </div>
              {conversation.client_email && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Email</label>
                  <p className="mt-1 text-sm text-gray-900">{conversation.client_email}</p>
                </div>
              )}
              {conversation.client_phone && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Phone</label>
                  <p className="mt-1 text-sm text-gray-900">{conversation.client_phone}</p>
                </div>
              )}
            </div>
          </div>

          {/* Project Information */}
          {conversation.project_title && (
            <div className="card">
              <div className="card-header">
                <h2 className="text-lg font-semibold text-gray-900">Project</h2>
              </div>
              <div className="card-body">
                <p className="text-sm text-gray-900">{conversation.project_title}</p>
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-semibold text-gray-900">Metadata</h2>
            </div>
            <div className="card-body space-y-2">
              <div>
                <label className="text-sm font-medium text-gray-500">Created By</label>
                <p className="mt-1 text-sm text-gray-900">
                  {conversation.created_by_name || 'N/A'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Created At</label>
                <p className="mt-1 text-sm text-gray-900">
                  {new Date(conversation.created_at).toLocaleString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ConversationModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          refetch();
        }}
        onSuccess={() => {
          setIsEditModalOpen(false);
          refetch();
        }}
        conversation={conversation}
      />

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Delete Conversation"
        message={`Are you sure you want to delete this conversation? This action cannot be undone.`}
      />
    </div>
  );
};

export default ConversationDetail;
