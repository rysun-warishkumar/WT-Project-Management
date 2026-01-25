const express = require('express');
const { authenticateToken, authorizePermission } = require('../middleware/auth');
const { body, validationResult, query: validatorQuery } = require('express-validator');
const { query: dbQuery } = require('../config/database');
const { getClientFilter, canAccessClientData } = require('../utils/dataFiltering');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Validation middleware
const validateConversation = [
  body('client_id').isInt({ min: 1 }).withMessage('Valid client ID is required'),
  body('project_id').optional({ nullable: true, checkFalsy: true }).custom((value) => {
    if (value !== null && value !== undefined && value !== '' && (isNaN(value) || parseInt(value) < 1)) {
      throw new Error('Valid project ID is required');
    }
    return true;
  }),
  body('conversation_type').isIn(['email', 'call', 'meeting', 'chat', 'note']).withMessage('Valid conversation type is required'),
  body('subject').optional({ nullable: true }).isString().isLength({ max: 200 }).withMessage('Subject must be a string with max 200 characters'),
  body('message').trim().notEmpty().withMessage('Message is required'),
  body('direction').isIn(['inbound', 'outbound', 'internal']).withMessage('Valid direction is required'),
  body('is_important').optional().isBoolean().withMessage('is_important must be a boolean'),
  body('follow_up_date').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('Valid follow-up date is required'),
];

// Get all conversations with pagination and filters
router.get('/', authorizePermission('conversations', 'view'), [
  validatorQuery('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  validatorQuery('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 1000'),
  validatorQuery('search').optional().isString().withMessage('Search must be a string'),
  validatorQuery('conversation_type').optional().isIn(['email', 'call', 'meeting', 'chat', 'note']).withMessage('Valid conversation type is required'),
  validatorQuery('direction').optional().isIn(['inbound', 'outbound', 'internal']).withMessage('Valid direction is required'),
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
  validatorQuery('is_important').optional().isBoolean().withMessage('is_important must be a boolean'),
  validatorQuery('follow_up_date_from').optional().isISO8601().withMessage('Valid date is required'),
  validatorQuery('follow_up_date_to').optional().isISO8601().withMessage('Valid date is required'),
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
    const conversationType = req.query.conversation_type || '';
    const direction = req.query.direction || '';
    const clientId = req.query.client_id || '';
    const projectId = req.query.project_id || '';
    const isImportant = req.query.is_important;
    const followUpDateFrom = req.query.follow_up_date_from || '';
    const followUpDateTo = req.query.follow_up_date_to || '';

    // Build WHERE clause
    let whereClause = 'WHERE 1=1';
    const whereParams = [];

    // Add client filter for client role users
    const clientFilter = getClientFilter(req, 'c', 'client_id');
    whereClause += clientFilter.whereClause;
    whereParams.push(...clientFilter.whereParams);

    if (search) {
      whereClause += ' AND (c.subject LIKE ? OR c.message LIKE ?)';
      const searchTerm = `%${search}%`;
      whereParams.push(searchTerm, searchTerm);
    }

    if (conversationType) {
      whereClause += ' AND c.conversation_type = ?';
      whereParams.push(conversationType);
    }

    if (direction) {
      whereClause += ' AND c.direction = ?';
      whereParams.push(direction);
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

    if (isImportant !== undefined && isImportant !== '') {
      whereClause += ' AND c.is_important = ?';
      whereParams.push(isImportant === 'true' || isImportant === true);
    }

    if (followUpDateFrom) {
      whereClause += ' AND c.follow_up_date >= ?';
      whereParams.push(followUpDateFrom);
    }

    if (followUpDateTo) {
      whereClause += ' AND c.follow_up_date <= ?';
      whereParams.push(followUpDateTo);
    }

    // Get conversations with related data
    const conversations = await dbQuery(
      `SELECT 
        c.*,
        cl.full_name as client_name,
        cl.company_name as client_company,
        cl.email as client_email,
        p.title as project_title,
        u.full_name as created_by_name
       FROM conversations c
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
       FROM conversations c
       ${whereClause}`,
      whereParams
    );

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        conversations,
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
    console.error('Error fetching conversations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conversations'
    });
  }
});

// Get conversation by ID
router.get('/:id', authorizePermission('conversations', 'view'), async (req, res) => {
  try {
    const conversationId = req.params.id;

    const conversations = await dbQuery(
      `SELECT 
        c.*,
        cl.full_name as client_name,
        cl.company_name as client_company,
        cl.email as client_email,
        cl.phone as client_phone,
        p.title as project_title,
        u.full_name as created_by_name
       FROM conversations c
       LEFT JOIN clients cl ON c.client_id = cl.id
       LEFT JOIN projects p ON c.project_id = p.id
       LEFT JOIN users u ON c.created_by = u.id
       WHERE c.id = ?`,
      [conversationId]
    );

    if (conversations.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    const conversation = conversations[0];

    // Check if client user can access this conversation's data
    if (!canAccessClientData(req, conversation.client_id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view conversations associated with your account.'
      });
    }

    res.json({
      success: true,
      data: conversation
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conversation'
    });
  }
});

