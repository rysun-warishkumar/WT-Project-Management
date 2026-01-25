import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  Trash2,
  Star,
  StarOff,
  Mail,
  Phone,
  Users,
  MessageSquare,
  FileText,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  RefreshCw,
  X,
  Calendar,
} from 'lucide-react';
import { conversationsAPI, clientsAPI, projectsAPI } from '../../services/api';
import toast from 'react-hot-toast';
import ConversationModal from './ConversationModal';
import DeleteConfirmModal from '../../components/Common/DeleteConfirmModal';

const Conversations = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [directionFilter, setDirectionFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [importantFilter, setImportantFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConversation, setEditingConversation] = useState(null);
  const [deleteConversation, setDeleteConversation] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch conversations data
  const {
    data: conversationsData,
    isLoading,
    error,
  } = useQuery(
    ['conversations', currentPage, searchTerm, typeFilter, directionFilter, clientFilter, projectFilter, importantFilter, refreshKey],
    () => {
      const params = {
        page: currentPage,
        limit: 10,
      };
      if (searchTerm) params.search = searchTerm;
      if (typeFilter) params.conversation_type = typeFilter;
      if (directionFilter) params.direction = directionFilter;
      if (clientFilter) params.client_id = clientFilter;
      if (projectFilter) params.project_id = projectFilter;
      if (importantFilter !== '') params.is_important = importantFilter === 'true';
      return conversationsAPI.getAll(params);
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

  // Toggle important mutation
  const toggleImportantMutation = useMutation(
    (data) => conversationsAPI.update(data.id, { is_important: !data.is_important }),
    {
      onSuccess: () => {
        toast.success('Conversation updated successfully');
        queryClient.invalidateQueries('conversations');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update conversation');
      },
    }
  );

  // Delete conversation mutation
  const deleteMutation = useMutation(
    (id) => conversationsAPI.delete(id),
    {
      onSuccess: () => {
        toast.success('Conversation deleted successfully');
        queryClient.invalidateQueries('conversations');
        setDeleteConversation(null);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to delete conversation');
      },
    }
  );

  const conversations = conversationsData?.data?.data?.conversations || [];
  const pagination = conversationsData?.data?.data?.pagination || {};

  const getConversationIcon = (type) => {
    switch (type) {
      case 'email':
        return <Mail className="h-5 w-5 text-blue-500" />;
      case 'call':
        return <Phone className="h-5 w-5 text-green-500" />;
      case 'meeting':
        return <Users className="h-5 w-5 text-purple-500" />;
      case 'chat':
        return <MessageSquare className="h-5 w-5 text-orange-500" />;
      case 'note':
        return <FileText className="h-5 w-5 text-gray-500" />;
      default:
        return <MessageSquare className="h-5 w-5 text-gray-500" />;
    }
  };

  const getDirectionIcon = (direction) => {
    switch (direction) {
      case 'inbound':
        return <ArrowDownLeft className="h-4 w-4 text-green-600" />;
      case 'outbound':
        return <ArrowUpRight className="h-4 w-4 text-blue-600" />;
      case 'internal':
        return <ArrowLeftRight className="h-4 w-4 text-gray-600" />;
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

  const handleEdit = (conversation) => {
    setEditingConversation(conversation);
    setIsModalOpen(true);
  };

  const handleDelete = (conversation) => {
    setDeleteConversation(conversation);
  };

  const handleView = (conversation) => {
    navigate(`/conversations/${conversation.id}`);
  };

  const handleToggleImportant = (conversation) => {
    toggleImportantMutation.mutate({
      id: conversation.id,
      is_important: conversation.is_important,
    });
  };

  const confirmDelete = () => {
    if (deleteConversation) {
      deleteMutation.mutate(deleteConversation.id);
    }
  };

  const handleSuccess = () => {
    setIsModalOpen(false);
    setEditingConversation(null);
    queryClient.invalidateQueries('conversations');
  };

  const clearFilters = () => {
    setTypeFilter('');
    setDirectionFilter('');
    setClientFilter('');
    setProjectFilter('');
    setImportantFilter('');
    setSearchTerm('');
    setCurrentPage(1);
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div className="card">
          <div className="card-body text-center py-8">
            <p className="text-red-500">Error loading conversations. Please try again.</p>
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Conversations</h1>
          <p className="text-gray-600">Manage client communications</p>
        </div>
        <button
          onClick={() => {
            setEditingConversation(null);
            setIsModalOpen(true);
          }}
          className="btn btn-primary w-full sm:w-auto"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Conversation
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
                  placeholder="Search conversations..."
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
              className={`btn ${showFilters ? 'btn-primary' : 'btn-outline'} w-full sm:w-auto`}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </button>
            {(typeFilter || directionFilter || clientFilter || projectFilter || importantFilter) && (
              <button
                onClick={clearFilters}
                className="btn btn-outline w-full sm:w-auto"
              >
                <X className="h-4 w-4 mr-2" />
                Clear
              </button>
            )}
          </div>

          {showFilters && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t">
              <div>
                <label className="form-label">Type</label>
                <select
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="form-select"
                >
                  <option value="">All Types</option>
                  <option value="email">Email</option>
                  <option value="call">Call</option>
                  <option value="meeting">Meeting</option>
                  <option value="chat">Chat</option>
                  <option value="note">Note</option>
                </select>
              </div>
              <div>
                <label className="form-label">Direction</label>
                <select
                  value={directionFilter}
                  onChange={(e) => {
                    setDirectionFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="form-select"
                >
                  <option value="">All Directions</option>
                  <option value="inbound">Inbound</option>
                  <option value="outbound">Outbound</option>
                  <option value="internal">Internal</option>
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
              <div>
                <label className="form-label">Important</label>
                <select
                  value={importantFilter}
                  onChange={(e) => {
                    setImportantFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="form-select"
                >
                  <option value="">All</option>
                  <option value="true">Important Only</option>
                  <option value="false">Not Important</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Conversations List */}
      <div className="card">
        <div className="card-body">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
              <p className="text-gray-500 mt-4">Loading conversations...</p>
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No conversations found</p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Conversation
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type/Direction
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Client/Project
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Follow-up
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {conversations.map((conversation) => (
                      <tr key={conversation.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-start">
                            <div className="flex-shrink-0 mt-1">
                              {conversation.is_important ? (
                                <Star className="h-5 w-5 text-yellow-500 fill-current" />
                              ) : (
                                <StarOff className="h-5 w-5 text-gray-300" />
                              )}
                            </div>
                            <div className="ml-3 flex-1">
                              <div className="text-sm font-medium text-gray-900">
                                {conversation.subject || 'No Subject'}
                              </div>
                              <div className="text-sm text-gray-500 line-clamp-2 mt-1">
                                {conversation.message}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {getConversationIcon(conversation.conversation_type)}
                            <span className="text-sm text-gray-900">
                              {getTypeLabel(conversation.conversation_type)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            {getDirectionIcon(conversation.direction)}
                            <span className="text-xs text-gray-500">
                              {getDirectionLabel(conversation.direction)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div>
                            {conversation.client_name && (
                              <div className="font-medium text-gray-900">{conversation.client_name}</div>
                            )}
                            {conversation.project_title && (
                              <div className="text-xs text-gray-400">{conversation.project_title}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {conversation.follow_up_date ? (
                            <div className="flex items-center gap-1 text-orange-600">
                              <Calendar className="h-4 w-4" />
                              {new Date(conversation.follow_up_date).toLocaleDateString()}
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(conversation.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleView(conversation)}
                              className="text-blue-600 hover:text-blue-900"
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleToggleImportant(conversation)}
                              className={conversation.is_important ? "text-yellow-600 hover:text-yellow-900" : "text-gray-400 hover:text-gray-600"}
                              title={conversation.is_important ? "Mark as not important" : "Mark as important"}
                            >
                              {conversation.is_important ? (
                                <Star className="h-4 w-4 fill-current" />
                              ) : (
                                <StarOff className="h-4 w-4" />
                              )}
                            </button>
                            <button
                              onClick={() => handleEdit(conversation)}
                              className="text-indigo-600 hover:text-indigo-900"
                              title="Edit"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(conversation)}
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

              {/* Mobile Card View */}
              <div className="md:hidden space-y-4">
                {conversations.map((conversation) => (
                  <div key={conversation.id} className="border rounded-lg p-4 bg-white">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-start gap-2 flex-1">
                        {conversation.is_important ? (
                          <Star className="h-5 w-5 text-yellow-500 fill-current flex-shrink-0 mt-0.5" />
                        ) : (
                          <StarOff className="h-5 w-5 text-gray-300 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {conversation.subject || 'No Subject'}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {getConversationIcon(conversation.conversation_type)}
                            <span className="text-xs text-gray-600">
                              {getTypeLabel(conversation.conversation_type)}
                            </span>
                            {getDirectionIcon(conversation.direction)}
                            <span className="text-xs text-gray-500">
                              {getDirectionLabel(conversation.direction)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleToggleImportant(conversation)}
                        className={conversation.is_important ? "text-yellow-600" : "text-gray-300"}
                      >
                        {conversation.is_important ? (
                          <Star className="h-5 w-5 fill-current" />
                        ) : (
                          <StarOff className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2 mt-2">
                      {conversation.message}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                      <div>
                        {conversation.client_name && (
                          <div>{conversation.client_name}</div>
                        )}
                        {conversation.follow_up_date && (
                          <div className="flex items-center gap-1 text-orange-600 mt-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(conversation.follow_up_date).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        {new Date(conversation.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-end gap-2 pt-3 border-t">
                      <button
                        onClick={() => handleView(conversation)}
                        className="text-blue-600 hover:text-blue-900 text-sm"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleEdit(conversation)}
                        className="text-indigo-600 hover:text-indigo-900 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(conversation)}
                        className="text-red-600 hover:text-red-900 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-sm text-gray-700">
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                    {pagination.total} conversations
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
      <ConversationModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingConversation(null);
        }}
        onSuccess={handleSuccess}
        conversation={editingConversation}
      />

      <DeleteConfirmModal
        isOpen={!!deleteConversation}
        onClose={() => setDeleteConversation(null)}
        onConfirm={confirmDelete}
        title="Delete Conversation"
        message={`Are you sure you want to delete this conversation? This action cannot be undone.`}
      />
    </div>
  );
};

export default Conversations;
