const { query: dbQuery } = require('../config/database');

/**
 * Log an activity to the pm_activities table
 * @param {Object} activityData - Activity data
 * @param {number} activityData.workspace_id - Workspace ID
 * @param {string} activityData.entity_type - Entity type (user_story, task, epic, sprint)
 * @param {number} activityData.entity_id - Entity ID
 * @param {string} activityData.action - Action type (created, updated, status_changed, assigned, etc.)
 * @param {string|Object} activityData.old_value - Old value (optional)
 * @param {string|Object} activityData.new_value - New value (optional)
 * @param {number} activityData.performed_by - User ID who performed the action
 */
const logActivity = async (activityData) => {
  try {
    const {
      workspace_id,
      entity_type,
      entity_id,
      action,
      old_value = null,
      new_value = null,
      performed_by,
    } = activityData;

    // Validate required fields
    if (!entity_type || !entity_id || !action || !performed_by) {
      console.error('Activity logging failed: Missing required fields', activityData);
      return;
    }

    // Convert objects to JSON strings if needed
    const oldValueStr = old_value ? (typeof old_value === 'object' ? JSON.stringify(old_value) : old_value) : null;
    const newValueStr = new_value ? (typeof new_value === 'object' ? JSON.stringify(new_value) : new_value) : null;

    await dbQuery(
      `INSERT INTO pm_activities 
       (workspace_id, entity_type, entity_id, action, old_value, new_value, performed_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        workspace_id || null,
        entity_type,
        entity_id,
        action,
        oldValueStr,
        newValueStr,
        performed_by,
      ]
    );
  } catch (error) {
    // Don't throw error - activity logging should not break the main flow
    console.error('Error logging activity:', error);
  }
};

/**
 * Helper function to log status changes
 */
const logStatusChange = async (workspaceId, entityType, entityId, oldStatus, newStatus, performedBy) => {
  await logActivity({
    workspace_id: workspaceId,
    entity_type: entityType,
    entity_id: entityId,
    action: 'status_changed',
    old_value: oldStatus,
    new_value: newStatus,
    performed_by: performedBy,
  });
};

/**
 * Helper function to log assignments
 */
const logAssignment = async (workspaceId, entityType, entityId, oldAssignee, newAssignee, performedBy) => {
  await logActivity({
    workspace_id: workspaceId,
    entity_type: entityType,
    entity_id: entityId,
    action: 'assigned',
    old_value: oldAssignee ? String(oldAssignee) : null,
    new_value: newAssignee ? String(newAssignee) : null,
    performed_by: performedBy,
  });
};

/**
 * Helper function to log creation
 */
const logCreation = async (workspaceId, entityType, entityId, performedBy, additionalData = {}) => {
  await logActivity({
    workspace_id: workspaceId,
    entity_type: entityType,
    entity_id: entityId,
    action: 'created',
    new_value: Object.keys(additionalData).length > 0 ? JSON.stringify(additionalData) : null,
    performed_by: performedBy,
  });
};

/**
 * Helper function to log updates
 */
const logUpdate = async (workspaceId, entityType, entityId, changes, performedBy) => {
  await logActivity({
    workspace_id: workspaceId,
    entity_type: entityType,
    entity_id: entityId,
    action: 'updated',
    old_value: JSON.stringify(changes.old || {}),
    new_value: JSON.stringify(changes.new || {}),
    performed_by: performedBy,
  });
};

/**
 * Helper function to log deletion
 */
const logDeletion = async (workspaceId, entityType, entityId, performedBy) => {
  await logActivity({
    workspace_id: workspaceId,
    entity_type: entityType,
    entity_id: entityId,
    action: 'deleted',
    performed_by: performedBy,
  });
};

module.exports = {
  logActivity,
  logStatusChange,
  logAssignment,
  logCreation,
  logUpdate,
  logDeletion,
};
