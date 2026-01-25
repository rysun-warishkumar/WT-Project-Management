const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { authenticateToken, authorizePermission } = require('../../middleware/auth');
const { body, validationResult } = require('express-validator');
const { query: dbQuery } = require('../../config/database');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../../uploads/pm');
const ensureUploadsDir = async () => {
  try {
    await fs.access(uploadsDir);
  } catch {
    await fs.mkdir(uploadsDir, { recursive: true });
  }
};
ensureUploadsDir();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    await ensureUploadsDir();
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'pm-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB default
  },
  fileFilter: (req, file, cb) => {
    // Allow all file types for PM attachments
    cb(null, true);
  }
});

// Get attachments for an entity
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

    // Get entity and check workspace access
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

    // Get attachments
    const attachments = await dbQuery(
      `SELECT 
        a.*,
        u.full_name as uploaded_by_name,
        u.email as uploaded_by_email
       FROM pm_attachments a
       LEFT JOIN users u ON a.uploaded_by = u.id
       WHERE a.entity_type = ? AND a.entity_id = ?
       ORDER BY a.created_at DESC`,
      [entityType, entityId]
    );

    res.json({
      success: true,
      data: attachments.map(att => ({
        id: att.id,
        comment_id: att.comment_id,
        entity_type: att.entity_type,
        entity_id: att.entity_id,
        file_name: att.file_name,
        file_path: att.file_path,
        file_size: att.file_size,
        mime_type: att.mime_type,
        uploaded_by: att.uploaded_by,
        uploaded_by_name: att.uploaded_by_name,
        uploaded_by_email: att.uploaded_by_email,
        created_at: att.created_at
      }))
    });
  } catch (error) {
    console.error('Error fetching attachments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch attachments'
    });
  }
});

// Upload attachment
router.post('/:entityType/:entityId', 
  authorizePermission('projects', 'edit'),
  upload.single('file'),
  [
    body('comment_id').optional().isInt().withMessage('Comment ID must be a valid integer'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }

      const { entityType, entityId } = req.params;
      const { comment_id } = req.body;
      const userId = req.user.id;

      // Validate entity type
      if (!['user_story', 'task', 'epic'].includes(entityType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid entity type'
        });
      }

      // Get entity and check workspace access
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
        // Clean up uploaded file
        await fs.unlink(req.file.path).catch(() => {});
        return res.status(403).json({
          success: false,
          message: 'Access denied. You do not have access to this workspace.'
        });
      }

      // Save attachment to database
      const result = await dbQuery(
        `INSERT INTO pm_attachments 
         (comment_id, entity_type, entity_id, file_name, file_path, file_size, mime_type, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          comment_id || null,
          entityType,
          entityId,
          req.file.originalname,
          req.file.path,
          req.file.size,
          req.file.mimetype,
          userId
        ]
      );

      const attachmentId = result.insertId;

      // Get created attachment
      const [attachment] = await dbQuery(
        `SELECT 
          a.*,
          u.full_name as uploaded_by_name,
          u.email as uploaded_by_email
         FROM pm_attachments a
         LEFT JOIN users u ON a.uploaded_by = u.id
         WHERE a.id = ?`,
        [attachmentId]
      );

      res.status(201).json({
        success: true,
        message: 'File uploaded successfully',
        data: {
          id: attachment.id,
          comment_id: attachment.comment_id,
          entity_type: attachment.entity_type,
          entity_id: attachment.entity_id,
          file_name: attachment.file_name,
          file_path: attachment.file_path,
          file_size: attachment.file_size,
          mime_type: attachment.mime_type,
          uploaded_by: attachment.uploaded_by,
          uploaded_by_name: attachment.uploaded_by_name,
          uploaded_by_email: attachment.uploaded_by_email,
          created_at: attachment.created_at
        }
      });
    } catch (error) {
      console.error('Error uploading attachment:', error);
      // Clean up uploaded file on error
      if (req.file) {
        await fs.unlink(req.file.path).catch(() => {});
      }
      res.status(500).json({
        success: false,
        message: 'Failed to upload file'
      });
    }
  }
);

// Download attachment
router.get('/download/:id', authorizePermission('projects', 'view'), async (req, res) => {
  try {
    const attachmentId = req.params.id;
    const userId = req.user.id;

    // Get attachment with workspace_id
    const [attachment] = await dbQuery(
      `SELECT 
        a.*,
        COALESCE(
          us.workspace_id,
          us2.workspace_id,
          e.workspace_id
        ) as workspace_id
       FROM pm_attachments a
       LEFT JOIN pm_user_stories us ON us.id = a.entity_id AND a.entity_type = 'user_story'
       LEFT JOIN pm_tasks t ON t.id = a.entity_id AND a.entity_type = 'task'
       LEFT JOIN pm_user_stories us2 ON us2.id = t.user_story_id AND a.entity_type = 'task'
       LEFT JOIN pm_epics e ON e.id = a.entity_id AND a.entity_type = 'epic'
       WHERE a.id = ?`,
      [attachmentId]
    );

    if (!attachment) {
      return res.status(404).json({
        success: false,
        message: 'Attachment not found'
      });
    }

    const workspaceId = attachment.workspace_id;

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

    // Check if file exists
    try {
      await fs.access(attachment.file_path);
    } catch {
      return res.status(404).json({
        success: false,
        message: 'File not found on server'
      });
    }

    // Send file
    res.download(attachment.file_path, attachment.file_name, (err) => {
      if (err) {
        console.error('Error downloading file:', err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Failed to download file'
          });
        }
      }
    });
  } catch (error) {
    console.error('Error downloading attachment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download file'
    });
  }
});

// Delete attachment
router.delete('/:id', authorizePermission('projects', 'edit'), async (req, res) => {
  try {
    const attachmentId = req.params.id;
    const userId = req.user.id;

    // Get attachment with workspace_id
    const [attachment] = await dbQuery(
      `SELECT 
        a.*,
        COALESCE(
          us.workspace_id,
          us2.workspace_id,
          e.workspace_id
        ) as workspace_id
       FROM pm_attachments a
       LEFT JOIN pm_user_stories us ON us.id = a.entity_id AND a.entity_type = 'user_story'
       LEFT JOIN pm_tasks t ON t.id = a.entity_id AND a.entity_type = 'task'
       LEFT JOIN pm_user_stories us2 ON us2.id = t.user_story_id AND a.entity_type = 'task'
       LEFT JOIN pm_epics e ON e.id = a.entity_id AND a.entity_type = 'epic'
       WHERE a.id = ?`,
      [attachmentId]
    );

    if (!attachment) {
      return res.status(404).json({
        success: false,
        message: 'Attachment not found'
      });
    }

    const workspaceId = attachment.workspace_id;

    // Check if user owns the attachment or has workspace admin access
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

    if (!workspaceAccess && attachment.uploaded_by !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only delete your own attachments or need workspace admin access.'
      });
    }

    // Delete file from filesystem
    try {
      await fs.unlink(attachment.file_path);
    } catch (error) {
      console.error('Error deleting file from filesystem:', error);
      // Continue with database deletion even if file deletion fails
    }

    // Delete from database
    await dbQuery('DELETE FROM pm_attachments WHERE id = ?', [attachmentId]);

    res.json({
      success: true,
      message: 'Attachment deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting attachment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete attachment'
    });
  }
});

module.exports = router;
