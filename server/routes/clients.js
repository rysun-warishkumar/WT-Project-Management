const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { authenticateToken, managerAndAdmin, authorizePermission } = require('../middleware/auth');
const { query: dbQuery } = require('../config/database');
const bcrypt = require('bcryptjs');
const { sendClientCredentials } = require('../utils/email');
const { getClientFilter, canAccessClientData, getWorkspaceFilter } = require('../utils/dataFiltering');
const { workspaceContext } = require('../middleware/workspaceContext');

const router = express.Router();

// Apply authentication and workspace context to all routes
router.use(authenticateToken);
router.use(workspaceContext);

// Validation for client creation/update – clear messages for API responses
const clientValidation = [
  body('full_name').trim().notEmpty().withMessage('Full name is required').isLength({ max: 255 }).withMessage('Full name must be 255 characters or less'),
  body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Please enter a valid email address'),
  body('phone').optional({ checkFalsy: true }).trim().isLength({ max: 30 }).withMessage('Phone number must be 30 characters or less'),
  body('whatsapp').optional({ checkFalsy: true }).trim().isLength({ max: 30 }).withMessage('WhatsApp number must be 30 characters or less'),
  body('company_name').optional({ checkFalsy: true }).trim().isLength({ max: 255 }).withMessage('Company name must be 255 characters or less'),
  body('business_type').optional({ checkFalsy: true }).trim().isLength({ max: 100 }).withMessage('Business type must be 100 characters or less'),
  body('gst_number').optional({ checkFalsy: true }).trim().isLength({ max: 50 }).withMessage('GST number must be 50 characters or less'),
  body('tax_id').optional({ checkFalsy: true }).trim().isLength({ max: 50 }).withMessage('Tax ID must be 50 characters or less')
];

// Get all clients with pagination and search
router.get('/', authorizePermission('clients', 'view'), [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 1000'),
  query('search').optional().isLength({ max: 100 }).withMessage('Search term too long'),
  query('status').optional().custom((value) => {
    if (value && !['active', 'inactive', 'prospect'].includes(value)) {
      throw new Error('Invalid status');
    }
    return true;
  }),
  query('business_type').optional().isLength({ max: 50 }).withMessage('Business type too long')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errList = errors.array().map((e) => ({ field: e.path, message: e.msg }));
      return res.status(400).json({
        success: false,
        message: errList[0]?.message || 'Invalid filter or pagination',
        errors: errList
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const status = req.query.status;
    const businessType = req.query.business_type;

    // Build WHERE clause for COUNT query (no alias)
    let countWhereClause = 'WHERE 1=1';
    const countWhereParams = [];

    // Build WHERE clause for SELECT query (with alias)
    let selectWhereClause = 'WHERE 1=1';
    const selectWhereParams = [];

    // Add workspace filter (primary) and client filter (legacy support)
    // For COUNT query - no alias
    const countWorkspaceFilter = getWorkspaceFilter(req, '', 'workspace_id');
    countWhereClause += countWorkspaceFilter.whereClause;
    countWhereParams.push(...countWorkspaceFilter.whereParams);
    
    const countClientFilter = getClientFilter(req, '', 'id');
    countWhereClause += countClientFilter.whereClause;
    countWhereParams.push(...countClientFilter.whereParams);

    countWhereClause += ' AND (deleted_at IS NULL)';
    selectWhereClause += ' AND (c.deleted_at IS NULL)';

    // For SELECT query - with alias
    const selectWorkspaceFilter = getWorkspaceFilter(req, 'c', 'workspace_id');
    selectWhereClause += selectWorkspaceFilter.whereClause;
    selectWhereParams.push(...selectWorkspaceFilter.whereParams);
    
    const selectClientFilter = getClientFilter(req, 'c', 'id');
    selectWhereClause += selectClientFilter.whereClause;
    selectWhereParams.push(...selectClientFilter.whereParams);

    if (search) {
      const searchTerm = `%${search}%`;
      countWhereClause += ' AND (full_name LIKE ? OR company_name LIKE ? OR email LIKE ? OR phone LIKE ?)';
      countWhereParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
      selectWhereClause += ' AND (c.full_name LIKE ? OR c.company_name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)';
      selectWhereParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (status) {
      countWhereClause += ' AND status = ?';
      countWhereParams.push(status);
      selectWhereClause += ' AND c.status = ?';
      selectWhereParams.push(status);
    }

    if (businessType) {
      countWhereClause += ' AND business_type = ?';
      countWhereParams.push(businessType);
      selectWhereClause += ' AND c.business_type = ?';
      selectWhereParams.push(businessType);
    }

    // Get total count
    const countResult = await dbQuery(
      `SELECT COUNT(*) as total FROM clients ${countWhereClause}`,
      countWhereParams
    );
    const total = countResult[0].total;

         // Get clients with pagination
     const clients = await dbQuery(
       `SELECT 
         c.*,
         COALESCE(pc.project_count, 0) as project_count,
         COALESCE(pc.completed_projects, 0) as completed_projects,
         COALESCE(pc.active_projects, 0) as active_projects
        FROM clients c
        LEFT JOIN (
          SELECT 
            client_id,
            COUNT(*) as project_count,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_projects,
            COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as active_projects
          FROM projects
          WHERE deleted_at IS NULL
          GROUP BY client_id
        ) pc ON c.id = pc.client_id
        ${selectWhereClause}
        ORDER BY c.created_at DESC
        LIMIT ? OFFSET ?`,
       [...selectWhereParams, limit, offset]
     );

    // Get business types for filter (with workspace filter)
    const businessTypesWorkspaceFilter = getWorkspaceFilter(req, '', 'workspace_id');
    const businessTypes = await dbQuery(
      `SELECT DISTINCT business_type FROM clients 
       WHERE business_type IS NOT NULL AND business_type != "" 
       ${businessTypesWorkspaceFilter.whereClause}`,
      businessTypesWorkspaceFilter.whereParams
    );

    // Set cache control headers to prevent caching
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.json({
      success: true,
      data: {
        clients,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        },
        filters: {
          businessTypes: businessTypes.map(bt => bt.business_type)
        }
      }
    });
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch clients'
    });
  }
});

