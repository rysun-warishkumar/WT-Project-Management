import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { X, Link2, Search } from 'lucide-react';
import { pmAPI } from '../../../services/api';
import toast from 'react-hot-toast';

const TaskLinkModal = ({ task, isOpen, onClose }) => {
  const queryClient = useQueryClient();
  const [linkType, setLinkType] = useState('relates_to');
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch available tasks
  const { data: tasksData, isLoading } = useQuery(
    ['pm-available-tasks', task.id, searchTerm],
    () => pmAPI.getAvailableTasksForLinking(task.id, searchTerm),
    {
      enabled: isOpen && !!task?.id,
      debounce: 300,
    }
  );

  const availableTasks = tasksData?.data?.data || [];

  // Create link mutation
  const createMutation = useMutation(
    (data) => pmAPI.createTaskLink({
      source_task_id: task.id,
      target_task_id: parseInt(data.target_task_id),
      link_type: data.link_type,
    }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['pm-task-links', task.id]);
        toast.success('Task link created successfully');
        onClose();
        setSelectedTaskId('');
        setSearchTerm('');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to create task link');
      },
    }
  );

  useEffect(() => {
    if (!isOpen) {
      setLinkType('relates_to');
      setSelectedTaskId('');
      setSearchTerm('');
    }
  }, [isOpen]);

  const handleSubmit = () => {
    if (!selectedTaskId) {
      toast.error('Please select a task to link');
      return;
    }
    createMutation.mutate({
      target_task_id: selectedTaskId,
      link_type: linkType,
    });
  };

  const linkTypes = [
    { value: 'blocks', label: 'Blocks', description: 'This task must be completed before the linked task' },
    { value: 'blocked_by', label: 'Blocked By', description: 'This task cannot start until the linked task is done' },
    { value: 'relates_to', label: 'Relates To', description: 'Tasks are related but no dependency' },
    { value: 'duplicates', label: 'Duplicates', description: 'This task duplicates another task' },
    { value: 'clones', label: 'Clones', description: 'This task is a copy of another task' },
  ];

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary-600" />
              <h3 className="text-lg font-semibold text-gray-900">Link Task</h3>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {task && (
            <p className="text-sm text-gray-600 mt-1">Link task: {task.title}</p>
          )}
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Link Type <span className="text-red-500">*</span>
            </label>
            <select
              value={linkType}
              onChange={(e) => setLinkType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            >
              {linkTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {linkTypes.find(t => t.value === linkType)?.description}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Link To Task <span className="text-red-500">*</span>
            </label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search tasks..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
              </div>
            ) : availableTasks.length === 0 ? (
              <div className="text-center py-4 text-gray-500 text-sm">
                {searchTerm ? 'No tasks found' : 'Start typing to search tasks'}
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                {availableTasks.map((availableTask) => (
                  <button
                    key={availableTask.id}
                    type="button"
                    onClick={() => setSelectedTaskId(availableTask.id.toString())}
                    className={`w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 ${
                      selectedTaskId === availableTask.id.toString() ? 'bg-primary-50 border-primary-200' : ''
                    }`}
                  >
                    <p className="font-medium text-gray-900">{availableTask.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500">{availableTask.story_title}</span>
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                        {availableTask.status.replace('_', ' ')}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSubmit();
              }}
              disabled={!selectedTaskId || createMutation.isLoading}
              className="btn btn-primary"
            >
              {createMutation.isLoading ? 'Creating...' : 'Create Link'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Render modal using portal to avoid form nesting issues
  return createPortal(modalContent, document.body);
};

export default TaskLinkModal;
