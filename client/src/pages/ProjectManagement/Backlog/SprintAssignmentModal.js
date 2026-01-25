import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { X, Calendar, Plus } from 'lucide-react';
import { pmAPI } from '../../../services/api';
import toast from 'react-hot-toast';
import SprintModal from '../Sprints/SprintModal';

const SprintAssignmentModal = ({ isOpen, onClose, workspace, userStory }) => {
  const queryClient = useQueryClient();
  const [selectedSprintId, setSelectedSprintId] = useState(userStory?.sprint_id || '');
  const [isCreateSprintOpen, setIsCreateSprintOpen] = useState(false);

  // Fetch sprints
  const { data: sprintsData } = useQuery(
    ['pm-sprints', workspace.id],
    () => pmAPI.getSprints(workspace.id),
    {
      enabled: isOpen && !!workspace?.id,
    }
  );

  // Filter sprints to show planning and active only
  const sprints = (sprintsData?.data?.data || []).filter(
    sprint => sprint.status === 'planning' || sprint.status === 'active'
  );

  const assignMutation = useMutation(
    (sprintId) => pmAPI.updateUserStory(userStory.id, {
      sprint_id: sprintId || null,
      status: sprintId ? 'sprint' : 'backlog',
    }),
    {
      onSuccess: () => {
        toast.success('User story assigned to sprint successfully');
        queryClient.invalidateQueries(['pm-user-stories', workspace.id]);
        queryClient.invalidateQueries(['pm-sprints', workspace.id]);
        onClose();
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to assign user story');
      },
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    const sprintId = selectedSprintId ? parseInt(selectedSprintId) : null;
    assignMutation.mutate(sprintId);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-md w-full">
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary-600" />
              Assign to Sprint
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
                Select Sprint
              </label>
              <select
                value={selectedSprintId}
                onChange={(e) => setSelectedSprintId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">Backlog (No Sprint)</option>
                {sprints.map((sprint) => (
                  <option key={sprint.id} value={sprint.id}>
                    {sprint.name} ({sprint.status}) - {new Date(sprint.start_date).toLocaleDateString()} to {new Date(sprint.end_date).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setIsCreateSprintOpen(true)}
                className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
              >
                <Plus className="h-4 w-4" />
                Create New Sprint
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assignMutation.isLoading}
                  className="px-4 py-2 text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {assignMutation.isLoading ? 'Assigning...' : 'Assign'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {isCreateSprintOpen && (
        <SprintModal
          isOpen={isCreateSprintOpen}
          onClose={() => setIsCreateSprintOpen(false)}
          workspace={workspace}
        />
      )}
    </>
  );
};

export default SprintAssignmentModal;