// Create conversation
router.post('/', authorizePermission('conversations', 'create'), validateConversation, async (req, res) => {
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
      client_id,
      project_id,
      conversation_type,
      subject,
      message,
      direction,
      is_important,
      follow_up_date
    } = req.body;

    // Check if client exists
    const clientCheck = await dbQuery('SELECT id FROM clients WHERE id = ?', [client_id]);
    if (clientCheck.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Client not found'
      });
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

    // Insert conversation
    const result = await dbQuery(
      `INSERT INTO conversations (
        client_id, project_id, conversation_type, subject, message,
        direction, is_important, follow_up_date, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        client_id,
        project_id || null,
        conversation_type,
        subject || null,
        message.trim(),
        direction,
        is_important || false,
        follow_up_date || null,
        req.user.id
      ]
    );

    const conversationId = result.insertId;

    // Fetch the created conversation
    const conversations = await dbQuery(
      `SELECT 
        c.*,
        cl.full_name as client_name,
        cl.company_name as client_company,
        cl.email as client_email,
        p.title as project_title,
        u.full_name as created_by_name
       FROM conversations c
       LEFT JOIN clients cl ON c.client_id = cl.id
       LEFT JOIN projects p ON c.project_id = p.id
       LEFT JOIN users u ON c.created_by = u.id
       WHERE c.id = ?`,
      [conversationId]
    );

    res.status(201).json({
      success: true,
      message: 'Conversation created successfully',
      data: conversations[0]
    });
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create conversation'
    });
  }
});

// Update conversation
router.put('/:id', authorizePermission('conversations', 'edit'), [
  body('client_id').optional().isInt({ min: 1 }).withMessage('Valid client ID is required'),
  body('project_id').optional({ nullable: true, checkFalsy: true }).custom((value) => {
    if (value !== null && value !== undefined && value !== '' && (isNaN(value) || parseInt(value) < 1)) {
      throw new Error('Valid project ID is required');
    }
    return true;
  }),
  body('conversation_type').optional().isIn(['email', 'call', 'meeting', 'chat', 'note']).withMessage('Valid conversation type is required'),
  body('subject').optional({ nullable: true }).isString().isLength({ max: 200 }).withMessage('Subject must be a string with max 200 characters'),
  body('message').optional().trim().notEmpty().withMessage('Message cannot be empty'),
  body('direction').optional().isIn(['inbound', 'outbound', 'internal']).withMessage('Valid direction is required'),
  body('is_important').optional().isBoolean().withMessage('is_important must be a boolean'),
  body('follow_up_date').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('Valid follow-up date is required'),
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

    const conversationId = req.params.id;
    const {
      client_id,
      project_id,
      conversation_type,
      subject,
      message,
      direction,
      is_important,
      follow_up_date
    } = req.body;

    // Check if conversation exists
    const conversationCheck = await dbQuery('SELECT * FROM conversations WHERE id = ?', [conversationId]);
    if (conversationCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    // Check if client exists (if provided)
    if (client_id !== undefined) {
      const clientCheck = await dbQuery('SELECT id FROM clients WHERE id = ?', [client_id]);
      if (clientCheck.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Client not found'
        });
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

    if (client_id !== undefined) {
      updates.push('client_id = ?');
      updateParams.push(client_id);
    }

    if (project_id !== undefined) {
      updates.push('project_id = ?');
      updateParams.push(project_id || null);
    }

    if (conversation_type !== undefined) {
      updates.push('conversation_type = ?');
      updateParams.push(conversation_type);
    }

    if (subject !== undefined) {
      updates.push('subject = ?');
      updateParams.push(subject || null);
    }

    if (message !== undefined) {
      updates.push('message = ?');
      updateParams.push(message.trim());
    }

    if (direction !== undefined) {
      updates.push('direction = ?');
      updateParams.push(direction);
    }

    if (is_important !== undefined) {
      updates.push('is_important = ?');
      updateParams.push(is_important);
    }

    if (follow_up_date !== undefined) {
      updates.push('follow_up_date = ?');
      updateParams.push(follow_up_date || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updateParams.push(conversationId);

    await dbQuery(
      `UPDATE conversations SET ${updates.join(', ')} WHERE id = ?`,
      updateParams
    );

    // Fetch updated conversation
    const conversations = await dbQuery(
      `SELECT 
        c.*,
        cl.full_name as client_name,
        cl.company_name as client_company,
        cl.email as client_email,
        p.title as project_title,
        u.full_name as created_by_name
       FROM conversations c
       LEFT JOIN clients cl ON c.client_id = cl.id
       LEFT JOIN projects p ON c.project_id = p.id
       LEFT JOIN users u ON c.created_by = u.id
       WHERE c.id = ?`,
      [conversationId]
    );

    res.json({
      success: true,
      message: 'Conversation updated successfully',
      data: conversations[0]
    });
  } catch (error) {
    console.error('Error updating conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update conversation'
    });
  }
});

// Delete conversation
router.delete('/:id', authorizePermission('conversations', 'delete'), async (req, res) => {
  try {
    const conversationId = req.params.id;

    // Check if conversation exists
    const conversationCheck = await dbQuery('SELECT id FROM conversations WHERE id = ?', [conversationId]);
    if (conversationCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    // Delete conversation
    await dbQuery('DELETE FROM conversations WHERE id = ?', [conversationId]);

    res.json({
      success: true,
      message: 'Conversation deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete conversation'
    });
  }
});

module.exports = router;
