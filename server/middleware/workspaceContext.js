/**
 * Workspace Context Middleware
 * Ensures workspace context is available and validates workspace access
 */

const { query } = require('../config/database');
const { isWorkspaceAccessAllowed } = require('../utils/workspaceUtils');

/**
 * Middleware to ensure workspace context is set
 * Adds workspace filter to request for data isolation
 */
const workspaceContext = async (req, res, next) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Super admin bypasses workspace filtering
    if (user.is_super_admin || user.isSuperAdmin) {
      req.workspaceFilter = null; // No filter for super admin
      req.isSuperAdmin = true;
      return next();
    }

    // Get workspace ID from user or workspace context
    let workspaceId = user.workspace_id || user.workspaceId;

    // If no workspace_id on user, try to get from workspace context
    if (!workspaceId && req.user.workspace) {
      workspaceId = req.user.workspace.id;
    }

    // If still no workspace, try to get from workspace_members
    if (!workspaceId) {
      const memberships = await query(
        `SELECT workspace_id 
         FROM workspace_members 
         WHERE user_id = ? AND status = 'active'
         ORDER BY joined_at DESC
         LIMIT 1`,
        [user.id]
      );

      if (memberships.length > 0) {
        workspaceId = memberships[0].workspace_id;
        // Update user object for future use
        req.user.workspace_id = workspaceId;
        req.user.workspaceId = workspaceId;
      }
    }

    if (!workspaceId) {
      return res.status(403).json({
        success: false,
        message: 'No workspace assigned. Please contact your administrator.'
      });
    }

    // Verify workspace exists, is active, and trial/subscription allows access
    const workspaces = await query(
      'SELECT id, name, status, trial_ends_at, subscription_id FROM workspaces WHERE id = ?',
      [workspaceId]
    );

    if (workspaces.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Workspace not found'
      });
    }

    const workspace = workspaces[0];

    if (workspace.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Workspace is not active'
      });
    }

    const access = isWorkspaceAccessAllowed(workspace);
    if (!access.allowed && access.reason === 'trial_expired') {
      return res.status(403).json({
        success: false,
        message: 'Your free trial has ended. Please upgrade or contact sales to continue.',
        code: 'TRIAL_EXPIRED',
        trial_ends_at: access.trial_ends_at,
      });
    }

    // Add workspace filter to request
    req.workspaceFilter = {
      column: 'workspace_id',
      value: workspaceId
    };
    req.workspaceId = workspaceId;
    req.workspace = workspace;
    req.isSuperAdmin = false;

    next();
  } catch (error) {
    console.error('Workspace context error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to set workspace context'
    });
  }
};

/**
 * Middleware to verify workspace ownership/access
 * Use this for routes that modify workspace-specific data
 */
const verifyWorkspaceAccess = async (req, res, next) => {
  try {
    const user = req.user;

    // Super admin can access any workspace
    if (user.is_super_admin || user.isSuperAdmin) {
      return next();
    }

    // Get workspace ID from request (could be in body, params, or query)
    const requestedWorkspaceId = req.body.workspace_id || 
                                  req.params.workspace_id || 
                                  req.query.workspace_id ||
                                  req.workspaceId;

    if (!requestedWorkspaceId) {
      return res.status(400).json({
        success: false,
        message: 'Workspace ID is required'
      });
    }

    // Verify user has access to this workspace
    const memberships = await query(
      `SELECT wm.workspace_id, wm.role, w.status
       FROM workspace_members wm
       INNER JOIN workspaces w ON wm.workspace_id = w.id
       WHERE wm.user_id = ? AND wm.workspace_id = ? AND wm.status = 'active' AND w.status = 'active'`,
      [user.id, requestedWorkspaceId]
    );

    if (memberships.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have access to this workspace.'
      });
    }

    req.workspaceAccess = {
      workspace_id: requestedWorkspaceId,
      role: memberships[0].role
    };

    next();
  } catch (error) {
    console.error('Workspace access verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify workspace access'
    });
  }
};

module.exports = {
  workspaceContext,
  verifyWorkspaceAccess,
};
