const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, authorizePermission } = require('../../middleware/auth');
const { query: dbQuery } = require('../../config/database');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get task links for a task
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

    // Get all links where this task is source or target
    const links = await dbQuery(
      `SELECT 
        tl.*,
        source_task.title as source_task_title,
        source_task.status as source_task_status,
        target_task.title as target_task_title,
        target_task.status as target_task_status
       FROM pm_task_links tl
       JOIN pm_tasks source_task ON tl.source_task_id = source_task.id
       JOIN pm_tasks target_task ON tl.target_task_id = target_task.id
       WHERE tl.source_task_id = ? OR tl.target_task_id = ?
       ORDER BY tl.created_at DESC`,
      [taskId, taskId]
    );

    // Separate into outgoing and incoming links
    const outgoingLinks = links.filter(link => link.source_task_id === parseInt(taskId));
    const incomingLinks = links.filter(link => link.target_task_id === parseInt(taskId));

    res.json({
      success: true,
      data: {
        outgoing: outgoingLinks.map(link => ({
          id: link.id,
          link_type: link.link_type,
          target_task_id: link.target_task_id,
          target_task_title: link.target_task_title,
          target_task_status: link.target_task_status,
          created_at: link.created_at
        })),
        incoming: incomingLinks.map(link => ({
          id: link.id,
          link_type: link.link_type,
          source_task_id: link.source_task_id,
          source_task_title: link.source_task_title,
          source_task_status: link.source_task_status,
          created_at: link.created_at
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching task links:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch task links'
    });
  }
});

// Create task link
router.post('/', authorizePermission('projects', 'edit'), [
  body('source_task_id').isInt().withMessage('Source task ID is required'),
  body('target_task_id').isInt().withMessage('Target task ID is required'),
  body('link_type').isIn(['blocks', 'blocked_by', 'relates_to', 'duplicates', 'clones']).withMessage('Invalid link type'),
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

    const { source_task_id, target_task_id, link_type } = req.body;
    const userId = req.user.id;

    // Prevent linking task to itself
    if (source_task_id === target_task_id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot link a task to itself'
      });
    }

    // Get both tasks and check workspace access
    const [sourceTask] = await dbQuery(
      `SELECT t.*, us.workspace_id
       FROM pm_tasks t
       JOIN pm_user_stories us ON us.id = t.user_story_id
       WHERE t.id = ?`,
      [source_task_id]
    );

    const [targetTask] = await dbQuery(
      `SELECT t.*, us.workspace_id
       FROM pm_tasks t
       JOIN pm_user_stories us ON us.id = t.user_story_id
       WHERE t.id = ?`,
      [target_task_id]
    );

    if (!sourceTask || !targetTask) {
      return res.status(404).json({
        success: false,
        message: 'One or both tasks not found'
      });
    }

    // Tasks must be in the same workspace
    if (sourceTask.workspace_id !== targetTask.workspace_id) {
      return res.status(400).json({
        success: false,
        message: 'Tasks must be in the same workspace'
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
      [sourceTask.workspace_id, userId, sourceTask.workspace_id, userId]
    );

    if (!workspaceAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have access to this workspace.'
      });
    }

    // Check if link already exists
    const [existingLink] = await dbQuery(
      'SELECT * FROM pm_task_links WHERE source_task_id = ? AND target_task_id = ? AND link_type = ?',
      [source_task_id, target_task_id, link_type]
    );

    if (existingLink) {
      return res.status(400).json({
        success: false,
        message: 'This link already exists'
      });
    }

    // Check for circular dependencies (only for blocks/blocked_by)
    if (link_type === 'blocks' || link_type === 'blocked_by') {
      // Check if target blocks source (would create cycle)
      const [reverseLink] = await dbQuery(
        `SELECT * FROM pm_task_links 
         WHERE source_task_id = ? AND target_task_id = ? 
         AND link_type IN ('blocks', 'blocked_by')`,
        [target_task_id, source_task_id]
      );

      if (reverseLink) {
        return res.status(400).json({
          success: false,
          message: 'Cannot create circular dependency'
        });
      }

      // Check for transitive dependencies (A blocks B, B blocks C, so C cannot block A)
      const [transitiveCheck] = await dbQuery(
        `SELECT COUNT(*) as count FROM (
          SELECT target_task_id FROM pm_task_links 
          WHERE source_task_id = ? AND link_type IN ('blocks', 'blocked_by')
          UNION ALL
          SELECT source_task_id FROM pm_task_links 
          WHERE target_task_id = ? AND link_type IN ('blocks', 'blocked_by')
        ) as related_tasks
        WHERE target_task_id = ?`,
        [source_task_id, source_task_id, target_task_id]
      );

      // Additional check: if target is already in a dependency chain with source
      const [dependencyChain] = await dbQuery(
        `WITH RECURSIVE dependency_chain AS (
          SELECT source_task_id, target_task_id, 1 as depth
          FROM pm_task_links
          WHERE source_task_id = ? AND link_type IN ('blocks', 'blocked_by')
          UNION ALL
          SELECT tl.source_task_id, tl.target_task_id, dc.depth + 1
          FROM pm_task_links tl
          JOIN dependency_chain dc ON tl.source_task_id = dc.target_task_id
          WHERE tl.link_type IN ('blocks', 'blocked_by') AND dc.depth < 10
        )
        SELECT COUNT(*) as count FROM dependency_chain WHERE target_task_id = ?`,
        [source_task_id, target_task_id]
      );

      if (dependencyChain.count > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot create circular dependency'
        });
      }
    }

    // Create link
    const result = await dbQuery(
      `INSERT INTO pm_task_links (source_task_id, target_task_id, link_type)
       VALUES (?, ?, ?)`,
      [source_task_id, target_task_id, link_type]
    );

    const linkId = result.insertId;

    // Get created link
    const [link] = await dbQuery(
      `SELECT 
        tl.*,
        source_task.title as source_task_title,
        target_task.title as target_task_title
       FROM pm_task_links tl
       JOIN pm_tasks source_task ON tl.source_task_id = source_task.id
       JOIN pm_tasks target_task ON tl.target_task_id = target_task.id
       WHERE tl.id = ?`,
      [linkId]
    );

    res.status(201).json({
      success: true,
      message: 'Task link created successfully',
      data: {
        id: link.id,
        source_task_id: link.source_task_id,
        source_task_title: link.source_task_title,
        target_task_id: link.target_task_id,
        target_task_title: link.target_task_title,
        link_type: link.link_type,
        created_at: link.created_at
      }
    });
  } catch (error) {
    console.error('Error creating task link:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create task link'
    });
  }
});

