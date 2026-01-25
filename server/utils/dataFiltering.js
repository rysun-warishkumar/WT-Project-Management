/**
 * Data filtering utilities for role-based access control
 * Ensures client users only see data associated with their client_id
 */

/**
 * Add client filtering to WHERE clause for client role users
 * @param {Object} req - Express request object
 * @param {string} tableAlias - Table alias (e.g., 'c', 'p', 'i')
 * @param {string} clientIdColumn - Column name for client_id (default: 'client_id')
 * @returns {Object} - { whereClause: string, whereParams: array }
 */
const addClientFilter = (req, tableAlias = '', clientIdColumn = 'client_id') => {
  const user = req.user;
  
  // If user is a client role and has a client_id, filter by it
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
 * Check if user can access a specific client's data
 * @param {Object} req - Express request object
 * @param {number} clientId - Client ID to check
 * @returns {boolean} - True if user can access this client's data
 */
const canAccessClientData = (req, clientId) => {
  const user = req.user;
  
  // Admin, PO, Manager, Accountant can access all
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
 * Get client filter for SQL queries
 * @param {Object} req - Express request object
 * @param {string} tableAlias - Table alias
 * @param {string} clientIdColumn - Column name
 * @returns {Object} - { clause: string, params: array }
 */
const getClientFilter = (req, tableAlias = '', clientIdColumn = 'client_id') => {
  return addClientFilter(req, tableAlias, clientIdColumn);
};

module.exports = {
  addClientFilter,
  canAccessClientData,
  getClientFilter
};
