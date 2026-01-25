import React from 'react';

const ProjectStatusChart = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">No project data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data.map((item, index) => (
        <div key={index} className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-900 capitalize">
            {item.status.replace('_', ' ')}
          </span>
          <div className="flex items-center space-x-2">
            <div className="w-32 bg-gray-200 rounded-full h-2">
              <div
                className="bg-primary-600 h-2 rounded-full"
                style={{ width: `${(item.count / Math.max(...data.map(d => d.count))) * 100}%` }}
              />
            </div>
            <span className="text-sm text-gray-600 w-8 text-right">{item.count}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ProjectStatusChart;
