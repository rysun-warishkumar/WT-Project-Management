import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { 
  ChevronDown, 
  ChevronUp, 
  Edit, 
  Trash2, 
  Plus, 
  CheckSquare, 
  Square,
  AlertCircle,
  Clock,
  User,
  Tag,
  Calendar
} from 'lucide-react';
import { pmAPI } from '../../../services/api';
import toast from 'react-hot-toast';
import TaskList from './TaskList';
import UserStoryModal from './UserStoryModal';
import CommentsSection from './CommentsSection';
import SprintAssignmentModal from './SprintAssignmentModal';
import AttachmentList from './AttachmentList';
import ReferenceNumberBadge from './ReferenceNumberBadge';
import AssigneeSelector from './AssigneeSelector';
import AssigneeBadge from './AssigneeBadge';

const UserStoryCard = ({ userStory, workspace }) => {
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteConfirm, setIsDeleteConfirm] = useState(false);
  const [isSprintAssignmentOpen, setIsSprintAssignmentOpen] = useState(false);

  // Fetch tasks for this user story
  const { data: tasksData } = useQuery(
    ['pm-tasks', userStory.id],
    () => pmAPI.getTasks(userStory.id),
    {
      enabled: isExpanded,
    }
  );

  const tasks = tasksData?.data?.data || [];
  const completedTasks = tasks.filter(t => t.status === 'done').length;
  const totalTasks = tasks.length;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Delete mutation
  const deleteMutation = useMutation(
    () => pmAPI.deleteUserStory(userStory.id),
    {
      onSuccess: () => {
        toast.success('User story deleted successfully');
        queryClient.invalidateQueries(['pm-user-stories', workspace.id]);
        setIsDeleteConfirm(false);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to delete user story');
      },
    }
  );

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'done':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'testing':
        return 'bg-purple-100 text-purple-800';
      case 'sprint':
        return 'bg-indigo-100 text-indigo-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5" />
                  ) : (
                    <ChevronDown className="h-5 w-5" />
                  )}
                </button>
                <ReferenceNumberBadge 
                  referenceNumber={userStory.reference_number} 
                  size="sm"
                  className="flex-shrink-0"
                />
                <h3 className="font-semibold text-gray-900 flex-1">{userStory.title}</h3>
                <span className={`px-2 py-0.5 text-xs font-medium rounded border ${getPriorityColor(userStory.priority)}`}>
                  {userStory.priority}
                </span>
                <span className={`px-2 py-0.5 text-xs font-medium rounded ${getStatusColor(userStory.status)}`}>
                  {userStory.status.replace('_', ' ')}
                </span>
              </div>
              
              {userStory.description && (
                <p className="text-sm text-gray-600 mb-2 line-clamp-2">{userStory.description}</p>
              )}

              {/* Meta Information */}
              <div className="flex items-center gap-4 text-xs text-gray-500">
                {userStory.story_points && (
                  <span className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {userStory.story_points} SP
                  </span>
                )}
                <AssigneeSelector
                  workspaceId={workspace.id}
                  currentAssignee={userStory.assignee_id ? {
                    id: userStory.assignee_id,
                    full_name: userStory.assignee_name,
                    email: userStory.assignee_email
                  } : null}
                  entityType="user_story"
                  entityId={userStory.id}
                  size="sm"
                  onSelect={async (assigneeId) => {
                    try {
                      await pmAPI.assignUserStory(userStory.id, assigneeId);
                      queryClient.invalidateQueries(['pm-user-stories', workspace.id]);
                      toast.success(assigneeId ? 'User story assigned successfully' : 'User story unassigned successfully');
                    } catch (error) {
                      toast.error(error.response?.data?.message || 'Failed to assign user story');
                    }
                  }}
                />
                {userStory.epic_name && (
                  <span 
                    className="px-2 py-0.5 rounded text-xs font-medium"
                    style={{ 
                      backgroundColor: `${userStory.epic_color}20`,
                      color: userStory.epic_color,
                      border: `1px solid ${userStory.epic_color}40`
                    }}
                  >
                    {userStory.epic_name}
                  </span>
                )}
                {userStory.sprint_name && (
                  <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded text-xs font-medium">
                    {userStory.sprint_name}
                  </span>
                )}
                {totalTasks > 0 && (
                  <span className="flex items-center gap-1">
                    <CheckSquare className="h-3 w-3" />
                    {completedTasks}/{totalTasks} tasks
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 ml-4">
              <AssigneeSelector
                workspaceId={workspace.id}
                currentAssignee={userStory.assignee_id ? {
                  id: userStory.assignee_id,
                  full_name: userStory.assignee_name,
                  email: userStory.assignee_email
                } : null}
                entityType="user_story"
                entityId={userStory.id}
                size="md"
                onSelect={async (assigneeId) => {
                  try {
                    await pmAPI.assignUserStory(userStory.id, assigneeId);
                    queryClient.invalidateQueries(['pm-user-stories', workspace.id]);
                    toast.success(assigneeId ? 'User story assigned successfully' : 'User story unassigned successfully');
                  } catch (error) {
                    toast.error(error.response?.data?.message || 'Failed to assign user story');
                  }
                }}
              />
              <button
                onClick={() => setIsSprintAssignmentOpen(true)}
                className="p-1.5 text-gray-400 hover:text-indigo-600 transition-colors"
                title="Assign to Sprint"
              >
                <Calendar className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="p-1.5 text-gray-400 hover:text-primary-600 transition-colors"
                title="Edit"
              >
                <Edit className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsDeleteConfirm(true)}
                className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          {totalTasks > 0 && (
            <div className="mb-3">
              <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary-600 h-2 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-4">
            <TaskList 
              userStory={userStory} 
              tasks={tasks}
              workspace={workspace}
            />
            <CommentsSection 
              entityType="user_story"
              entityId={userStory.id}
            />
            <AttachmentList 
              entityType="user_story"
              entityId={userStory.id}
            />
          </div>
        )}
      </div>

      {/* Sprint Assignment Modal */}
      {isSprintAssignmentOpen && (
        <SprintAssignmentModal
          isOpen={isSprintAssignmentOpen}
          onClose={() => setIsSprintAssignmentOpen(false)}
          workspace={workspace}
          userStory={userStory}
        />
      )}

      {/* Edit Modal */}
      {isEditModalOpen && (
        <UserStoryModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          workspace={workspace}
          userStory={userStory}
        />
      )}

      {/* Delete Confirmation */}
      {isDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete User Story</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete "{userStory.title}"? This will also delete all associated tasks. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setIsDeleteConfirm(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isLoading}
                className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleteMutation.isLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UserStoryCard;
