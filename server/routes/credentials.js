const express = require('express');
const crypto = require('crypto');
const { authenticateToken, authorizePermission } = require('../middleware/auth');
const { body, validationResult, query: validatorQuery } = require('express-validator');
const { query: dbQuery } = require('../config/database');
const { getClientFilter, canAccessClientData } = require('../utils/dataFiltering');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Encryption key from environment or use default (should be set in production)
// AES-256 requires a 32-byte (256-bit) key
let ENCRYPTION_KEY;
if (process.env.CREDENTIAL_ENCRYPTION_KEY) {
  // If provided as hex string, convert to buffer
  const keyString = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (keyString.length === 64) {
    // Hex string (64 chars = 32 bytes)
    ENCRYPTION_KEY = Buffer.from(keyString, 'hex');
  } else if (keyString.length === 32) {
    // Raw string (32 chars, treat as UTF-8)
    ENCRYPTION_KEY = Buffer.from(keyString, 'utf8');
  } else {
    // Invalid length, generate new one
    console.warn('Invalid CREDENTIAL_ENCRYPTION_KEY length. Generating new key.');
    ENCRYPTION_KEY = crypto.randomBytes(32);
  }
} else {
  // Generate a random 32-byte key
  ENCRYPTION_KEY = crypto.randomBytes(32);
  console.warn('CREDENTIAL_ENCRYPTION_KEY not set. Using randomly generated key. This will cause issues with decryption after restart!');
}

const ALGORITHM = 'aes-256-cbc';

// Helper function to encrypt password
const encryptPassword = (text) => {
  if (!text) return null;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
};

// Helper function to decrypt password
const decryptPassword = (text) => {
  if (!text) return null;
  try {
    const textParts = text.split(':');
    if (textParts.length !== 2) {
      throw new Error('Invalid encrypted format');
    }
    const iv = Buffer.from(textParts[0], 'hex');
    const encryptedText = textParts[1];
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Error decrypting password:', error);
    return null;
  }
};

// Validation middleware
const validateCredential = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('credential_type').isIn(['admin_panel', 'hosting', 'domain', 'ftp', 'database', 'api', 'other']).withMessage('Valid credential type is required'),
  body('password').notEmpty().withMessage('Password is required'),
  body('client_id').optional({ nullable: true, checkFalsy: true }).custom((value) => {
    if (value === '' || value === null || value === undefined) return true;
    if (isNaN(value) || parseInt(value) < 1) {
      throw new Error('Valid client ID is required');
    }
    return true;
  }),
  body('project_id').optional({ nullable: true, checkFalsy: true }).custom((value) => {
    if (value === '' || value === null || value === undefined) return true;
    if (isNaN(value) || parseInt(value) < 1) {
      throw new Error('Valid project ID is required');
    }
    return true;
  }),
  body('url').optional({ nullable: true, checkFalsy: true }).isURL().withMessage('Valid URL is required'),
  body('email').optional({ nullable: true, checkFalsy: true }).isEmail().withMessage('Valid email is required'),
];

// Get all credentials with pagination and filters
router.get('/', authorizePermission('credentials', 'view'), [
  validatorQuery('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  validatorQuery('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 1000'),
  validatorQuery('search').optional().isString().withMessage('Search must be a string'),
  validatorQuery('credential_type').optional().isIn(['admin_panel', 'hosting', 'domain', 'ftp', 'database', 'api', 'other']).withMessage('Valid credential type is required'),
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
    const credentialType = req.query.credential_type || '';
    const clientId = req.query.client_id || '';
    const projectId = req.query.project_id || '';

    // Build WHERE clause
    let whereClause = 'WHERE 1=1';
    const whereParams = [];

    // Add client filter for client role users
    const clientFilter = getClientFilter(req, 'c', 'client_id');
    whereClause += clientFilter.whereClause;
    whereParams.push(...clientFilter.whereParams);

    if (search) {
      whereClause += ' AND (c.title LIKE ? OR c.url LIKE ? OR c.username LIKE ? OR c.email LIKE ?)';
      const searchTerm = `%${search}%`;
      whereParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (credentialType) {
      whereClause += ' AND c.credential_type = ?';
      whereParams.push(credentialType);
    }

    // Only allow filtering by client_id if user is not a client role
    if (clientId && req.user.role !== 'client') {
      whereClause += ' AND c.client_id = ?';
      whereParams.push(clientId);
    }

    if (projectId) {
      whereClause += ' AND c.project_id = ?';
      whereParams.push(projectId);
    }

    // Get credentials with related data (password is encrypted, don't decrypt in list view)
    const credentials = await dbQuery(
      `SELECT 
        c.id,
        c.title,
        c.client_id,
        c.project_id,
        c.credential_type,
        c.url,
        c.ip_address,
        c.username,
        c.email,
        c.notes,
        c.created_by,
        c.created_at,
        c.updated_at,
        cl.full_name as client_name,
        cl.company_name as client_company,
        p.title as project_title,
        u.full_name as created_by_name
       FROM credentials c
       LEFT JOIN clients cl ON c.client_id = cl.id
       LEFT JOIN projects p ON c.project_id = p.id
       LEFT JOIN users u ON c.created_by = u.id
       ${whereClause}
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`,
      [...whereParams, limit, offset]
    );

    // Get total count
    const countResult = await dbQuery(
      `SELECT COUNT(*) as total
       FROM credentials c
       ${whereClause}`,
      whereParams
    );

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        credentials,
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
    console.error('Error fetching credentials:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch credentials'
    });
  }
});

