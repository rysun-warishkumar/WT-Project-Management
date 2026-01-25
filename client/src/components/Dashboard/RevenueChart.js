import React from 'react';

const RevenueChart = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">No revenue data available</p>
      </div>
    );
  }

  const maxRevenue = Math.max(...data.map(item => item.revenue || 0));

  return (
    <div className="space-y-4">
      {data.map((item, index) => (
        <div key={index} className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-900">
            {new Date(item.month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </span>
          <div className="flex items-center space-x-2">
            <div className="w-32 bg-gray-200 rounded-full h-2">
              <div
                className="bg-success-600 h-2 rounded-full"
                style={{ width: `${((item.revenue || 0) / maxRevenue) * 100}%` }}
              />
            </div>
            <span className="text-sm text-gray-600 w-16 text-right">
              ${parseFloat(item.revenue || 0).toFixed(0)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default RevenueChart;
