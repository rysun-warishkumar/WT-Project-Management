import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { ListTodo, Plus, Filter, Search, Layers } from 'lucide-react';
import { pmAPI } from '../../../services/api';
import UserStoryCard from './UserStoryCard';
import UserStoryModal from './UserStoryModal';
import EpicList from './EpicList';

const BacklogView = ({ workspace }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [epicFilter, setEpicFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showEpics, setShowEpics] = useState(false);

  // Fetch user stories
  const {
    data: storiesData,
    isLoading,
    error,
  } = useQuery(
    ['pm-user-stories', workspace.id, statusFilter],
    () => pmAPI.getUserStories(workspace.id, { status: statusFilter || undefined }),
    {
      enabled: !!workspace?.id,
      refetchOnMount: true,
    }
  );

  const userStories = storiesData?.data?.data || [];

  // Fetch epics for filter
  const { data: epicsData } = useQuery(
    ['pm-epics', workspace.id],
    () => pmAPI.getEpics(workspace.id, { status: 'active' }),
    {
      enabled: !!workspace?.id,
    }
  );

  const epics = epicsData?.data?.data || [];

  const normalizeSearch = (value) => (value || '').toString().toLowerCase().trim();

  const parseIdList = (value) => {
    if (!value) return [];
    return value
      .toString()
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  };

  // Filter by search term and epic
  const filteredStories = userStories.filter((story) => {
    // Epic filter
    if (epicFilter && epicFilter !== '') {
      const storyEpicId = story.epic_id ? story.epic_id.toString() : '';
      if (storyEpicId !== epicFilter) return false;
    }

    // Search filter
    if (!searchTerm) return true;
    const search = normalizeSearch(searchTerm);
    const searchNumber = Number(search);
    const isNumericSearch = !Number.isNaN(searchNumber) && search !== '';

    const textMatches = (value) => normalizeSearch(value).includes(search);
    const matchesId = (value) => value !== undefined && value !== null && Number(value) === searchNumber;
    const listMatchesId = (value) => parseIdList(value).some((id) => Number(id) === searchNumber);

    // ID-based matches (user story id, epic id, assignee id, created by id, task/subtask ids)
    const idMatch = isNumericSearch && (
      matchesId(story.id) ||
      matchesId(story.epic_id) ||
      matchesId(story.assignee_id) ||
      matchesId(story.created_by) ||
      listMatchesId(story.task_ids) ||
      listMatchesId(story.subtask_ids)
    );

    if (idMatch) return true;

    // Text/reference matches (reference numbers, names, emails, titles, descriptions)
    return [
      story.title,
      story.description,
      story.reference_number,
      story.epic_reference_number,
      story.task_reference_numbers,
      story.subtask_reference_numbers,
      story.epic_name,
      story.sprint_name,
      story.assignee_name,
      story.assignee_email,
    ].some(textMatches);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ListTodo className="h-6 w-6 text-primary-600" />
            Backlog
          </h2>
          <p className="text-gray-600 mt-1">Manage your user stories and tasks</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add User Story
        </button>
      </div>

      {/* Epics Section - Collapsible */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <button
          onClick={() => setShowEpics(!showEpics)}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary-600" />
            <h3 className="text-lg font-semibold text-gray-900">Epics</h3>
            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
              {epics.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {epicFilter && (
              <span className="px-2 py-1 bg-primary-100 text-primary-700 text-xs rounded">
                Filtered
              </span>
            )}
            <span className="text-gray-400 text-sm">
              {showEpics ? 'Hide' : 'Show'} Epics
            </span>
          </div>
        </button>
        {showEpics && (
          <div className="border-t border-gray-200 p-4">
            <EpicList
              workspace={workspace}
              selectedEpicId={epicFilter ? parseInt(epicFilter) : null}
              onEpicSelect={(epicId) => setEpicFilter(epicId ? epicId.toString() : '')}
            />
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search user stories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="sm:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">All Statuses</option>
              <option value="backlog">Backlog</option>
              <option value="sprint">Sprint</option>
              <option value="in_progress">In Progress</option>
              <option value="testing">Testing</option>
              <option value="done">Done</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="sm:w-48">
            <select
              value={epicFilter}
              onChange={(e) => setEpicFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">All Epics</option>
              {epics.map((epic) => (
                <option key={epic.id} value={epic.id.toString()}>
                  {epic.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* User Stories List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Failed to load user stories. Please try again.</p>
        </div>
      ) : filteredStories.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <ListTodo className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchTerm || statusFilter ? 'No matching user stories' : 'Backlog is empty'}
          </h3>
          <p className="text-gray-600 mb-4">
            {searchTerm || statusFilter
              ? 'Try adjusting your search or filters'
              : 'Start by adding your first user story to the backlog'}
          </p>
          {!searchTerm && !statusFilter && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2 mx-auto"
            >
              <Plus className="h-4 w-4" />
              Create User Story
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredStories.map((story) => (
            <UserStoryCard
              key={story.id}
              userStory={story}
              workspace={workspace}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <UserStoryModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          workspace={workspace}
        />
      )}
    </div>
  );
};

export default BacklogView;
