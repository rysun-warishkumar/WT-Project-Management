const express = require('express');
const { body, validationResult, query: validatorQuery } = require('express-validator');
const { authenticateToken, authorizePermission } = require('../../middleware/auth');
const { query: dbQuery } = require('../../config/database');
const { checkProjectAvailable } = require('../../utils/pmProjectCheck');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get time logs for a task
router.get('/task/:taskId', authorizePermission('projects', 'view'), async (req, res) => {
  try {
    const taskId = req.params.taskId;
    const userId = req.user.id;

    // Get task and check workspace access
    const [task] = await dbQuery(
      `SELECT t.*, us.workspace_id
       FROM pm_tasks t
       JOIN pm_user_stories us ON us.id = t.user_story_id
       WHERE t.id = ?`,
      [taskId]
    );

    if (!task) {
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
      [task.workspace_id, userId, task.workspace_id, userId]
    );

    if (!workspaceAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have access to this workspace.'
      });
    }

    // Get time logs
    const timeLogs = await dbQuery(
      `SELECT 
        tl.*,
        u.full_name as user_name,
        u.email as user_email
       FROM pm_time_logs tl
       JOIN users u ON tl.user_id = u.id
       WHERE tl.task_id = ?
       ORDER BY tl.logged_date DESC, tl.created_at DESC`,
      [taskId]
    );

    // Calculate totals
    const totalHours = timeLogs.reduce((sum, log) => sum + parseFloat(log.hours), 0);

    res.json({
      success: true,
      data: {
        time_logs: timeLogs.map(log => ({
          id: log.id,
          task_id: log.task_id,
          user_id: log.user_id,
          user_name: log.user_name,
          user_email: log.user_email,
          hours: parseFloat(log.hours),
          description: log.description,
          logged_date: log.logged_date,
          created_at: log.created_at
        })),
        total_hours: parseFloat(totalHours.toFixed(2)),
        task_estimated_hours: parseFloat(task.estimated_hours) || 0,
        task_logged_hours: parseFloat(task.logged_hours) || 0
      }
    });
  } catch (error) {
    console.error('Error fetching time logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch time logs'
    });
  }
});

// Get time logs for a user story (aggregated from all tasks)
router.get('/user-story/:storyId', authorizePermission('projects', 'view'), async (req, res) => {
  try {
    const storyId = req.params.storyId;
    const userId = req.user.id;

    // Get user story and check workspace access
    const [story] = await dbQuery(
      `SELECT us.*, us.workspace_id
       FROM pm_user_stories us
       WHERE us.id = ?`,
      [storyId]
    );

    if (!story) {
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
      [story.workspace_id, userId, story.workspace_id, userId]
    );

    if (!workspaceAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have access to this workspace.'
      });
    }

    // Get time logs from all tasks in this story
    const timeLogs = await dbQuery(
      `SELECT 
        tl.*,
        t.title as task_title,
        t.id as task_id,
        u.full_name as user_name,
        u.email as user_email
       FROM pm_time_logs tl
       JOIN pm_tasks t ON tl.task_id = t.id
       JOIN users u ON tl.user_id = u.id
       WHERE t.user_story_id = ?
       ORDER BY tl.logged_date DESC, tl.created_at DESC`,
      [storyId]
    );

    // Calculate totals
    const totalHours = timeLogs.reduce((sum, log) => sum + parseFloat(log.hours), 0);

    // Get task totals
    const [taskTotals] = await dbQuery(
      `SELECT 
        COALESCE(SUM(estimated_hours), 0) as total_estimated,
        COALESCE(SUM(logged_hours), 0) as total_logged
       FROM pm_tasks
       WHERE user_story_id = ?`,
      [storyId]
    );

    res.json({
      success: true,
      data: {
        time_logs: timeLogs.map(log => ({
          id: log.id,
          task_id: log.task_id,
          task_title: log.task_title,
          user_id: log.user_id,
          user_name: log.user_name,
          user_email: log.user_email,
          hours: parseFloat(log.hours),
          description: log.description,
          logged_date: log.logged_date,
          created_at: log.created_at
        })),
        total_hours: parseFloat(totalHours.toFixed(2)),
        total_estimated_hours: parseFloat(taskTotals.total_estimated),
        total_logged_hours: parseFloat(taskTotals.total_logged)
      }
    });
  } catch (error) {
    console.error('Error fetching user story time logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch time logs'
    });
  }
});

