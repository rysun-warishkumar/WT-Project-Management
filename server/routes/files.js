const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { authenticateToken, authorizePermission } = require('../middleware/auth');
const { body, validationResult, query: validatorQuery } = require('express-validator');
const { query: dbQuery } = require('../config/database');
const { getClientFilter, canAccessClientData, getWorkspaceFilter } = require('../utils/dataFiltering');
const { workspaceContext } = require('../middleware/workspaceContext');

const router = express.Router();

// Apply authentication + workspace context to all routes
router.use(authenticateToken);
router.use(workspaceContext);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
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
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB default
  },
  fileFilter: (req, file, cb) => {
    // Allow all file types
    cb(null, true);
  }
});

// Helper function to determine file type
const getFileType = (mimeType) => {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text')) return 'document';
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar') || mimeType.includes('gz')) return 'archive';
  return 'other';
};

// Get all files with pagination and filters
router.get('/', authorizePermission('files', 'view'), [
  validatorQuery('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  validatorQuery('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 1000'),
  validatorQuery('search').optional().isString().withMessage('Search must be a string'),
  validatorQuery('file_type').optional().isIn(['document', 'image', 'archive', 'other']).withMessage('Valid file type is required'),
  validatorQuery('client_id').optional().custom((value) => {
    if (value === '' || value === null || value === undefined) return true;
    if (isNaN(value) || parseInt(value) < 1) {
      throw new Error('Valid client ID is required');
    }
    return true;
  }),
  validatorQuery('project_id').optional().custom((value) => {
    if (value === '' || value === null || value === undefined) return true;
    if (isNaN(value) || parseInt(value) < 1) {
      throw new Error('Valid project ID is required');
    }
    return true;
  }),
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

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const fileType = req.query.file_type || '';
    const clientId = req.query.client_id || '';
    const projectId = req.query.project_id || '';

    // Build WHERE clause
    let whereClause = 'WHERE 1=1';
    const whereParams = [];

    // Add workspace filter (primary)
    const workspaceFilter = getWorkspaceFilter(req, 'f', 'workspace_id');
    whereClause += workspaceFilter.whereClause;
    whereParams.push(...workspaceFilter.whereParams);

    // Add client filter for client role users
    const clientFilter = getClientFilter(req, 'f', 'client_id');
    whereClause += clientFilter.whereClause;
    whereParams.push(...clientFilter.whereParams);

    if (search) {
      whereClause += ' AND (f.original_name LIKE ? OR f.description LIKE ?)';
      const searchTerm = `%${search}%`;
      whereParams.push(searchTerm, searchTerm);
    }

    if (fileType) {
      whereClause += ' AND f.file_type = ?';
      whereParams.push(fileType);
    }

    // Only allow filtering by client_id if user is not a client role
    if (clientId && req.user.role !== 'client') {
      whereClause += ' AND f.client_id = ?';
      whereParams.push(clientId);
    }

    if (projectId) {
      whereClause += ' AND f.project_id = ?';
      whereParams.push(projectId);
    }

    // Get files with related data
    const files = await dbQuery(
      `SELECT 
        f.*,
        c.full_name as client_name,
        c.company_name as client_company,
        p.title as project_title,
        u.full_name as uploaded_by_name
       FROM files f
       LEFT JOIN clients c ON f.client_id = c.id
       LEFT JOIN projects p ON f.project_id = p.id
       LEFT JOIN users u ON f.uploaded_by = u.id
       ${whereClause}
       ORDER BY f.created_at DESC
       LIMIT ? OFFSET ?`,
      [...whereParams, limit, offset]
    );

    // Get total count
    const countResult = await dbQuery(
      `SELECT COUNT(*) as total
       FROM files f
       ${whereClause}`,
      whereParams
    );

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        files,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch files'
    });
  }
});

// Get file by ID
router.get('/:id', authorizePermission('files', 'view'), async (req, res) => {
  try {
    const fileId = req.params.id;

    const files = await dbQuery(
      `SELECT 
        f.*,
        c.full_name as client_name,
        c.company_name as client_company,
        p.title as project_title,
        u.full_name as uploaded_by_name
       FROM files f
       LEFT JOIN clients c ON f.client_id = c.id
       LEFT JOIN projects p ON f.project_id = p.id
       LEFT JOIN users u ON f.uploaded_by = u.id
       WHERE f.id = ?`,
      [fileId]
    );

    if (files.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    const file = files[0];

    // Check if client user can access this file's data
    if (file.client_id && !canAccessClientData(req, file.client_id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view files associated with your account.'
      });
    }

    res.json({
      success: true,
      data: file
    });
  } catch (error) {
    console.error('Error fetching file:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch file'
    });
  }
});

