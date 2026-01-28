import React, { useState } from 'react';
import { Building2, ChevronDown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const WorkspaceDisplay = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  // Get workspace info from user object
  const workspace = user?.workspace || (user?.workspace_id ? { id: user.workspace_id, name: user.workspace_name || 'My Workspace' } : null);
  const isSuperAdmin = user?.is_super_admin || user?.isSuperAdmin;

  // Super admin doesn't need workspace display (they see all)
  if (isSuperAdmin) {
    return null;
  }

  // If no workspace, don't display
  if (!workspace) {
    return null;
  }

  return (
    <div className="relative">
      <div className="flex items-center text-xs sm:text-sm text-gray-600">
        {/* Slightly larger icon on small screens for better tap target */}
        <Building2 className="h-5 w-5 sm:h-4 sm:w-4 mr-1.5 text-gray-500" />
        <span className="font-medium text-gray-700 truncate max-w-[120px] sm:max-w-none">
          {workspace.name || 'My Workspace'}
        </span>
      </div>
    </div>
  );
};

export default WorkspaceDisplay;
