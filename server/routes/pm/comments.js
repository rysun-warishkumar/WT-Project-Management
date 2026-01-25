const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, authorizePermission } = require('../../middleware/auth');
const { query: dbQuery } = require('../../config/database');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get comments for an entity
router.get('/:entityType/:entityId', authorizePermission('projects', 'view'), async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const userId = req.user.id;

    // Validate entity type
    if (!['user_story', 'task', 'epic'].includes(entityType)) {
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
    } else if (entityType === 'task') {
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

    // Get comments
    const comments = await dbQuery(
      `SELECT 
        c.*,
        u.full_name as created_by_name,
        u.email as created_by_email,
        u.username as created_by_username
       FROM pm_comments c
       LEFT JOIN users u ON c.created_by = u.id
       WHERE c.entity_type = ? AND c.entity_id = ?
       ORDER BY c.created_at ASC`,
      [entityType, entityId]
    );

    res.json({
      success: true,
      data: comments
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch comments'
    });
  }
});

// Create comment
router.post('/:entityType/:entityId', authorizePermission('projects', 'create'), [
  body('comment').trim().notEmpty().withMessage('Comment is required'),
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

    const { entityType, entityId } = req.params;
    const { comment } = req.body;
    const userId = req.user.id;

    // Validate entity type
    if (!['user_story', 'task', 'epic'].includes(entityType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid entity type'
      });
    }

    // Get workspace_id and verify entity exists
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

    // Create comment
    const result = await dbQuery(
      `INSERT INTO pm_comments (entity_type, entity_id, comment, created_by)
       VALUES (?, ?, ?, ?)`,
      [entityType, entityId, comment, userId]
    );

    const commentId = result.insertId;

    // Get created comment
    const [newComment] = await dbQuery(
      `SELECT 
        c.*,
        u.full_name as created_by_name,
        u.email as created_by_email,
        u.username as created_by_username
       FROM pm_comments c
       LEFT JOIN users u ON c.created_by = u.id
       WHERE c.id = ?`,
      [commentId]
    );

    // Log activity
    await dbQuery(
      `INSERT INTO pm_activities (workspace_id, entity_type, entity_id, action, performed_by)
       VALUES (?, ?, ?, 'commented', ?)`,
      [workspaceId, entityType, entityId, userId]
    );

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      data: newComment
    });
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create comment'
    });
  }
});

// Update comment
router.put('/:id', authorizePermission('projects', 'edit'), [
  body('comment').trim().notEmpty().withMessage('Comment is required'),
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

    const commentId = req.params.id;
    const { comment } = req.body;
    const userId = req.user.id;

    // Get existing comment
    const [existingComment] = await dbQuery(
      'SELECT * FROM pm_comments WHERE id = ?',
      [commentId]
    );

    if (!existingComment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found'
      });
    }

    // Check if user is the creator
    if (existingComment.created_by !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only edit your own comments.'
      });
    }

    // Update comment
    await dbQuery(
      'UPDATE pm_comments SET comment = ? WHERE id = ?',
      [comment, commentId]
    );

    // Get updated comment
    const [updatedComment] = await dbQuery(
      `SELECT 
        c.*,
        u.full_name as created_by_name,
        u.email as created_by_email,
        u.username as created_by_username
       FROM pm_comments c
       LEFT JOIN users u ON c.created_by = u.id
       WHERE c.id = ?`,
      [commentId]
    );

    res.json({
      success: true,
      message: 'Comment updated successfully',
      data: updatedComment
    });
  } catch (error) {
    console.error('Error updating comment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update comment'
    });
  }
});

// Delete comment
router.delete('/:id', authorizePermission('projects', 'delete'), async (req, res) => {
  try {
    const commentId = req.params.id;
    const userId = req.user.id;

    // Get existing comment
    const [existingComment] = await dbQuery(
      'SELECT * FROM pm_comments WHERE id = ?',
      [commentId]
    );

    if (!existingComment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found'
      });
    }

    // Check if user is the creator or workspace admin/owner
    if (existingComment.created_by !== userId) {
      // Check if user is workspace admin/owner
      let workspaceId;
      if (existingComment.entity_type === 'user_story') {
        const [story] = await dbQuery(
          'SELECT workspace_id FROM pm_user_stories WHERE id = ?',
          [existingComment.entity_id]
        );
        workspaceId = story?.workspace_id;
      } else if (existingComment.entity_type === 'task') {
        const [task] = await dbQuery(
          `SELECT us.workspace_id 
           FROM pm_tasks t
           LEFT JOIN pm_user_stories us ON t.user_story_id = us.id
           WHERE t.id = ?`,
          [existingComment.entity_id]
        );
        workspaceId = task?.workspace_id;
      }

      if (workspaceId) {
        const [workspaceAccess] = await dbQuery(
          `SELECT wm.role 
           FROM pm_workspace_members wm
           WHERE wm.workspace_id = ? AND wm.user_id = ? AND wm.role IN ('owner', 'admin')
           UNION
           SELECT 'owner' as role
           FROM pm_workspaces w
           WHERE w.id = ? AND w.created_by = ?`,
          [workspaceId, userId, workspaceId, userId]
        );

        if (!workspaceAccess) {
          return res.status(403).json({
            success: false,
            message: 'Access denied. You can only delete your own comments or be a workspace admin.'
          });
        }
      } else {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only delete your own comments.'
        });
      }
    }

    // Delete comment
    await dbQuery('DELETE FROM pm_comments WHERE id = ?', [commentId]);

    res.json({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete comment'
    });
  }
});

module.exports = router;
