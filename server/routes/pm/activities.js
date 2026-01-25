const express = require('express');
const { query: validatorQuery } = require('express-validator');
const { authenticateToken, authorizePermission } = require('../../middleware/auth');
const { query: dbQuery } = require('../../config/database');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get activities for a workspace
router.get('/workspace/:workspaceId', authorizePermission('projects', 'view'), async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const userId = req.user.id;
    const { 
      entity_type, 
      entity_id, 
      action, 
      user_id, 
      start_date, 
      end_date,
      limit = 50,
      offset = 0
    } = req.query;

    // Check workspace access
    const [workspaceAccess] = await dbQuery(
      `SELECT wm.role 
       FROM pm_workspace_members wm
       WHERE wm.workspace_id = ? AND wm.user_id = ?
       UNION
       SELECT 'owner' as role
       FROM pm_workspaces w
       WHERE w.id = ? AND w.created_by = ?`,
      [workspaceId, userId, workspaceId, userId]
    );

    if (!workspaceAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have access to this workspace.'
      });
    }

    // Build WHERE clause
    let whereClause = 'WHERE a.workspace_id = ?';
    const whereParams = [workspaceId];

    if (entity_type) {
      whereClause += ' AND a.entity_type = ?';
      whereParams.push(entity_type);
    }

    if (entity_id) {
      whereClause += ' AND a.entity_id = ?';
      whereParams.push(entity_id);
    }

    if (action) {
      whereClause += ' AND a.action = ?';
      whereParams.push(action);
    }

    if (user_id) {
      whereClause += ' AND a.performed_by = ?';
      whereParams.push(user_id);
    }

    if (start_date) {
      whereClause += ' AND DATE(a.created_at) >= ?';
      whereParams.push(start_date);
    }

    if (end_date) {
      whereClause += ' AND DATE(a.created_at) <= ?';
      whereParams.push(end_date);
    }

    // Get activities with user information and entity details
    const activities = await dbQuery(
      `SELECT 
        a.*,
        u.full_name as performed_by_name,
        u.email as performed_by_email,
        CASE 
          WHEN a.entity_type = 'user_story' THEN us.title
          WHEN a.entity_type = 'task' THEN t.title
          WHEN a.entity_type = 'epic' THEN e.name
          WHEN a.entity_type = 'sprint' THEN s.name
          ELSE NULL
        END as entity_title
       FROM pm_activities a
       LEFT JOIN users u ON a.performed_by = u.id
       LEFT JOIN pm_user_stories us ON a.entity_type = 'user_story' AND a.entity_id = us.id
       LEFT JOIN pm_tasks t ON a.entity_type = 'task' AND a.entity_id = t.id
       LEFT JOIN pm_epics e ON a.entity_type = 'epic' AND a.entity_id = e.id
       LEFT JOIN pm_sprints s ON a.entity_type = 'sprint' AND a.entity_id = s.id
       ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT ? OFFSET ?`,
      [...whereParams, parseInt(limit), parseInt(offset)]
    );

    // Get total count for pagination
    const [countResult] = await dbQuery(
      `SELECT COUNT(*) as total
       FROM pm_activities a
       ${whereClause}`,
      whereParams
    );

    res.json({
      success: true,
      data: {
        activities: activities.map(activity => ({
          id: activity.id,
          workspace_id: activity.workspace_id,
          entity_type: activity.entity_type,
          entity_id: activity.entity_id,
          entity_title: activity.entity_title,
          action: activity.action,
          old_value: activity.old_value,
          new_value: activity.new_value,
          performed_by: activity.performed_by,
          performed_by_name: activity.performed_by_name,
          performed_by_email: activity.performed_by_email,
          created_at: activity.created_at
        })),
        total: parseInt(countResult.total),
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch activities'
    });
  }
});

