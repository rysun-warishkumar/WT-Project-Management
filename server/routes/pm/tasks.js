const express = require('express');
const { body, validationResult, query: validatorQuery } = require('express-validator');
const { authenticateToken, authorizePermission } = require('../../middleware/auth');
const { query: dbQuery } = require('../../config/database');
const { logCreation, logUpdate, logDeletion, logStatusChange, logAssignment } = require('../../utils/activityLogger');
const { generateTaskReference, generateSubtaskReference } = require('../../utils/referenceNumberGenerator');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get all tasks for a user story
router.get('/user-story/:storyId', authorizePermission('projects', 'view'), async (req, res) => {
  try {
    const storyId = req.params.storyId;
    const userId = req.user.id;

    // Check if user has access to the user story's workspace
    const [story] = await dbQuery(
      'SELECT workspace_id FROM pm_user_stories WHERE id = ?',
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

    // Get tasks (excluding subtasks - they'll be attached to parent tasks)
    const tasks = await dbQuery(
      `SELECT 
        t.*,
        u.full_name as assignee_name,
        u.email as assignee_email,
        creator.full_name as created_by_name,
        COUNT(DISTINCT tl.id) as link_count
       FROM pm_tasks t
       LEFT JOIN users u ON t.assignee_id = u.id
       LEFT JOIN users creator ON t.created_by = creator.id
       LEFT JOIN pm_task_links tl ON t.id = tl.source_task_id OR t.id = tl.target_task_id
       WHERE t.user_story_id = ? AND t.parent_task_id IS NULL
       GROUP BY t.id
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

    // Get subtasks for each task
    const tasksWithSubtasks = await Promise.all(
      tasks.map(async (task) => {
        const subtasks = await dbQuery(
          `SELECT 
            t.*,
            u.full_name as assignee_name,
            u.email as assignee_email
           FROM pm_tasks t
           LEFT JOIN users u ON t.assignee_id = u.id
           WHERE t.parent_task_id = ?
           ORDER BY t.created_at`,
          [task.id]
        );

        // Calculate subtask progress
        const totalSubtasks = subtasks.length;
        const completedSubtasks = subtasks.filter(st => st.status === 'done').length;
        const subtaskProgress = totalSubtasks > 0 
          ? Math.round((completedSubtasks / totalSubtasks) * 100) 
          : 0;

        return {
          ...task,
          subtasks: subtasks,
          subtask_count: totalSubtasks,
          completed_subtask_count: completedSubtasks,
          subtask_progress: subtaskProgress
        };
      })
    );

    res.json({
      success: true,
      data: tasksWithSubtasks
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tasks'
    });
  }
});

// Get task by ID
router.get('/:id', authorizePermission('projects', 'view'), async (req, res) => {
  try {
    const taskId = req.params.id;
    const userId = req.user.id;

    // Get task
    const [task] = await dbQuery(
      `SELECT 
        t.*,
        us.title as user_story_title,
        us.workspace_id,
        u.full_name as assignee_name,
        u.email as assignee_email,
        creator.full_name as created_by_name
       FROM pm_tasks t
       LEFT JOIN pm_user_stories us ON t.user_story_id = us.id
       LEFT JOIN users u ON t.assignee_id = u.id
       LEFT JOIN users creator ON t.created_by = creator.id
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
        message: 'Access denied. You do not have access to this task.'
      });
    }

    // Get subtasks
    const subtasks = await dbQuery(
      `SELECT 
        t.*,
        u.full_name as assignee_name
       FROM pm_tasks t
       LEFT JOIN users u ON t.assignee_id = u.id
       WHERE t.parent_task_id = ?
       ORDER BY t.created_at`,
      [taskId]
    );

    // Get task links
    const links = await dbQuery(
      `SELECT 
        tl.*,
        CASE 
          WHEN tl.source_task_id = ? THEN t2.title
          ELSE t1.title
        END as linked_task_title,
        CASE 
          WHEN tl.source_task_id = ? THEN t2.status
          ELSE t1.status
        END as linked_task_status
       FROM pm_task_links tl
       LEFT JOIN pm_tasks t1 ON tl.source_task_id = t1.id
       LEFT JOIN pm_tasks t2 ON tl.target_task_id = t2.id
       WHERE tl.source_task_id = ? OR tl.target_task_id = ?`,
      [taskId, taskId, taskId, taskId]
    );

    // Get time logs
    const timeLogs = await dbQuery(
      `SELECT 
        tl.*,
        u.full_name as user_name
       FROM pm_time_logs tl
       LEFT JOIN users u ON tl.user_id = u.id
       WHERE tl.task_id = ?
       ORDER BY tl.logged_date DESC, tl.created_at DESC`,
      [taskId]
    );

    task.subtasks = subtasks;
    task.links = links;
    task.time_logs = timeLogs;

    res.json({
      success: true,
      data: task
    });
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch task'
    });
  }
});

