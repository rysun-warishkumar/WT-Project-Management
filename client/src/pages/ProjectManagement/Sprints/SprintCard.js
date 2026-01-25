import React from 'react';
import { Calendar, Play, CheckCircle, Edit, Trash2, BarChart3 } from 'lucide-react';
import { useMutation, useQueryClient } from 'react-query';
import { pmAPI } from '../../../services/api';
import toast from 'react-hot-toast';

const SprintCard = ({ sprint, workspace, onEdit, onViewBurndown }) => {
  const queryClient = useQueryClient();

  const startMutation = useMutation(
    () => pmAPI.startSprint(sprint.id),
    {
      onSuccess: () => {
        toast.success('Sprint started successfully');
        queryClient.invalidateQueries(['pm-sprints', workspace.id]);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to start sprint');
      },
    }
  );

  const completeMutation = useMutation(
    () => pmAPI.completeSprint(sprint.id),
    {
      onSuccess: () => {
        toast.success('Sprint completed successfully');
        queryClient.invalidateQueries(['pm-sprints', workspace.id]);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to complete sprint');
      },
    }
  );

  const deleteMutation = useMutation(
    () => pmAPI.deleteSprint(sprint.id),
    {
      onSuccess: () => {
        toast.success('Sprint deleted successfully');
        queryClient.invalidateQueries(['pm-sprints', workspace.id]);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to delete sprint');
      },
    }
  );

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'completed':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getDaysRemaining = () => {
    if (sprint.status !== 'active') return null;
    const end = new Date(sprint.end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const daysRemaining = getDaysRemaining();
  const progress = sprint.committed_story_points > 0 
    ? Math.round((sprint.completed_story_points / sprint.committed_story_points) * 100)
    : 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-5 w-5 text-primary-600" />
              <h3 className="font-semibold text-gray-900">{sprint.name}</h3>
              <span className={`px-2 py-0.5 text-xs font-medium rounded border ${getStatusColor(sprint.status)}`}>
                {sprint.status}
              </span>
            </div>
            {sprint.goal && (
              <p className="text-sm text-gray-600 mb-2">{sprint.goal}</p>
            )}
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span>{formatDate(sprint.start_date)} - {formatDate(sprint.end_date)}</span>
              {daysRemaining !== null && (
                <span className={daysRemaining < 3 ? 'text-red-600 font-medium' : ''}>
                  {daysRemaining} days remaining
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 ml-4">
            {sprint.status === 'planning' && (
              <button
                onClick={() => startMutation.mutate()}
                disabled={startMutation.isLoading}
                className="p-1.5 text-green-600 hover:text-green-700 transition-colors"
                title="Start Sprint"
              >
                <Play className="h-4 w-4" />
              </button>
            )}
            {sprint.status === 'active' && (
              <>
                <button
                  onClick={onViewBurndown}
                  className="p-1.5 text-primary-600 hover:text-primary-700 transition-colors"
                  title="View Burndown"
                >
                  <BarChart3 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    if (window.confirm('Are you sure you want to complete this sprint?')) {
                      completeMutation.mutate();
                    }
                  }}
                  disabled={completeMutation.isLoading}
                  className="p-1.5 text-blue-600 hover:text-blue-700 transition-colors"
                  title="Complete Sprint"
                >
                  <CheckCircle className="h-4 w-4" />
                </button>
              </>
            )}
            {sprint.status !== 'active' && sprint.status !== 'completed' && (
              <button
                onClick={() => onEdit(sprint)}
                className="p-1.5 text-gray-400 hover:text-primary-600 transition-colors"
                title="Edit"
              >
                <Edit className="h-4 w-4" />
              </button>
            )}
            {sprint.status !== 'active' && (
              <button
                onClick={() => {
                  if (window.confirm('Are you sure you want to delete this sprint? User stories will be moved back to backlog.')) {
                    deleteMutation.mutate();
                  }
                }}
                className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-3 gap-4 mb-3">
          <div>
            <p className="text-xs text-gray-500 mb-1">User Stories</p>
            <p className="text-lg font-semibold text-gray-900">{sprint.user_story_count || 0}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Committed SP</p>
            <p className="text-lg font-semibold text-gray-900">
              {parseFloat(sprint.committed_story_points || 0).toFixed(1)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Completed SP</p>
            <p className="text-lg font-semibold text-green-600">
              {parseFloat(sprint.completed_story_points || 0).toFixed(1)}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        {sprint.committed_story_points > 0 && (
          <div>
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
    </div>
  );
};

export default SprintCard;
