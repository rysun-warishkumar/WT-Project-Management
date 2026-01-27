/**
 * Data filtering utilities for role-based access control
 * Ensures users only see data associated with their workspace
 * Legacy: Also supports client_id filtering for backward compatibility
 */

/**
 * Add workspace filtering to WHERE clause
 * @param {Object} req - Express request object
 * @param {string} tableAlias - Table alias (e.g., 'c', 'p', 'i')
 * @param {string} workspaceIdColumn - Column name for workspace_id (default: 'workspace_id')
 * @returns {Object} - { whereClause: string, whereParams: array }
 */
const addWorkspaceFilter = (req, tableAlias = '', workspaceIdColumn = 'workspace_id') => {
  const user = req.user;
  
  // Super admin sees all data (no filter)
  if (user && (user.is_super_admin || user.isSuperAdmin)) {
    return { whereClause: '', whereParams: [] };
  }
  
  // Get workspace ID from request context or user
  const workspaceId = req.workspaceId || req.workspaceFilter?.value || user.workspace_id || user.workspaceId;
  
  if (workspaceId) {
    const column = tableAlias ? `${tableAlias}.${workspaceIdColumn}` : workspaceIdColumn;
    return {
      whereClause: ` AND ${column} = ?`,
      whereParams: [workspaceId]
    };
  }

  // No workspace assigned - return empty (will cause no results)
  return { whereClause: ' AND 1=0', whereParams: [] };
};

/**
 * Add client filtering to WHERE clause for client role users (legacy support)
 * @param {Object} req - Express request object
 * @param {string} tableAlias - Table alias (e.g., 'c', 'p', 'i')
 * @param {string} clientIdColumn - Column name for client_id (default: 'client_id')
 * @returns {Object} - { whereClause: string, whereParams: array }
 */
const addClientFilter = (req, tableAlias = '', clientIdColumn = 'client_id') => {
  const user = req.user;
  
  // If user is a client role and has a client_id, filter by it (legacy support)
  if (user && user.role === 'client' && user.client_id) {
    const column = tableAlias ? `${tableAlias}.${clientIdColumn}` : clientIdColumn;
    return {
      whereClause: ` AND ${column} = ?`,
      whereParams: [user.client_id]
    };
  }

  return { whereClause: '', whereParams: [] };
};

/**
 * Check if user can access a specific workspace's data
 * @param {Object} req - Express request object
 * @param {number} workspaceId - Workspace ID to check
 * @returns {boolean} - True if user can access this workspace's data
 */
const canAccessWorkspaceData = (req, workspaceId) => {
  const user = req.user;
  
  // Super admin can access all workspaces
  if (user && (user.is_super_admin || user.isSuperAdmin)) {
    return true;
  }
  
  // Regular users can only access their own workspace
  const userWorkspaceId = req.workspaceId || req.workspaceFilter?.value || user.workspace_id || user.workspaceId;
  if (userWorkspaceId) {
    return parseInt(userWorkspaceId) === parseInt(workspaceId);
  }
  
  return false;
};

/**
 * Check if user can access a specific client's data (legacy support)
 * @param {Object} req - Express request object
 * @param {number} clientId - Client ID to check
 * @returns {boolean} - True if user can access this client's data
 */
const canAccessClientData = (req, clientId) => {
  const user = req.user;
  
  // Super admin can access all
  if (user && (user.is_super_admin || user.isSuperAdmin)) {
    return true;
  }
  
  // Admin, PO, Manager, Accountant can access all (legacy)
  if (user && ['admin', 'po', 'manager', 'accountant'].includes(user.role)) {
    return true;
  }
  
  // Client users can only access their own data
  if (user && user.role === 'client' && user.client_id) {
    return parseInt(user.client_id) === parseInt(clientId);
  }
  
  // Viewer role - check permissions
  // For now, viewers can see all (but this can be restricted based on permissions)
  return true;
};

/**
 * Get workspace filter for SQL queries (primary method)
 * @param {Object} req - Express request object
 * @param {string} tableAlias - Table alias
 * @param {string} workspaceIdColumn - Column name (default: 'workspace_id')
 * @returns {Object} - { whereClause: string, whereParams: array }
 */
const getWorkspaceFilter = (req, tableAlias = '', workspaceIdColumn = 'workspace_id') => {
  return addWorkspaceFilter(req, tableAlias, workspaceIdColumn);
};

/**
 * Get client filter for SQL queries (legacy support)
 * @param {Object} req - Express request object
 * @param {string} tableAlias - Table alias
 * @param {string} clientIdColumn - Column name
 * @returns {Object} - { clause: string, params: array }
 */
const getClientFilter = (req, tableAlias = '', clientIdColumn = 'client_id') => {
  return addClientFilter(req, tableAlias, clientIdColumn);
};

module.exports = {
  addWorkspaceFilter,
  addClientFilter,
  canAccessWorkspaceData,
  canAccessClientData,
  getWorkspaceFilter,
  getClientFilter
};
