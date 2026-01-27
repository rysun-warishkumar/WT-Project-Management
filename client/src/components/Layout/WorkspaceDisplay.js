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
      <div className="flex items-center text-sm text-gray-600">
        <Building2 className="h-4 w-4 mr-1.5 text-gray-500" />
        <span className="font-medium text-gray-700">{workspace.name || 'My Workspace'}</span>
      </div>
    </div>
  );
};

export default WorkspaceDisplay;
