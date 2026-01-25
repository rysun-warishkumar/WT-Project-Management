const express = require('express');
const { body, validationResult, query: validatorQuery } = require('express-validator');
const { authenticateToken, authorizePermission } = require('../../middleware/auth');
const { query: dbQuery } = require('../../config/database');
const { logCreation, logUpdate, logDeletion, logStatusChange, logAssignment } = require('../../utils/activityLogger');
const { generateUserStoryReference } = require('../../utils/referenceNumberGenerator');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get all user stories for a workspace
router.get('/workspace/:workspaceId', authorizePermission('projects', 'view'), [
  validatorQuery('status').optional().isIn(['backlog', 'sprint', 'in_progress', 'testing', 'done', 'cancelled']),
  validatorQuery('epic_id').optional().isInt(),
  validatorQuery('sprint_id').optional().isInt(),
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

    const workspaceId = req.params.workspaceId;
    const { status, epic_id, sprint_id } = req.query;
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
    let whereClause = 'WHERE us.workspace_id = ?';
    const whereParams = [workspaceId];

    if (status) {
      whereClause += ' AND us.status = ?';
      whereParams.push(status);
    }

    if (epic_id) {
      whereClause += ' AND us.epic_id = ?';
      whereParams.push(epic_id);
    }

    if (sprint_id) {
      whereClause += ' AND us.sprint_id = ?';
      whereParams.push(sprint_id);
    }

    // Get user stories
    const userStories = await dbQuery(
      `SELECT 
        us.*,
        e.name as epic_name,
        e.color as epic_color,
        e.reference_number as epic_reference_number,
        s.name as sprint_name,
        s.status as sprint_status,
        u.full_name as assignee_name,
        u.email as assignee_email,
        creator.full_name as created_by_name,
        COUNT(DISTINCT t.id) as task_count,
        COUNT(DISTINCT CASE WHEN t.status = 'done' THEN t.id END) as completed_task_count,
        GROUP_CONCAT(DISTINCT t.id ORDER BY t.id) as task_ids,
        GROUP_CONCAT(DISTINCT t.reference_number ORDER BY t.reference_number) as task_reference_numbers,
        GROUP_CONCAT(DISTINCT st.id ORDER BY st.id) as subtask_ids,
        GROUP_CONCAT(DISTINCT st.reference_number ORDER BY st.reference_number) as subtask_reference_numbers
       FROM pm_user_stories us
       LEFT JOIN pm_epics e ON us.epic_id = e.id
       LEFT JOIN pm_sprints s ON us.sprint_id = s.id
       LEFT JOIN users u ON us.assignee_id = u.id
       LEFT JOIN users creator ON us.created_by = creator.id
       LEFT JOIN pm_tasks t ON us.id = t.user_story_id
       LEFT JOIN pm_tasks st ON st.parent_task_id = t.id
       ${whereClause}
       GROUP BY us.id
       ORDER BY 
         CASE us.priority
           WHEN 'critical' THEN 1
           WHEN 'high' THEN 2
           WHEN 'medium' THEN 3
           ELSE 4
         END,
         us.created_at DESC`,
      whereParams
    );

    res.json({
      success: true,
      data: userStories
    });
  } catch (error) {
    console.error('Error fetching user stories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user stories'
    });
  }
});

