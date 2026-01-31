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

// Validation middleware
const validateQuotation = [
  body('quote_number').optional({ nullable: true, checkFalsy: true }).trim().custom((value) => {
    if (value !== null && value !== undefined && value !== '' && value.trim() === '') {
      throw new Error('Quote number cannot be empty if provided');
    }
    return true;
  }),
  body('client_id').isInt({ min: 1 }).withMessage('Valid client ID is required'),
  body('project_id').optional({ nullable: true, checkFalsy: true }).custom((value) => {
    if (value !== null && value !== undefined && value !== '' && (isNaN(value) || parseInt(value) < 1)) {
      throw new Error('Valid project ID is required');
    }
    return true;
  }),
  body('quote_date').isISO8601().withMessage('Valid quote date is required'),
  body('valid_till_date').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('Valid expiry date is required'),
  body('status').isIn(['draft', 'sent', 'accepted', 'declined', 'expired']).withMessage('Valid status is required'),
  body('subtotal').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('Subtotal must be a positive number'),
  body('tax_rate').optional({ nullable: true }).isFloat({ min: 0, max: 100 }).withMessage('Tax rate must be between 0 and 100'),
  body('currency').optional({ nullable: true }).isLength({ min: 3, max: 3 }).withMessage('Currency must be 3 characters'),
];

