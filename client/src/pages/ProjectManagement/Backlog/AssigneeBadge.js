import React from 'react';
import { User } from 'lucide-react';

const AssigneeBadge = ({ assignee, size = 'md', showName = false, onClick, className = '' }) => {
  if (!assignee) {
    return (
      <div
        className={`
          inline-flex items-center gap-1.5
          ${size === 'sm' ? 'w-6 h-6' : size === 'md' ? 'w-8 h-8' : 'w-10 h-10'}
          rounded-full bg-gray-200 border-2 border-white
          ${onClick ? 'cursor-pointer hover:bg-gray-300' : ''}
          transition-colors
          ${className}
        `}
        onClick={onClick}
        title="Unassigned"
      >
        <User className={`${size === 'sm' ? 'h-3 w-3' : size === 'md' ? 'h-4 w-4' : 'h-5 w-5'} text-gray-400 mx-auto`} />
      </div>
    );
  }

  // Generate color based on user ID (consistent color per user)
  const getColorFromId = (id) => {
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500',
      'bg-yellow-500', 'bg-indigo-500', 'bg-red-500', 'bg-teal-500',
      'bg-orange-500', 'bg-cyan-500'
    ];
    return colors[id % colors.length];
  };

  const getInitials = (name, email) => {
    if (name) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    }
    if (email) {
      return email.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  const initials = getInitials(assignee.full_name, assignee.email);
  const displayName = assignee.full_name || assignee.email || 'Unknown User';
  const colorClass = getColorFromId(assignee.id);

  return (
    <div
      className={`
        inline-flex items-center gap-2
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      onClick={onClick}
      title={displayName}
    >
      <div
        className={`
          ${size === 'sm' ? 'w-6 h-6 text-xs' : size === 'md' ? 'w-8 h-8 text-sm' : 'w-10 h-10 text-base'}
          rounded-full ${colorClass} text-white
          border-2 border-white
          flex items-center justify-center
          font-semibold
          ${onClick ? 'hover:opacity-80' : ''}
          transition-opacity
          shadow-sm
        `}
      >
        {initials}
      </div>
      {showName && (
        <span className="text-sm text-gray-700 font-medium">
          {displayName}
        </span>
      )}
    </div>
  );
};

export default AssigneeBadge;
