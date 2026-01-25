const { query: dbQuery } = require('../config/database');

/**
 * Generate unique reference number for epics
 * Format: EPIC-{workspace_id}-{sequential_number}
 * @param {number} workspaceId - Workspace ID
 * @returns {Promise<string>} Generated reference number
 */
const generateEpicReference = async (workspaceId) => {
  try {
    // Get the highest sequential number for this workspace
    const [result] = await dbQuery(
      `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(reference_number, '-', -1) AS UNSIGNED)), 0) as max_num
       FROM pm_epics
       WHERE workspace_id = ? AND reference_number LIKE ?`,
      [workspaceId, `EPIC-${workspaceId}-%`]
    );

    const nextNum = (result.max_num || 0) + 1;
    const referenceNumber = `EPIC-${workspaceId}-${String(nextNum).padStart(3, '0')}`;

    return referenceNumber;
  } catch (error) {
    console.error('Error generating epic reference:', error);
    throw new Error('Failed to generate epic reference number');
  }
};

/**
 * Generate unique reference number for user stories
 * Format: US-{workspace_id}-{sequential_number}
 * @param {number} workspaceId - Workspace ID
 * @returns {Promise<string>} Generated reference number
 */
const generateUserStoryReference = async (workspaceId) => {
  try {
    // Get the highest sequential number for this workspace
    const [result] = await dbQuery(
      `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(reference_number, '-', -1) AS UNSIGNED)), 0) as max_num
       FROM pm_user_stories
       WHERE workspace_id = ? AND reference_number LIKE ?`,
      [workspaceId, `US-${workspaceId}-%`]
    );

    const nextNum = (result.max_num || 0) + 1;
    const referenceNumber = `US-${workspaceId}-${String(nextNum).padStart(3, '0')}`;

    return referenceNumber;
  } catch (error) {
    console.error('Error generating user story reference:', error);
    throw new Error('Failed to generate user story reference number');
  }
};

/**
 * Generate unique reference number for tasks
 * Format: TASK-{workspace_id}-{sequential_number}
 * @param {number} workspaceId - Workspace ID
 * @returns {Promise<string>} Generated reference number
 */
const generateTaskReference = async (workspaceId) => {
  try {
    // Get the highest sequential number for this workspace
    const [result] = await dbQuery(
      `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(reference_number, '-', -1) AS UNSIGNED)), 0) as max_num
       FROM pm_tasks t
       INNER JOIN pm_user_stories us ON t.user_story_id = us.id
       WHERE us.workspace_id = ? AND t.reference_number LIKE ? AND t.parent_task_id IS NULL`,
      [workspaceId, `TASK-${workspaceId}-%`]
    );

    const nextNum = (result.max_num || 0) + 1;
    const referenceNumber = `TASK-${workspaceId}-${String(nextNum).padStart(3, '0')}`;

    return referenceNumber;
  } catch (error) {
    console.error('Error generating task reference:', error);
    throw new Error('Failed to generate task reference number');
  }
};

/**
 * Generate unique reference number for subtasks
 * Format: TASK-{workspace_id}-{parent_task_number}-{subtask_number}
 * @param {number} workspaceId - Workspace ID
 * @param {number} parentTaskId - Parent task ID
 * @returns {Promise<string>} Generated reference number
 */
const generateSubtaskReference = async (workspaceId, parentTaskId) => {
  try {
    // Get parent task reference number
    const [parentTask] = await dbQuery(
      'SELECT reference_number FROM pm_tasks WHERE id = ?',
      [parentTaskId]
    );

    if (!parentTask || !parentTask.reference_number) {
      throw new Error('Parent task not found or has no reference number');
    }

    // Extract parent task number (last part before subtask number)
    const parentRef = parentTask.reference_number;
    
    // Count existing subtasks for this parent
    const [result] = await dbQuery(
      'SELECT COUNT(*) as count FROM pm_tasks WHERE parent_task_id = ?',
      [parentTaskId]
    );

    const nextSubtaskNum = (result.count || 0) + 1;
    const referenceNumber = `${parentRef}-${nextSubtaskNum}`;

    return referenceNumber;
  } catch (error) {
    console.error('Error generating subtask reference:', error);
    throw new Error('Failed to generate subtask reference number');
  }
};

/**
 * Generate reference number based on entity type
 * @param {string} entityType - 'epic', 'user_story', 'task', 'subtask'
 * @param {number} workspaceId - Workspace ID
 * @param {number} parentTaskId - Optional, required for subtasks
 * @returns {Promise<string>} Generated reference number
 */
const generateReferenceNumber = async (entityType, workspaceId, parentTaskId = null) => {
  switch (entityType.toLowerCase()) {
    case 'epic':
      return await generateEpicReference(workspaceId);
    case 'user_story':
      return await generateUserStoryReference(workspaceId);
    case 'task':
      return await generateTaskReference(workspaceId);
    case 'subtask':
      if (!parentTaskId) {
        throw new Error('Parent task ID is required for subtasks');
      }
      return await generateSubtaskReference(workspaceId, parentTaskId);
    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }
};

/**
 * Validate reference number format
 * @param {string} referenceNumber - Reference number to validate
 * @returns {boolean} True if valid format
 */
const isValidReferenceFormat = (referenceNumber) => {
  if (!referenceNumber || typeof referenceNumber !== 'string') {
    return false;
  }

  // Patterns:
  // EPIC-{workspace_id}-{number}
  // US-{workspace_id}-{number}
  // TASK-{workspace_id}-{number}
  // TASK-{workspace_id}-{number}-{subtask_number}
  const patterns = [
    /^EPIC-\d+-\d{3,}$/,
    /^US-\d+-\d{3,}$/,
    /^TASK-\d+-\d{3,}$/,
    /^TASK-\d+-\d{3,}-\d+$/
  ];

  return patterns.some(pattern => pattern.test(referenceNumber));
};

/**
 * Parse reference number to extract components
 * @param {string} referenceNumber - Reference number to parse
 * @returns {Object} Parsed components {type, workspaceId, number, subtaskNumber}
 */
const parseReferenceNumber = (referenceNumber) => {
  if (!isValidReferenceFormat(referenceNumber)) {
    return null;
  }

  const parts = referenceNumber.split('-');
  
  if (parts[0] === 'EPIC' || parts[0] === 'US') {
    return {
      type: parts[0] === 'EPIC' ? 'epic' : 'user_story',
      workspaceId: parseInt(parts[1]),
      number: parseInt(parts[2]),
      subtaskNumber: null
    };
  } else if (parts[0] === 'TASK') {
    if (parts.length === 3) {
      // Regular task
      return {
        type: 'task',
        workspaceId: parseInt(parts[1]),
        number: parseInt(parts[2]),
        subtaskNumber: null
      };
    } else if (parts.length === 4) {
      // Subtask
      return {
        type: 'subtask',
        workspaceId: parseInt(parts[1]),
        number: parseInt(parts[2]),
        subtaskNumber: parseInt(parts[3])
      };
    }
  }

  return null;
};

module.exports = {
  generateEpicReference,
  generateUserStoryReference,
  generateTaskReference,
  generateSubtaskReference,
  generateReferenceNumber,
  isValidReferenceFormat,
  parseReferenceNumber,
};
