import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Link2, Plus, X, AlertTriangle, GitBranch, Copy, FileX } from 'lucide-react';
import { pmAPI } from '../../../services/api';
import toast from 'react-hot-toast';
import TaskLinkModal from './TaskLinkModal';

const TaskLinkList = ({ task }) => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch task links
  const { data: linksData, isLoading } = useQuery(
    ['pm-task-links', task.id],
    () => pmAPI.getTaskLinks(task.id),
    {
      enabled: !!task?.id,
    }
  );

  const links = linksData?.data?.data || {};
  const outgoingLinks = links.outgoing || [];
  const incomingLinks = links.incoming || [];

  // Delete mutation
  const deleteMutation = useMutation(
    (linkId) => pmAPI.deleteTaskLink(linkId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['pm-task-links', task.id]);
        toast.success('Link removed successfully');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to remove link');
      },
    }
  );

  const getLinkTypeIcon = (linkType) => {
    switch (linkType) {
      case 'blocks':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'blocked_by':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'relates_to':
        return <Link2 className="h-4 w-4 text-blue-500" />;
      case 'duplicates':
        return <Copy className="h-4 w-4 text-yellow-500" />;
      case 'clones':
        return <GitBranch className="h-4 w-4 text-purple-500" />;
      default:
        return <Link2 className="h-4 w-4 text-gray-500" />;
    }
  };

  const getLinkTypeLabel = (linkType) => {
    switch (linkType) {
      case 'blocks':
        return 'Blocks';
      case 'blocked_by':
        return 'Blocked By';
      case 'relates_to':
        return 'Relates To';
      case 'duplicates':
        return 'Duplicates';
      case 'clones':
        return 'Clones';
      default:
        return linkType;
    }
  };

  const getLinkTypeColor = (linkType) => {
    switch (linkType) {
      case 'blocks':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'blocked_by':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'relates_to':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'duplicates':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'clones':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'done':
        return 'text-green-600';
      case 'in_progress':
        return 'text-blue-600';
      case 'blocked':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const hasLinks = outgoingLinks.length > 0 || incomingLinks.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-gray-500" />
          <h4 className="font-medium text-gray-900">Task Links</h4>
          {hasLinks && (
            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
              {outgoingLinks.length + incomingLinks.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
        >
          <Plus className="h-3 w-3" />
          Add Link
        </button>
      </div>

      {!hasLinks ? (
        <div className="text-center py-6 text-gray-500 border border-gray-200 rounded-lg">
          <Link2 className="h-8 w-8 mx-auto mb-2 text-gray-400" />
          <p className="text-sm">No task links yet</p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="text-sm text-primary-600 hover:text-primary-700 mt-2"
          >
            Create your first link
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Outgoing Links */}
          {outgoingLinks.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-gray-500 mb-2 uppercase">Outgoing Links</h5>
              <div className="space-y-2">
                {outgoingLinks.map((link) => (
                  <div
                    key={link.id}
                    className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {getLinkTypeIcon(link.link_type)}
                      <span className={`px-2 py-0.5 text-xs font-medium rounded border ${getLinkTypeColor(link.link_type)}`}>
                        {getLinkTypeLabel(link.link_type)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {link.target_task_title}
                        </p>
                        <p className={`text-xs ${getStatusColor(link.target_task_status)}`}>
                          {link.target_task_status.replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteMutation.mutate(link.id)}
                      className="p-1 text-gray-400 hover:text-red-600 rounded"
                      title="Remove link"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Incoming Links */}
          {incomingLinks.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-gray-500 mb-2 uppercase">Incoming Links</h5>
              <div className="space-y-2">
                {incomingLinks.map((link) => (
                  <div
                    key={link.id}
                    className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {getLinkTypeIcon(link.link_type)}
                      <span className={`px-2 py-0.5 text-xs font-medium rounded border ${getLinkTypeColor(link.link_type)}`}>
                        {getLinkTypeLabel(link.link_type)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {link.source_task_title}
                        </p>
                        <p className={`text-xs ${getStatusColor(link.source_task_status)}`}>
                          {link.source_task_status.replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteMutation.mutate(link.id)}
                      className="p-1 text-gray-400 hover:text-red-600 rounded"
                      title="Remove link"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Task Link Modal */}
      <TaskLinkModal
        task={task}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
};

export default TaskLinkList;
