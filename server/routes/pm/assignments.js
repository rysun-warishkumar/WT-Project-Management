const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, authorizePermission } = require('../../middleware/auth');
const { query: dbQuery } = require('../../config/database');
const { checkProjectAvailable } = require('../../utils/pmProjectCheck');
const { logAssignment } = require('../../utils/activityLogger');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get assignable users for a workspace
router.get('/workspace/:workspaceId/users', authorizePermission('projects', 'view'), async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const userId = req.user.id;
    const { search = '' } = req.query;

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

    // Get workspace members
    let whereClause = `WHERE wm.workspace_id = ?`;
    const whereParams = [workspaceId];

    if (search) {
      whereClause += ` AND (u.full_name LIKE ? OR u.email LIKE ? OR u.username LIKE ?)`;
      const searchTerm = `%${search}%`;
      whereParams.push(searchTerm, searchTerm, searchTerm);
    }

    const users = await dbQuery(
      `SELECT DISTINCT
        u.id,
        u.username,
        u.email,
        u.full_name,
        u.avatar,
        wm.role as workspace_role
       FROM pm_workspace_members wm
       INNER JOIN users u ON wm.user_id = u.id
       ${whereClause}
       ORDER BY u.full_name ASC
       LIMIT 50`,
      whereParams
    );

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Error fetching assignable users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch assignable users'
    });
  }
});

// Assign user story
router.post('/user-stories/:id/assign', authorizePermission('projects', 'edit'), [
  body('assignee_id').optional({ nullable: true }).isInt().withMessage('Assignee ID must be a valid integer'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const storyId = req.params.id;
    const userId = req.user.id;
    const { assignee_id } = req.body;

    // Get existing user story
    const [existingStory] = await dbQuery(
      'SELECT * FROM pm_user_stories WHERE id = ?',
      [storyId]
    );

    if (!existingStory) {
      return res.status(404).json({
        success: false,
        message: 'User story not found'
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
      [existingStory.workspace_id, userId, existingStory.workspace_id, userId]
    );

    if (!workspaceAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have access to this workspace.'
      });
    }

    const projectCheck = await checkProjectAvailable(existingStory.workspace_id);
    if (projectCheck) {
      return res.status(projectCheck.status).json({
        success: false,
        message: projectCheck.message
      });
    }

    // Validate assignee is workspace member if provided
    if (assignee_id) {
      const [assigneeCheck] = await dbQuery(
        `SELECT wm.user_id 
         FROM pm_workspace_members wm
         WHERE wm.workspace_id = ? AND wm.user_id = ?
         UNION
         SELECT w.created_by as user_id
         FROM pm_workspaces w
         WHERE w.id = ? AND w.created_by = ?`,
        [existingStory.workspace_id, assignee_id, existingStory.workspace_id, assignee_id]
      );

      if (!assigneeCheck) {
        return res.status(400).json({
          success: false,
          message: 'Assignee must be a workspace member'
        });
      }
    }

    // Update assignment
    await dbQuery(
      'UPDATE pm_user_stories SET assignee_id = ? WHERE id = ?',
      [assignee_id || null, storyId]
    );

    // Log assignment history
    await dbQuery(
      `INSERT INTO pm_assignment_history (entity_type, entity_id, assigned_to, assigned_by)
       VALUES ('user_story', ?, ?, ?)`,
      [storyId, assignee_id || null, userId]
    );

    // Log activity
    await logAssignment(
      existingStory.workspace_id,
      'user_story',
      storyId,
      existingStory.assignee_id,
      assignee_id || null,
      userId
    );

    // Get updated user story
    const [userStory] = await dbQuery(
      `SELECT 
        us.*,
        u.full_name as assignee_name,
        u.email as assignee_email
       FROM pm_user_stories us
       LEFT JOIN users u ON us.assignee_id = u.id
       WHERE us.id = ?`,
      [storyId]
    );

    res.json({
      success: true,
      message: assignee_id ? 'User story assigned successfully' : 'User story unassigned successfully',
      data: userStory
    });
  } catch (error) {
    console.error('Error assigning user story:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign user story'
    });
  }
});