// Delete task link
router.delete('/:id', authorizePermission('projects', 'edit'), async (req, res) => {
  try {
    const linkId = req.params.id;
    const userId = req.user.id;

    // Get link
    const [link] = await dbQuery(
      `SELECT tl.*, us.workspace_id
       FROM pm_task_links tl
       JOIN pm_tasks t ON tl.source_task_id = t.id
       JOIN pm_user_stories us ON us.id = t.user_story_id
       WHERE tl.id = ?`,
      [linkId]
    );

    if (!link) {
      return res.status(404).json({
        success: false,
        message: 'Task link not found'
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
      [link.workspace_id, userId, link.workspace_id, userId]
    );

    if (!workspaceAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have access to this workspace.'
      });
    }

    // Delete link
    await dbQuery('DELETE FROM pm_task_links WHERE id = ?', [linkId]);

    res.json({
      success: true,
      message: 'Task link deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting task link:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete task link'
    });
  }
});

// Get tasks available for linking (same workspace, excluding current task)
router.get('/available/:taskId', authorizePermission('projects', 'view'), async (req, res) => {
  try {
    const taskId = req.params.taskId;
    const userId = req.user.id;
    const { search } = req.query;

    // Get task and workspace
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

    // Get available tasks (same workspace, exclude current task)
    let query = `
      SELECT 
        t.id,
        t.title,
        t.status,
        us.title as story_title,
        us.id as story_id
       FROM pm_tasks t
       JOIN pm_user_stories us ON us.id = t.user_story_id
       WHERE us.workspace_id = ? AND t.id != ?
    `;
    const params = [task.workspace_id, taskId];

    if (search) {
      query += ' AND (t.title LIKE ? OR us.title LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    query += ' ORDER BY t.created_at DESC LIMIT 50';

    const tasks = await dbQuery(query, params);

    res.json({
      success: true,
      data: tasks
    });
  } catch (error) {
    console.error('Error fetching available tasks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available tasks'
    });
  }
});

module.exports = router;