// Create task
router.post('/', authorizePermission('projects', 'create'), [
  body('user_story_id').isInt().withMessage('User story ID is required'),
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid priority'),
  body('status').optional().isIn(['todo', 'in_progress', 'review', 'testing', 'done', 'blocked']).withMessage('Invalid status'),
  body('parent_task_id').optional().isInt().withMessage('Parent task ID must be a valid integer'),
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
      user_story_id,
      parent_task_id,
      title,
      description,
      status = 'todo',
      priority = 'medium',
      estimated_hours,
      assignee_id,
      due_date,
      labels
    } = req.body;
    const userId = req.user.id;

    // Get user story to check workspace access
    const [userStory] = await dbQuery(
      'SELECT workspace_id FROM pm_user_stories WHERE id = ?',
      [user_story_id]
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
       WHERE wm.workspace_id = ? AND wm.user_id = ?
       UNION
       SELECT 'owner' as role
       FROM pm_workspaces w
       WHERE w.id = ? AND w.created_by = ?`,
      [userStory.workspace_id, userId, userStory.workspace_id, userId]
    );

    if (!workspaceAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have access to this workspace.'
      });
    }

    // Validate parent task if provided
    let parentTask = null;
    if (parent_task_id) {
      const [parentTaskResult] = await dbQuery(
        'SELECT id FROM pm_tasks WHERE id = ? AND user_story_id = ?',
        [parent_task_id, user_story_id]
      );
      if (!parentTaskResult) {
        return res.status(404).json({
          success: false,
          message: 'Parent task not found'
        });
      }
      parentTask = parentTaskResult;
    }

    // Generate reference number
    let referenceNumber;
    if (parent_task_id) {
      // Subtask
      referenceNumber = await generateSubtaskReference(userStory.workspace_id, parent_task_id);
    } else {
      // Regular task
      referenceNumber = await generateTaskReference(userStory.workspace_id);
    }

    // Create task
    const result = await dbQuery(
      `INSERT INTO pm_tasks 
       (user_story_id, parent_task_id, reference_number, title, description, status, priority, estimated_hours, assignee_id, due_date, labels, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user_story_id,
        parent_task_id || null,
        referenceNumber,
        title,
        description || null,
        status,
        priority,
        estimated_hours || null,
        assignee_id || null,
        due_date || null,
        labels ? JSON.stringify(labels) : null,
        userId
      ]
    );

    const taskId = result.insertId;

    // Get created task
    const [task] = await dbQuery(
      `SELECT 
        t.*,
        u.full_name as assignee_name,
        u.email as assignee_email,
        creator.full_name as created_by_name
       FROM pm_tasks t
       LEFT JOIN users u ON t.assignee_id = u.id
       LEFT JOIN users creator ON t.created_by = creator.id
       WHERE t.id = ?`,
      [taskId]
    );

    // Log activity
    await logCreation(userStory.workspace_id, 'task', taskId, userId, {
      title: title,
      priority: priority || 'medium',
      status: status || 'todo',
      reference_number: referenceNumber
    });

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: task
    });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create task'
    });
  }
});

