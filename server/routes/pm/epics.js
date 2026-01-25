const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, authorizePermission } = require('../../middleware/auth');
const { query: dbQuery } = require('../../config/database');
const { generateEpicReference } = require('../../utils/referenceNumberGenerator');
const { logCreation } = require('../../utils/activityLogger');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get all epics for a workspace
router.get('/workspace/:workspaceId', authorizePermission('projects', 'view'), async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const userId = req.user.id;
    const { status } = req.query;

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
    let whereClause = 'WHERE e.workspace_id = ?';
    const whereParams = [workspaceId];

    if (status) {
      whereClause += ' AND e.status = ?';
      whereParams.push(status);
    }

    // Get epics with statistics
    const epics = await dbQuery(
      `SELECT 
        e.*,
        creator.full_name as created_by_name,
        COUNT(DISTINCT us.id) as total_stories,
        COUNT(DISTINCT CASE WHEN us.status = 'done' THEN us.id END) as completed_stories,
        COALESCE(SUM(us.story_points), 0) as total_story_points,
        COALESCE(SUM(CASE WHEN us.status = 'done' THEN us.story_points ELSE 0 END), 0) as completed_story_points
       FROM pm_epics e
       LEFT JOIN users creator ON e.created_by = creator.id
       LEFT JOIN pm_user_stories us ON us.epic_id = e.id
       ${whereClause}
       GROUP BY e.id
       ORDER BY e.created_at DESC`,
      whereParams
    );

    res.json({
      success: true,
      data: epics.map(epic => ({
        id: epic.id,
        workspace_id: epic.workspace_id,
        reference_number: epic.reference_number,
        name: epic.name,
        description: epic.description,
        color: epic.color,
        status: epic.status,
        created_by: epic.created_by,
        created_by_name: epic.created_by_name,
        created_at: epic.created_at,
        updated_at: epic.updated_at,
        total_stories: parseInt(epic.total_stories),
        completed_stories: parseInt(epic.completed_stories),
        total_story_points: parseFloat(epic.total_story_points),
        completed_story_points: parseFloat(epic.completed_story_points),
        progress_percentage: epic.total_stories > 0
          ? parseFloat(((epic.completed_stories / epic.total_stories) * 100).toFixed(2))
          : 0
      }))
    });
  } catch (error) {
    console.error('Error fetching epics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch epics'
    });
  }
});

// Get epic by ID
router.get('/:id', authorizePermission('projects', 'view'), async (req, res) => {
  try {
    const epicId = req.params.id;
    const userId = req.user.id;

    // Get epic
    const [epic] = await dbQuery(
      `SELECT 
        e.*,
        creator.full_name as created_by_name
       FROM pm_epics e
       LEFT JOIN users creator ON e.created_by = creator.id
       WHERE e.id = ?`,
      [epicId]
    );

    if (!epic) {
      return res.status(404).json({
        success: false,
        message: 'Epic not found'
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
      [epic.workspace_id, userId, epic.workspace_id, userId]
    );

    if (!workspaceAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have access to this workspace.'
      });
    }

    // Get user stories in this epic
    const stories = await dbQuery(
      `SELECT 
        us.id,
        us.title,
        us.status,
        us.story_points,
        us.priority,
        us.sprint_id,
        s.name as sprint_name
       FROM pm_user_stories us
       LEFT JOIN pm_sprints s ON us.sprint_id = s.id
       WHERE us.epic_id = ?
       ORDER BY us.created_at ASC`,
      [epicId]
    );

    // Calculate statistics
    const totalStories = stories.length;
    const completedStories = stories.filter(s => s.status === 'done').length;
    const totalStoryPoints = stories.reduce((sum, s) => sum + (parseFloat(s.story_points) || 0), 0);
    const completedStoryPoints = stories
      .filter(s => s.status === 'done')
      .reduce((sum, s) => sum + (parseFloat(s.story_points) || 0), 0);

    res.json({
      success: true,
      data: {
        ...epic,
        created_by_name: epic.created_by_name,
        stories: stories.map(s => ({
          ...s,
          story_points: parseFloat(s.story_points) || 0
        })),
        total_stories: totalStories,
        completed_stories: completedStories,
        total_story_points: totalStoryPoints,
        completed_story_points: completedStoryPoints,
        progress_percentage: totalStories > 0
          ? parseFloat(((completedStories / totalStories) * 100).toFixed(2))
          : 0
      }
    });
  } catch (error) {
    console.error('Error fetching epic:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch epic'
    });
  }
});

