import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from 'react-query';
import { X, Clock } from 'lucide-react';
import { pmAPI } from '../../../services/api';
import toast from 'react-hot-toast';

const TimeLogModal = ({ task, isOpen, onClose }) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    hours: '',
    description: '',
    logged_date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (isOpen) {
      setFormData({
        hours: '',
        description: '',
        logged_date: new Date().toISOString().split('T')[0],
      });
    }
  }, [isOpen]);

  const createMutation = useMutation(
    (data) => pmAPI.createTimeLog({
      ...data,
      task_id: task.id,
    }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['pm-time-logs', task.id]);
        queryClient.invalidateQueries(['pm-tasks', task.user_story_id]);
        queryClient.invalidateQueries(['pm-user-stories']);
        toast.success('Time logged successfully');
        onClose();
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to log time');
      },
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.hours || parseFloat(formData.hours) <= 0) {
      toast.error('Please enter a valid number of hours');
      return;
    }
    createMutation.mutate(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary-600" />
              <h3 className="text-lg font-semibold text-gray-900">Log Time</h3>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {task && (
            <p className="text-sm text-gray-600 mt-1">Task: {task.title}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hours <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.25"
              min="0.25"
              value={formData.hours}
              onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="0.00"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter time in hours (e.g., 2.5 for 2 hours 30 minutes)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date
            </label>
            <input
              type="date"
              value={formData.logged_date}
              onChange={(e) => setFormData({ ...formData, logged_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              rows={3}
              placeholder="What did you work on?"
            />
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
              type="submit"
              disabled={createMutation.isLoading}
              className="btn btn-primary"
            >
              {createMutation.isLoading ? 'Logging...' : 'Log Time'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TimeLogModal;
