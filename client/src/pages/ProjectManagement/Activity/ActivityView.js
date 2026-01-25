import React from 'react';
import { useParams } from 'react-router-dom';
import ActivityFeed from '../Backlog/ActivityFeed';

const ActivityView = () => {
  const { workspaceId } = useParams();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Activity Feed</h2>
        <p className="text-gray-600">
          Track all activities and changes in this workspace
        </p>
      </div>
      <ActivityFeed workspaceId={parseInt(workspaceId)} />
    </div>
  );
};

export default ActivityView;
