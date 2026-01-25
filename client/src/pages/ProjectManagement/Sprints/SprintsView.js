import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { Calendar, Plus, Filter } from 'lucide-react';
import { pmAPI } from '../../../services/api';
import SprintCard from './SprintCard';
import SprintModal from './SprintModal';
import BurndownChart from './BurndownChart';

const SprintsView = ({ workspace }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSprint, setEditingSprint] = useState(null);
  const [selectedSprint, setSelectedSprint] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');

  // Fetch sprints
  const {
    data: sprintsData,
    isLoading,
    error,
  } = useQuery(
    ['pm-sprints', workspace.id, statusFilter],
    () => pmAPI.getSprints(workspace.id, { status: statusFilter || undefined }),
    {
      enabled: !!workspace?.id,
      refetchOnMount: true,
    }
  );

  const sprints = sprintsData?.data?.data || [];

  const handleAddSprint = () => {
    setEditingSprint(null);
    setIsModalOpen(true);
  };

  const handleEditSprint = (sprint) => {
    setEditingSprint(sprint);
    setIsModalOpen(true);
  };

  const handleViewBurndown = (sprint) => {
    setSelectedSprint(sprint);
  };

  if (selectedSprint) {
    return (
      <BurndownChart
        sprint={selectedSprint}
        workspace={workspace}
        onBack={() => setSelectedSprint(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary-600" />
            Sprints
          </h2>
          <p className="text-gray-600 mt-1">Manage your sprints and iterations</p>
        </div>
        <button
          onClick={handleAddSprint}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Create Sprint
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="">All Sprints</option>
            <option value="planning">Planning</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Sprints List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Failed to load sprints. Please try again.</p>
        </div>
      ) : sprints.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {statusFilter ? 'No matching sprints' : 'No sprints yet'}
          </h3>
          <p className="text-gray-600 mb-4">
            {statusFilter
              ? 'Try adjusting your filter'
              : 'Start by creating your first sprint'}
          </p>
          {!statusFilter && (
            <button
              onClick={handleAddSprint}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2 mx-auto"
            >
              <Plus className="h-4 w-4" />
              Create Sprint
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sprints.map((sprint) => (
            <SprintCard
              key={sprint.id}
              sprint={sprint}
              workspace={workspace}
              onEdit={handleEditSprint}
              onViewBurndown={() => handleViewBurndown(sprint)}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <SprintModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingSprint(null);
          }}
          workspace={workspace}
          sprint={editingSprint}
        />
      )}
    </div>
  );
};

export default SprintsView;
