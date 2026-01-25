const express = require('express');
const { body, validationResult, query: validatorQuery } = require('express-validator');
const { authenticateToken, authorizePermission } = require('../../middleware/auth');
const { query: dbQuery } = require('../../config/database');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get all sprints for a workspace
router.get('/workspace/:workspaceId', authorizePermission('projects', 'view'), async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const { status } = req.query;
    const userId = req.user.id;

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
    let whereClause = 'WHERE s.workspace_id = ?';
    const whereParams = [workspaceId];

    if (status) {
      whereClause += ' AND s.status = ?';
      whereParams.push(status);
    }

    // Get sprints with statistics
    const sprints = await dbQuery(
      `SELECT 
        s.*,
        creator.full_name as created_by_name,
        COUNT(DISTINCT us.id) as user_story_count,
        COALESCE(SUM(us.story_points), 0) as committed_story_points,
        COUNT(DISTINCT CASE WHEN us.status = 'done' THEN us.id END) as completed_story_count,
        COALESCE(SUM(CASE WHEN us.status = 'done' THEN us.story_points ELSE 0 END), 0) as completed_story_points
       FROM pm_sprints s
       LEFT JOIN users creator ON s.created_by = creator.id
       LEFT JOIN pm_user_stories us ON s.id = us.sprint_id
       ${whereClause}
       GROUP BY s.id
       ORDER BY s.start_date DESC, s.created_at DESC`,
      whereParams
    );

    res.json({
      success: true,
      data: sprints
    });
  } catch (error) {
    console.error('Error fetching sprints:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sprints'
    });
  }
});

// Get sprint by ID with details
router.get('/:id', authorizePermission('projects', 'view'), async (req, res) => {
  try {
    const sprintId = req.params.id;
    const userId = req.user.id;

    // Get sprint
    const [sprint] = await dbQuery(
      `SELECT 
        s.*,
        creator.full_name as created_by_name
       FROM pm_sprints s
       LEFT JOIN users creator ON s.created_by = creator.id
       WHERE s.id = ?`,
      [sprintId]
    );

    if (!sprint) {
      return res.status(404).json({
        success: false,
        message: 'Sprint not found'
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
      [sprint.workspace_id, userId, sprint.workspace_id, userId]
    );

    if (!workspaceAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have access to this sprint.'
      });
    }

    // Get user stories in this sprint
    const userStories = await dbQuery(
      `SELECT 
        us.*,
        e.name as epic_name,
        e.color as epic_color,
        u.full_name as assignee_name
       FROM pm_user_stories us
       LEFT JOIN pm_epics e ON us.epic_id = e.id
       LEFT JOIN users u ON us.assignee_id = u.id
       WHERE us.sprint_id = ?
       ORDER BY 
         CASE us.priority
           WHEN 'critical' THEN 1
           WHEN 'high' THEN 2
           WHEN 'medium' THEN 3
           ELSE 4
         END,
         us.created_at`,
      [sprintId]
    );

    sprint.user_stories = userStories;

    // Calculate statistics
    const totalStoryPoints = userStories.reduce((sum, us) => sum + (parseFloat(us.story_points) || 0), 0);
    const completedStoryPoints = userStories
      .filter(us => us.status === 'done')
      .reduce((sum, us) => sum + (parseFloat(us.story_points) || 0), 0);

    sprint.total_story_points = totalStoryPoints;
    sprint.completed_story_points = completedStoryPoints;
    sprint.remaining_story_points = totalStoryPoints - completedStoryPoints;

    res.json({
      success: true,
      data: sprint
    });
  } catch (error) {
    console.error('Error fetching sprint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sprint'
    });
  }
});