// Upload file
router.post('/upload', authorizePermission('files', 'upload'), upload.single('file'), [
  body('client_id').optional().isInt({ min: 1 }).withMessage('Valid client ID is required'),
  body('project_id').optional().isInt({ min: 1 }).withMessage('Valid project ID is required'),
  body('description').optional().isString().withMessage('Description must be a string'),
  body('tags').optional().isString().withMessage('Tags must be a JSON string'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Delete uploaded file if validation fails
      if (req.file) {
        await fs.unlink(req.file.path).catch(() => {});
      }
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

    const { client_id, project_id, description, tags } = req.body;
    const workspaceId = req.workspaceId || req.workspaceFilter?.value;
    if (!workspaceId && !req.isSuperAdmin) {
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(403).json({ success: false, message: 'Workspace context required' });
    }

    // Check if client exists (if provided)
    if (client_id) {
      const wsCli = getWorkspaceFilter(req, '', 'workspace_id');
      const clientCheck = await dbQuery(
        `SELECT id FROM clients WHERE id = ? ${wsCli.whereClause}`,
        [client_id, ...wsCli.whereParams]
      );
      if (clientCheck.length === 0) {
        await fs.unlink(req.file.path).catch(() => {});
        return res.status(400).json({
          success: false,
          message: 'Client not found'
        });
      }
    }

    // Check if project exists (if provided)
    if (project_id) {
      const wsProj = getWorkspaceFilter(req, '', 'workspace_id');
      const projectCheck = await dbQuery(
        `SELECT id FROM projects WHERE id = ? ${wsProj.whereClause}`,
        [project_id, ...wsProj.whereParams]
      );
      if (projectCheck.length === 0) {
        await fs.unlink(req.file.path).catch(() => {});
        return res.status(400).json({
          success: false,
          message: 'Project not found'
        });
      }
    }

    // Parse tags if provided
    let parsedTags = null;
    if (tags) {
      try {
        parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
      } catch {
        parsedTags = null;
      }
    }

    // Determine file type
    const fileType = getFileType(req.file.mimetype);

    // Insert file record
    const result = await dbQuery(
      `INSERT INTO files (
        filename, original_name, file_path, file_size, mime_type, file_type,
        client_id, project_id, uploaded_by, description, tags, workspace_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.file.filename,
        req.file.originalname,
        req.file.path,
        req.file.size,
        req.file.mimetype,
        fileType,
        client_id || null,
        project_id || null,
        req.user.id,
        description || null,
        parsedTags ? JSON.stringify(parsedTags) : null,
        workspaceId || null
      ]
    );

    const fileId = result.insertId;

    // Fetch the created file
    const files = await dbQuery(
      `SELECT 
        f.*,
        c.full_name as client_name,
        c.company_name as client_company,
        p.title as project_title,
        u.full_name as uploaded_by_name
       FROM files f
       LEFT JOIN clients c ON f.client_id = c.id
       LEFT JOIN projects p ON f.project_id = p.id
       LEFT JOIN users u ON f.uploaded_by = u.id
       WHERE f.id = ? ${getWorkspaceFilter(req, 'f', 'workspace_id').whereClause}`,
      [fileId, ...getWorkspaceFilter(req, 'f', 'workspace_id').whereParams]
    );

    res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      data: files[0]
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    // Delete uploaded file if database insert fails
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    res.status(500).json({
      success: false,
      message: 'Failed to upload file'
    });
  }
});

// Download file
router.get('/:id/download', authorizePermission('files', 'download'), async (req, res) => {
  try {
    const fileId = req.params.id;

    const ws = getWorkspaceFilter(req, '', 'workspace_id');
    const files = await dbQuery(
      `SELECT * FROM files WHERE id = ? ${ws.whereClause}`,
      [fileId, ...ws.whereParams]
    );

    if (files.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    const file = files[0];
    
    // file_path stored by multer is already absolute, use it directly
    const filePath = file.file_path;

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      console.error('File access error:', error, 'Path:', filePath);
      return res.status(404).json({
        success: false,
        message: 'File not found on disk'
      });
    }

    // Set headers for download
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.original_name)}"`);
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    
    // Send file
    res.sendFile(path.resolve(filePath), (err) => {
      if (err) {
        console.error('Download error:', err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Failed to download file'
          });
        }
      }
    });
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download file'
    });
  }
});

