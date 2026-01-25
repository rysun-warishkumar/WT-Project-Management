/**
 * Permission utility functions
 * Used to check user permissions throughout the application
 */

/**
 * Check if user has a specific permission
 * @param {Array} permissions - Array of permission objects with module and action
 * @param {string} module - Module name (e.g., 'clients', 'invoices')
 * @param {string} action - Action name (e.g., 'view', 'create', 'edit', 'delete')
 * @param {string} role - User role (admin always has all permissions)
 * @returns {boolean} - True if user has permission
 */
export const hasPermission = (permissions, module, action, role = null) => {
  // Admin always has all permissions
  if (role === 'admin') {
    return true;
  }

  if (!permissions || !Array.isArray(permissions)) {
    return false;
  }

  return permissions.some(
    perm => perm.module === module && perm.action === action
  );
};

/**
 * Check if user has any of the specified permissions (OR logic)
 * @param {Array} permissions - Array of permission objects
 * @param {Array} permissionList - Array of [module, action] tuples
 * @param {string} role - User role
 * @returns {boolean} - True if user has at least one permission
 */
export const hasAnyPermission = (permissions, permissionList, role = null) => {
  if (role === 'admin') {
    return true;
  }

  if (!permissions || !Array.isArray(permissions) || !permissionList || !Array.isArray(permissionList)) {
    return false;
  }

  return permissionList.some(([module, action]) =>
    hasPermission(permissions, module, action, role)
  );
};

/**
 * Check if user has all of the specified permissions (AND logic)
 * @param {Array} permissions - Array of permission objects
 * @param {Array} permissionList - Array of [module, action] tuples
 * @param {string} role - User role
 * @returns {boolean} - True if user has all permissions
 */
export const hasAllPermissions = (permissions, permissionList, role = null) => {
  if (role === 'admin') {
    return true;
  }

  if (!permissions || !Array.isArray(permissions) || !permissionList || !Array.isArray(permissionList)) {
    return false;
  }

  return permissionList.every(([module, action]) =>
    hasPermission(permissions, module, action, role)
  );
};

/**
 * Get module permissions map for easier checking
 * @param {Array} permissions - Array of permission objects
 * @returns {Object} - Object with module names as keys and arrays of actions as values
 */
export const getModulePermissions = (permissions) => {
  if (!permissions || !Array.isArray(permissions)) {
    return {};
  }

  return permissions.reduce((acc, perm) => {
    if (!acc[perm.module]) {
      acc[perm.module] = [];
    }
    acc[perm.module].push(perm.action);
    return acc;
  }, {});
};

/**
 * Check if user can view a module (has view permission)
 * @param {Array} permissions - Array of permission objects
 * @param {string} module - Module name
 * @param {string} role - User role
 * @returns {boolean} - True if user can view the module
 */
export const canViewModule = (permissions, module, role = null) => {
  return hasPermission(permissions, module, 'view', role);
};

/**
 * Permission requirements for navigation items
 */
export const NAVIGATION_PERMISSIONS = {
  dashboard: { module: 'dashboard', action: 'view' },
  clients: { module: 'clients', action: 'view' },
  projects: { module: 'projects', action: 'view' },
  quotations: { module: 'quotations', action: 'view' },
  invoices: { module: 'invoices', action: 'view' },
  files: { module: 'files', action: 'view' },
  credentials: { module: 'credentials', action: 'view' },
  conversations: { module: 'conversations', action: 'view' },
  users: { module: 'users', action: 'view' },
  roles: { module: 'roles', action: 'view' },
  reports: { module: 'reports', action: 'view' },
  guide: null, // No permission required
  settings: null, // No permission required (users can always access their own settings)
};