// Get user story by ID
router.get('/:id', authorizePermission('projects', 'view'), async (req, res) => {
  try {
    const storyId = req.params.id;
    const userId = req.user.id;

    // Get user story
    const [userStory] = await dbQuery(
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
       WHERE us.id = ?`,
      [storyId]
    );

    if (!userStory) {
      return res.status(404).json({
        success: false,
        message: 'User story not found'
      });
    }

    // Check workspace access
    const [workspaceAccess] = await dbQuery(
      `SELECT wm.role 
       FROM pm_workspace_members wm
       JOIN pm_user_stories us ON wm.workspace_id = us.workspace_id
       WHERE us.id = ? AND wm.user_id = ?
       UNION
       SELECT 'owner' as role
       FROM pm_workspaces w
       JOIN pm_user_stories us ON w.id = us.workspace_id
       WHERE us.id = ? AND w.created_by = ?`,
      [storyId, userId, storyId, userId]
    );

    if (!workspaceAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have access to this user story.'
      });
    }

    // Get tasks for this user story
    const tasks = await dbQuery(
      `SELECT 
        t.*,
        u.full_name as assignee_name,
        u.email as assignee_email
       FROM pm_tasks t
       LEFT JOIN users u ON t.assignee_id = u.id
       WHERE t.user_story_id = ?
       ORDER BY 
         CASE t.priority
           WHEN 'critical' THEN 1
           WHEN 'high' THEN 2
           WHEN 'medium' THEN 3
           ELSE 4
         END,
         t.created_at`,
      [storyId]
    );

    userStory.tasks = tasks;

    res.json({
      success: true,
      data: userStory
    });
  } catch (error) {
    console.error('Error fetching user story:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user story'
    });
  }
});

// Create user story
router.post('/', authorizePermission('projects', 'create'), [
  body('workspace_id').isInt().withMessage('Workspace ID is required'),
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('story_points').optional({ nullable: true, checkFalsy: true }).custom((value) => {
    if (value === null || value === '' || value === undefined) return true;
    const numValue = parseFloat(value);
    return !isNaN(numValue) && numValue >= 0;
  }).withMessage('Story points must be a non-negative number'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid priority'),
  body('epic_id').optional({ nullable: true, checkFalsy: true }).custom((value) => {
    if (value === null || value === '' || value === undefined) return true;
    return Number.isInteger(parseInt(value));
  }).withMessage('Epic ID must be a valid integer'),
  body('sprint_id').optional({ nullable: true, checkFalsy: true }).custom((value) => {
    if (value === null || value === '' || value === undefined) return true;
    return Number.isInteger(parseInt(value));
  }).withMessage('Sprint ID must be a valid integer'),
  body('assignee_id').optional({ nullable: true, checkFalsy: true }).custom((value) => {
    if (value === null || value === '' || value === undefined) return true;
    return Number.isInteger(parseInt(value));
  }).withMessage('Assignee ID must be a valid integer'),
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
      epic_id,
      title,
      description,
      acceptance_criteria,
      story_points,
      priority = 'medium',
      sprint_id,
      assignee_id,
      labels
    } = req.body;

    // Normalize optional fields - convert empty strings to null
    const normalizedEpicId = epic_id === '' || epic_id === null || epic_id === undefined ? null : parseInt(epic_id);
    const normalizedSprintId = sprint_id === '' || sprint_id === null || sprint_id === undefined ? null : parseInt(sprint_id);
    const normalizedAssigneeId = assignee_id === '' || assignee_id === null || assignee_id === undefined ? null : parseInt(assignee_id);
    const normalizedStoryPoints = story_points === '' || story_points === null || story_points === undefined ? null : parseFloat(story_points);
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

    // Validate epic if provided
    if (normalizedEpicId) {
      const [epic] = await dbQuery(
        'SELECT id FROM pm_epics WHERE id = ? AND workspace_id = ?',
        [normalizedEpicId, workspace_id]
      );
      if (!epic) {
        return res.status(404).json({
          success: false,
          message: 'Epic not found'
        });
      }
    }

    // Validate sprint if provided
    if (normalizedSprintId) {
      const [sprint] = await dbQuery(
        'SELECT id FROM pm_sprints WHERE id = ? AND workspace_id = ?',
        [normalizedSprintId, workspace_id]
      );
      if (!sprint) {
        return res.status(404).json({
          success: false,
          message: 'Sprint not found'
        });
      }
    }

    // Determine status based on sprint
    let status = 'backlog';
    if (normalizedSprintId) {
      status = 'sprint';
    }

    // Generate reference number
    const referenceNumber = await generateUserStoryReference(workspace_id);

    // Create user story
    const result = await dbQuery(
      `INSERT INTO pm_user_stories 
       (workspace_id, reference_number, epic_id, title, description, acceptance_criteria, story_points, priority, status, sprint_id, assignee_id, labels, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        workspace_id,
        referenceNumber,
        normalizedEpicId,
        title,
        description || null,
        acceptance_criteria || null,
        normalizedStoryPoints,
        priority,
        status,
        normalizedSprintId,
        normalizedAssigneeId,
        labels ? JSON.stringify(labels) : null,
        userId
      ]
    );

    const storyId = result.insertId;

    // Get created user story
    const [userStory] = await dbQuery(
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
       WHERE us.id = ?`,
      [storyId]
    );

    // Log activity
    await logCreation(workspace_id, 'user_story', storyId, userId, {
      title,
      priority,
      story_points: normalizedStoryPoints,
      reference_number: referenceNumber
    });

    res.status(201).json({
      success: true,
      message: 'User story created successfully',
      data: userStory
    });
  } catch (error) {
    console.error('Error creating user story:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create user story'
    });
  }
});

// Update user story
router.put('/:id', authorizePermission('projects', 'edit'), [
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
  body('story_points').optional().isInt({ min: 0 }).withMessage('Story points must be a non-negative integer'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid priority'),
  body('status').optional().isIn(['backlog', 'sprint', 'in_progress', 'testing', 'done', 'cancelled']).withMessage('Invalid status'),
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
    const {
      title,
      description,
      acceptance_criteria,
      story_points,
      priority,
      status,
      epic_id,
      sprint_id,
      assignee_id,
      labels
    } = req.body;

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
        message: 'Access denied. You do not have access to this user story.'
      });
    }

    // Build update query
    const updateFields = [];
    const updateValues = [];

    if (title !== undefined) {
      updateFields.push('title = ?');
      updateValues.push(title);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description);
    }
    if (acceptance_criteria !== undefined) {
      updateFields.push('acceptance_criteria = ?');
      updateValues.push(acceptance_criteria);
    }
    if (story_points !== undefined) {
      updateFields.push('story_points = ?');
      updateValues.push(story_points);
    }
    if (priority !== undefined) {
      updateFields.push('priority = ?');
      updateValues.push(priority);
    }
    if (status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(status);
    }
    if (epic_id !== undefined) {
      updateFields.push('epic_id = ?');
      updateValues.push(epic_id || null);
    }
    if (sprint_id !== undefined) {
      updateFields.push('sprint_id = ?');
      updateValues.push(sprint_id || null);
      // Update status if sprint is assigned/removed
      if (sprint_id) {
        updateFields.push('status = ?');
        updateValues.push('sprint');
      } else if (existingStory.sprint_id) {
        updateFields.push('status = ?');
        updateValues.push('backlog');
      }
    }
    if (assignee_id !== undefined) {
      updateFields.push('assignee_id = ?');
      updateValues.push(assignee_id || null);
    }
    if (labels !== undefined) {
      updateFields.push('labels = ?');
      updateValues.push(labels ? JSON.stringify(labels) : null);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updateValues.push(storyId);
    await dbQuery(
      `UPDATE pm_user_stories 
       SET ${updateFields.join(', ')}
       WHERE id = ?`,
      updateValues
    );

    // Get updated user story
    const [userStory] = await dbQuery(
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
       WHERE us.id = ?`,
      [storyId]
    );

    // Log specific activities
    if (status !== undefined && status !== existingStory.status) {
      await logStatusChange(existingStory.workspace_id, 'user_story', storyId, existingStory.status, status, userId);
    }
    if (assignee_id !== undefined && assignee_id !== existingStory.assignee_id) {
      await logAssignment(existingStory.workspace_id, 'user_story', storyId, existingStory.assignee_id, assignee_id, userId);
    }
    // Log general update if other fields changed
    const hasOtherChanges = title !== undefined || description !== undefined || 
                            acceptance_criteria !== undefined || story_points !== undefined || 
                            priority !== undefined || epic_id !== undefined || sprint_id !== undefined || labels !== undefined;
    if (hasOtherChanges && (status === undefined || status === existingStory.status) && 
        (assignee_id === undefined || assignee_id === existingStory.assignee_id)) {
      await logUpdate(existingStory.workspace_id, 'user_story', storyId, {
        old: {
          title: existingStory.title,
          description: existingStory.description,
          priority: existingStory.priority,
          story_points: existingStory.story_points,
          epic_id: existingStory.epic_id,
          sprint_id: existingStory.sprint_id
        },
        new: {
          title: title !== undefined ? title : existingStory.title,
          description: description !== undefined ? description : existingStory.description,
          priority: priority !== undefined ? priority : existingStory.priority,
          story_points: story_points !== undefined ? story_points : existingStory.story_points,
          epic_id: epic_id !== undefined ? epic_id : existingStory.epic_id,
          sprint_id: sprint_id !== undefined ? sprint_id : existingStory.sprint_id
        }
      }, userId);
    }

    res.json({
      success: true,
      message: 'User story updated successfully',
      data: userStory
    });
  } catch (error) {
    console.error('Error updating user story:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user story'
    });
  }
});

// Delete user story
router.delete('/:id', authorizePermission('projects', 'delete'), async (req, res) => {
  try {
    const storyId = req.params.id;
    const userId = req.user.id;

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

    // Check workspace access (only owner/admin can delete)
    const [workspaceAccess] = await dbQuery(
      `SELECT wm.role 
       FROM pm_workspace_members wm
       WHERE wm.workspace_id = ? AND wm.user_id = ? AND wm.role IN ('owner', 'admin')
       UNION
       SELECT 'owner' as role
       FROM pm_workspaces w
       WHERE w.id = ? AND w.created_by = ?`,
      [existingStory.workspace_id, userId, existingStory.workspace_id, userId]
    );

    if (!workspaceAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only workspace owners and admins can delete user stories.'
      });
    }

    // Log activity before deletion
    await logDeletion(existingStory.workspace_id, 'user_story', storyId, userId);

    // Delete user story (cascade will delete tasks)
    await dbQuery('DELETE FROM pm_user_stories WHERE id = ?', [storyId]);

    res.json({
      success: true,
      message: 'User story deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user story:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user story'
    });
  }
});

module.exports = router;