// Get credential by ID (with decrypted password)
router.get('/:id', authorizePermission('credentials', 'view'), async (req, res) => {
  try {
    const credentialId = req.params.id;

    const credentials = await dbQuery(
      `SELECT 
        c.*,
        cl.full_name as client_name,
        cl.company_name as client_company,
        p.title as project_title,
        u.full_name as created_by_name
       FROM credentials c
       LEFT JOIN clients cl ON c.client_id = cl.id
       LEFT JOIN projects p ON c.project_id = p.id
       LEFT JOIN users u ON c.created_by = u.id
       WHERE c.id = ?`,
      [credentialId]
    );

    if (credentials.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Credential not found'
      });
    }

    const credential = credentials[0];

    // Check if client user can access this credential's data
    if (credential.client_id && !canAccessClientData(req, credential.client_id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view credentials associated with your account.'
      });
    }
    
    // Decrypt password for viewing
    const decryptedPassword = decryptPassword(credential.password);
    credential.password = decryptedPassword || '[Decryption Error]';

    res.json({
      success: true,
      data: credential
    });
  } catch (error) {
    console.error('Error fetching credential:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch credential'
    });
  }
});

// Create credential
router.post('/', authorizePermission('credentials', 'create'), validateCredential, async (req, res) => {
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
      title,
      client_id,
      project_id,
      credential_type,
      url,
      ip_address,
      username,
      email,
      password,
      notes
    } = req.body;

    // Check if client exists (if provided)
    if (client_id) {
      const clientCheck = await dbQuery('SELECT id FROM clients WHERE id = ?', [client_id]);
      if (clientCheck.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Client not found'
        });
      }
    }

    // Check if project exists (if provided)
    if (project_id) {
      const projectCheck = await dbQuery('SELECT id FROM projects WHERE id = ?', [project_id]);
      if (projectCheck.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Project not found'
        });
      }
    }

    // Encrypt password
    const encryptedPassword = encryptPassword(password);

    // Insert credential
    const result = await dbQuery(
      `INSERT INTO credentials (
        title, client_id, project_id, credential_type, url, ip_address,
        username, email, password, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        client_id || null,
        project_id || null,
        credential_type,
        url || null,
        ip_address || null,
        username || null,
        email || null,
        encryptedPassword,
        notes || null,
        req.user.id
      ]
    );

    const credentialId = result.insertId;

    // Fetch the created credential
    const credentials = await dbQuery(
      `SELECT 
        c.*,
        cl.full_name as client_name,
        cl.company_name as client_company,
        p.title as project_title,
        u.full_name as created_by_name
       FROM credentials c
       LEFT JOIN clients cl ON c.client_id = cl.id
       LEFT JOIN projects p ON c.project_id = p.id
       LEFT JOIN users u ON c.created_by = u.id
       WHERE c.id = ?`,
      [credentialId]
    );

    const credential = credentials[0];
    // Decrypt password for response
    const decryptedPassword = decryptPassword(credential.password);
    credential.password = decryptedPassword || '[Decryption Error]';

    res.status(201).json({
      success: true,
      message: 'Credential created successfully',
      data: credential
    });
  } catch (error) {
    console.error('Error creating credential:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create credential'
    });
  }
});

// Update credential
router.put('/:id', authorizePermission('credentials', 'edit'), [
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
  body('credential_type').optional().isIn(['admin_panel', 'hosting', 'domain', 'ftp', 'database', 'api', 'other']).withMessage('Valid credential type is required'),
  body('client_id').optional().isInt({ min: 1 }).withMessage('Valid client ID is required'),
  body('project_id').optional().isInt({ min: 1 }).withMessage('Valid project ID is required'),
  body('url').optional().isURL().withMessage('Valid URL is required'),
  body('email').optional().isEmail().withMessage('Valid email is required'),
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

    const credentialId = req.params.id;
    const {
      title,
      client_id,
      project_id,
      credential_type,
      url,
      ip_address,
      username,
      email,
      password,
      notes
    } = req.body;

    // Check if credential exists
    const credentialCheck = await dbQuery('SELECT * FROM credentials WHERE id = ?', [credentialId]);
    if (credentialCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Credential not found'
      });
    }

    // Check if client exists (if provided)
    if (client_id !== undefined) {
      if (client_id) {
        const clientCheck = await dbQuery('SELECT id FROM clients WHERE id = ?', [client_id]);
        if (clientCheck.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Client not found'
          });
        }
      }
    }

    // Check if project exists (if provided)
    if (project_id !== undefined) {
      if (project_id) {
        const projectCheck = await dbQuery('SELECT id FROM projects WHERE id = ?', [project_id]);
        if (projectCheck.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Project not found'
          });
        }
      }
    }

    // Build update query
    const updates = [];
    const updateParams = [];

    if (title !== undefined) {
      updates.push('title = ?');
      updateParams.push(title);
    }

    if (client_id !== undefined) {
      updates.push('client_id = ?');
      updateParams.push(client_id || null);
    }

    if (project_id !== undefined) {
      updates.push('project_id = ?');
      updateParams.push(project_id || null);
    }

    if (credential_type !== undefined) {
      updates.push('credential_type = ?');
      updateParams.push(credential_type);
    }

    if (url !== undefined) {
      updates.push('url = ?');
      updateParams.push(url || null);
    }

    if (ip_address !== undefined) {
      updates.push('ip_address = ?');
      updateParams.push(ip_address || null);
    }

    if (username !== undefined) {
      updates.push('username = ?');
      updateParams.push(username || null);
    }

    if (email !== undefined) {
      updates.push('email = ?');
      updateParams.push(email || null);
    }

    if (password !== undefined) {
      // Encrypt new password
      const encryptedPassword = encryptPassword(password);
      updates.push('password = ?');
      updateParams.push(encryptedPassword);
    }

    if (notes !== undefined) {
      updates.push('notes = ?');
      updateParams.push(notes || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updateParams.push(credentialId);

    await dbQuery(
      `UPDATE credentials SET ${updates.join(', ')} WHERE id = ?`,
      updateParams
    );

    // Fetch updated credential
    const credentials = await dbQuery(
      `SELECT 
        c.*,
        cl.full_name as client_name,
        cl.company_name as client_company,
        p.title as project_title,
        u.full_name as created_by_name
       FROM credentials c
       LEFT JOIN clients cl ON c.client_id = cl.id
       LEFT JOIN projects p ON c.project_id = p.id
       LEFT JOIN users u ON c.created_by = u.id
       WHERE c.id = ?`,
      [credentialId]
    );

    const credential = credentials[0];
    // Decrypt password for response
    const decryptedPassword = decryptPassword(credential.password);
    credential.password = decryptedPassword || '[Decryption Error]';

    res.json({
      success: true,
      message: 'Credential updated successfully',
      data: credential
    });
  } catch (error) {
    console.error('Error updating credential:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update credential'
    });
  }
});

// Delete credential
router.delete('/:id', authorizePermission('credentials', 'delete'), async (req, res) => {
  try {
    const credentialId = req.params.id;

    // Check if credential exists
    const credentialCheck = await dbQuery('SELECT id FROM credentials WHERE id = ?', [credentialId]);
    if (credentialCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Credential not found'
      });
    }

    // Delete credential
    await dbQuery('DELETE FROM credentials WHERE id = ?', [credentialId]);

    res.json({
      success: true,
      message: 'Credential deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting credential:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete credential'
    });
  }
});

module.exports = router;
