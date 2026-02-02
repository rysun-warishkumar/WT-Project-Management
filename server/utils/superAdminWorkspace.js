/**
 * Get or create the "Super admin workspace" used when super admins create data
 * (clients, projects, etc.) so workspace_id is never null.
 */

const { query } = require('../config/database');

const SUPER_ADMIN_WORKSPACE_SLUG = 'super-admin-workspace';
const SUPER_ADMIN_WORKSPACE_NAME = 'Super admin workspace';

/**
 * Get existing Super admin workspace id, or create it and add the user as owner/member.
 * @param {number} superAdminUserId - The super admin user's id (used as owner_id)
 * @returns {Promise<number>} workspace id
 */
async function getOrCreateSuperAdminWorkspace(superAdminUserId) {
  if (!superAdminUserId) {
    throw new Error('Super admin user id is required');
  }

  // Look up by slug (works with or without active column via COALESCE)
  let rows;
  try {
    rows = await query(
      'SELECT id FROM workspaces WHERE slug = ? AND (COALESCE(active, 1) = 1) LIMIT 1',
      [SUPER_ADMIN_WORKSPACE_SLUG]
    );
  } catch (e) {
    // If active column missing, try without it
    if (e.code === 'ER_BAD_FIELD_ERROR' || (e.message && e.message.includes('active'))) {
      rows = await query('SELECT id FROM workspaces WHERE slug = ? LIMIT 1', [SUPER_ADMIN_WORKSPACE_SLUG]);
    } else {
      throw e;
    }
  }

  if (rows && rows.length > 0) {
    return Number(rows[0].id);
  }

  // Create Super admin workspace
  const insertResult = await query(
    `INSERT INTO workspaces (name, slug, owner_id, plan_type, status, trial_ends_at)
     VALUES (?, ?, ?, 'free', 'active', DATE_ADD(NOW(), INTERVAL 3650 DAY))`,
    [SUPER_ADMIN_WORKSPACE_NAME, SUPER_ADMIN_WORKSPACE_SLUG, superAdminUserId]
  );

  let workspaceId = insertResult && insertResult.insertId != null ? Number(insertResult.insertId) : 0;

  if (workspaceId <= 0) {
    const nextRows = await query(
      'SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM workspaces WHERE id > 0'
    );
    const nextId = nextRows && nextRows[0] ? Number(nextRows[0].next_id) : 1;
    await query(
      'UPDATE workspaces SET id = ? WHERE id = 0 AND slug = ? LIMIT 1',
      [nextId, SUPER_ADMIN_WORKSPACE_SLUG]
    );
    workspaceId = nextId;
  }

  // Add super admin as workspace member (admin)
  try {
    await query(
      `INSERT INTO workspace_members (workspace_id, user_id, role, status, joined_at)
       VALUES (?, ?, 'admin', 'active', NOW())`,
      [workspaceId, superAdminUserId]
    );
  } catch (memberErr) {
    if (memberErr.code !== 'ER_DUP_ENTRY') {
      console.warn('Super admin workspace: could not add member', memberErr.message);
    }
  }

  // Optionally set workspace_id on super admin user for consistency
  try {
    await query('UPDATE users SET workspace_id = ? WHERE id = ? AND (workspace_id IS NULL OR workspace_id = 0)', [
      workspaceId,
      superAdminUserId,
    ]);
  } catch (updateErr) {
    console.warn('Super admin workspace: could not update user workspace_id', updateErr.message);
  }

  return workspaceId;
}

module.exports = {
  getOrCreateSuperAdminWorkspace,
  SUPER_ADMIN_WORKSPACE_SLUG,
  SUPER_ADMIN_WORKSPACE_NAME,
};
