import React from 'react';
import { useQuery } from 'react-query';
import { ArrowLeft, BarChart3, TrendingDown } from 'lucide-react';
import { pmAPI } from '../../../services/api';

const BurndownChart = ({ sprint, workspace, onBack }) => {
  const { data: burndownData, isLoading } = useQuery(
    ['pm-sprint-burndown', sprint.id],
    () => pmAPI.getSprintBurndown(sprint.id),
    {
      enabled: !!sprint?.id,
    }
  );

  const burndown = burndownData?.data?.data?.burndown || [];
  const totalStoryPoints = burndownData?.data?.data?.total_story_points || 0;

  // Calculate ideal burndown line
  const idealBurndown = burndown.map((point, index) => {
    const days = burndown.length;
    const dailyBurn = totalStoryPoints / days;
    return totalStoryPoints - (dailyBurn * (index + 1));
  });

  // Find max value for scaling
  const maxValue = Math.max(
    totalStoryPoints,
    ...burndown.map(p => p.remaining),
    ...idealBurndown
  );

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary-600" />
              Burndown Chart - {sprint.name}
            </h2>
            <p className="text-gray-600 mt-1">Track sprint progress over time</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : burndown.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <TrendingDown className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No burndown data available</h3>
          <p className="text-gray-600">
            Burndown data will appear once the sprint starts and work is completed.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Total Story Points</p>
              <p className="text-2xl font-bold text-gray-900">{totalStoryPoints.toFixed(1)}</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Completed</p>
              <p className="text-2xl font-bold text-green-600">
                {burndown[burndown.length - 1]?.completed?.toFixed(1) || '0.0'}
              </p>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Remaining</p>
              <p className="text-2xl font-bold text-orange-600">
                {burndown[burndown.length - 1]?.remaining?.toFixed(1) || '0.0'}
              </p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Progress</p>
              <p className="text-2xl font-bold text-blue-600">
                {totalStoryPoints > 0
                  ? Math.round((burndown[burndown.length - 1]?.completed / totalStoryPoints) * 100)
                  : 0}%
              </p>
            </div>
          </div>

          {/* Chart */}
          <div className="relative" style={{ height: '400px' }}>
            <svg width="100%" height="100%" className="overflow-visible">
              {/* Grid lines */}
              {[0, 25, 50, 75, 100].map((percent) => (
                <line
                  key={percent}
                  x1="0"
                  y1={`${percent}%`}
                  x2="100%"
                  y2={`${percent}%`}
                  stroke="#e5e7eb"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
              ))}

              {/* Ideal burndown line */}
              <polyline
                points={burndown.map((point, index) => {
                  const x = (index / (burndown.length - 1)) * 100;
                  const y = 100 - (idealBurndown[index] / maxValue) * 100;
                  return `${x}%,${y}%`;
                }).join(' ')}
                fill="none"
                stroke="#9ca3af"
                strokeWidth="2"
                strokeDasharray="5 5"
              />

              {/* Actual burndown line */}
              <polyline
                points={burndown.map((point, index) => {
                  const x = (index / (burndown.length - 1)) * 100;
                  const y = 100 - (point.remaining / maxValue) * 100;
                  return `${x}%,${y}%`;
                }).join(' ')}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="3"
              />

              {/* Data points */}
              {burndown.map((point, index) => {
                const x = (index / (burndown.length - 1)) * 100;
                const y = 100 - (point.remaining / maxValue) * 100;
                return (
                  <circle
                    key={index}
                    cx={`${x}%`}
                    cy={`${y}%`}
                    r="4"
                    fill="#3b82f6"
                    className="hover:r-6 transition-all"
                  />
                );
              })}
            </svg>

            {/* X-axis labels */}
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              {burndown.map((point, index) => {
                if (index % Math.ceil(burndown.length / 8) === 0 || index === burndown.length - 1) {
                  return (
                    <span key={index}>{formatDate(point.date)}</span>
                  );
                }
                return null;
              })}
            </div>

            {/* Y-axis labels */}
            <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500 pr-2">
              <span>{maxValue.toFixed(1)}</span>
              <span>{(maxValue * 0.75).toFixed(1)}</span>
              <span>{(maxValue * 0.5).toFixed(1)}</span>
              <span>{(maxValue * 0.25).toFixed(1)}</span>
              <span>0</span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-gray-400" style={{ borderTop: '2px dashed #9ca3af' }}></div>
              <span className="text-sm text-gray-600">Ideal Burndown</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-primary-600"></div>
              <span className="text-sm text-gray-600">Actual Burndown</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BurndownChart;
