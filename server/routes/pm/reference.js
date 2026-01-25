const express = require('express');
const { authenticateToken, authorizePermission } = require('../../middleware/auth');
const { query: dbQuery } = require('../../config/database');
const { parseReferenceNumber, isValidReferenceFormat } = require('../../utils/referenceNumberGenerator');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Lookup entity by reference number
router.get('/:referenceNumber', authorizePermission('projects', 'view'), async (req, res) => {
  try {
    const { referenceNumber } = req.params;
    const userId = req.user.id;

    // Validate reference number format
    if (!isValidReferenceFormat(referenceNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reference number format'
      });
    }

    // Parse reference number
    const parsed = parseReferenceNumber(referenceNumber);
    if (!parsed) {
      return res.status(400).json({
        success: false,
        message: 'Could not parse reference number'
      });
    }

    // Check workspace access
    const [workspaceAccess] = await dbQuery(
      `SELECT wm.role 
       FROM pm_workspace_members wm
       WHERE wm.workspace_id = ? AND wm.user_id = ?
       UNION
       SELECT 'owner' as role
       FROM pm_workspaces w
       WHERE w.id = ? AND w.created_by = ?`,
      [parsed.workspaceId, userId, parsed.workspaceId, userId]
    );

    if (!workspaceAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have access to this workspace.'
      });
    }

    let entity = null;
    let entityType = null;

    // Fetch entity based on type
    if (parsed.type === 'epic') {
      const [epic] = await dbQuery(
        `SELECT 
          e.*,
          u.full_name as created_by_name,
          COUNT(DISTINCT us.id) as story_count,
          COUNT(DISTINCT CASE WHEN us.status = 'done' THEN us.id END) as completed_story_count
         FROM pm_epics e
         LEFT JOIN users u ON e.created_by = u.id
         LEFT JOIN pm_user_stories us ON us.epic_id = e.id
         WHERE e.reference_number = ? AND e.workspace_id = ?
         GROUP BY e.id`,
        [referenceNumber, parsed.workspaceId]
      );
      entity = epic;
      entityType = 'epic';
    } else if (parsed.type === 'user_story') {
      const [story] = await dbQuery(
        `SELECT 
          us.*,
          e.name as epic_name,
          e.color as epic_color,
          s.name as sprint_name,
          u.full_name as assignee_name,
          u.email as assignee_email,
          creator.full_name as created_by_name
         FROM pm_user_stories us
         LEFT JOIN pm_epics e ON us.epic_id = e.id
         LEFT JOIN pm_sprints s ON us.sprint_id = s.id
         LEFT JOIN users u ON us.assignee_id = u.id
         LEFT JOIN users creator ON us.created_by = creator.id
         WHERE us.reference_number = ? AND us.workspace_id = ?`,
        [referenceNumber, parsed.workspaceId]
      );
      entity = story;
      entityType = 'user_story';
    } else if (parsed.type === 'task' || parsed.type === 'subtask') {
      const [task] = await dbQuery(
        `SELECT 
          t.*,
          us.workspace_id,
          us.title as story_title,
          u.full_name as assignee_name,
          u.email as assignee_email,
          creator.full_name as created_by_name
         FROM pm_tasks t
         LEFT JOIN pm_user_stories us ON t.user_story_id = us.id
         LEFT JOIN users u ON t.assignee_id = u.id
         LEFT JOIN users creator ON t.created_by = creator.id
         WHERE t.reference_number = ? AND us.workspace_id = ?`,
        [referenceNumber, parsed.workspaceId]
      );
      entity = task;
      entityType = 'task';
    }

    if (!entity) {
      return res.status(404).json({
        success: false,
        message: 'Entity not found with the given reference number'
      });
    }

    res.json({
      success: true,
      data: {
        entity,
        entityType,
        referenceNumber
      }
    });
  } catch (error) {
    console.error('Error looking up reference number:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to lookup reference number'
    });
  }
});

module.exports = router;