// Update file metadata
router.put('/:id', authorizePermission('files', 'edit'), [
  body('client_id').optional().isInt({ min: 1 }).withMessage('Valid client ID is required'),
  body('project_id').optional().isInt({ min: 1 }).withMessage('Valid project ID is required'),
  body('description').optional().isString().withMessage('Description must be a string'),
  body('tags').optional().isString().withMessage('Tags must be a JSON string'),
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

    const fileId = req.params.id;
    const { client_id, project_id, description, tags } = req.body;

    // Check if file exists
    const ws = getWorkspaceFilter(req, '', 'workspace_id');
    const fileCheck = await dbQuery(
      `SELECT * FROM files WHERE id = ? ${ws.whereClause}`,
      [fileId, ...ws.whereParams]
    );
    if (fileCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Check if client exists (if provided)
    if (client_id) {
      const wsCli = getWorkspaceFilter(req, '', 'workspace_id');
      const clientCheck = await dbQuery(
        `SELECT id FROM clients WHERE id = ? ${wsCli.whereClause}`,
        [client_id, ...wsCli.whereParams]
      );
      if (clientCheck.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Client not found'
        });
      }
    }

    // Check if project exists (if provided)
    if (project_id) {
      const wsProj = getWorkspaceFilter(req, '', 'workspace_id');
      const projectCheck = await dbQuery(
        `SELECT id FROM projects WHERE id = ? ${wsProj.whereClause}`,
        [project_id, ...wsProj.whereParams]
      );
      if (projectCheck.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Project not found'
        });
      }
    }

    // Parse tags if provided
    let parsedTags = null;
    if (tags !== undefined) {
      if (tags) {
        try {
          parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
        } catch {
          parsedTags = null;
        }
      }
    }

    // Build update query
    const updates = [];
    const updateParams = [];

    if (client_id !== undefined) {
      updates.push('client_id = ?');
      updateParams.push(client_id || null);
    }

    if (project_id !== undefined) {
      updates.push('project_id = ?');
      updateParams.push(project_id || null);
    }

    if (description !== undefined) {
      updates.push('description = ?');
      updateParams.push(description || null);
    }

    if (tags !== undefined) {
      updates.push('tags = ?');
      updateParams.push(parsedTags ? JSON.stringify(parsedTags) : null);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updateParams.push(fileId);

    const wsUpd = getWorkspaceFilter(req, '', 'workspace_id');
    await dbQuery(
      `UPDATE files SET ${updates.join(', ')} WHERE id = ? ${wsUpd.whereClause}`,
      [...updateParams, ...wsUpd.whereParams]
    );

    // Fetch updated file
    const files = await dbQuery(
      `SELECT 
        f.*,
        c.full_name as client_name,
        c.company_name as client_company,
        p.title as project_title,
        u.full_name as uploaded_by_name
       FROM files f
       LEFT JOIN clients c ON f.client_id = c.id
       LEFT JOIN projects p ON f.project_id = p.id
       LEFT JOIN users u ON f.uploaded_by = u.id
       WHERE f.id = ? ${getWorkspaceFilter(req, 'f', 'workspace_id').whereClause}`,
      [fileId, ...getWorkspaceFilter(req, 'f', 'workspace_id').whereParams]
    );

    res.json({
      success: true,
      message: 'File updated successfully',
      data: files[0]
    });
  } catch (error) {
    console.error('Error updating file:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update file'
    });
  }
});

// Delete file
router.delete('/:id', authorizePermission('files', 'delete'), async (req, res) => {
  try {
    const fileId = req.params.id;

    // Get file record
    const wsDel = getWorkspaceFilter(req, '', 'workspace_id');
    const files = await dbQuery(
      `SELECT * FROM files WHERE id = ? ${wsDel.whereClause}`,
      [fileId, ...wsDel.whereParams]
    );

    if (files.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    const file = files[0];

    // Delete file from disk
    try {
      await fs.unlink(file.file_path);
    } catch (error) {
      console.error('Error deleting file from disk:', error);
      // Continue with database deletion even if file deletion fails
    }

    // Delete file record from database
    const wsD = getWorkspaceFilter(req, '', 'workspace_id');
    await dbQuery(`DELETE FROM files WHERE id = ? ${wsD.whereClause}`, [fileId, ...wsD.whereParams]);

    res.json({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete file'
    });
  }
});

module.exports = router;
