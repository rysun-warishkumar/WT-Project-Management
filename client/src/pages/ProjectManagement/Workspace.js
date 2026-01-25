import React from 'react';
import { useParams, Navigate, Routes, Route } from 'react-router-dom';
import { useQuery } from 'react-query';
import { pmAPI } from '../../services/api';
import PMLayout from './PMLayout';
import BacklogView from './Backlog/BacklogView';
import BoardView from './Board/BoardView';
import SprintsView from './Sprints/SprintsView';
import ReportsView from './Reports/ReportsView';
import SettingsView from './Settings/SettingsView';
import ActivityView from './Activity/ActivityView';

const Workspace = () => {
  const { workspaceId } = useParams();

  // Fetch workspace data
  const {
    data: workspaceData,
    isLoading,
    error,
  } = useQuery(
    ['pm-workspace', workspaceId],
    () => pmAPI.getWorkspaceById(workspaceId),
    {
      enabled: !!workspaceId,
      refetchOnMount: true,
    }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 mb-4">Failed to load workspace</p>
          <button
            onClick={() => window.location.reload()}
            className="btn btn-primary"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const workspace = workspaceData?.data?.data;

  if (!workspace) {
    return <Navigate to="/projects" replace />;
  }

  return (
    <PMLayout workspace={workspace}>
      <Routes>
        <Route path="backlog" element={<BacklogView workspace={workspace} />} />
        <Route path="board" element={<BoardView workspace={workspace} />} />
        <Route path="sprints" element={<SprintsView workspace={workspace} />} />
        <Route path="activity" element={<ActivityView />} />
        <Route path="reports" element={<ReportsView workspace={workspace} />} />
        <Route path="settings" element={<SettingsView workspace={workspace} />} />
        <Route path="*" element={<Navigate to={`/project-management/${workspaceId}/backlog`} replace />} />
      </Routes>
    </PMLayout>
  );
};

export default Workspace;
