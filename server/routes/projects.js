const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles, authorizePermission } = require('../middleware/auth');
const { body, validationResult, query: validatorQuery } = require('express-validator');
const { query: dbQuery } = require('../config/database');
const { getClientFilter, canAccessClientData, getWorkspaceFilter } = require('../utils/dataFiltering');
const { workspaceContext } = require('../middleware/workspaceContext');

// Apply authentication + workspace context to all routes
router.use(authenticateToken);
router.use(workspaceContext);

// Validation middleware – clear messages for API responses
const validateProject = [
  body('title').trim().notEmpty().withMessage('Project title is required').isLength({ max: 255 }).withMessage('Title must be 255 characters or less'),
  body('client_id').notEmpty().withMessage('Please select a client').bail().toInt().isInt({ min: 1 }).withMessage('Valid client is required'),
  body('type').notEmpty().withMessage('Please select a project type').bail().isIn(['website', 'ecommerce', 'mobile_app', 'web_app', 'design', 'consulting', 'maintenance', 'other']).withMessage('Please select a valid project type'),
  body('status').notEmpty().withMessage('Please select a status').bail().isIn(['planning', 'in_progress', 'review', 'completed', 'on_hold', 'cancelled']).withMessage('Please select a valid status'),
  body('start_date').optional({ checkFalsy: true }).isISO8601().withMessage('Start date must be a valid date (YYYY-MM-DD)'),
  body('end_date').optional({ checkFalsy: true }).isISO8601().withMessage('End date must be a valid date (YYYY-MM-DD)'),
  body('end_date').custom((value, { req }) => {
    if (req.body.status === 'completed' && !value) {
      throw new Error('End date is required when status is Completed');
    }
    return true;
  }),
  body('budget').optional({ checkFalsy: true }).isFloat({ min: 0 }).withMessage('Budget must be zero or a positive number'),
  body('admin_url').optional({ checkFalsy: true }).custom((value) => {
    if (value && value.trim() && !/^https?:\/\/.+/.test(value)) {
      throw new Error('Admin URL must start with http:// or https://');
    }
    return true;
  }),
  body('delivery_link').optional({ checkFalsy: true }).custom((value) => {
    if (value && value.trim() && !/^https?:\/\/.+/.test(value)) {
      throw new Error('Delivery link must start with http:// or https://');
    }
    return true;
  }),
];

// Helper function to process technology stack
const processTechnologyStack = (techStack) => {
  if (!techStack) return null;
  
  try {
    // If it's already a JSON string, parse it
    if (typeof techStack === 'string' && techStack.startsWith('[')) {
      return JSON.parse(techStack);
    }
    
    // If it's a string with newlines, split it
    if (typeof techStack === 'string') {
      return techStack.split('\n')
        .map(item => item.trim())
        .filter(item => item.length > 0);
    }
    
    // If it's already an array, return it
    if (Array.isArray(techStack)) {
      return techStack.filter(item => item && item.trim().length > 0);
    }
    
    return null;
  } catch (error) {
    console.error('Error processing technology stack:', error);
    return null;
  }
};