const validateQuotationItem = [
  body('item_name').trim().notEmpty().withMessage('Item name is required'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('unit_price').isFloat({ min: 0 }).withMessage('Unit price must be a positive number'),
];

// Helper function to generate quote number
const generateQuoteNumber = async (req) => {
  const year = new Date().getFullYear();
  // Scope quote number generation per workspace (so two workspaces don't influence each other).
  // Super admin has no workspace filter; in that case counts across all.
  // Note: This is best-effort; ideally use a dedicated sequence per workspace.
  const ws = getWorkspaceFilter(req, '', 'workspace_id');
  const result = await dbQuery(
    `SELECT COUNT(*) as count FROM quotations WHERE YEAR(created_at) = ? ${ws.whereClause}`,
    [year, ...ws.whereParams]
  );
  const count = result[0].count + 1;
  return `QT-${year}-${count.toString().padStart(4, '0')}`;
};

// Helper function to calculate totals
const calculateTotals = (items) => {
  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  return { subtotal };
};

// Get all quotations with pagination and filters
router.get('/', authorizePermission('quotations', 'view'), [
  validatorQuery('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  validatorQuery('limit').optional().custom((value) => {
    if (value && (isNaN(value) || parseInt(value) < 1 || parseInt(value) > 1000)) {
      throw new Error('Limit must be between 1 and 1000');
    }
    return true;
  }),
  validatorQuery('search').optional().isString().withMessage('Search must be a string'),
  validatorQuery('status').optional().custom((value) => {
    if (value && !['draft', 'sent', 'accepted', 'declined', 'expired'].includes(value)) {
      throw new Error('Valid status is required');
    }
    return true;
  }),
  validatorQuery('client_id').optional().custom((value) => {
    if (value && (isNaN(value) || parseInt(value) < 1)) {
      throw new Error('Valid client ID is required');
    }
    return true;
  }),
  validatorQuery('client_name').optional().isString().withMessage('Valid client name is required'),
  validatorQuery('project_id').optional().custom((value) => {
    if (value && (isNaN(value) || parseInt(value) < 1)) {
      throw new Error('Valid project ID is required');
    }
    return true;
  }),
  validatorQuery('project_name').optional().isString().withMessage('Valid project name is required'),
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
    const status = req.query.status || '';
    const clientId = req.query.client_id || '';
    const clientName = req.query.client_name || '';
    const projectId = req.query.project_id || '';
    const projectName = req.query.project_name || '';

    // Build WHERE clause
    let whereClause = 'WHERE 1=1';
    const whereParams = [];

    // Add workspace filter (primary)
    const workspaceFilter = getWorkspaceFilter(req, 'q', 'workspace_id');
    whereClause += workspaceFilter.whereClause;
    whereParams.push(...workspaceFilter.whereParams);

    // Add client filter for client role users
    const clientFilter = getClientFilter(req, 'q', 'client_id');
    whereClause += clientFilter.whereClause;
    whereParams.push(...clientFilter.whereParams);

    if (search) {
      whereClause += ' AND (q.quote_number LIKE ? OR c.full_name LIKE ? OR c.company_name LIKE ? OR p.title LIKE ?)';
      const searchTerm = `%${search}%`;
      whereParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (status) {
      whereClause += ' AND q.status = ?';
      whereParams.push(status);
    }

    // Only allow filtering by client_id if user is not a client role
    if (clientId && req.user.role !== 'client') {
      whereClause += ' AND q.client_id = ?';
      whereParams.push(clientId);
    }

    if (clientName) {
      whereClause += ' AND (c.full_name LIKE ? OR c.company_name LIKE ?)';
      const clientTerm = `%${clientName}%`;
      whereParams.push(clientTerm, clientTerm);
    }

    if (projectId) {
      whereClause += ' AND q.project_id = ?';
      whereParams.push(projectId);
    }

    if (projectName) {
      whereClause += ' AND p.title LIKE ?';
      whereParams.push(`%${projectName}%`);
    }

    // Get quotations with client and project information
    const quotations = await dbQuery(
      `SELECT 
        q.*,
        c.full_name as client_name,
        c.company_name as client_company,
        c.email as client_email,
        p.title as project_title,
        u.full_name as created_by_name
       FROM quotations q
       LEFT JOIN clients c ON q.client_id = c.id
       LEFT JOIN projects p ON q.project_id = p.id
       LEFT JOIN users u ON q.created_by = u.id
       ${whereClause}
       ORDER BY q.created_at DESC
       LIMIT ? OFFSET ?`,
      [...whereParams, limit, offset]
    );

    // Get total count for pagination
    const countResult = await dbQuery(
      `SELECT COUNT(*) as total
       FROM quotations q
       LEFT JOIN clients c ON q.client_id = c.id
       LEFT JOIN projects p ON q.project_id = p.id
       ${whereClause}`,
      whereParams
    );

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    // Get filters for frontend
    const quotationStatuses = await dbQuery(
      'SELECT DISTINCT status FROM quotations WHERE status IS NOT NULL ORDER BY status'
    );

    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.json({
      success: true,
      data: {
        quotations,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        },
        filters: {
          statuses: quotationStatuses.map(qs => qs.status)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching quotations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch quotations'
    });
  }
});

// Get quotation by ID
router.get('/:id', authorizePermission('quotations', 'view'), async (req, res) => {
  try {
    const quotationId = req.params.id;

    const ws = getWorkspaceFilter(req, 'q', 'workspace_id');
    const quotations = await dbQuery(
      `SELECT 
        q.*,
        c.full_name as client_name,
        c.company_name as client_company,
        c.email as client_email,
        c.phone as client_phone,
        c.address as client_address,
        p.title as project_title,
        p.description as project_description,
        u.full_name as created_by_name
       FROM quotations q
       LEFT JOIN clients c ON q.client_id = c.id
       LEFT JOIN projects p ON q.project_id = p.id
       LEFT JOIN users u ON q.created_by = u.id
       WHERE q.id = ? ${ws.whereClause}`,
      [quotationId, ...ws.whereParams]
    );

    if (quotations.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found'
      });
    }

    const quotation = quotations[0];

    // Check if client user can access this quotation's data
    if (!canAccessClientData(req, quotation.client_id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view quotations associated with your account.'
      });
    }

    // Get quotation items
    const items = await dbQuery(
      'SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY id',
      [quotationId]
    );

    // Get related invoices
    let invoices = [];
    try {
      const invoiceResult = await dbQuery(
        `SELECT * FROM invoices WHERE quotation_id = ? ${getWorkspaceFilter(req, '', 'workspace_id').whereClause} ORDER BY created_at DESC`,
        [quotationId, ...getWorkspaceFilter(req, '', 'workspace_id').whereParams]
      );
      invoices = invoiceResult;
    } catch (error) {
      console.log('Invoices table not accessible or empty');
    }

    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.json({
      success: true,
      data: {
        ...quotation,
        items,
        invoices
      }
    });
  } catch (error) {
    console.error('Error fetching quotation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch quotation'
    });
  }
});