// Get single client by ID
router.get('/:id', authorizePermission('clients', 'view'), async (req, res) => {
  try {
    const clientId = parseInt(req.params.id);
    
    if (isNaN(clientId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid client ID'
      });
    }

    // Check if client user can access this client's data
    if (!canAccessClientData(req, clientId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own client data.'
      });
    }

    const clients = await dbQuery(
      `SELECT 
        c.*,
        COUNT(p.id) as project_count,
        COUNT(CASE WHEN p.status = 'completed' THEN 1 END) as completed_projects,
        COUNT(CASE WHEN p.status = 'in_progress' THEN 1 END) as active_projects
       FROM clients c
       LEFT JOIN projects p ON c.id = p.client_id
       WHERE c.id = ?
       GROUP BY c.id`,
      [clientId]
    );

    if (clients.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Get client's projects
    const projects = await dbQuery(
      'SELECT id, title, status, type, start_date, end_date FROM projects WHERE client_id = ? ORDER BY created_at DESC',
      [clientId]
    );

    // Get client's recent conversations
    const conversations = await dbQuery(
      'SELECT id, conversation_type, subject, message, direction, is_important, created_at FROM conversations WHERE client_id = ? ORDER BY created_at DESC LIMIT 10',
      [clientId]
    );

    // Get client's recent invoices
    const invoices = await dbQuery(
      'SELECT id, invoice_number, invoice_date, due_date, total_amount, status FROM invoices WHERE client_id = ? ORDER BY created_at DESC LIMIT 10',
      [clientId]
    );

    const client = clients[0];
    client.projects = projects;
    client.conversations = conversations;
    client.invoices = invoices;

    // Set cache control headers to prevent caching
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.json({
      success: true,
      data: client
    });
  } catch (error) {
    console.error('Get client error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch client'
    });
  }
});

