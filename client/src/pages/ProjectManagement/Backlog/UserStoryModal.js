import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { X, Info } from 'lucide-react';
import { pmAPI } from '../../../services/api';
import toast from 'react-hot-toast';
import ReferenceNumberBadge from './ReferenceNumberBadge';
import AssigneeSelector from './AssigneeSelector';

const UserStoryModal = ({ isOpen, onClose, workspace, userStory = null }) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    acceptance_criteria: '',
    story_points: '',
    priority: 'medium',
    epic_id: '',
    assignee_id: '',
    labels: [],
  });

  useEffect(() => {
    if (userStory) {
      setFormData({
        title: userStory.title || '',
        description: userStory.description || '',
        acceptance_criteria: userStory.acceptance_criteria || '',
        story_points: userStory.story_points || '',
        priority: userStory.priority || 'medium',
        epic_id: userStory.epic_id || '',
        assignee_id: userStory.assignee_id || '',
        labels: userStory.labels || [],
      });
    } else {
      setFormData({
        title: '',
        description: '',
        acceptance_criteria: '',
        story_points: '',
        priority: 'medium',
        epic_id: '',
        assignee_id: '',
        labels: [],
      });
    }
  }, [userStory, isOpen]);

  // Fetch epics for dropdown
  const { data: epicsData } = useQuery(
    ['pm-epics', workspace.id],
    () => pmAPI.getEpics(workspace.id),
    {
      enabled: !!workspace?.id && isOpen,
    }
  );

  const epics = epicsData?.data?.data || [];

  const createMutation = useMutation(
    (data) => pmAPI.createUserStory({
      ...data,
      workspace_id: workspace.id,
    }),
    {
      onSuccess: () => {
        toast.success('User story created successfully');
        queryClient.invalidateQueries(['pm-user-stories', workspace.id]);
        onClose();
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to create user story');
      },
    }
  );

  const updateMutation = useMutation(
    (data) => pmAPI.updateUserStory(userStory.id, data),
    {
      onSuccess: () => {
        toast.success('User story updated successfully');
        queryClient.invalidateQueries(['pm-user-stories', workspace.id]);
        onClose();
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update user story');
      },
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      title: formData.title,
      description: formData.description || null,
      acceptance_criteria: formData.acceptance_criteria || null,
      story_points: formData.story_points ? parseFloat(formData.story_points) : null,
      priority: formData.priority,
      epic_id: formData.epic_id && formData.epic_id !== '' ? parseInt(formData.epic_id) : null,
      assignee_id: formData.assignee_id && formData.assignee_id !== '' ? parseInt(formData.assignee_id) : null,
    };

    // Remove null/empty values to avoid validation issues
    Object.keys(data).forEach(key => {
      if (data[key] === null || data[key] === '' || data[key] === undefined) {
        delete data[key];
      }
    });

    if (userStory) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-semibold text-gray-900">
              {userStory ? 'Edit User Story' : 'Create User Story'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {userStory?.reference_number && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Reference:</span>
              <ReferenceNumberBadge 
                referenceNumber={userStory.reference_number} 
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
              placeholder="As a user, I want to..."
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
              placeholder="Describe the user story..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Acceptance Criteria
            </label>
            <textarea
              value={formData.acceptance_criteria}
              onChange={(e) => setFormData({ ...formData, acceptance_criteria: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Given... When... Then..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                Story Points
                <div className="group relative">
                  <Info className="h-4 w-4 text-gray-400 hover:text-primary-600 cursor-help" />
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                    <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap shadow-lg">
                      1 Story Point = 8 Hours
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                        <div className="border-4 border-transparent border-t-gray-900"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={formData.story_points}
                onChange={(e) => setFormData({ ...formData, story_points: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="0"
              />
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
                Epic
              </label>
              <select
                value={formData.epic_id}
                onChange={(e) => setFormData({ ...formData, epic_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">No Epic</option>
                {epics
                  .filter(epic => epic.status === 'active')
                  .map((epic) => (
                    <option key={epic.id} value={epic.id}>
                      {epic.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assignee
              </label>
              <AssigneeSelector
                workspaceId={workspace.id}
                currentAssignee={formData.assignee_id ? {
                  id: parseInt(formData.assignee_id),
                  full_name: userStory?.assignee_name,
                  email: userStory?.assignee_email
                } : null}
                entityType="user_story"
                entityId={userStory?.id}
                size="md"
                showName={true}
                onSelect={(assigneeId) => {
                  setFormData({ ...formData, assignee_id: assigneeId || '' });
                }}
                className="w-full"
              />
            </div>
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
                : userStory
                ? 'Update'
                : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserStoryModal;