// Assign task
router.post('/tasks/:id/assign', authorizePermission('projects', 'edit'), [
  body('assignee_id').optional({ nullable: true }).isInt().withMessage('Assignee ID must be a valid integer'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const taskId = req.params.id;
    const userId = req.user.id;
    const { assignee_id } = req.body;

    // Get existing task
    const [existingTask] = await dbQuery(
      `SELECT t.*, us.workspace_id
       FROM pm_tasks t
       LEFT JOIN pm_user_stories us ON t.user_story_id = us.id
       WHERE t.id = ?`,
      [taskId]
    );

    if (!existingTask) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
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
      [existingTask.workspace_id, userId, existingTask.workspace_id, userId]
    );

    if (!workspaceAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have access to this workspace.'
      });
    }

    const projectCheck = await checkProjectAvailable(existingTask.workspace_id);
    if (projectCheck) {
      return res.status(projectCheck.status).json({
        success: false,
        message: projectCheck.message
      });
    }

    // Validate assignee is workspace member if provided
    if (assignee_id) {
      const [assigneeCheck] = await dbQuery(
        `SELECT wm.user_id 
         FROM pm_workspace_members wm
         WHERE wm.workspace_id = ? AND wm.user_id = ?
         UNION
         SELECT w.created_by as user_id
         FROM pm_workspaces w
         WHERE w.id = ? AND w.created_by = ?`,
        [existingTask.workspace_id, assignee_id, existingTask.workspace_id, assignee_id]
      );

      if (!assigneeCheck) {
        return res.status(400).json({
          success: false,
          message: 'Assignee must be a workspace member'
        });
      }
    }

    // Update assignment
    await dbQuery(
      'UPDATE pm_tasks SET assignee_id = ? WHERE id = ?',
      [assignee_id || null, taskId]
    );

    // Log assignment history
    await dbQuery(
      `INSERT INTO pm_assignment_history (entity_type, entity_id, assigned_to, assigned_by)
       VALUES ('task', ?, ?, ?)`,
      [taskId, assignee_id || null, userId]
    );

    // Log activity
    await logAssignment(
      existingTask.workspace_id,
      'task',
      taskId,
      existingTask.assignee_id,
      assignee_id || null,
      userId
    );

    // Get updated task
    const [task] = await dbQuery(
      `SELECT 
        t.*,
        u.full_name as assignee_name,
        u.email as assignee_email
       FROM pm_tasks t
       LEFT JOIN users u ON t.assignee_id = u.id
       WHERE t.id = ?`,
      [taskId]
    );

    res.json({
      success: true,
      message: assignee_id ? 'Task assigned successfully' : 'Task unassigned successfully',
      data: task
    });
  } catch (error) {
    console.error('Error assigning task:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign task'
    });
  }
});

// Get assignment history for an entity
router.get('/history/:entityType/:entityId', authorizePermission('projects', 'view'), async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const userId = req.user.id;

    // Validate entity type
    if (!['user_story', 'task'].includes(entityType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid entity type'
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
    } else {
      const [task] = await dbQuery(
        `SELECT us.workspace_id
         FROM pm_tasks t
         LEFT JOIN pm_user_stories us ON t.user_story_id = us.id
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

    // Get assignment history
    const history = await dbQuery(
      `SELECT 
        ah.*,
        u.full_name as assigned_to_name,
        u.email as assigned_to_email,
        u.avatar as assigned_to_avatar,
        assigner.full_name as assigned_by_name,
        assigner.email as assigned_by_email
       FROM pm_assignment_history ah
       LEFT JOIN users u ON ah.assigned_to = u.id
       LEFT JOIN users assigner ON ah.assigned_by = assigner.id
       WHERE ah.entity_type = ? AND ah.entity_id = ?
       ORDER BY ah.assigned_at DESC
       LIMIT 50`,
      [entityType, entityId]
    );

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Error fetching assignment history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch assignment history'
    });
  }
});

module.exports = router;