// Get all projects with pagination and filters
router.get('/', authorizePermission('projects', 'view'), [
  validatorQuery('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  validatorQuery('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 1000'),
  validatorQuery('search').optional().isString().withMessage('Search must be a string'),
  validatorQuery('status').optional().custom((value) => {
    if (value && !['planning', 'in_progress', 'review', 'completed', 'on_hold', 'cancelled'].includes(value)) {
      throw new Error('Valid status is required');
    }
    return true;
  }),
  validatorQuery('type').optional().custom((value) => {
    if (value && !['website', 'ecommerce', 'mobile_app', 'web_app', 'design', 'consulting', 'maintenance', 'other'].includes(value)) {
      throw new Error('Valid type is required');
    }
    return true;
  }),
  validatorQuery('client_id').optional().custom((value) => {
    if (value && !Number.isInteger(parseInt(value))) {
      throw new Error('Valid client ID is required');
    }
    return true;
  }),
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
    const status = req.query.status || '';
    const type = req.query.type || '';
    const clientId = req.query.client_id || '';

    // Build WHERE clause
    let whereClause = 'WHERE 1=1';
    const whereParams = [];

    // Add workspace filter (primary)
    const workspaceFilter = getWorkspaceFilter(req, 'p', 'workspace_id');
    whereClause += workspaceFilter.whereClause;
    whereParams.push(...workspaceFilter.whereParams);

    // Exclude soft-deleted projects (deleted = hidden for user, kept in DB)
    whereClause += ' AND (p.deleted_at IS NULL)';

    // Add client filter for client role users
    const clientFilter = getClientFilter(req, 'p', 'client_id');
    whereClause += clientFilter.whereClause;
    whereParams.push(...clientFilter.whereParams);

    if (search) {
      whereClause += ' AND (p.title LIKE ? OR p.description LIKE ? OR c.full_name LIKE ? OR c.company_name LIKE ?)';
      const searchTerm = `%${search}%`;
      whereParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (status) {
      whereClause += ' AND p.status = ?';
      whereParams.push(status);
    }

    if (type) {
      whereClause += ' AND p.type = ?';
      whereParams.push(type);
    }

    // Only allow filtering by client_id if user is not a client role
    // (client role users are already filtered above)
    if (clientId && req.user.role !== 'client') {
      whereClause += ' AND p.client_id = ?';
      whereParams.push(clientId);
    }

    // Get projects with client information
    const projects = await dbQuery(
      `SELECT 
        p.*,
        c.full_name as client_name,
        c.company_name as client_company,
        c.email as client_email,
        COALESCE(i.invoice_count, 0) as invoice_count,
        COALESCE(i.total_billed, 0) as total_billed,
        COALESCE(i.total_paid, 0) as total_paid
       FROM projects p
       LEFT JOIN clients c ON p.client_id = c.id
       LEFT JOIN (
         SELECT 
           project_id,
           COUNT(*) as invoice_count,
           SUM(total_amount) as total_billed,
           SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END) as total_paid
         FROM invoices
         WHERE project_id IS NOT NULL
         GROUP BY project_id
       ) i ON p.id = i.project_id
       ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [...whereParams, limit, offset]
    );

    // Get total count for pagination
    const countResult = await dbQuery(
      `SELECT COUNT(*) as total
       FROM projects p
       LEFT JOIN clients c ON p.client_id = c.id
       ${whereClause}`,
      whereParams
    );

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    // Get filters for frontend
    const filtersWorkspace = getWorkspaceFilter(req, '', 'workspace_id');
    const projectTypes = await dbQuery(
      `SELECT DISTINCT type FROM projects WHERE type IS NOT NULL AND deleted_at IS NULL ${filtersWorkspace.whereClause} ORDER BY type`,
      filtersWorkspace.whereParams
    );

    const projectStatuses = await dbQuery(
      `SELECT DISTINCT status FROM projects WHERE status IS NOT NULL AND deleted_at IS NULL ${filtersWorkspace.whereClause} ORDER BY status`,
      filtersWorkspace.whereParams
    );

    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.json({
      success: true,
      data: {
        projects,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        },
        filters: {
          types: projectTypes.map(pt => pt.type),
          statuses: projectStatuses.map(ps => ps.status)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch projects'
    });
  }
});

// Get project statistics (must be before /:id route to avoid route matching conflicts)
router.get('/stats/overview', authorizePermission('projects', 'view'), async (req, res) => {
  try {
    const ws = getWorkspaceFilter(req, '', 'workspace_id');
    const stats = await dbQuery(`
      SELECT
        COUNT(*) as total_projects,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as active_projects,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_projects,
        COUNT(CASE WHEN status = 'planning' THEN 1 END) as planning_projects,
        COUNT(CASE WHEN status = 'on_hold' THEN 1 END) as on_hold_projects,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_projects,
        SUM(CASE WHEN budget IS NOT NULL THEN budget ELSE 0 END) as total_budget,
        AVG(CASE WHEN budget IS NOT NULL THEN budget ELSE NULL END) as avg_budget
      FROM projects
      WHERE 1=1 AND (deleted_at IS NULL) ${ws.whereClause}
    `, ws.whereParams);

    const typeStats = await dbQuery(`
      SELECT 
        type,
        COUNT(*) as count
      FROM projects
      WHERE 1=1 AND (deleted_at IS NULL) ${ws.whereClause}
      GROUP BY type
      ORDER BY count DESC
    `, ws.whereParams);

    const recentProjects = await dbQuery(`
      SELECT 
        p.*,
        c.full_name as client_name,
        c.company_name as client_company
      FROM projects p
      LEFT JOIN clients c ON p.client_id = c.id
      WHERE 1=1 AND (p.deleted_at IS NULL) ${getWorkspaceFilter(req, 'p', 'workspace_id').whereClause}
      ORDER BY p.created_at DESC
      LIMIT 5
    `, getWorkspaceFilter(req, 'p', 'workspace_id').whereParams);

    res.json({
      success: true,
      data: {
        overview: stats[0],
        byType: typeStats,
        recent: recentProjects
      }
    });
  } catch (error) {
    console.error('Error fetching project stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch project statistics'
    });
  }
});

// Get project by ID
router.get('/:id', authorizePermission('projects', 'view'), async (req, res) => {
  try {
    const projectId = req.params.id;

    const ws = getWorkspaceFilter(req, 'p', 'workspace_id');
    const projects = await dbQuery(
      `SELECT 
        p.*,
        c.full_name as client_name,
        c.company_name as client_company,
        c.email as client_email,
        c.phone as client_phone,
        COALESCE(i.invoice_count, 0) as invoice_count,
        COALESCE(i.total_billed, 0) as total_billed,
        COALESCE(i.total_paid, 0) as total_paid
       FROM projects p
       LEFT JOIN clients c ON p.client_id = c.id
       LEFT JOIN (
         SELECT 
           project_id,
           COUNT(*) as invoice_count,
           SUM(total_amount) as total_billed,
           SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END) as total_paid
         FROM invoices
         WHERE project_id IS NOT NULL
         GROUP BY project_id
       ) i ON p.id = i.project_id
       WHERE p.id = ? AND (p.deleted_at IS NULL) ${ws.whereClause}`,
      [projectId, ...ws.whereParams]
    );

    if (projects.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    const project = projects[0];

    // Check if client user can access this project's data
    if (!canAccessClientData(req, project.client_id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view projects associated with your account.'
      });
    }

    // Get related invoices
    let invoices = [];
    try {
      const invoiceResult = await dbQuery(
        `SELECT * FROM invoices WHERE project_id = ? ${getWorkspaceFilter(req, '', 'workspace_id').whereClause} ORDER BY created_at DESC LIMIT 10`,
        [projectId, ...getWorkspaceFilter(req, '', 'workspace_id').whereParams]
      );
      invoices = invoiceResult;
    } catch (error) {
      console.log('Invoices table not accessible or empty');
    }

    // Get related quotations
    let quotations = [];
    try {
      const quotationResult = await dbQuery(
        'SELECT * FROM quotations WHERE project_id = ? ORDER BY created_at DESC LIMIT 10',
        [projectId]
      );
      quotations = quotationResult;
    } catch (error) {
      console.log('Quotations table not accessible or empty');
    }

    // Get project files
    let files = [];
    try {
      const fileResult = await dbQuery(
        'SELECT * FROM files WHERE project_id = ? ORDER BY created_at DESC',
        [projectId]
      );
      files = fileResult;
    } catch (error) {
      console.log('Files table not accessible or empty');
    }

    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.json({
      success: true,
      data: {
        ...project,
        invoices,
        quotations,
        files
      }
    });
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch project'
    });
  }
});

// Create new project
router.post('/', authorizePermission('projects', 'create'), validateProject, async (req, res) => {
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
      title,
      client_id,
      type,
      status,
      description,
      tech_stack,
      start_date,
      end_date,
      budget,
      admin_url,
      delivery_link,
      notes
    } = req.body;

    // Process technology stack
    const technologyStack = processTechnologyStack(tech_stack);

    // Check if client exists and get workspace_id (used for project when super admin)
    const wsClients = getWorkspaceFilter(req, '', 'workspace_id');
    const clientCheck = await dbQuery(
      `SELECT id, workspace_id FROM clients WHERE id = ? ${wsClients.whereClause}`,
      [client_id, ...wsClients.whereParams]
    );
    if (clientCheck.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Selected client was not found. Please choose another client.'
      });
    }

    // workspace_id: for super admin use client's workspace; for others use their workspace from context
    const wsProjects = getWorkspaceFilter(req, '', 'workspace_id');
    const workspaceId = wsProjects.whereParams?.[0] ?? clientCheck[0].workspace_id ?? null;
    if (workspaceId == null) {
      return res.status(400).json({
        success: false,
        message: 'Could not determine workspace for this project. The selected client may not belong to a workspace.'
      });
    }

    // Insert project
    const result = await dbQuery(
      `INSERT INTO projects (
        title, client_id, type, status, description, technology_stack,
        start_date, end_date, budget, admin_url, delivery_link, notes, workspace_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        client_id,
        type,
        status,
        description,
        technologyStack ? JSON.stringify(technologyStack) : null,
        start_date,
        end_date,
        budget,
        admin_url,
        delivery_link,
        notes,
        workspaceId
      ]
    );

    // Resolve project id; when insertId is 0 (broken AUTO_INCREMENT on live), assign next id in DB and bump AUTO_INCREMENT
    let projectId = result.insertId != null ? Number(result.insertId) : 0;
    if (projectId <= 0) {
      const maxRetries = 5;
      let assigned = false;
      for (let attempt = 0; attempt < maxRetries && !assigned; attempt++) {
        const nextRows = await dbQuery(
          'SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM projects WHERE id > 0'
        );
        const nextId = nextRows && nextRows[0] ? Number(nextRows[0].next_id) : 1;
        try {
          const updateResult = await dbQuery(
            'UPDATE projects SET id = ? WHERE id = 0 AND workspace_id = ? AND title = ? AND client_id = ? LIMIT 1',
            [nextId, workspaceId, title, client_id]
          );
          const affected = updateResult && typeof updateResult.affectedRows === 'number' ? updateResult.affectedRows : 0;
          if (affected >= 1) {
            projectId = nextId;
            assigned = true;
            try {
              await dbQuery(
                `ALTER TABLE projects AUTO_INCREMENT = ${Number(nextId) + 1}`
              );
            } catch (alterErr) {
              console.warn('Could not bump projects AUTO_INCREMENT:', alterErr.message);
            }
            break;
          }
        } catch (err) {
          if (err.code === 'ER_DUP_ENTRY') continue;
          throw err;
        }
      }
      if (!assigned) {
        const createdRow = await dbQuery(
          `SELECT id FROM projects WHERE workspace_id = ? AND title = ? AND client_id = ? ORDER BY id DESC LIMIT 1`,
          [workspaceId, title, client_id]
        );
        if (createdRow && createdRow.length > 0) {
          projectId = Number(createdRow[0].id);
        }
      }
      if (!projectId || projectId <= 0) {
        return res.status(500).json({
          success: false,
          message: 'Project was created but could not be retrieved. Please refresh the list or contact support.'
        });
      }
    }

    // Auto-assign the creating user to this project so they appear in user_projects (Users list "Projects" count)
    try {
      await dbQuery(
        'INSERT INTO user_projects (user_id, project_id) VALUES (?, ?)',
        [req.user.id, projectId]
      );
    } catch (err) {
      // Ignore duplicate or missing table; project was still created
      if (err.code !== 'ER_DUP_ENTRY' && err.code !== 'ER_NO_SUCH_TABLE') {
        console.warn('Could not assign creator to project:', err.message);
      }
    }

    // Fetch the created project
    const projects = await dbQuery(
      `SELECT 
        p.*,
        c.full_name as client_name,
        c.company_name as client_company
       FROM projects p
       LEFT JOIN clients c ON p.client_id = c.id
       WHERE p.id = ? ${getWorkspaceFilter(req, 'p', 'workspace_id').whereClause}`,
      [projectId, ...getWorkspaceFilter(req, 'p', 'workspace_id').whereParams]
    );

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data: projects[0]
    });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create project'
    });
  }
});