// Create epic
router.post('/', authorizePermission('projects', 'create'), [
  body('workspace_id').isInt().withMessage('Workspace ID is required'),
  body('name').trim().notEmpty().withMessage('Epic name is required'),
  body('description').optional().trim(),
  body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/).withMessage('Color must be a valid hex color code'),
  body('status').optional().isIn(['active', 'completed', 'archived']).withMessage('Invalid status'),
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

    const { workspace_id, name, description, color, status } = req.body;
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
      [workspace_id, userId, workspace_id, userId]
    );

    if (!workspaceAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have access to this workspace.'
      });
    }

    // Generate reference number
    const referenceNumber = await generateEpicReference(workspace_id);

    // Create epic
    const result = await dbQuery(
      `INSERT INTO pm_epics (workspace_id, reference_number, name, description, color, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        workspace_id,
        referenceNumber,
        name,
        description || null,
        color || '#3B82F6',
        status || 'active',
        userId
      ]
    );

    const epicId = result.insertId;

    // Log activity
    await logCreation(workspace_id, 'epic', epicId, userId, {
      name,
      reference_number: referenceNumber
    });

    // Get created epic
    const [epic] = await dbQuery(
      `SELECT 
        e.*,
        creator.full_name as created_by_name
       FROM pm_epics e
       LEFT JOIN users creator ON e.created_by = creator.id
       WHERE e.id = ?`,
      [epicId]
    );

    res.status(201).json({
      success: true,
      message: 'Epic created successfully',
      data: {
        ...epic,
        created_by_name: epic.created_by_name,
        total_stories: 0,
        completed_stories: 0,
        total_story_points: 0,
        completed_story_points: 0,
        progress_percentage: 0
      }
    });
  } catch (error) {
    console.error('Error creating epic:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create epic'
    });
  }
});

// Update epic
router.put('/:id', authorizePermission('projects', 'edit'), [
  body('name').optional().trim().notEmpty().withMessage('Epic name cannot be empty'),
  body('description').optional().trim(),
  body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/).withMessage('Color must be a valid hex color code'),
  body('status').optional().isIn(['active', 'completed', 'archived']).withMessage('Invalid status'),
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

    const epicId = req.params.id;
    const userId = req.user.id;
    const { name, description, color, status } = req.body;

    // Get epic
    const [epic] = await dbQuery('SELECT * FROM pm_epics WHERE id = ?', [epicId]);

    if (!epic) {
      return res.status(404).json({
        success: false,
        message: 'Epic not found'
      });
    }

    // Check workspace access
    const [workspaceAccess] = await dbQuery(
      `SELECT wm.role 
       FROM pm_workspace_members wm
       WHERE wm.workspace_id = ? AND wm.user_id = ? AND wm.role IN ('owner', 'admin', 'member')
       UNION
       SELECT 'owner' as role
       FROM pm_workspaces w
       WHERE w.id = ? AND w.created_by = ?`,
      [epic.workspace_id, userId, epic.workspace_id, userId]
    );

    if (!workspaceAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have access to this workspace.'
      });
    }

    // Build update query
    const updateFields = [];
    const updateValues = [];

    if (name) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description || null);
    }
    if (color) {
      updateFields.push('color = ?');
      updateValues.push(color);
    }
    if (status) {
      updateFields.push('status = ?');
      updateValues.push(status);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updateValues.push(epicId);

    await dbQuery(
      `UPDATE pm_epics 
       SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      updateValues
    );

    // Get updated epic
    const [updatedEpic] = await dbQuery(
      `SELECT 
        e.*,
        creator.full_name as created_by_name
       FROM pm_epics e
       LEFT JOIN users creator ON e.created_by = creator.id
       WHERE e.id = ?`,
      [epicId]
    );

    res.json({
      success: true,
      message: 'Epic updated successfully',
      data: updatedEpic
    });
  } catch (error) {
    console.error('Error updating epic:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update epic'
    });
  }
});

// Delete epic
router.delete('/:id', authorizePermission('projects', 'delete'), async (req, res) => {
  try {
    const epicId = req.params.id;
    const userId = req.user.id;

    // Get epic
    const [epic] = await dbQuery('SELECT * FROM pm_epics WHERE id = ?', [epicId]);

    if (!epic) {
      return res.status(404).json({
        success: false,
        message: 'Epic not found'
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
      [epic.workspace_id, userId, epic.workspace_id, userId]
    );

    if (!workspaceAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only workspace owners and admins can delete epics.'
      });
    }

    // Check if epic has stories
    const [storyCount] = await dbQuery(
      'SELECT COUNT(*) as count FROM pm_user_stories WHERE epic_id = ?',
      [epicId]
    );

    if (storyCount.count > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete epic. It has ${storyCount.count} user story/stories. Please remove or reassign stories first.`
      });
    }

    // Delete epic
    await dbQuery('DELETE FROM pm_epics WHERE id = ?', [epicId]);

    res.json({
      success: true,
      message: 'Epic deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting epic:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete epic'
    });
  }
});

module.exports = router;
