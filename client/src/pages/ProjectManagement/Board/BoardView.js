import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Kanban, Filter } from 'lucide-react';
import { pmAPI } from '../../../services/api';
import toast from 'react-hot-toast';

const BoardView = ({ workspace }) => {
  const queryClient = useQueryClient();
  const [selectedSprint, setSelectedSprint] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');

  // Fetch sprints for filter
  const { data: sprintsData } = useQuery(
    ['pm-sprints', workspace.id],
    () => pmAPI.getSprints(workspace.id),
    {
      enabled: !!workspace?.id,
    }
  );

  const sprints = sprintsData?.data?.data || [];
  const activeSprint = sprints.find(s => s.status === 'active');

  // Fetch user stories
  const {
    data: storiesData,
    isLoading,
  } = useQuery(
    ['pm-user-stories-board', workspace.id, selectedSprint?.id, statusFilter],
    () => pmAPI.getUserStories(workspace.id, {
      sprint_id: selectedSprint?.id || undefined,
      status: statusFilter || undefined,
    }),
    {
      enabled: !!workspace?.id,
    }
  );

  const userStories = storiesData?.data?.data || [];

  // Update story status mutation
  const updateStatusMutation = useMutation(
    ({ storyId, newStatus }) => pmAPI.updateUserStory(storyId, { status: newStatus }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['pm-user-stories-board', workspace.id]);
        queryClient.invalidateQueries(['pm-user-stories', workspace.id]);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update story status');
      },
    }
  );

  // Board columns configuration
  const columns = [
    { id: 'backlog', title: 'Backlog', status: 'backlog' },
    { id: 'sprint', title: 'Sprint', status: 'sprint' },
    { id: 'in_progress', title: 'In Progress', status: 'in_progress' },
    { id: 'testing', title: 'Testing', status: 'testing' },
    { id: 'done', title: 'Done', status: 'done' },
  ];

  // Group stories by status
  const storiesByStatus = columns.reduce((acc, column) => {
    acc[column.status] = userStories.filter(story => story.status === column.status);
    return acc;
  }, {});

  const [draggedStory, setDraggedStory] = useState(null);

  const handleDragStart = (e, story) => {
    setDraggedStory(story);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, newStatus) => {
    e.preventDefault();
    if (!draggedStory || draggedStory.status === newStatus) {
      setDraggedStory(null);
      return;
    }

    updateStatusMutation.mutate({ storyId: draggedStory.id, newStatus });
    setDraggedStory(null);
  };

  const handleDragEnd = () => {
    setDraggedStory(null);
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical':
        return 'border-l-red-500';
      case 'high':
        return 'border-l-orange-500';
      case 'medium':
        return 'border-l-yellow-500';
      default:
        return 'border-l-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Kanban className="h-6 w-6 text-primary-600" />
            Board
          </h2>
          <p className="text-gray-600 mt-1">Visualize and manage your work</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={selectedSprint?.id || ''}
            onChange={(e) => {
              const sprintId = e.target.value;
              setSelectedSprint(sprints.find(s => s.id === parseInt(sprintId)) || null);
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="">All Stories</option>
            {sprints.map((sprint) => (
              <option key={sprint.id} value={sprint.id}>
                {sprint.name} {sprint.status === 'active' && '(Active)'}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Board */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-4 overflow-x-auto pb-4">
          {columns.map((column) => (
            <div key={column.id} className="flex-shrink-0 w-64">
              <div className="bg-gray-50 rounded-lg p-3 mb-2">
                <h3 className="font-semibold text-gray-900 text-sm">
                  {column.title}
                </h3>
                <p className="text-xs text-gray-500">
                  {storiesByStatus[column.status]?.length || 0} stories
                </p>
              </div>
              <div
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, column.status)}
                className={`min-h-[500px] p-2 rounded-lg transition-colors bg-gray-50 ${
                  draggedStory ? 'bg-primary-50' : ''
                }`}
              >
                {storiesByStatus[column.status]?.map((story) => (
                  <div
                    key={story.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, story)}
                    onDragEnd={handleDragEnd}
                    className={`bg-white rounded-lg border-l-4 p-3 mb-2 shadow-sm hover:shadow-md transition-shadow cursor-move ${
                      getPriorityColor(story.priority)
                    } ${draggedStory?.id === story.id ? 'opacity-50' : ''}`}
                  >
                    <h4 className="font-medium text-sm text-gray-900 mb-1 line-clamp-2">
                      {story.title}
                    </h4>
                    {story.story_points && (
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                        <span className="px-1.5 py-0.5 bg-gray-100 rounded">
                          {parseFloat(story.story_points).toFixed(1)} SP
                        </span>
                        {story.epic_name && (
                          <span
                            className="px-1.5 py-0.5 rounded text-xs"
                            style={{
                              backgroundColor: `${story.epic_color}20`,
                              color: story.epic_color,
                            }}
                          >
                            {story.epic_name}
                          </span>
                        )}
                      </div>
                    )}
                    {story.assignee_name && (
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <span className="w-5 h-5 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-medium">
                          {story.assignee_name.charAt(0).toUpperCase()}
                        </span>
                        <span>{story.assignee_name}</span>
                      </div>
                    )}
                  </div>
                ))}
                {storiesByStatus[column.status]?.length === 0 && (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    Drop stories here
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BoardView;