// Update task
router.put('/:id', authorizePermission('projects', 'edit'), [
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid priority'),
  body('status').optional().isIn(['todo', 'in_progress', 'review', 'testing', 'done', 'blocked']).withMessage('Invalid status'),
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
    const {
      title,
      description,
      status,
      priority,
      estimated_hours,
      assignee_id,
      due_date,
      labels
    } = req.body;

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
        message: 'Access denied. You do not have access to this task.'
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
    if (status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(status);
    }
    if (priority !== undefined) {
      updateFields.push('priority = ?');
      updateValues.push(priority);
    }
    if (estimated_hours !== undefined) {
      updateFields.push('estimated_hours = ?');
      updateValues.push(estimated_hours);
    }
    if (assignee_id !== undefined) {
      updateFields.push('assignee_id = ?');
      updateValues.push(assignee_id || null);
    }
    if (due_date !== undefined) {
      updateFields.push('due_date = ?');
      updateValues.push(due_date || null);
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

    updateValues.push(taskId);
    await dbQuery(
      `UPDATE pm_tasks 
       SET ${updateFields.join(', ')}
       WHERE id = ?`,
      updateValues
    );

    // Get updated task
    const [task] = await dbQuery(
      `SELECT 
        t.*,
        u.full_name as assignee_name,
        u.email as assignee_email,
        creator.full_name as created_by_name
       FROM pm_tasks t
       LEFT JOIN users u ON t.assignee_id = u.id
       LEFT JOIN users creator ON t.created_by = creator.id
       WHERE t.id = ?`,
      [taskId]
    );

    // Log specific activities
    if (status !== undefined && status !== existingTask.status) {
      await logStatusChange(existingTask.workspace_id, 'task', taskId, existingTask.status, status, userId);
    }
    if (assignee_id !== undefined && assignee_id !== existingTask.assignee_id) {
      await logAssignment(existingTask.workspace_id, 'task', taskId, existingTask.assignee_id, assignee_id, userId);
    }
    // Log general update if other fields changed
    const hasOtherChanges = title !== undefined || description !== undefined || 
                            priority !== undefined || estimated_hours !== undefined || 
                            due_date !== undefined || labels !== undefined;
    if (hasOtherChanges && (status === undefined || status === existingTask.status) && 
        (assignee_id === undefined || assignee_id === existingTask.assignee_id)) {
      await logUpdate(existingTask.workspace_id, 'task', taskId, {
        old: {
          title: existingTask.title,
          description: existingTask.description,
          priority: existingTask.priority,
          estimated_hours: existingTask.estimated_hours,
          due_date: existingTask.due_date
        },
        new: {
          title: title !== undefined ? title : existingTask.title,
          description: description !== undefined ? description : existingTask.description,
          priority: priority !== undefined ? priority : existingTask.priority,
          estimated_hours: estimated_hours !== undefined ? estimated_hours : existingTask.estimated_hours,
          due_date: due_date !== undefined ? due_date : existingTask.due_date
        }
      }, userId);
    }

    res.json({
      success: true,
      message: 'Task updated successfully',
      data: task
    });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update task'
    });
  }
});

// Delete task
router.delete('/:id', authorizePermission('projects', 'delete'), async (req, res) => {
  try {
    const taskId = req.params.id;
    const userId = req.user.id;

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

    // Check workspace access (only owner/admin can delete)
    const [workspaceAccess] = await dbQuery(
      `SELECT wm.role 
       FROM pm_workspace_members wm
       WHERE wm.workspace_id = ? AND wm.user_id = ? AND wm.role IN ('owner', 'admin')
       UNION
       SELECT 'owner' as role
       FROM pm_workspaces w
       WHERE w.id = ? AND w.created_by = ?`,
      [existingTask.workspace_id, userId, existingTask.workspace_id, userId]
    );

    if (!workspaceAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only workspace owners and admins can delete tasks.'
      });
    }

    // Delete task (cascade will delete subtasks and links)
    await dbQuery('DELETE FROM pm_tasks WHERE id = ?', [taskId]);

    // Log activity before deletion
    await logDeletion(existingTask.workspace_id, 'task', taskId, userId);

    res.json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete task'
    });
  }
});

module.exports = router;
