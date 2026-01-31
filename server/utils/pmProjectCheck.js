/**
 * PM Project availability check.
 * Ensures the project linked to a PM workspace still exists (and is not soft-deleted)
 * before allowing mutations. Use after resolving workspace_id in PM routes.
 */
const { query: dbQuery } = require('../config/database');

const PROJECT_UNAVAILABLE_MESSAGE =
  'This project is no longer available. Contact the administrator.';

/**
 * Check that the project linked to the given PM workspace_id still exists and is available.
 * After soft-delete is implemented, also requires project.deleted_at IS NULL.
 *
 * @param {number} workspaceId - PM workspace id (pm_workspaces.id)
 * @returns {Promise<{ status: number, message: string } | null>}
 *   null if project is available; otherwise { status, message } to send as response.
 */
async function checkProjectAvailable(workspaceId) {
  if (workspaceId == null || workspaceId === '') {
    return { status: 410, message: PROJECT_UNAVAILABLE_MESSAGE };
  }
  const [w] = await dbQuery(
    'SELECT project_id FROM pm_workspaces WHERE id = ?',
    [workspaceId]
  );
  if (!w || w.project_id == null) {
    return { status: 410, message: PROJECT_UNAVAILABLE_MESSAGE };
  }
  // Exclude soft-deleted projects
  const [p] = await dbQuery(
    'SELECT id FROM projects WHERE id = ? AND deleted_at IS NULL',
    [w.project_id]
  );
  if (!p) {
    return { status: 410, message: PROJECT_UNAVAILABLE_MESSAGE };
  }
  return null;
}

module.exports = { checkProjectAvailable, PROJECT_UNAVAILABLE_MESSAGE };
