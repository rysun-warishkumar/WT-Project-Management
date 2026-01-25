import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from 'react-query';
import { X, Palette } from 'lucide-react';
import { pmAPI } from '../../../services/api';
import toast from 'react-hot-toast';
import ReferenceNumberBadge from './ReferenceNumberBadge';

const EpicModal = ({ workspace, epic, isOpen, onClose }) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3B82F6',
    status: 'active',
  });

  useEffect(() => {
    if (epic) {
      setFormData({
        name: epic.name || '',
        description: epic.description || '',
        color: epic.color || '#3B82F6',
        status: epic.status || 'active',
      });
    } else {
      setFormData({
        name: '',
        description: '',
        color: '#3B82F6',
        status: 'active',
      });
    }
  }, [epic, isOpen]);

  const createMutation = useMutation(
    (data) => pmAPI.createEpic({ ...data, workspace_id: workspace.id }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['pm-epics', workspace.id]);
        toast.success('Epic created successfully');
        onClose();
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to create epic');
      },
    }
  );

  const updateMutation = useMutation(
    (data) => pmAPI.updateEpic(epic.id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['pm-epics', workspace.id]);
        queryClient.invalidateQueries(['pm-epic', epic.id]);
        toast.success('Epic updated successfully');
        onClose();
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update epic');
      },
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (epic) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const presetColors = [
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#84CC16', // Lime
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-900">
              {epic ? 'Edit Epic' : 'Create Epic'}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {epic?.reference_number && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Reference:</span>
              <ReferenceNumberBadge 
                referenceNumber={epic.reference_number} 
                size="sm"
              />
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Epic Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Enter epic name"
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
              rows={4}
              placeholder="Enter epic description"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Color
            </label>
            <div className="flex items-center gap-3">
              <div className="flex gap-2">
                {presetColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      formData.color === color
                        ? 'border-gray-900 scale-110'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-12 h-8 border border-gray-300 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                  placeholder="#3B82F6"
                  pattern="^#[0-9A-Fa-f]{6}$"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
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
              disabled={createMutation.isLoading || updateMutation.isLoading}
              className="btn btn-primary"
            >
              {createMutation.isLoading || updateMutation.isLoading
                ? 'Saving...'
                : epic
                ? 'Update Epic'
                : 'Create Epic'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EpicModal;