// Get sprint burndown data
router.get('/:id/burndown', authorizePermission('projects', 'view'), async (req, res) => {
  try {
    const sprintId = req.params.id;
    const userId = req.user.id;

    // Get sprint
    const [sprint] = await dbQuery(
      'SELECT * FROM pm_sprints WHERE id = ?',
      [sprintId]
    );

    if (!sprint) {
      return res.status(404).json({
        success: false,
        message: 'Sprint not found'
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
      [sprint.workspace_id, userId, sprint.workspace_id, userId]
    );

    if (!workspaceAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied.'
      });
    }

    // Get total story points committed
    const [totalPoints] = await dbQuery(
      `SELECT COALESCE(SUM(story_points), 0) as total
       FROM pm_user_stories
       WHERE sprint_id = ?`,
      [sprintId]
    );

    const totalStoryPoints = parseFloat(totalPoints.total) || 0;

    // Generate burndown data (daily progress)
    const startDate = new Date(sprint.start_date);
    const endDate = new Date(sprint.end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const burndownData = [];
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      
      // Get completed story points up to this date
      const [completed] = await dbQuery(
        `SELECT COALESCE(SUM(story_points), 0) as completed
         FROM pm_user_stories
         WHERE sprint_id = ? 
         AND status = 'done'
         AND DATE(updated_at) <= ?`,
        [sprintId, dateStr]
      );

      const completedPoints = parseFloat(completed.completed) || 0;
      const remainingPoints = totalStoryPoints - completedPoints;

      burndownData.push({
        date: dateStr,
        remaining: remainingPoints,
        completed: completedPoints,
        total: totalStoryPoints
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    res.json({
      success: true,
      data: {
        sprint,
        burndown: burndownData,
        total_story_points: totalStoryPoints
      }
    });
  } catch (error) {
    console.error('Error fetching burndown:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch burndown data'
    });
  }
});

// Create sprint
router.post('/', authorizePermission('projects', 'create'), [
  body('workspace_id').isInt().withMessage('Workspace ID is required'),
  body('name').trim().notEmpty().withMessage('Sprint name is required'),
  body('start_date').isISO8601().withMessage('Start date is required and must be a valid date'),
  body('end_date').isISO8601().withMessage('End date is required and must be a valid date'),
  body('capacity').optional({ nullable: true, checkFalsy: true }).custom((value) => {
    if (value === null || value === '' || value === undefined) return true;
    const numValue = parseFloat(value);
    return !isNaN(numValue) && numValue >= 0;
  }).withMessage('Capacity must be a non-negative number'),
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

    const {
      workspace_id,
      name,
      goal,
      start_date,
      end_date,
      capacity
    } = req.body;
    const userId = req.user.id;

    // Validate dates
    const start = new Date(start_date);
    const end = new Date(end_date);
    
    if (start >= end) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date'
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
      [workspace_id, userId, workspace_id, userId]
    );

    if (!workspaceAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have access to this workspace.'
      });
    }

    // Check for overlapping active sprints
    const [overlapping] = await dbQuery(
      `SELECT id FROM pm_sprints 
       WHERE workspace_id = ? 
       AND status IN ('planning', 'active')
       AND (
         (start_date <= ? AND end_date >= ?) OR
         (start_date <= ? AND end_date >= ?) OR
         (start_date >= ? AND end_date <= ?)
       )`,
      [workspace_id, start_date, start_date, end_date, end_date, start_date, end_date]
    );

    if (overlapping) {
      return res.status(400).json({
        success: false,
        message: 'A sprint already exists for this date range'
      });
    }

    // Create sprint
    const result = await dbQuery(
      `INSERT INTO pm_sprints 
       (workspace_id, name, goal, start_date, end_date, capacity, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 'planning', ?)`,
      [
        workspace_id,
        name,
        goal || null,
        start_date,
        end_date,
        capacity ? parseFloat(capacity) : null,
        userId
      ]
    );

    const sprintId = result.insertId;

    // Get created sprint
    const [sprint] = await dbQuery(
      `SELECT 
        s.*,
        creator.full_name as created_by_name
       FROM pm_sprints s
       LEFT JOIN users creator ON s.created_by = creator.id
       WHERE s.id = ?`,
      [sprintId]
    );

    // Log activity
    await dbQuery(
      `INSERT INTO pm_activities (workspace_id, entity_type, entity_id, action, performed_by)
       VALUES (?, 'sprint', ?, 'created', ?)`,
      [workspace_id, sprintId, userId]
    );

    res.status(201).json({
      success: true,
      message: 'Sprint created successfully',
      data: sprint
    });
  } catch (error) {
    console.error('Error creating sprint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create sprint'
    });
  }
});

