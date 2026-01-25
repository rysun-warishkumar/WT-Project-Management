import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

const StatCard = ({ title, value, subtitle, icon: Icon, color, change, changeType }) => {
  const getColorClasses = (color) => {
    switch (color) {
      case 'primary':
        return {
          bg: 'bg-primary-50',
          text: 'text-primary-600',
          border: 'border-primary-200',
        };
      case 'success':
        return {
          bg: 'bg-success-50',
          text: 'text-success-600',
          border: 'border-success-200',
        };
      case 'warning':
        return {
          bg: 'bg-warning-50',
          text: 'text-warning-600',
          border: 'border-warning-200',
        };
      case 'danger':
        return {
          bg: 'bg-danger-50',
          text: 'text-danger-600',
          border: 'border-danger-200',
        };
      default:
        return {
          bg: 'bg-gray-50',
          text: 'text-gray-600',
          border: 'border-gray-200',
        };
    }
  };

  const colorClasses = getColorClasses(color);

  return (
    <div className="stat-card">
      <div className="stat-card-header">
        <div className="flex items-center">
          <div className={`flex-shrink-0 p-3 rounded-lg ${colorClasses.bg} ${colorClasses.border} border`}>
            <Icon className={`h-6 w-6 ${colorClasses.text}`} />
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="stat-card-label">{title}</dt>
              <dd className="stat-card-value">{typeof value === 'number' ? value.toLocaleString() : value}</dd>
              {subtitle && (
                <dd className="text-sm text-gray-500 mt-1">{subtitle}</dd>
              )}
            </dl>
          </div>
        </div>
        {change && (
          <div className="mt-4">
            <div className={`stat-card-change ${
              changeType === 'positive' ? 'stat-card-change-positive' : 'stat-card-change-negative'
            }`}>
              <div className="flex items-center">
                {changeType === 'positive' ? (
                  <TrendingUp className="h-4 w-4 mr-1" />
                ) : (
                  <TrendingDown className="h-4 w-4 mr-1" />
                )}
                {change}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;