// Create new client
router.post('/', authorizePermission('clients', 'create'), clientValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errList = errors.array().map((e) => ({ field: e.path, message: e.msg }));
      const firstMsg = errList[0]?.message || 'Please fix the errors below';
      return res.status(400).json({
        success: false,
        message: firstMsg,
        errors: errList
      });
    }

    const {
      company_name,
      full_name,
      email,
      phone,
      whatsapp,
      business_type,
      gst_number,
      tax_id,
      address,
      city,
      state,
      country,
      postal_code,
      tags,
      onboarding_date,
      status,
      notes
    } = req.body;

    // Get workspace ID
    const workspaceId = req.workspaceId || req.workspaceFilter?.value;
    if (!workspaceId && !req.isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Workspace context required'
      });
    }

    // Check if email already exists (within workspace)
    const existingClientsWhere = workspaceId 
      ? 'WHERE email = ? AND workspace_id = ?'
      : 'WHERE email = ?';
    const existingClientsParams = workspaceId 
      ? [email, workspaceId]
      : [email];
    
    const existingClients = await dbQuery(
      `SELECT id FROM clients ${existingClientsWhere}`,
      existingClientsParams
    );

    if (existingClients.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'A client with this email address already exists. Please use a different email.'
      });
    }

    // Insert new client (with workspace_id)
    const result = await dbQuery(
      `INSERT INTO clients (
        company_name, full_name, email, phone, whatsapp, business_type,
        gst_number, tax_id, address, city, state, country, postal_code,
        tags, onboarding_date, status, notes, workspace_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        company_name, full_name, email, phone, whatsapp, business_type,
        gst_number, tax_id, address, city, state, country, postal_code,
        tags ? JSON.stringify(tags) : null, onboarding_date, status || 'active', notes,
        workspaceId || null
      ]
    );

    // Get the created client (by insertId; fallback by workspace+email when insertId is 0 - hotfix for broken AUTO_INCREMENT on some hosts)
    let newClient;
    const insertId = result.insertId != null ? Number(result.insertId) : 0;
    if (insertId > 0) {
      newClient = await dbQuery('SELECT * FROM clients WHERE id = ?', [insertId]);
    }
    if (!newClient || newClient.length === 0) {
      newClient = await dbQuery(
        'SELECT * FROM clients WHERE workspace_id <=> ? AND email = ? ORDER BY id DESC LIMIT 1',
        [workspaceId || null, email]
      );
    }
    if (!newClient || newClient.length === 0) {
      return res.status(500).json({
        success: false,
        message: 'Client was created but could not be retrieved. Please refresh the list or contact support.'
      });
    }

    // Auto-create client user account
    let userCreated = false;
    let userCredentials = null;
    try {
      // Check if user with this email already exists
      const existingUser = await dbQuery(
        'SELECT id FROM users WHERE email = ?',
        [email]
      );

      if (existingUser.length === 0) {
        // Generate a random password
        const randomPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8) + 'A1!';
        const hashedPassword = await bcrypt.hash(randomPassword, 12);

        // Generate username from email (before @) or use full_name
        const usernameBase = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
        let username = usernameBase;
        let counter = 1;
        
        // Ensure username is unique
        while (true) {
          const usernameCheck = await dbQuery(
            'SELECT id FROM users WHERE username = ?',
            [username]
          );
          if (usernameCheck.length === 0) break;
          username = `${usernameBase}${counter}`;
          counter++;
        }

        // Create user account (use newClient[0].id so it's correct even when insertId was 0)
        await dbQuery(
          `INSERT INTO users (username, email, password, full_name, role, client_id, is_active)
           VALUES (?, ?, ?, ?, 'client', ?, 1)`,
          [username, email, hashedPassword, full_name, newClient[0].id]
        );

        userCreated = true;
        userCredentials = {
          email: email,
          password: randomPassword,
          username: username
        };

        // Send credentials email (non-blocking)
        sendClientCredentials(newClient[0], userCredentials).catch(err => {
          console.error('Failed to send credentials email:', err);
          // Don't fail the request if email fails
        });
      }
    } catch (userError) {
      console.error('Error creating client user account:', userError);
      // Continue even if user creation fails - client is already created
    }

    res.status(201).json({
      success: true,
      message: userCreated 
        ? 'Client created successfully. User account created and credentials sent via email.' 
        : 'Client created successfully',
      data: newClient[0],
      user_created: userCreated,
      credentials_sent: userCreated && userCredentials !== null
    });
  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to create client. Please try again or contact support if the problem continues.'
    });
  }
});

// Update client
router.put('/:id', authorizePermission('clients', 'edit'), clientValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errList = errors.array().map((e) => ({ field: e.path, message: e.msg }));
      const firstMsg = errList[0]?.message || 'Please fix the errors below';
      return res.status(400).json({
        success: false,
        message: firstMsg,
        errors: errList
      });
    }

    const clientId = parseInt(req.params.id);
    
    if (isNaN(clientId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid client. Please refresh and try again.'
      });
    }

    const {
      company_name,
      full_name,
      email,
      phone,
      whatsapp,
      business_type,
      gst_number,
      tax_id,
      address,
      city,
      state,
      country,
      postal_code,
      tags,
      onboarding_date,
      status,
      notes
    } = req.body;

    // Check if client exists
    const existingClients = await dbQuery(
      'SELECT id FROM clients WHERE id = ? AND deleted_at IS NULL',
      [clientId]
    );

    if (existingClients.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Check if email is already taken by another client
    if (email) {
      const emailCheck = await dbQuery(
        'SELECT id FROM clients WHERE email = ? AND id != ? AND deleted_at IS NULL',
        [email, clientId]
      );

      if (emailCheck.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Email already exists'
        });
      }
    }

    // Update client
    await dbQuery(
      `UPDATE clients SET 
        company_name = ?, full_name = ?, email = ?, phone = ?, whatsapp = ?,
        business_type = ?, gst_number = ?, tax_id = ?, address = ?, city = ?,
        state = ?, country = ?, postal_code = ?, tags = ?, onboarding_date = ?,
        status = ?, notes = ?
       WHERE id = ?`,
      [
        company_name, full_name, email, phone, whatsapp, business_type,
        gst_number, tax_id, address, city, state, country, postal_code,
        tags ? JSON.stringify(tags) : null, onboarding_date, status, notes, clientId
      ]
    );

    // Get updated client
    const updatedClient = await dbQuery(
      'SELECT * FROM clients WHERE id = ?',
      [clientId]
    );

    res.json({
      success: true,
      message: 'Client updated successfully',
      data: updatedClient[0]
    });
  } catch (error) {
    console.error('Update client error:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to update client. Please try again or contact support if the problem continues.'
    });
  }
});

// Delete client
router.delete('/:id', authorizePermission('clients', 'delete'), async (req, res) => {
  try {
    const clientId = parseInt(req.params.id);
    
    if (isNaN(clientId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid client ID'
      });
    }

    // Check if client has active projects (only non-deleted projects)
    const activeProjects = await dbQuery(
      'SELECT COUNT(*) as count FROM projects WHERE client_id = ? AND deleted_at IS NULL AND status IN ("planning", "in_progress", "review")',
      [clientId]
    );

    if (activeProjects[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete client with active projects'
      });
    }

    // Check if client has unpaid invoices
    const unpaidInvoices = await dbQuery(
      'SELECT COUNT(*) as count FROM invoices WHERE client_id = ? AND status IN ("sent", "partial", "overdue")',
      [clientId]
    );

    if (unpaidInvoices[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete client with unpaid invoices'
      });
    }

    // Soft delete: keep data, hide from user
    await dbQuery(
      'UPDATE clients SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL',
      [clientId]
    );

    res.json({
      success: true,
      message: 'Client deleted successfully'
    });
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete client'
    });
  }
});

// Get client statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const stats = await dbQuery(`
      SELECT 
        COUNT(*) as total_clients,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_clients,
        COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_clients,
        COUNT(CASE WHEN status = 'prospect' THEN 1 END) as prospect_clients,
        COUNT(CASE WHEN onboarding_date >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as new_clients_30_days
      FROM clients
      WHERE deleted_at IS NULL
    `);

    const businessTypeStats = await dbQuery(`
      SELECT 
        business_type,
        COUNT(*) as count
      FROM clients 
      WHERE business_type IS NOT NULL AND business_type != '' AND deleted_at IS NULL
      GROUP BY business_type
      ORDER BY count DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      data: {
        overview: stats[0],
        businessTypes: businessTypeStats
      }
    });
  } catch (error) {
    console.error('Get client stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch client statistics'
    });
  }
});

module.exports = router;
