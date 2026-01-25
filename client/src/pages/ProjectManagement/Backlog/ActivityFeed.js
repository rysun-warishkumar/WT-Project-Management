import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { 
  Activity, 
  Filter, 
  X, 
  FileText, 
  CheckSquare, 
  GitBranch, 
  Calendar,
  User,
  Clock,
  AlertCircle
} from 'lucide-react';
import { pmAPI } from '../../../services/api';
import { formatDistanceToNow } from 'date-fns';

const ActivityFeed = ({ workspaceId }) => {
  const [filters, setFilters] = useState({
    entity_type: '',
    action: '',
    user_id: '',
    start_date: '',
    end_date: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 20;

  // Fetch activities
  const { data: activitiesData, isLoading, error, refetch } = useQuery(
    ['pm-activities', workspaceId, filters, page],
    () => pmAPI.getActivities(workspaceId, { ...filters, limit, offset: (page - 1) * limit }),
    {
      enabled: !!workspaceId,
      refetchInterval: 30000, // Refetch every 30 seconds
    }
  );

  const activities = activitiesData?.data?.data?.activities || [];
  const total = activitiesData?.data?.data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1); // Reset to first page when filter changes
  };

  const clearFilters = () => {
    setFilters({
      entity_type: '',
      action: '',
      user_id: '',
      start_date: '',
      end_date: ''
    });
    setPage(1);
  };

  const getActionIcon = (action) => {
    switch (action) {
      case 'created':
        return <AlertCircle className="h-4 w-4 text-green-600" />;
      case 'updated':
        return <Clock className="h-4 w-4 text-blue-600" />;
      case 'status_changed':
        return <CheckSquare className="h-4 w-4 text-purple-600" />;
      case 'assigned':
        return <User className="h-4 w-4 text-orange-600" />;
      case 'deleted':
        return <X className="h-4 w-4 text-red-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  const getEntityIcon = (entityType) => {
    switch (entityType) {
      case 'user_story':
        return <FileText className="h-4 w-4 text-primary-600" />;
      case 'task':
        return <CheckSquare className="h-4 w-4 text-blue-600" />;
      case 'epic':
        return <GitBranch className="h-4 w-4 text-purple-600" />;
      case 'sprint':
        return <Calendar className="h-4 w-4 text-green-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  const formatActionText = (activity) => {
    const userName = activity.performed_by_name || 'Unknown User';
    const entityTitle = activity.entity_title || `#${activity.entity_id}`;
    const entityTypeLabel = activity.entity_type.replace('_', ' ');

    switch (activity.action) {
      case 'created':
        return (
          <span>
            <strong>{userName}</strong> created {entityTypeLabel} <strong>{entityTitle}</strong>
          </span>
        );
      case 'updated':
        return (
          <span>
            <strong>{userName}</strong> updated {entityTypeLabel} <strong>{entityTitle}</strong>
          </span>
        );
      case 'status_changed':
        try {
          const oldStatus = activity.old_value || 'unknown';
          const newStatus = activity.new_value || 'unknown';
          return (
            <span>
              <strong>{userName}</strong> changed status of {entityTypeLabel} <strong>{entityTitle}</strong> from <span className="font-medium text-gray-600">{oldStatus}</span> to <span className="font-medium text-primary-600">{newStatus}</span>
            </span>
          );
        } catch (e) {
          return (
            <span>
              <strong>{userName}</strong> changed status of {entityTypeLabel} <strong>{entityTitle}</strong>
            </span>
          );
        }
      case 'assigned':
        return (
          <span>
            <strong>{userName}</strong> assigned {entityTypeLabel} <strong>{entityTitle}</strong>
          </span>
        );
      case 'deleted':
        return (
          <span>
            <strong>{userName}</strong> deleted {entityTypeLabel} <strong>{entityTitle}</strong>
          </span>
        );
      default:
        return (
          <span>
            <strong>{userName}</strong> performed {activity.action} on {entityTypeLabel} <strong>{entityTitle}</strong>
          </span>
        );
    }
  };

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-gray-600">Failed to load activities</p>
            <button
              onClick={() => refetch()}
              className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary-600" />
          <h3 className="text-lg font-semibold text-gray-900">Activity Feed</h3>
          {total > 0 && (
            <span className="text-sm text-gray-500">({total} activities)</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              showFilters
                ? 'bg-primary-50 border-primary-300 text-primary-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter className="h-4 w-4 inline mr-1" />
            Filters
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Entity Type
              </label>
              <select
                value={filters.entity_type}
                onChange={(e) => handleFilterChange('entity_type', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">All Types</option>
                <option value="user_story">User Story</option>
                <option value="task">Task</option>
                <option value="epic">Epic</option>
                <option value="sprint">Sprint</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Action
              </label>
              <select
                value={filters.action}
                onChange={(e) => handleFilterChange('action', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">All Actions</option>
                <option value="created">Created</option>
                <option value="updated">Updated</option>
                <option value="status_changed">Status Changed</option>
                <option value="assigned">Assigned</option>
                <option value="deleted">Deleted</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={filters.start_date}
                onChange={(e) => handleFilterChange('start_date', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={filters.end_date}
                onChange={(e) => handleFilterChange('end_date', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="w-full px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activities List */}
      <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : activities.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No activities found</p>
            </div>
          </div>
        ) : (
          activities.map((activity) => (
            <div key={activity.id} className="p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1">
                  {getActionIcon(activity.action)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {getEntityIcon(activity.entity_type)}
                    <span className="text-sm text-gray-600 capitalize">
                      {activity.entity_type.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-900 mb-1">
                    {formatActionText(activity)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} activities
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(prev => Math.max(1, prev - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityFeed;
