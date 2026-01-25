import { useAuth } from '../contexts/AuthContext';
import { hasPermission, hasAnyPermission, hasAllPermissions, canViewModule } from '../utils/permissions';

/**
 * Custom hook for checking user permissions
 * @returns {Object} - Object with permission checking functions
 */
export const usePermissions = () => {
  const { user } = useAuth();
  const permissions = user?.permissions || [];
  const role = user?.role || null;

  return {
    permissions,
    role,
    hasPermission: (module, action) => hasPermission(permissions, module, action, role),
    hasAnyPermission: (permissionList) => hasAnyPermission(permissions, permissionList, role),
    hasAllPermissions: (permissionList) => hasAllPermissions(permissions, permissionList, role),
    canViewModule: (module) => canViewModule(permissions, module, role),
    isAdmin: role === 'admin',
  };
};