// Get time logs for a workspace (with filters)
router.get('/workspace/:workspaceId', authorizePermission('projects', 'view'), async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const userId = req.user.id;
    const { start_date, end_date, user_id, task_id } = req.query;

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
    let whereClause = `
      WHERE us.workspace_id = ?
    `;
    const whereParams = [workspaceId];

    if (start_date) {
      whereClause += ' AND tl.logged_date >= ?';
      whereParams.push(start_date);
    }

    if (end_date) {
      whereClause += ' AND tl.logged_date <= ?';
      whereParams.push(end_date);
    }

    if (user_id) {
      whereClause += ' AND tl.user_id = ?';
      whereParams.push(user_id);
    }

    if (task_id) {
      whereClause += ' AND tl.task_id = ?';
      whereParams.push(task_id);
    }

    // Get time logs
    const timeLogs = await dbQuery(
      `SELECT 
        tl.*,
        t.title as task_title,
        t.id as task_id,
        us.title as story_title,
        us.id as story_id,
        u.full_name as user_name,
        u.email as user_email
       FROM pm_time_logs tl
       JOIN pm_tasks t ON tl.task_id = t.id
       JOIN pm_user_stories us ON us.id = t.user_story_id
       JOIN users u ON tl.user_id = u.id
       ${whereClause}
       ORDER BY tl.logged_date DESC, tl.created_at DESC
       LIMIT 500`,
      whereParams
    );

    // Calculate totals
    const totalHours = timeLogs.reduce((sum, log) => sum + parseFloat(log.hours), 0);

    res.json({
      success: true,
      data: {
        time_logs: timeLogs.map(log => ({
          id: log.id,
          task_id: log.task_id,
          task_title: log.task_title,
          story_id: log.story_id,
          story_title: log.story_title,
          user_id: log.user_id,
          user_name: log.user_name,
          user_email: log.user_email,
          hours: parseFloat(log.hours),
          description: log.description,
          logged_date: log.logged_date,
          created_at: log.created_at
        })),
        total_hours: parseFloat(totalHours.toFixed(2)),
        count: timeLogs.length
      }
    });
  } catch (error) {
    console.error('Error fetching workspace time logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch time logs'
    });
  }
});

// Create time log
router.post('/', authorizePermission('projects', 'edit'), [
  body('task_id').isInt().withMessage('Task ID is required'),
  body('hours').isFloat({ min: 0.01 }).withMessage('Hours must be a positive number'),
  body('description').optional().trim(),
  body('logged_date').isISO8601().toDate().withMessage('Logged date must be a valid date'),
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

    const { task_id, hours, description, logged_date } = req.body;
    const userId = req.user.id;

    // Get task and check workspace access
    const [task] = await dbQuery(
      `SELECT t.*, us.workspace_id
       FROM pm_tasks t
       JOIN pm_user_stories us ON us.id = t.user_story_id
       WHERE t.id = ?`,
      [task_id]
    );

    if (!task) {
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
      [task.workspace_id, userId, task.workspace_id, userId]
    );

    if (!workspaceAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have access to this workspace.'
      });
    }

    const projectCheck = await checkProjectAvailable(task.workspace_id);
    if (projectCheck) {
      return res.status(projectCheck.status).json({
        success: false,
        message: projectCheck.message
      });
    }

    // Create time log
    const result = await dbQuery(
      `INSERT INTO pm_time_logs (task_id, user_id, hours, description, logged_date)
       VALUES (?, ?, ?, ?, ?)`,
      [
        task_id,
        userId,
        parseFloat(hours),
        description || null,
        logged_date || new Date().toISOString().split('T')[0]
      ]
    );

    const timeLogId = result.insertId;

    // Get created time log
    const [timeLog] = await dbQuery(
      `SELECT 
        tl.*,
        u.full_name as user_name,
        u.email as user_email
       FROM pm_time_logs tl
       JOIN users u ON tl.user_id = u.id
       WHERE tl.id = ?`,
      [timeLogId]
    );

    // Get updated task (logged_hours should be updated by trigger)
    const [updatedTask] = await dbQuery(
      'SELECT * FROM pm_tasks WHERE id = ?',
      [task_id]
    );

    res.status(201).json({
      success: true,
      message: 'Time logged successfully',
      data: {
        ...timeLog,
        hours: parseFloat(timeLog.hours),
        user_name: timeLog.user_name,
        user_email: timeLog.user_email,
        task_logged_hours: parseFloat(updatedTask.logged_hours) || 0
      }
    });
  } catch (error) {
    console.error('Error creating time log:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to log time'
    });
  }
});