// Create new quotation
router.post('/', authorizePermission('quotations', 'create'), validateQuotation, async (req, res) => {
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
      quote_number,
      client_id,
      project_id,
      quote_date,
      valid_till_date,
      status,
      subtotal,
      tax_rate,
      tax_amount,
      total_amount,
      currency,
      notes,
      terms_conditions,
      items
    } = req.body;

    const workspaceId = req.workspaceId || req.workspaceFilter?.value;
    if (!workspaceId && !req.isSuperAdmin) {
      return res.status(403).json({ success: false, message: 'Workspace context required' });
    }

    // Check if client exists and is not soft-deleted
    const wsCli = getWorkspaceFilter(req, '', 'workspace_id');
    const clientCheck = await dbQuery(
      `SELECT id FROM clients WHERE id = ? AND deleted_at IS NULL ${wsCli.whereClause}`,
      [client_id, ...wsCli.whereParams]
    );
    if (clientCheck.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Check if project exists and is not soft-deleted (if provided)
    if (project_id) {
      const wsProj = getWorkspaceFilter(req, '', 'workspace_id');
      const projectCheck = await dbQuery(
        `SELECT id FROM projects WHERE id = ? AND deleted_at IS NULL ${wsProj.whereClause}`,
        [project_id, ...wsProj.whereParams]
      );
      if (projectCheck.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Project not found'
        });
      }
    }

    // Generate quote number if not provided
    const finalQuoteNumber = quote_number || await generateQuoteNumber(req);

    // Calculate totals if not provided
    let finalSubtotal = subtotal;
    let finalTaxAmount = tax_amount;
    let finalTotalAmount = total_amount;

    if (items && items.length > 0) {
      const calculated = calculateTotals(items);
      finalSubtotal = calculated.subtotal;
      finalTaxAmount = (finalSubtotal * (tax_rate || 0)) / 100;
      finalTotalAmount = finalSubtotal + finalTaxAmount;
    }

    // Insert quotation
    const result = await dbQuery(
      `INSERT INTO quotations (
        quote_number, client_id, project_id, quote_date, valid_till_date,
        status, subtotal, tax_rate, tax_amount, total_amount, currency,
        notes, terms_conditions, created_by, workspace_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        finalQuoteNumber, client_id, project_id, quote_date, valid_till_date,
        status, finalSubtotal, tax_rate || 0, finalTaxAmount, finalTotalAmount, currency || 'USD',
        notes, terms_conditions, req.user.id, workspaceId || null
      ]
    );

    const quotationId = result.insertId;

    // Insert quotation items
    if (items && items.length > 0) {
      for (const item of items) {
        await dbQuery(
          `INSERT INTO quotation_items (
            quotation_id, item_name, description, quantity, unit_price, total_price
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            quotationId,
            item.item_name,
            item.description,
            item.quantity,
            item.unit_price,
            item.quantity * item.unit_price
          ]
        );
      }
    }

    // Fetch the created quotation
    const quotations = await dbQuery(
      `SELECT 
        q.*,
        c.full_name as client_name,
        c.company_name as client_company,
        p.title as project_title
       FROM quotations q
       LEFT JOIN clients c ON q.client_id = c.id
       LEFT JOIN projects p ON q.project_id = p.id
       WHERE q.id = ? ${getWorkspaceFilter(req, 'q', 'workspace_id').whereClause}`,
      [quotationId, ...getWorkspaceFilter(req, 'q', 'workspace_id').whereParams]
    );

    res.status(201).json({
      success: true,
      message: 'Quotation created successfully',
      data: quotations[0]
    });
  } catch (error) {
    console.error('Error creating quotation:', error);
    if (error.code === 'ER_DUP_ENTRY' && error.sqlMessage && error.sqlMessage.includes('quote_number')) {
      return res.status(409).json({
        success: false,
        message: 'A quotation with this quote number already exists. Please use a different quote number.'
      });
    }
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: error.sqlMessage || 'A record with this value already exists. Please use a different value.'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to create quotation'
    });
  }
});