// Update sprint
router.put('/:id', authorizePermission('projects', 'edit'), [
  body('name').optional().trim().notEmpty().withMessage('Sprint name cannot be empty'),
  body('start_date').optional().isISO8601().withMessage('Start date must be a valid date'),
  body('end_date').optional().isISO8601().withMessage('End date must be a valid date'),
  body('capacity').optional({ nullable: true, checkFalsy: true }).custom((value) => {
    if (value === null || value === '' || value === undefined) return true;
    const numValue = parseFloat(value);
    return !isNaN(numValue) && numValue >= 0;
  }).withMessage('Capacity must be a non-negative number'),
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

    const sprintId = req.params.id;
    const userId = req.user.id;
    const { name, goal, start_date, end_date, capacity, status } = req.body;

    // Get existing sprint
    const [existingSprint] = await dbQuery(
      'SELECT * FROM pm_sprints WHERE id = ?',
      [sprintId]
    );

    if (!existingSprint) {
      return res.status(404).json({
        success: false,
        message: 'Sprint not found'
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
      [existingSprint.workspace_id, userId, existingSprint.workspace_id, userId]
    );

    if (!workspaceAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have access to this sprint.'
      });
    }

    // Validate dates if provided
    if (start_date && end_date) {
      const start = new Date(start_date);
      const end = new Date(end_date);
      
      if (start >= end) {
        return res.status(400).json({
          success: false,
          message: 'End date must be after start date'
        });
      }
    }

    // Build update query
    const updateFields = [];
    const updateValues = [];

    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    if (goal !== undefined) {
      updateFields.push('goal = ?');
      updateValues.push(goal);
    }
    if (start_date !== undefined) {
      updateFields.push('start_date = ?');
      updateValues.push(start_date);
    }
    if (end_date !== undefined) {
      updateFields.push('end_date = ?');
      updateValues.push(end_date);
    }
    if (capacity !== undefined) {
      updateFields.push('capacity = ?');
      updateValues.push(capacity ? parseFloat(capacity) : null);
    }
    if (status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(status);
      
      // Update velocity when sprint is completed
      if (status === 'completed') {
        const [completedPoints] = await dbQuery(
          `SELECT COALESCE(SUM(story_points), 0) as total
           FROM pm_user_stories
           WHERE sprint_id = ? AND status = 'done'`,
          [sprintId]
        );
        updateFields.push('velocity = ?');
        updateValues.push(parseFloat(completedPoints.total) || 0);
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updateValues.push(sprintId);
    await dbQuery(
      `UPDATE pm_sprints 
       SET ${updateFields.join(', ')}
       WHERE id = ?`,
      updateValues
    );

    // Get updated sprint
    const [sprint] = await dbQuery(
      `SELECT 
        s.*,
        creator.full_name as created_by_name
       FROM pm_sprints s
       LEFT JOIN users creator ON s.created_by = creator.id
       WHERE s.id = ?`,
      [sprintId]
    );

    // Log activity
    await dbQuery(
      `INSERT INTO pm_activities (workspace_id, entity_type, entity_id, action, performed_by)
       VALUES (?, 'sprint', ?, 'updated', ?)`,
      [existingSprint.workspace_id, sprintId, userId]
    );

    res.json({
      success: true,
      message: 'Sprint updated successfully',
      data: sprint
    });
  } catch (error) {
    console.error('Error updating sprint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update sprint'
    });
  }
});