// Update project
router.put('/:id', authorizePermission('projects', 'edit'), validateProject, async (req, res) => {
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

    const projectId = req.params.id;
    const {
      title,
      client_id,
      type,
      status,
      description,
      tech_stack,
      start_date,
      end_date,
      budget,
      admin_url,
      delivery_link,
      notes
    } = req.body;

    // Process technology stack
    const technologyStack = processTechnologyStack(tech_stack);

    // Check if project exists and is not soft-deleted
    const wsProj = getWorkspaceFilter(req, '', 'workspace_id');
    const projectCheck = await dbQuery(
      `SELECT id FROM projects WHERE id = ? AND deleted_at IS NULL ${wsProj.whereClause}`,
      [projectId, ...wsProj.whereParams]
    );
    if (projectCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Check if client exists
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

    // Update project
    const wsUpdate = getWorkspaceFilter(req, '', 'workspace_id');
    await dbQuery(
      `UPDATE projects SET
        title = ?, client_id = ?, type = ?, status = ?, description = ?,
        technology_stack = ?, start_date = ?, end_date = ?, budget = ?,
        admin_url = ?, delivery_link = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? ${wsUpdate.whereClause}`,
      [
        title, 
        client_id, 
        type, 
        status, 
        description, 
        technologyStack ? JSON.stringify(technologyStack) : null,
        start_date, 
        end_date, 
        budget, 
        admin_url, 
        delivery_link, 
        notes, 
        projectId,
        ...wsUpdate.whereParams
      ]
    );

    // Fetch the updated project
    const projects = await dbQuery(
      `SELECT 
        p.*,
        c.full_name as client_name,
        c.company_name as client_company
       FROM projects p
       LEFT JOIN clients c ON p.client_id = c.id
       WHERE p.id = ? AND (p.deleted_at IS NULL) ${getWorkspaceFilter(req, 'p', 'workspace_id').whereClause}`,
      [projectId, ...getWorkspaceFilter(req, 'p', 'workspace_id').whereParams]
    );

    res.json({
      success: true,
      message: 'Project updated successfully',
      data: projects[0]
    });
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to update project. Please try again or contact support if the problem continues.'
    });
  }
});

