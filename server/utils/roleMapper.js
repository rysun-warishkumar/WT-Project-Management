/**
 * Role Mapping Utility
 * Maps Client Management System roles to Project Management workspace roles
 * and determines effective permissions
 */

/**
 * Map Client Management role to PM workspace role
 * @param {string} clientManagementRole - Role from Client Management (admin, po, manager, accountant, client, viewer)
 * @returns {string} - PM workspace role (owner, admin, member, viewer)
 */
const mapToWorkspaceRole = (clientManagementRole) => {
  const roleMap = {
    'admin': 'admin',      // Admin in CMS = Admin in PM
    'po': 'admin',         // Project Owner in CMS = Admin in PM
    'manager': 'admin',   // Manager in CMS = Admin in PM
    'accountant': 'member', // Accountant in CMS = Member in PM
    'client': 'member',    // Client in CMS = Member in PM
    'viewer': 'viewer',    // Viewer in CMS = Viewer in PM
  };

  return roleMap[clientManagementRole] || 'member';
};

/**
 * Get effective PM workspace role considering both CMS role and workspace role
 * @param {string} cmsRole - Client Management System role
 * @param {string} workspaceRole - Current workspace role (if assigned)
 * @returns {string} - Effective workspace role
 */
const getEffectiveWorkspaceRole = (cmsRole, workspaceRole = null) => {
  // If workspace role is explicitly set and user is not admin/po, use workspace role
  // But if user is admin/po in CMS, they should be admin in workspace
  if (workspaceRole && !['admin', 'po'].includes(cmsRole)) {
    return workspaceRole;
  }

  // Map CMS role to workspace role
  return mapToWorkspaceRole(cmsRole);
};

/**
 * Check if user has permission based on both CMS role and workspace role
 * @param {Object} user - User object with roles and permissions
 * @param {string} module - Permission module
 * @param {string} action - Permission action
 * @param {string} workspaceRole - Workspace role (optional)
 * @returns {boolean} - True if user has permission
 */
const hasPMPermission = (user, module, action, workspaceRole = null) => {
  // Admin always has all permissions
  if (user.role === 'admin' || user.role_names?.includes('admin')) {
    return true;
  }

  // Check CMS permissions first
  const hasCMSPermission = user.permissions?.some(
    p => p.module === module && p.action === action
  );

  if (hasCMSPermission) {
    // If user has CMS permission, check workspace role restrictions
    if (workspaceRole === 'viewer' && action !== 'view') {
      // Viewers can only view, regardless of CMS permissions
      return false;
    }
    return true;
  }

  // If no CMS permission, check if workspace role allows it
  if (workspaceRole === 'admin' || workspaceRole === 'owner') {
    // Workspace admins/owners have full access within workspace
    return true;
  }

  if (workspaceRole === 'member') {
    // Members can create/edit but not delete
    return action !== 'delete';
  }

  if (workspaceRole === 'viewer') {
    // Viewers can only view
    return action === 'view';
  }

  return false;
};

module.exports = {
  mapToWorkspaceRole,
  getEffectiveWorkspaceRole,
  hasPMPermission,
};
