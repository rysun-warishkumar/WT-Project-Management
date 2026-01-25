import React from 'react';
import { format, isToday, isTomorrow } from 'date-fns';
import { Calendar, AlertTriangle } from 'lucide-react';

const UpcomingDueDates = ({ dueDates }) => {
  const getDueDateColor = (dueDate) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'text-danger-600 bg-danger-50';
    if (diffDays === 0) return 'text-danger-600 bg-danger-50';
    if (diffDays === 1) return 'text-warning-600 bg-warning-50';
    return 'text-gray-600 bg-gray-50';
  };

  const getDueDateText = (dueDate) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'Overdue';
    if (diffDays === 0) return 'Due today';
    if (diffDays === 1) return 'Due tomorrow';
    return `Due in ${diffDays} days`;
  };

  if (!dueDates || dueDates.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No upcoming due dates</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {dueDates.map((item, index) => (
        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${getDueDateColor(item.due_date)}`}>
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{item.reference}</p>
              <p className="text-sm text-gray-600">{item.client_name}</p>
              <p className="text-xs text-gray-500">{item.description}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">
              ${parseFloat(item.amount || 0).toFixed(2)}
            </p>
            <p className={`text-xs ${getDueDateColor(item.due_date).split(' ')[0]}`}>
              {getDueDateText(item.due_date)}
            </p>
            <p className="text-xs text-gray-500">
              {format(new Date(item.due_date), 'MMM dd, yyyy')}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default UpcomingDueDates;