// Update time log
router.put('/:id', authorizePermission('projects', 'edit'), [
  body('hours').optional().isFloat({ min: 0.01 }).withMessage('Hours must be a positive number'),
  body('description').optional().trim(),
  body('logged_date').optional().isISO8601().toDate().withMessage('Logged date must be a valid date'),
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

    const timeLogId = req.params.id;
    const userId = req.user.id;
    const { hours, description, logged_date } = req.body;

    // Get time log and check access
    const [timeLog] = await dbQuery(
      `SELECT tl.*, t.user_story_id, us.workspace_id
       FROM pm_time_logs tl
       JOIN pm_tasks t ON tl.task_id = t.id
       JOIN pm_user_stories us ON us.id = t.user_story_id
       WHERE tl.id = ?`,
      [timeLogId]
    );

    if (!timeLog) {
      return res.status(404).json({
        success: false,
        message: 'Time log not found'
      });
    }

    // Check if user owns the log or has workspace access
    const [workspaceAccess] = await dbQuery(
      `SELECT wm.role 
       FROM pm_workspace_members wm
       WHERE wm.workspace_id = ? AND wm.user_id = ?
       UNION
       SELECT 'owner' as role
       FROM pm_workspaces w
       WHERE w.id = ? AND w.created_by = ?`,
      [timeLog.workspace_id, userId, timeLog.workspace_id, userId]
    );

    if (!workspaceAccess && timeLog.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only edit your own time logs or need workspace admin access.'
      });
    }

    // Build update query
    const updateFields = [];
    const updateValues = [];

    if (hours !== undefined) {
      updateFields.push('hours = ?');
      updateValues.push(parseFloat(hours));
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description || null);
    }
    if (logged_date) {
      updateFields.push('logged_date = ?');
      updateValues.push(logged_date);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updateValues.push(timeLogId);

    await dbQuery(
      `UPDATE pm_time_logs 
       SET ${updateFields.join(', ')}
       WHERE id = ?`,
      updateValues
    );

    // Get updated time log
    const [updatedLog] = await dbQuery(
      `SELECT 
        tl.*,
        u.full_name as user_name,
        u.email as user_email
       FROM pm_time_logs tl
       JOIN users u ON tl.user_id = u.id
       WHERE tl.id = ?`,
      [timeLogId]
    );

    res.json({
      success: true,
      message: 'Time log updated successfully',
      data: {
        ...updatedLog,
        hours: parseFloat(updatedLog.hours),
        user_name: updatedLog.user_name,
        user_email: updatedLog.user_email
      }
    });
  } catch (error) {
    console.error('Error updating time log:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update time log'
    });
  }
});

// Delete time log
router.delete('/:id', authorizePermission('projects', 'edit'), async (req, res) => {
  try {
    const timeLogId = req.params.id;
    const userId = req.user.id;

    // Get time log and check access
    const [timeLog] = await dbQuery(
      `SELECT tl.*, t.user_story_id, us.workspace_id
       FROM pm_time_logs tl
       JOIN pm_tasks t ON tl.task_id = t.id
       JOIN pm_user_stories us ON us.id = t.user_story_id
       WHERE tl.id = ?`,
      [timeLogId]
    );

    if (!timeLog) {
      return res.status(404).json({
        success: false,
        message: 'Time log not found'
      });
    }

    // Check if user owns the log or has workspace admin access
    const [workspaceAccess] = await dbQuery(
      `SELECT wm.role 
       FROM pm_workspace_members wm
       WHERE wm.workspace_id = ? AND wm.user_id = ? AND wm.role IN ('owner', 'admin')
       UNION
       SELECT 'owner' as role
       FROM pm_workspaces w
       WHERE w.id = ? AND w.created_by = ?`,
      [timeLog.workspace_id, userId, timeLog.workspace_id, userId]
    );

    if (!workspaceAccess && timeLog.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only delete your own time logs or need workspace admin access.'
      });
    }

    const projectCheck = await checkProjectAvailable(timeLog.workspace_id);
    if (projectCheck) {
      return res.status(projectCheck.status).json({
        success: false,
        message: projectCheck.message
      });
    }

    // Delete time log
    await dbQuery('DELETE FROM pm_time_logs WHERE id = ?', [timeLogId]);

    res.json({
      success: true,
      message: 'Time log deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting time log:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete time log'
    });
  }
});

module.exports = router;
