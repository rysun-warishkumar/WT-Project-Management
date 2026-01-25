import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation } from 'react-query';
import { X } from 'lucide-react';
import { conversationsAPI, clientsAPI, projectsAPI } from '../../services/api';
import toast from 'react-hot-toast';

const ConversationModal = ({ isOpen, onClose, onSuccess, conversation }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    reset,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      client_id: '',
      project_id: '',
      conversation_type: 'note',
      subject: '',
      message: '',
      direction: 'internal',
      is_important: false,
      follow_up_date: '',
    }
  });

  const watchedClientId = watch('client_id');

  // Filter projects by selected client
  const filteredProjects = watchedClientId
    ? projects.filter(p => p.client_id === parseInt(watchedClientId))
    : projects;

  // Fetch conversation details if editing
  useQuery(
    ['conversation', conversation?.id],
    () => conversationsAPI.getById(conversation.id),
    {
      enabled: !!conversation && isOpen,
      onSuccess: (data) => {
        const conv = data.data.data;
        reset({
          client_id: conv.client_id ? String(conv.client_id) : '',
          project_id: conv.project_id ? String(conv.project_id) : '',
          conversation_type: conv.conversation_type || 'note',
          subject: conv.subject || '',
          message: conv.message || '',
          direction: conv.direction || 'internal',
          is_important: conv.is_important || false,
          follow_up_date: conv.follow_up_date || '',
        });
      },
    }
  );

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      reset({
        client_id: '',
        project_id: '',
        conversation_type: 'note',
        subject: '',
        message: '',
        direction: 'internal',
        is_important: false,
        follow_up_date: '',
      });
    } else if (!conversation) {
      reset({
        client_id: '',
        project_id: '',
        conversation_type: 'note',
        subject: '',
        message: '',
        direction: 'internal',
        is_important: false,
        follow_up_date: '',
      });
    }
  }, [isOpen, conversation, reset]);

  // Create/Update mutation
  const mutation = useMutation(
    (data) => {
      if (conversation) {
        return conversationsAPI.update(conversation.id, data);
      } else {
        return conversationsAPI.create(data);
      }
    },
    {
      onSuccess: () => {
        toast.success(conversation ? 'Conversation updated successfully' : 'Conversation created successfully');
        onSuccess();
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || 'Failed to save conversation';
        const validationErrors = error.response?.data?.errors;
        
        if (validationErrors && validationErrors.length > 0) {
          validationErrors.forEach((err) => {
            toast.error(err.msg || err.message || 'Validation error');
          });
        } else {
          toast.error(errorMessage);
        }
      },
      onSettled: () => {
        setIsSubmitting(false);
      },
    }
  );

  const onSubmit = (data) => {
    setIsSubmitting(true);

    const conversationData = {
      client_id: parseInt(data.client_id),
      project_id: data.project_id && data.project_id !== '' ? parseInt(data.project_id) : null,
      conversation_type: data.conversation_type,
      subject: data.subject && data.subject.trim() !== '' ? data.subject.trim() : null,
      message: data.message.trim(),
      direction: data.direction,
      is_important: data.is_important || false,
      follow_up_date: data.follow_up_date && data.follow_up_date !== '' ? data.follow_up_date : null,
    };

    mutation.mutate(conversationData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
          <h2 className="text-xl font-semibold text-gray-900">
            {conversation ? 'Edit Conversation' : 'Add New Conversation'}
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
              <label className="form-label">Client *</label>
              <select
                {...register('client_id', { required: 'Client is required' })}
                className={`form-select ${errors.client_id ? 'border-red-500' : ''}`}
              >
                <option value="">Select Client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.full_name} {client.company_name && `(${client.company_name})`}
                  </option>
                ))}
              </select>
              {errors.client_id && (
                <p className="text-red-500 text-sm mt-1">{errors.client_id.message}</p>
              )}
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
              <label className="form-label">Conversation Type *</label>
              <select
                {...register('conversation_type', { required: 'Conversation type is required' })}
                className={`form-select ${errors.conversation_type ? 'border-red-500' : ''}`}
              >
                <option value="email">Email</option>
                <option value="call">Call</option>
                <option value="meeting">Meeting</option>
                <option value="chat">Chat</option>
                <option value="note">Note</option>
              </select>
              {errors.conversation_type && (
                <p className="text-red-500 text-sm mt-1">{errors.conversation_type.message}</p>
              )}
            </div>

            <div>
              <label className="form-label">Direction *</label>
              <select
                {...register('direction', { required: 'Direction is required' })}
                className={`form-select ${errors.direction ? 'border-red-500' : ''}`}
              >
                <option value="inbound">Inbound</option>
                <option value="outbound">Outbound</option>
                <option value="internal">Internal</option>
              </select>
              {errors.direction && (
                <p className="text-red-500 text-sm mt-1">{errors.direction.message}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="form-label">Subject</label>
              <input
                {...register('subject')}
                className="form-input"
                placeholder="Conversation subject (optional)"
                maxLength={200}
              />
            </div>

            <div className="md:col-span-2">
              <label className="form-label">Message *</label>
              <textarea
                {...register('message', { 
                  required: 'Message is required',
                  minLength: {
                    value: 1,
                    message: 'Message cannot be empty'
                  }
                })}
                className={`form-textarea ${errors.message ? 'border-red-500' : ''}`}
                rows="6"
                placeholder="Enter conversation message..."
              />
              {errors.message && (
                <p className="text-red-500 text-sm mt-1">{errors.message.message}</p>
              )}
            </div>

            <div>
              <label className="form-label">Follow-up Date</label>
              <input
                {...register('follow_up_date')}
                type="date"
                className="form-input"
              />
            </div>

            <div className="flex items-center">
              <input
                {...register('is_important')}
                type="checkbox"
                id="is_important"
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="is_important" className="ml-2 block text-sm text-gray-900">
                Mark as Important
              </label>
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
              {isSubmitting ? 'Saving...' : conversation ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ConversationModal;