// Delete sprint
router.delete('/:id', authorizePermission('projects', 'delete'), async (req, res) => {
  try {
    const sprintId = req.params.id;
    const userId = req.user.id;

    // Get existing sprint
    const [existingSprint] = await dbQuery(
      'SELECT * FROM pm_sprints WHERE id = ?',
      [sprintId]
    );

    if (!existingSprint) {
      return res.status(404).json({
        success: false,
        message: 'Sprint not found'
      });
    }

    // Check workspace access (only owner/admin can delete)
    const [workspaceAccess] = await dbQuery(
      `SELECT wm.role 
       FROM pm_workspace_members wm
       WHERE wm.workspace_id = ? AND wm.user_id = ? AND wm.role IN ('owner', 'admin')
       UNION
       SELECT 'owner' as role
       FROM pm_workspaces w
       WHERE w.id = ? AND w.created_by = ?`,
      [existingSprint.workspace_id, userId, existingSprint.workspace_id, userId]
    );

    if (!workspaceAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only workspace owners and admins can delete sprints.'
      });
    }

    // Move user stories back to backlog
    await dbQuery(
      `UPDATE pm_user_stories 
       SET sprint_id = NULL, status = 'backlog'
       WHERE sprint_id = ?`,
      [sprintId]
    );

    // Delete sprint
    await dbQuery('DELETE FROM pm_sprints WHERE id = ?', [sprintId]);

    // Log activity
    await dbQuery(
      `INSERT INTO pm_activities (workspace_id, entity_type, entity_id, action, performed_by)
       VALUES (?, 'sprint', ?, 'deleted', ?)`,
      [existingSprint.workspace_id, sprintId, userId]
    );

    res.json({
      success: true,
      message: 'Sprint deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting sprint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete sprint'
    });
  }
});

// Start sprint
router.post('/:id/start', authorizePermission('projects', 'edit'), async (req, res) => {
  try {
    const sprintId = req.params.id;
    const userId = req.user.id;

    // Get sprint
    const [sprint] = await dbQuery(
      'SELECT * FROM pm_sprints WHERE id = ?',
      [sprintId]
    );

    if (!sprint) {
      return res.status(404).json({
        success: false,
        message: 'Sprint not found'
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
      [sprint.workspace_id, userId, sprint.workspace_id, userId]
    );

    if (!workspaceAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied.'
      });
    }

    // Check if there's already an active sprint
    const [activeSprint] = await dbQuery(
      'SELECT id FROM pm_sprints WHERE workspace_id = ? AND status = ? AND id != ?',
      [sprint.workspace_id, 'active', sprintId]
    );

    if (activeSprint) {
      return res.status(400).json({
        success: false,
        message: 'There is already an active sprint. Please complete it first.'
      });
    }

    // Start sprint
    await dbQuery(
      'UPDATE pm_sprints SET status = ? WHERE id = ?',
      ['active', sprintId]
    );

    // Log activity
    await dbQuery(
      `INSERT INTO pm_activities (workspace_id, entity_type, entity_id, action, performed_by)
       VALUES (?, 'sprint', ?, 'started', ?)`,
      [sprint.workspace_id, sprintId, userId]
    );

    res.json({
      success: true,
      message: 'Sprint started successfully'
    });
  } catch (error) {
    console.error('Error starting sprint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start sprint'
    });
  }
});

// Complete sprint
router.post('/:id/complete', authorizePermission('projects', 'edit'), async (req, res) => {
  try {
    const sprintId = req.params.id;
    const userId = req.user.id;

    // Get sprint
    const [sprint] = await dbQuery(
      'SELECT * FROM pm_sprints WHERE id = ?',
      [sprintId]
    );

    if (!sprint) {
      return res.status(404).json({
        success: false,
        message: 'Sprint not found'
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
      [sprint.workspace_id, userId, sprint.workspace_id, userId]
    );

    if (!workspaceAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied.'
      });
    }

    // Calculate velocity (completed story points)
    const [completedPoints] = await dbQuery(
      `SELECT COALESCE(SUM(story_points), 0) as total
       FROM pm_user_stories
       WHERE sprint_id = ? AND status = 'done'`,
      [sprintId]
    );

    const velocity = parseFloat(completedPoints.total) || 0;

    // Complete sprint
    await dbQuery(
      'UPDATE pm_sprints SET status = ?, velocity = ? WHERE id = ?',
      ['completed', velocity, sprintId]
    );

    // Log activity
    await dbQuery(
      `INSERT INTO pm_activities (workspace_id, entity_type, entity_id, action, performed_by)
       VALUES (?, 'sprint', ?, 'completed', ?)`,
      [sprint.workspace_id, sprintId, userId]
    );

    res.json({
      success: true,
      message: 'Sprint completed successfully',
      data: { velocity }
    });
  } catch (error) {
    console.error('Error completing sprint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete sprint'
    });
  }
});

module.exports = router;