// Delete project
router.delete('/:id', authorizePermission('projects', 'delete'), async (req, res) => {
  try {
    const projectId = req.params.id;

    // Check if project exists (include deleted_at so we only find non-deleted rows)
    const ws = getWorkspaceFilter(req, '', 'workspace_id');
    const projectCheck = await dbQuery(
      `SELECT id FROM projects WHERE id = ? AND (deleted_at IS NULL) ${ws.whereClause}`,
      [projectId, ...ws.whereParams]
    );
    if (projectCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Check if project has related data
    const wsi = getWorkspaceFilter(req, '', 'workspace_id');
    const invoiceCheck = await dbQuery(
      `SELECT id FROM invoices WHERE project_id = ? ${wsi.whereClause} LIMIT 1`,
      [projectId, ...wsi.whereParams]
    );
    const quotationCheck = await dbQuery(
      `SELECT id FROM quotations WHERE project_id = ? ${wsi.whereClause} LIMIT 1`,
      [projectId, ...wsi.whereParams]
    );

    if (invoiceCheck.length > 0 || quotationCheck.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete project with related invoices or quotations'
      });
    }

    const wsd = getWorkspaceFilter(req, '', 'workspace_id');
    await dbQuery(
      `UPDATE projects SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL ${wsd.whereClause}`,
      [projectId, ...wsd.whereParams]
    );

    res.json({
      success: true,
      message: 'Project deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete project'
    });
  }
});


module.exports = router;