// Update quotation
router.put('/:id', authorizePermission('quotations', 'edit'), validateQuotation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const quotationId = req.params.id;
    const {
      quote_number,
      client_id,
      project_id,
      quote_date,
      valid_till_date,
      status,
      subtotal,
      tax_rate,
      tax_amount,
      total_amount,
      currency,
      notes,
      terms_conditions,
      items
    } = req.body;

    // Check if quotation exists
    const wsQ = getWorkspaceFilter(req, '', 'workspace_id');
    const quotationCheck = await dbQuery(
      `SELECT id FROM quotations WHERE id = ? ${wsQ.whereClause}`,
      [quotationId, ...wsQ.whereParams]
    );
    if (quotationCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found'
      });
    }

    // Check if client exists
    const wsC = getWorkspaceFilter(req, '', 'workspace_id');
    const clientCheck = await dbQuery(
      `SELECT id FROM clients WHERE id = ? ${wsC.whereClause}`,
      [client_id, ...wsC.whereParams]
    );
    if (clientCheck.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Check if project exists (if provided)
    if (project_id) {
      const wsP = getWorkspaceFilter(req, '', 'workspace_id');
      const projectCheck = await dbQuery(
        `SELECT id FROM projects WHERE id = ? ${wsP.whereClause}`,
        [project_id, ...wsP.whereParams]
      );
      if (projectCheck.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Project not found'
        });
      }
    }

    // Calculate totals if not provided
    let finalSubtotal = subtotal;
    let finalTaxAmount = tax_amount;
    let finalTotalAmount = total_amount;

    if (items && items.length > 0) {
      const calculated = calculateTotals(items);
      finalSubtotal = calculated.subtotal;
      finalTaxAmount = (finalSubtotal * (tax_rate || 0)) / 100;
      finalTotalAmount = finalSubtotal + finalTaxAmount;
    }

    // Update quotation
    const wsUpd = getWorkspaceFilter(req, '', 'workspace_id');
    await dbQuery(
      `UPDATE quotations SET
        quote_number = ?, client_id = ?, project_id = ?, quote_date = ?, valid_till_date = ?,
        status = ?, subtotal = ?, tax_rate = ?, tax_amount = ?, total_amount = ?, currency = ?,
        notes = ?, terms_conditions = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? ${wsUpd.whereClause}`,
      [
        quote_number, client_id, project_id, quote_date, valid_till_date,
        status, finalSubtotal, tax_rate || 0, finalTaxAmount, finalTotalAmount, currency || 'USD',
        notes, terms_conditions, quotationId, ...wsUpd.whereParams
      ]
    );

    // Update quotation items
    if (items && items.length > 0) {
      // Delete existing items
      await dbQuery('DELETE FROM quotation_items WHERE quotation_id = ?', [quotationId]);

      // Insert new items
      for (const item of items) {
        await dbQuery(
          `INSERT INTO quotation_items (
            quotation_id, item_name, description, quantity, unit_price, total_price
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            quotationId,
            item.item_name,
            item.description,
            item.quantity,
            item.unit_price,
            item.quantity * item.unit_price
          ]
        );
      }
    }

    // Fetch the updated quotation
    const quotations = await dbQuery(
      `SELECT 
        q.*,
        c.full_name as client_name,
        c.company_name as client_company,
        p.title as project_title
       FROM quotations q
       LEFT JOIN clients c ON q.client_id = c.id
       LEFT JOIN projects p ON q.project_id = p.id
       WHERE q.id = ? ${getWorkspaceFilter(req, 'q', 'workspace_id').whereClause}`,
      [quotationId, ...getWorkspaceFilter(req, 'q', 'workspace_id').whereParams]
    );

    res.json({
      success: true,
      message: 'Quotation updated successfully',
      data: quotations[0]
    });
  } catch (error) {
    console.error('Error updating quotation:', error);
    if (error.code === 'ER_DUP_ENTRY' && error.sqlMessage && error.sqlMessage.includes('quote_number')) {
      return res.status(409).json({
        success: false,
        message: 'A quotation with this quote number already exists. Please use a different quote number.'
      });
    }
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: error.sqlMessage || 'A record with this value already exists. Please use a different value.'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to update quotation'
    });
  }
});

// Delete quotation
router.delete('/:id', authorizePermission('quotations', 'delete'), async (req, res) => {
  try {
    const quotationId = req.params.id;

    // Check if quotation exists
    const wsDel = getWorkspaceFilter(req, '', 'workspace_id');
    const quotationCheck = await dbQuery(
      `SELECT id FROM quotations WHERE id = ? ${wsDel.whereClause}`,
      [quotationId, ...wsDel.whereParams]
    );
    if (quotationCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found'
      });
    }

    // Check if quotation has related invoices
    const wsInv = getWorkspaceFilter(req, '', 'workspace_id');
    const invoiceCheck = await dbQuery(
      `SELECT id FROM invoices WHERE quotation_id = ? ${wsInv.whereClause} LIMIT 1`,
      [quotationId, ...wsInv.whereParams]
    );
    if (invoiceCheck.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete quotation with related invoices'
      });
    }

    // Delete quotation items first
    await dbQuery('DELETE FROM quotation_items WHERE quotation_id = ?', [quotationId]);

    // Delete quotation
    const wsD = getWorkspaceFilter(req, '', 'workspace_id');
    await dbQuery(`DELETE FROM quotations WHERE id = ? ${wsD.whereClause}`, [quotationId, ...wsD.whereParams]);

    res.json({
      success: true,
      message: 'Quotation deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting quotation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete quotation'
    });
  }
});

// Convert quotation to invoice
router.post('/:id/convert-to-invoice', authorizePermission('invoices', 'create'), async (req, res) => {
  try {
    const quotationId = req.params.id;
    const { invoice_date, due_date, payment_terms } = req.body;

    // Check if quotation exists and is accepted
    const ws = getWorkspaceFilter(req, '', 'workspace_id');
    const quotationCheck = await dbQuery(
      `SELECT * FROM quotations WHERE id = ? AND status = "accepted" ${ws.whereClause}`,
      [quotationId, ...ws.whereParams]
    );
    if (quotationCheck.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Quotation not found or not accepted'
      });
    }

    const quotation = quotationCheck[0];

    // Generate invoice number
    const year = new Date().getFullYear();
    const wsi = getWorkspaceFilter(req, '', 'workspace_id');
    const invoiceCount = await dbQuery(
      `SELECT COUNT(*) as count FROM invoices WHERE YEAR(created_at) = ? ${wsi.whereClause}`,
      [year, ...wsi.whereParams]
    );
    const invoiceNumber = `INV-${year}-${(invoiceCount[0].count + 1).toString().padStart(4, '0')}`;

    // Create invoice
    const workspaceId = req.workspaceId || req.workspaceFilter?.value;
    const invoiceResult = await dbQuery(
      `INSERT INTO invoices (
        invoice_number, quotation_id, client_id, project_id, invoice_date, due_date,
        status, subtotal, tax_rate, tax_amount, total_amount, currency, created_by, workspace_id
      ) VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoiceNumber, quotationId, quotation.client_id, quotation.project_id,
        invoice_date, due_date, quotation.subtotal, quotation.tax_rate,
        quotation.tax_amount, quotation.total_amount, quotation.currency, req.user.id, workspaceId || null
      ]
    );

    const invoiceId = invoiceResult.insertId;

    // Copy quotation items to invoice items
    const quotationItems = await dbQuery(
      'SELECT * FROM quotation_items WHERE quotation_id = ?',
      [quotationId]
    );

    for (const item of quotationItems) {
      await dbQuery(
        `INSERT INTO invoice_items (
          invoice_id, item_name, description, quantity, unit_price, total_price
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          invoiceId,
          item.item_name,
          item.description,
          item.quantity,
          item.unit_price,
          item.total_price
        ]
      );
    }

    // Update quotation status
    const wsq = getWorkspaceFilter(req, '', 'workspace_id');
    await dbQuery(
      `UPDATE quotations SET status = "accepted", updated_at = CURRENT_TIMESTAMP WHERE id = ? ${wsq.whereClause}`,
      [quotationId, ...wsq.whereParams]
    );

    res.status(201).json({
      success: true,
      message: 'Quotation converted to invoice successfully',
      data: { invoice_id: invoiceId, invoice_number: invoiceNumber }
    });
  } catch (error) {
    console.error('Error converting quotation to invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to convert quotation to invoice'
    });
  }
});

// Get quotation statistics
router.get('/stats/overview', authorizePermission('quotations', 'view'), async (req, res) => {
  try {
    const ws = getWorkspaceFilter(req, '', 'workspace_id');
    const stats = await dbQuery(`
      SELECT
        COUNT(*) as total_quotations,
        COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_quotations,
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_quotations,
        COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted_quotations,
        COUNT(CASE WHEN status = 'declined' THEN 1 END) as declined_quotations,
        COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired_quotations,
        SUM(total_amount) as total_value,
        AVG(total_amount) as avg_value
      FROM quotations
      WHERE 1=1 ${ws.whereClause}
    `, ws.whereParams);

    const recentQuotations = await dbQuery(`
      SELECT 
        q.*,
        c.full_name as client_name,
        c.company_name as client_company
      FROM quotations q
      LEFT JOIN clients c ON q.client_id = c.id
      WHERE 1=1 ${getWorkspaceFilter(req, 'q', 'workspace_id').whereClause}
      ORDER BY q.created_at DESC
      LIMIT 5
    `, getWorkspaceFilter(req, 'q', 'workspace_id').whereParams);

    res.json({
      success: true,
      data: {
        overview: stats[0],
        recent: recentQuotations
      }
    });
  } catch (error) {
    console.error('Error fetching quotation stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch quotation statistics'
    });
  }
});

module.exports = router;
