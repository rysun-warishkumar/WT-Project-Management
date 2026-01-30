/**
 * Workspace Utility Functions
 * Helper functions for workspace operations
 */

const { query } = require('../config/database');

/**
 * Generate a URL-friendly slug from a string
 * @param {string} text - Text to convert to slug
 * @returns {string} - URL-friendly slug
 */
const generateSlug = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')        // Replace spaces with hyphens
    .replace(/[^\w\-]+/g, '')    // Remove non-word chars
    .replace(/\-\-+/g, '-')      // Replace multiple hyphens with single
    .replace(/^-+/, '')          // Trim hyphens from start
    .replace(/-+$/, '');         // Trim hyphens from end
};

/**
 * Generate a unique workspace slug
 * @param {string} workspaceName - Workspace name
 * @returns {Promise<string>} - Unique slug
 */
const generateUniqueSlug = async (workspaceName) => {
  const baseSlug = generateSlug(workspaceName);
  let slug = baseSlug;
  let counter = 1;

  // Check if slug exists
  while (true) {
    const existing = await query(
      'SELECT id FROM workspaces WHERE slug = ?',
      [slug]
    );

    if (existing.length === 0) {
      return slug;
    }

    // Slug exists, append counter
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
};

/**
 * Check if workspace access is allowed (within trial or has active subscription)
 * @param {Object} workspace - Workspace row with trial_ends_at, subscription_id
 * @returns {{ allowed: boolean, reason?: string }} - allowed and optional reason when blocked
 */
const isWorkspaceAccessAllowed = (workspace) => {
  if (!workspace) return { allowed: false, reason: 'no_workspace' };
  // Paid: has subscription_id
  if (workspace.subscription_id) return { allowed: true };
  // No trial set (e.g. legacy workspace): allow for backward compatibility
  if (!workspace.trial_ends_at) return { allowed: true };
  const now = new Date();
  const trialEnd = new Date(workspace.trial_ends_at);
  if (trialEnd > now) return { allowed: true };
  return { allowed: false, reason: 'trial_expired', trial_ends_at: workspace.trial_ends_at };
};

/**
 * Get user's workspace context
 * @param {number} userId - User ID
 * @returns {Promise<Object|null>} - Workspace context or null
 */
const getUserWorkspaceContext = async (userId) => {
  try {
    // Get user's workspace membership
    const memberships = await query(
      `SELECT 
        wm.workspace_id,
        wm.role as workspace_role,
        wm.status as membership_status,
        w.id,
        w.name as workspace_name,
        w.slug as workspace_slug,
        w.owner_id,
        w.plan_type,
        w.status as workspace_status,
        w.trial_ends_at,
        w.subscription_id,
        w.created_at as workspace_created_at
      FROM workspace_members wm
      INNER JOIN workspaces w ON wm.workspace_id = w.id
      WHERE wm.user_id = ? AND wm.status = 'active' AND w.status = 'active'
      ORDER BY wm.joined_at DESC
      LIMIT 1`,
      [userId]
    );

    if (memberships.length === 0) {
      return null;
    }

    return memberships[0];
  } catch (error) {
    console.error('Error getting workspace context:', error);
    return null;
  }
};

/**
 * Get all workspaces for a user (for super admin or multi-workspace users)
 * @param {number} userId - User ID
 * @param {boolean} isSuperAdmin - Is user super admin
 * @returns {Promise<Array>} - Array of workspaces
 */
const getUserWorkspaces = async (userId, isSuperAdmin = false) => {
  try {
    if (isSuperAdmin) {
      // Super admin can see all workspaces
      return await query(
        `SELECT 
          w.id,
          w.name,
          w.slug,
          w.owner_id,
          w.plan_type,
          w.status,
          w.created_at,
          u.username as owner_username,
          u.email as owner_email
        FROM workspaces w
        LEFT JOIN users u ON w.owner_id = u.id
        ORDER BY w.created_at DESC`
      );
    } else {
      // Regular users see only their workspaces
      return await query(
        `SELECT 
          w.id,
          w.name,
          w.slug,
          w.owner_id,
          w.plan_type,
          w.status,
          w.created_at,
          wm.role as user_role,
          wm.status as membership_status
        FROM workspaces w
        INNER JOIN workspace_members wm ON w.id = wm.workspace_id
        WHERE wm.user_id = ? AND wm.status = 'active' AND w.status = 'active'
        ORDER BY wm.joined_at DESC`,
        [userId]
      );
    }
  } catch (error) {
    console.error('Error getting user workspaces:', error);
    return [];
  }
};

module.exports = {
  generateSlug,
  generateUniqueSlug,
  getUserWorkspaceContext,
  getUserWorkspaces,
  isWorkspaceAccessAllowed,
};
