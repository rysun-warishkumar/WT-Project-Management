import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from 'react-query';
import { X } from 'lucide-react';
import { pmAPI } from '../../../services/api';
import toast from 'react-hot-toast';
import AttachmentList from './AttachmentList';
import TaskLinkList from './TaskLinkList';
import ReferenceNumberBadge from './ReferenceNumberBadge';
import AssigneeSelector from './AssigneeSelector';
import TaskCicdLinks from './TaskCicdLinks';

const TaskModal = ({ isOpen, onClose, userStory, task = null, parentTask = null, workspace = null }) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'todo',
    priority: 'medium',
    estimated_hours: '',
    assignee_id: '',
    due_date: '',
  });

  useEffect(() => {
    if (task) {
      // Format due_date for date input (yyyy-MM-dd)
      let formattedDueDate = '';
      if (task.due_date) {
        try {
          const date = new Date(task.due_date);
          if (!isNaN(date.getTime())) {
            // Get local date string in yyyy-MM-dd format
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            formattedDueDate = `${year}-${month}-${day}`;
          }
        } catch (error) {
          console.error('Error formatting due date:', error);
          formattedDueDate = '';
        }
      }
      
      setFormData({
        title: task.title || '',
        description: task.description || '',
        status: task.status || 'todo',
        priority: task.priority || 'medium',
        estimated_hours: task.estimated_hours || '',
        assignee_id: task.assignee_id || '',
        due_date: formattedDueDate,
      });
    } else {
      setFormData({
        title: '',
        description: '',
        status: 'todo',
        priority: 'medium',
        estimated_hours: '',
        assignee_id: '',
        due_date: '',
      });
    }
  }, [task, isOpen]);

  const createMutation = useMutation(
    (data) => {
      const taskData = {
        ...data,
        user_story_id: userStory.id,
      };
      // Only include parent_task_id if parentTask exists
      if (parentTask && parentTask.id) {
        taskData.parent_task_id = parentTask.id;
      }
      return pmAPI.createTask(taskData);
    },
    {
      onSuccess: () => {
        toast.success('Task created successfully');
        queryClient.invalidateQueries(['pm-tasks', userStory.id]);
        onClose();
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to create task');
      },
    }
  );

  const updateMutation = useMutation(
    (data) => pmAPI.updateTask(task.id, data),
    {
      onSuccess: () => {
        toast.success('Task updated successfully');
        queryClient.invalidateQueries(['pm-tasks', userStory.id]);
        onClose();
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update task');
      },
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...formData,
      estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : null,
      assignee_id: formData.assignee_id ? parseInt(formData.assignee_id) : null,
    };

    if (task) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-semibold text-gray-900">
              {task ? 'Edit Task' : parentTask ? 'Create Subtask' : 'Create Task'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {task?.reference_number && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Reference:</span>
              <ReferenceNumberBadge 
                referenceNumber={task.reference_number} 
                size="sm"
              />
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Task title..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Task description..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="review">Review</option>
                <option value="testing">Testing</option>
                <option value="done">Done</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estimated Hours
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={formData.estimated_hours}
                onChange={(e) => setFormData({ ...formData, estimated_hours: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Assignee
            </label>
            {workspace || userStory ? (
              <AssigneeSelector
                workspaceId={workspace?.id || userStory?.workspace_id}
                currentAssignee={formData.assignee_id ? {
                  id: parseInt(formData.assignee_id),
                  full_name: task?.assignee_name,
                  email: task?.assignee_email
                } : null}
                entityType="task"
                entityId={task?.id}
                size="md"
                showName={true}
                onSelect={(assigneeId) => {
                  setFormData({ ...formData, assignee_id: assigneeId || '' });
                }}
                className="w-full"
              />
            ) : (
              <input
                type="text"
                value={formData.assignee_id || ''}
                onChange={(e) => setFormData({ ...formData, assignee_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Assignee ID"
                disabled
              />
            )}
          </div>

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
                : task
                ? 'Update'
                : 'Create'}
            </button>
          </div>
        </form>

        {/* Task Links - only show when editing existing task (outside form to avoid nesting) */}
        {task && (
          <div className="px-6 pt-4 border-t border-gray-200">
            <TaskLinkList task={task} />
          </div>
        )}

        {/* Attachments - only show when editing existing task (outside form to avoid nesting) */}
        {task && (
          <div className="px-6 pt-4 border-t border-gray-200">
            <AttachmentList entityType="task" entityId={task.id} />
          </div>
        )}

        {/* CI/CD Links - only show when editing existing task (outside form to avoid nesting) */}
        {task && (workspace || userStory) && (
          <div className="px-6 pt-4 border-t border-gray-200">
            <TaskCicdLinks task={task} workspace={workspace || { id: userStory.workspace_id }} />
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskModal;