// Get activities for a specific entity
router.get('/entity/:entityType/:entityId', authorizePermission('projects', 'view'), async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const userId = req.user.id;

    // Validate entity type
    if (!['user_story', 'task', 'epic', 'sprint'].includes(entityType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid entity type. Must be one of: user_story, task, epic, sprint'
      });
    }

    // Get workspace_id based on entity type
    let workspaceId;
    if (entityType === 'user_story') {
      const [story] = await dbQuery(
        'SELECT workspace_id FROM pm_user_stories WHERE id = ?',
        [entityId]
      );
      if (!story) {
        return res.status(404).json({
          success: false,
          message: 'User story not found'
        });
      }
      workspaceId = story.workspace_id;
    } else if (entityType === 'task') {
      const [task] = await dbQuery(
        `SELECT us.workspace_id
         FROM pm_tasks t
         JOIN pm_user_stories us ON us.id = t.user_story_id
         WHERE t.id = ?`,
        [entityId]
      );
      if (!task) {
        return res.status(404).json({
          success: false,
          message: 'Task not found'
        });
      }
      workspaceId = task.workspace_id;
    } else if (entityType === 'epic') {
      const [epic] = await dbQuery(
        'SELECT workspace_id FROM pm_epics WHERE id = ?',
        [entityId]
      );
      if (!epic) {
        return res.status(404).json({
          success: false,
          message: 'Epic not found'
        });
      }
      workspaceId = epic.workspace_id;
    } else if (entityType === 'sprint') {
      const [sprint] = await dbQuery(
        'SELECT workspace_id FROM pm_sprints WHERE id = ?',
        [entityId]
      );
      if (!sprint) {
        return res.status(404).json({
          success: false,
          message: 'Sprint not found'
        });
      }
      workspaceId = sprint.workspace_id;
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
      [workspaceId, userId, workspaceId, userId]
    );

    if (!workspaceAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have access to this workspace.'
      });
    }

    // Get activities for this entity
    const activities = await dbQuery(
      `SELECT 
        a.*,
        u.full_name as performed_by_name,
        u.email as performed_by_email
       FROM pm_activities a
       LEFT JOIN users u ON a.performed_by = u.id
       WHERE a.entity_type = ? AND a.entity_id = ?
       ORDER BY a.created_at DESC
       LIMIT 100`,
      [entityType, entityId]
    );

    res.json({
      success: true,
      data: activities.map(activity => ({
        id: activity.id,
        workspace_id: activity.workspace_id,
        entity_type: activity.entity_type,
        entity_id: activity.entity_id,
        action: activity.action,
        old_value: activity.old_value,
        new_value: activity.new_value,
        performed_by: activity.performed_by,
        performed_by_name: activity.performed_by_name,
        performed_by_email: activity.performed_by_email,
        created_at: activity.created_at
      }))
    });
  } catch (error) {
    console.error('Error fetching entity activities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch activities'
    });
  }
});

// Get recent activities for dashboard
router.get('/workspace/:workspaceId/recent', authorizePermission('projects', 'view'), async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const userId = req.user.id;
    const { limit = 10 } = req.query;

    // Check workspace access
    const [workspaceAccess] = await dbQuery(
      `SELECT wm.role 
       FROM pm_workspace_members wm
       WHERE wm.workspace_id = ? AND wm.user_id = ?
       UNION
       SELECT 'owner' as role
       FROM pm_workspaces w
       WHERE w.id = ? AND w.created_by = ?`,
      [workspaceId, userId, workspaceId, userId]
    );

    if (!workspaceAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have access to this workspace.'
      });
    }

    // Get recent activities
    const activities = await dbQuery(
      `SELECT 
        a.*,
        u.full_name as performed_by_name,
        u.email as performed_by_email,
        CASE 
          WHEN a.entity_type = 'user_story' THEN us.title
          WHEN a.entity_type = 'task' THEN t.title
          WHEN a.entity_type = 'epic' THEN e.name
          WHEN a.entity_type = 'sprint' THEN s.name
          ELSE NULL
        END as entity_title
       FROM pm_activities a
       LEFT JOIN users u ON a.performed_by = u.id
       LEFT JOIN pm_user_stories us ON a.entity_type = 'user_story' AND a.entity_id = us.id
       LEFT JOIN pm_tasks t ON a.entity_type = 'task' AND a.entity_id = t.id
       LEFT JOIN pm_epics e ON a.entity_type = 'epic' AND a.entity_id = e.id
       LEFT JOIN pm_sprints s ON a.entity_type = 'sprint' AND a.entity_id = s.id
       WHERE a.workspace_id = ?
       ORDER BY a.created_at DESC
       LIMIT ?`,
      [workspaceId, parseInt(limit)]
    );

    res.json({
      success: true,
      data: activities.map(activity => ({
        id: activity.id,
        workspace_id: activity.workspace_id,
        entity_type: activity.entity_type,
        entity_id: activity.entity_id,
        entity_title: activity.entity_title,
        action: activity.action,
        old_value: activity.old_value,
        new_value: activity.new_value,
        performed_by: activity.performed_by,
        performed_by_name: activity.performed_by_name,
        performed_by_email: activity.performed_by_email,
        created_at: activity.created_at
      }))
    });
  } catch (error) {
    console.error('Error fetching recent activities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent activities'
    });
  }
});

module.exports = router;
