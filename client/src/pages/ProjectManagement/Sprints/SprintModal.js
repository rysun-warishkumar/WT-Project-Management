import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from 'react-query';
import { X, Calendar } from 'lucide-react';
import { pmAPI } from '../../../services/api';
import toast from 'react-hot-toast';

const SprintModal = ({ isOpen, onClose, workspace, sprint = null }) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    goal: '',
    start_date: '',
    end_date: '',
    capacity: '',
  });

  useEffect(() => {
    if (sprint) {
      setFormData({
        name: sprint.name || '',
        goal: sprint.goal || '',
        start_date: sprint.start_date || '',
        end_date: sprint.end_date || '',
        capacity: sprint.capacity || '',
      });
    } else {
      // Set default dates (2 weeks from today)
      const today = new Date();
      const twoWeeksLater = new Date(today);
      twoWeeksLater.setDate(today.getDate() + 14);
      
      setFormData({
        name: '',
        goal: '',
        start_date: today.toISOString().split('T')[0],
        end_date: twoWeeksLater.toISOString().split('T')[0],
        capacity: '',
      });
    }
  }, [sprint, isOpen]);

  const createMutation = useMutation(
    (data) => pmAPI.createSprint({
      ...data,
      workspace_id: workspace.id,
    }),
    {
      onSuccess: () => {
        toast.success('Sprint created successfully');
        queryClient.invalidateQueries(['pm-sprints', workspace.id]);
        onClose();
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to create sprint');
      },
    }
  );

  const updateMutation = useMutation(
    (data) => pmAPI.updateSprint(sprint.id, data),
    {
      onSuccess: () => {
        toast.success('Sprint updated successfully');
        queryClient.invalidateQueries(['pm-sprints', workspace.id]);
        onClose();
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update sprint');
      },
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      name: formData.name,
      goal: formData.goal || null,
      start_date: formData.start_date,
      end_date: formData.end_date,
      capacity: formData.capacity ? parseFloat(formData.capacity) : null,
    };

    // Remove null/empty values
    Object.keys(data).forEach(key => {
      if (data[key] === null || data[key] === '' || data[key] === undefined) {
        delete data[key];
      }
    });

    if (sprint) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary-600" />
            {sprint ? 'Edit Sprint' : 'Create Sprint'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sprint Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Sprint 1, Sprint 2, etc."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sprint Goal
            </label>
            <textarea
              value={formData.goal}
              onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="What do we want to achieve in this sprint?"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Capacity (Story Points)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={formData.capacity}
              onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Total story points capacity"
            />
            <p className="text-xs text-gray-500 mt-1">
              Optional: Set the maximum story points this sprint can handle
            </p>
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
                : sprint
                ? 'Update'
                : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SprintModal;
