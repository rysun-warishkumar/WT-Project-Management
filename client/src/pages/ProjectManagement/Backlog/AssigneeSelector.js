import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from 'react-query';
import { X, Search, User, Check } from 'lucide-react';
import { pmAPI } from '../../../services/api';
import AssigneeBadge from './AssigneeBadge';

const AssigneeSelector = ({ 
  workspaceId, 
  currentAssignee, 
  onSelect, 
  entityType = 'user_story',
  entityId = null,
  size = 'md',
  showName = false,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 'auto', right: 'auto', left: 'auto', bottom: 'auto' });

  // Fetch assignable users
  const { data: usersData, isLoading } = useQuery(
    ['pm-assignable-users', workspaceId, searchTerm],
    () => pmAPI.getAssignableUsers(workspaceId, searchTerm),
    {
      enabled: isOpen && !!workspaceId,
      debounce: 300,
    }
  );

  const users = usersData?.data?.data || [];

  // Calculate dropdown position to stay within viewport
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const dropdownWidth = 256; // w-64 = 256px
      const dropdownHeight = 400; // approximate max height
      
      let position = {};

      // Horizontal positioning - use fixed positioning relative to viewport
      const spaceRight = viewportWidth - triggerRect.right;
      const spaceLeft = triggerRect.left;
      
      if (spaceRight >= dropdownWidth) {
        // Open to the right (default)
        position.left = `${triggerRect.right + 8}px`;
        position.right = 'auto';
      } else if (spaceLeft >= dropdownWidth) {
        // Open to the left
        position.right = `${viewportWidth - triggerRect.left + 8}px`;
        position.left = 'auto';
      } else {
        // Center horizontally if neither side has enough space
        position.left = `${Math.max(8, triggerRect.left - (dropdownWidth / 2))}px`;
        position.right = 'auto';
      }

      // Vertical positioning
      const spaceBelow = viewportHeight - triggerRect.bottom;
      const spaceAbove = triggerRect.top;
      
      if (spaceBelow >= dropdownHeight) {
        // Open below (default)
        position.top = `${triggerRect.bottom + 8}px`;
        position.bottom = 'auto';
      } else if (spaceAbove >= dropdownHeight) {
        // Open above
        position.bottom = `${viewportHeight - triggerRect.top + 8}px`;
        position.top = 'auto';
      } else {
        // If neither has enough space, prefer below but constrain height
        position.top = `${triggerRect.bottom + 8}px`;
        position.bottom = 'auto';
        position.maxHeight = `${Math.max(200, Math.min(dropdownHeight, spaceBelow - 20))}px`;
      }

      setDropdownPosition(position);
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
          triggerRef.current && !triggerRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (user) => {
    onSelect(user ? user.id : null);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleUnassign = () => {
    handleSelect(null);
  };

  return (
    <div className={`relative ${className}`}>
      {/* Current Assignee Display */}
      <div ref={triggerRef} onClick={() => setIsOpen(!isOpen)}>
        <AssigneeBadge
          assignee={currentAssignee}
          size={size}
          showName={showName}
          onClick={() => setIsOpen(!isOpen)}
        />
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div 
          ref={dropdownRef}
          className="fixed z-50 w-64 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden"
          style={{
            ...dropdownPosition,
            maxHeight: dropdownPosition.maxHeight || '400px'
          }}
        >
          {/* Header */}
          <div className="p-3 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-900">Assign To</h4>
              <button
                onClick={() => {
                  setIsOpen(false);
                  setSearchTerm('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search users..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                autoFocus
              />
            </div>
          </div>

          {/* Options */}
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(400px - 120px)' }}>
            {/* Unassign Option */}
            <button
              onClick={handleUnassign}
              className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors flex items-center gap-2 border-b border-gray-100"
            >
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                <X className="h-4 w-4 text-gray-500" />
              </div>
              <span className="text-sm text-gray-700 font-medium">Unassign</span>
            </button>

            {/* Assign to Me */}
            {currentAssignee && (
              <button
                onClick={() => {
                  // Get current user from context/localStorage if needed
                  // For now, just close
                  setIsOpen(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors flex items-center gap-2 border-b border-gray-100"
              >
                <User className="h-4 w-4 text-primary-600" />
                <span className="text-sm text-gray-700">Assign to me</span>
              </button>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
              </div>
            )}

            {/* Users List */}
            {!isLoading && users.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                {searchTerm ? 'No users found' : 'No workspace members'}
              </div>
            )}

            {!isLoading && users.map((user) => (
              <button
                key={user.id}
                onClick={() => handleSelect(user)}
                className={`
                  w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors
                  flex items-center gap-3
                  ${currentAssignee?.id === user.id ? 'bg-primary-50' : ''}
                `}
              >
                <AssigneeBadge assignee={user} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user.full_name || user.email}
                  </p>
                  {user.email && user.full_name && (
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  )}
                </div>
                {currentAssignee?.id === user.id && (
                  <Check className="h-4 w-4 text-primary-600 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AssigneeSelector;
