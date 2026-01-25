import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Clock, Plus, Edit2, Trash2, User } from 'lucide-react';
import { pmAPI } from '../../../services/api';
import toast from 'react-hot-toast';
import TimeLogModal from './TimeLogModal';

const TimeLogList = ({ task }) => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState(null);

  // Fetch time logs
  const { data: timeLogsData, isLoading } = useQuery(
    ['pm-time-logs', task.id],
    () => pmAPI.getTimeLogsByTask(task.id),
    {
      enabled: !!task?.id,
    }
  );

  const timeLogs = timeLogsData?.data?.data?.time_logs || [];
  const totalHours = timeLogsData?.data?.data?.total_hours || 0;
  const estimatedHours = timeLogsData?.data?.data?.task_estimated_hours || 0;
  const loggedHours = timeLogsData?.data?.data?.task_logged_hours || 0;

  // Delete mutation
  const deleteMutation = useMutation(
    (logId) => pmAPI.deleteTimeLog(logId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['pm-time-logs', task.id]);
        queryClient.invalidateQueries(['pm-tasks', task.user_story_id]);
        toast.success('Time log deleted successfully');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to delete time log');
      },
    }
  );

  const handleDelete = (logId) => {
    if (window.confirm('Are you sure you want to delete this time log?')) {
      deleteMutation.mutate(logId);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-gray-500" />
          <h4 className="font-medium text-gray-900">Time Logs</h4>
        </div>
        <button
          onClick={() => {
            setEditingLog(null);
            setIsModalOpen(true);
          }}
          className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
        >
          <Plus className="h-3 w-3" />
          Log Time
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 p-3 bg-gray-50 rounded-lg">
        <div>
          <p className="text-xs text-gray-500 mb-1">Estimated</p>
          <p className="text-sm font-semibold text-gray-700">
            {estimatedHours.toFixed(2)}h
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Logged</p>
          <p className={`text-sm font-semibold ${
            loggedHours > estimatedHours ? 'text-red-600' : 'text-green-600'
          }`}>
            {loggedHours.toFixed(2)}h
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Remaining</p>
          <p className={`text-sm font-semibold ${
            estimatedHours - loggedHours < 0 ? 'text-red-600' : 'text-gray-700'
          }`}>
            {Math.max(0, estimatedHours - loggedHours).toFixed(2)}h
          </p>
        </div>
      </div>

      {/* Time Logs List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
        </div>
      ) : timeLogs.length === 0 ? (
        <div className="text-center py-6 text-gray-500">
          <Clock className="h-8 w-8 mx-auto mb-2 text-gray-400" />
          <p className="text-sm">No time logs yet</p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="text-sm text-primary-600 hover:text-primary-700 mt-2"
          >
            Log your first time entry
          </button>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {timeLogs.map((log) => (
            <div
              key={log.id}
              className="flex items-start justify-between p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-gray-900">
                    {parseFloat(log.hours).toFixed(2)}h
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatDate(log.logged_date)}
                  </span>
                </div>
                {log.description && (
                  <p className="text-sm text-gray-600 mb-1">{log.description}</p>
                )}
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <User className="h-3 w-3" />
                  <span>{log.user_name}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleDelete(log.id)}
                  className="p-1 text-gray-400 hover:text-red-600 rounded"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Time Log Modal */}
      <TimeLogModal
        task={task}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingLog(null);
        }}
      />
    </div>
  );
};

export default TimeLogList;
