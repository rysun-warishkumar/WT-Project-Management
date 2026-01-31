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
const validateInvoice = [
  body('invoice_number').trim().notEmpty().withMessage('Invoice number is required'),
  body('client_id').isInt().withMessage('Valid client ID is required'),
  body('project_id').optional().custom((value) => {
    if (value !== null && value !== undefined && value !== '' && (isNaN(value) || parseInt(value) < 1)) {
      throw new Error('Valid project ID is required');
    }
    return true;
  }),
  body('quotation_id').optional().custom((value) => {
    if (value !== null && value !== undefined && value !== '' && (isNaN(value) || parseInt(value) < 1)) {
      throw new Error('Valid quotation ID is required');
    }
    return true;
  }),
  body('invoice_date').isISO8601().withMessage('Valid invoice date is required'),
  body('due_date').isISO8601().withMessage('Valid due date is required'),
  body('status').isIn(['draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled']).withMessage('Valid status is required'),
  body('subtotal').isFloat({ min: 0 }).withMessage('Subtotal must be a positive number'),
  body('tax_rate').isFloat({ min: 0, max: 100 }).withMessage('Tax rate must be between 0 and 100'),
  body('currency').isLength({ min: 3, max: 3 }).withMessage('Currency must be 3 characters'),
];

const validateInvoiceItem = [
  body('item_name').trim().notEmpty().withMessage('Item name is required'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('unit_price').isFloat({ min: 0 }).withMessage('Unit price must be a positive number'),
];

// Helper function to generate invoice number
const generateInvoiceNumber = async (req) => {
  const year = new Date().getFullYear();
  const ws = getWorkspaceFilter(req, '', 'workspace_id');
  const result = await dbQuery(
    `SELECT COUNT(*) as count FROM invoices WHERE YEAR(created_at) = ? ${ws.whereClause}`,
    [year, ...ws.whereParams]
  );
  const count = result[0].count + 1;
  return `INV-${year}-${count.toString().padStart(4, '0')}`;
};

// Helper function to calculate totals
const calculateTotals = (items) => {
  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  return { subtotal };
};

// Helper function to update invoice status based on payment
const updateInvoiceStatus = async (invoiceId) => {
  const invoice = await dbQuery(
    'SELECT total_amount, paid_amount, due_date, status FROM invoices WHERE id = ?',
    [invoiceId]
  );
  
  if (invoice.length === 0) return;
  
  const { total_amount, paid_amount, due_date, status: currentStatus } = invoice[0];
  const total = parseFloat(total_amount) || 0;
  const paid = parseFloat(paid_amount) || 0;
  const dueDate = new Date(due_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);
  
  let newStatus = currentStatus || 'draft';
  
  // Don't change status if invoice is cancelled
  if (currentStatus === 'cancelled') {
    return;
  }
  
  // Determine status based on payment and due date
  if (paid >= total) {
    // Fully paid
    newStatus = 'paid';
  } else if (paid > 0) {
    // Partially paid
    if (today > dueDate) {
      newStatus = 'overdue'; // Overdue but partially paid
    } else {
      newStatus = 'partial';
    }
  } else {
    // Not paid yet
    if (today > dueDate) {
      newStatus = 'overdue';
    } else if (currentStatus === 'draft') {
      newStatus = 'draft'; // Keep as draft if it was draft
    } else {
      newStatus = 'sent'; // Otherwise mark as sent
    }
  }
  
  await dbQuery(
    'UPDATE invoices SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [newStatus, invoiceId]
  );
};

// Get all invoices with pagination and filters
router.get('/', authorizePermission('invoices', 'view'), [
  validatorQuery('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  validatorQuery('limit').optional().custom((value) => {
    if (value && (isNaN(value) || parseInt(value) < 1 || parseInt(value) > 1000)) {
      throw new Error('Limit must be between 1 and 1000');
    }
    return true;
  }),
  validatorQuery('search').optional().isString().withMessage('Search must be a string'),
  validatorQuery('status').optional().custom((value) => {
    if (value && !['draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled'].includes(value)) {
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
    const workspaceFilter = getWorkspaceFilter(req, 'i', 'workspace_id');
    whereClause += workspaceFilter.whereClause;
    whereParams.push(...workspaceFilter.whereParams);

    // Add client filter for client role users
    const clientFilter = getClientFilter(req, 'i', 'client_id');
    whereClause += clientFilter.whereClause;
    whereParams.push(...clientFilter.whereParams);

    if (search) {
      whereClause += ' AND (i.invoice_number LIKE ? OR c.full_name LIKE ? OR c.company_name LIKE ? OR p.title LIKE ?)';
      const searchTerm = `%${search}%`;
      whereParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (status) {
      whereClause += ' AND i.status = ?';
      whereParams.push(status);
    }

    // Only allow filtering by client_id if user is not a client role
    if (clientId && req.user.role !== 'client') {
      whereClause += ' AND i.client_id = ?';
      whereParams.push(clientId);
    }

    if (clientName) {
      whereClause += ' AND (c.full_name LIKE ? OR c.company_name LIKE ?)';
      const clientTerm = `%${clientName}%`;
      whereParams.push(clientTerm, clientTerm);
    }

    if (projectId) {
      whereClause += ' AND i.project_id = ?';
      whereParams.push(projectId);
    }

    if (projectName) {
      whereClause += ' AND p.title LIKE ?';
      whereParams.push(`%${projectName}%`);
    }

    // Get invoices with client and project information
    const invoices = await dbQuery(
      `SELECT 
        i.*,
        c.full_name as client_name,
        c.company_name as client_company,
        c.email as client_email,
        COALESCE(p.title, NULL) as project_title,
        u.full_name as created_by_name,
        (i.total_amount - COALESCE(i.paid_amount, 0)) as outstanding_amount
       FROM invoices i
       LEFT JOIN clients c ON i.client_id = c.id
       LEFT JOIN projects p ON i.project_id = p.id
       LEFT JOIN users u ON i.created_by = u.id
       ${whereClause}
       ORDER BY i.created_at DESC
       LIMIT ? OFFSET ?`,
      [...whereParams, limit, offset]
    );

    // Get total count for pagination
    const countResult = await dbQuery(
      `SELECT COUNT(*) as total
       FROM invoices i
       LEFT JOIN clients c ON i.client_id = c.id
       LEFT JOIN projects p ON i.project_id = p.id
       ${whereClause}`,
      whereParams
    );

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    // Get filters for frontend
    const wsFilters = getWorkspaceFilter(req, '', 'workspace_id');
    const invoiceStatuses = await dbQuery(
      `SELECT DISTINCT status FROM invoices WHERE status IS NOT NULL ${wsFilters.whereClause} ORDER BY status`,
      wsFilters.whereParams
    );

    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.json({
      success: true,
      data: {
        invoices,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        },
        filters: {
          statuses: invoiceStatuses.map(is => is.status)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoices'
    });
  }
});

// Get invoice by ID
router.get('/:id', authorizePermission('invoices', 'view'), async (req, res) => {
  try {
    const invoiceId = req.params.id;

    const ws = getWorkspaceFilter(req, 'i', 'workspace_id');
    const invoices = await dbQuery(
      `SELECT 
        i.*,
        c.full_name as client_name,
        c.company_name as client_company,
        c.email as client_email,
        c.phone as client_phone,
        c.address as client_address,
        COALESCE(p.title, NULL) as project_title,
        p.description as project_description,
        qt.quote_number as quotation_number,
        u.full_name as created_by_name,
        (i.total_amount - COALESCE(i.paid_amount, 0)) as outstanding_amount
       FROM invoices i
       LEFT JOIN clients c ON i.client_id = c.id
       LEFT JOIN projects p ON i.project_id = p.id
       LEFT JOIN quotations qt ON i.quotation_id = qt.id
       LEFT JOIN users u ON i.created_by = u.id
       WHERE i.id = ? ${ws.whereClause}`,
      [invoiceId, ...ws.whereParams]
    );

    if (invoices.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    const invoice = invoices[0];

    // Check if client user can access this invoice's data
    if (!canAccessClientData(req, invoice.client_id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view invoices associated with your account.'
      });
    }

    // Get invoice items
    const items = await dbQuery(
      'SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id',
      [invoiceId]
    );

    // Get payment history
    let payments = [];
    try {
      const paymentResult = await dbQuery(
        'SELECT * FROM payments WHERE invoice_id = ? ORDER BY payment_date DESC',
        [invoiceId]
      );
      payments = paymentResult;
    } catch (error) {
      console.log('Payments table not accessible or empty');
    }

    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.json({
      success: true,
      data: {
        ...invoice,
        items,
        payments
      }
    });
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoice'
    });
  }
});

// Create new invoice
router.post('/', authorizePermission('invoices', 'create'), validateInvoice, async (req, res) => {
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
      invoice_number,
      client_id,
      project_id,
      quotation_id,
      invoice_date,
      due_date,
      status,
      subtotal,
      tax_rate,
      tax_amount,
      total_amount,
      currency,
      notes,
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

    // Check if quotation exists (if provided)
    if (quotation_id) {
      const wsQt = getWorkspaceFilter(req, '', 'workspace_id');
      const quotationCheck = await dbQuery(
        `SELECT id FROM quotations WHERE id = ? ${wsQt.whereClause}`,
        [quotation_id, ...wsQt.whereParams]
      );
      if (quotationCheck.length === 0) {
        return res.status(400).json({ success: false, message: 'Quotation not found' });
      }
    }

    // Check if quotation exists (if provided)
    if (quotation_id) {
      const quotationCheck = await dbQuery('SELECT id FROM quotations WHERE id = ?', [quotation_id]);
      if (quotationCheck.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Quotation not found'
        });
      }
    }

    // Generate invoice number if not provided
    const finalInvoiceNumber = invoice_number || await generateInvoiceNumber(req);

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

    // Insert invoice
    const result = await dbQuery(
      `INSERT INTO invoices (
        invoice_number, quotation_id, client_id, project_id, invoice_date, due_date,
        status, subtotal, tax_rate, tax_amount, total_amount, currency, notes, created_by, workspace_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        finalInvoiceNumber, quotation_id, client_id, project_id, invoice_date, due_date,
        status, finalSubtotal, tax_rate || 0, finalTaxAmount, finalTotalAmount, currency || 'USD',
        notes, req.user.id, workspaceId || null
      ]
    );

    const invoiceId = result.insertId;

    // Insert invoice items
    if (items && items.length > 0) {
      for (const item of items) {
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
            item.quantity * item.unit_price
          ]
        );
      }
    }

    // Fetch the created invoice
    const invoices = await dbQuery(
      `SELECT 
        i.*,
        c.full_name as client_name,
        c.company_name as client_company,
        p.title as project_title
       FROM invoices i
       LEFT JOIN clients c ON i.client_id = c.id
       LEFT JOIN projects p ON i.project_id = p.id
       WHERE i.id = ? ${getWorkspaceFilter(req, 'i', 'workspace_id').whereClause}`,
      [invoiceId, ...getWorkspaceFilter(req, 'i', 'workspace_id').whereParams]
    );

    res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      data: invoices[0]
    });
  } catch (error) {
    console.error('Error creating invoice:', error);
    // Return user-friendly message for duplicate invoice number
    if (error.code === 'ER_DUP_ENTRY' && error.sqlMessage && error.sqlMessage.includes('invoice_number')) {
      return res.status(409).json({
        success: false,
        message: 'An invoice with this invoice number already exists. Please use a different invoice number.'
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
      message: 'Failed to create invoice'
    });
  }
});

// Update invoice
router.put('/:id', authorizePermission('invoices', 'edit'), validateInvoice, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const invoiceId = req.params.id;
    const {
      invoice_number,
      client_id,
      project_id,
      quotation_id,
      invoice_date,
      due_date,
      status,
      subtotal,
      tax_rate,
      tax_amount,
      total_amount,
      currency,
      notes,
      items
    } = req.body;

    // Check if invoice exists (scoped to workspace)
    const wsInv = getWorkspaceFilter(req, '', 'workspace_id');
    const invoiceCheck = await dbQuery(
      `SELECT id FROM invoices WHERE id = ? ${wsInv.whereClause}`,
      [invoiceId, ...wsInv.whereParams]
    );
    if (invoiceCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
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

    // Check if quotation exists (if provided)
    if (quotation_id) {
      const wsQt = getWorkspaceFilter(req, '', 'workspace_id');
      const quotationCheck = await dbQuery(
        `SELECT id FROM quotations WHERE id = ? ${wsQt.whereClause}`,
        [quotation_id, ...wsQt.whereParams]
      );
      if (quotationCheck.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Quotation not found'
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

    // Update invoice
    const wsUpd = getWorkspaceFilter(req, '', 'workspace_id');
    await dbQuery(
      `UPDATE invoices SET
        invoice_number = ?, quotation_id = ?, client_id = ?, project_id = ?, invoice_date = ?, due_date = ?,
        status = ?, subtotal = ?, tax_rate = ?, tax_amount = ?, total_amount = ?, currency = ?,
        notes = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? ${wsUpd.whereClause}`,
      [
        invoice_number, quotation_id, client_id, project_id, invoice_date, due_date,
        status, finalSubtotal, tax_rate || 0, finalTaxAmount, finalTotalAmount, currency || 'USD',
        notes, invoiceId, ...wsUpd.whereParams
      ]
    );

    // Update invoice items
    if (items && items.length > 0) {
      // Delete existing items
      await dbQuery('DELETE FROM invoice_items WHERE invoice_id = ?', [invoiceId]);

      // Insert new items
      for (const item of items) {
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
            item.quantity * item.unit_price
          ]
        );
      }
    }

    // Update invoice status
    await updateInvoiceStatus(invoiceId);

    // Fetch the updated invoice
    const invoices = await dbQuery(
      `SELECT 
        i.*,
        c.full_name as client_name,
        c.company_name as client_company,
        p.title as project_title
       FROM invoices i
       LEFT JOIN clients c ON i.client_id = c.id
       LEFT JOIN projects p ON i.project_id = p.id
       WHERE i.id = ? ${getWorkspaceFilter(req, 'i', 'workspace_id').whereClause}`,
      [invoiceId, ...getWorkspaceFilter(req, 'i', 'workspace_id').whereParams]
    );

    res.json({
      success: true,
      message: 'Invoice updated successfully',
      data: invoices[0]
    });
  } catch (error) {
    console.error('Error updating invoice:', error);
    if (error.code === 'ER_DUP_ENTRY' && error.sqlMessage && error.sqlMessage.includes('invoice_number')) {
      return res.status(409).json({
        success: false,
        message: 'An invoice with this invoice number already exists. Please use a different invoice number.'
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
      message: 'Failed to update invoice'
    });
  }
});

// Record payment
router.post('/:id/payment', authorizePermission('invoices', 'record_payment'), [
  body('amount').isFloat({ min: 0.01 }).withMessage('Payment amount must be greater than 0'),
  body('payment_method').trim().notEmpty().withMessage('Payment method is required'),
  body('payment_date').isISO8601().withMessage('Valid payment date is required'),
  body('reference_number').optional().isString().withMessage('Reference number must be a string'),
  body('notes').optional().isString().withMessage('Notes must be a string'),
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

    const invoiceId = req.params.id;
    const {
      amount,
      payment_method,
      payment_date,
      reference_number,
      notes
    } = req.body;

    // Check if invoice exists (scoped to workspace)
    const wsInv = getWorkspaceFilter(req, '', 'workspace_id');
    const invoiceCheck = await dbQuery(
      `SELECT * FROM invoices WHERE id = ? ${wsInv.whereClause}`,
      [invoiceId, ...wsInv.whereParams]
    );
    if (invoiceCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    const invoice = invoiceCheck[0];

    // Check if client user can access this invoice's data
    if (!canAccessClientData(req, invoice.client_id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only manage payments for your own invoices.'
      });
    }

    // Validate payment amount
    const currentPaidAmount = parseFloat(invoice.paid_amount) || 0;
    const totalAmount = parseFloat(invoice.total_amount) || 0;
    const paymentAmount = parseFloat(amount);
    const outstandingAmount = totalAmount - currentPaidAmount;
    
    // Check for negative or zero amounts
    if (paymentAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Payment amount must be greater than 0'
      });
    }
    
    // Check if payment amount exceeds outstanding amount
    if (paymentAmount > outstandingAmount) {
      return res.status(400).json({
        success: false,
        message: `Payment amount cannot exceed outstanding amount of ${formatCurrency(outstandingAmount, invoice.currency || 'USD')}`
      });
    }
    
    // Check if invoice is already fully paid (with small tolerance for rounding)
    if (currentPaidAmount >= totalAmount - 0.01) {
      return res.status(400).json({
        success: false,
        message: 'Invoice is already fully paid'
      });
    }
    
    // Check if invoice is cancelled
    if (invoice.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot record payment for a cancelled invoice'
      });
    }

    // Insert payment record
    await dbQuery(
      `INSERT INTO payments (
        invoice_id, amount, payment_method, payment_date, reference_number, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        invoiceId, amount, payment_method, payment_date, reference_number, notes, req.user.id
      ]
    );

    // Update invoice paid amount
    const newPaidAmount = currentPaidAmount + paymentAmount;
    
    // Ensure paid amount doesn't exceed total amount (safety check)
    const finalPaidAmount = Math.min(newPaidAmount, totalAmount);
    
    const wsPaid = getWorkspaceFilter(req, '', 'workspace_id');
    await dbQuery(
      `UPDATE invoices SET paid_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? ${wsPaid.whereClause}`,
      [finalPaidAmount, invoiceId, ...wsPaid.whereParams]
    );

    // Update invoice status
    await updateInvoiceStatus(invoiceId);

    // Fetch updated invoice with all related data
    const updatedInvoices = await dbQuery(
      `SELECT 
        i.*,
        c.full_name as client_name,
        c.company_name as client_company,
        c.email as client_email,
        c.phone as client_phone,
        c.address as client_address,
        p.title as project_title,
        qt.quote_number as quotation_number,
        u.full_name as created_by_name,
        (i.total_amount - i.paid_amount) as outstanding_amount
       FROM invoices i
       LEFT JOIN clients c ON i.client_id = c.id
       LEFT JOIN projects p ON i.project_id = p.id
       LEFT JOIN quotations qt ON i.quotation_id = qt.id
       LEFT JOIN users u ON i.created_by = u.id
       WHERE i.id = ? ${getWorkspaceFilter(req, 'i', 'workspace_id').whereClause}`,
      [invoiceId, ...getWorkspaceFilter(req, 'i', 'workspace_id').whereParams]
    );

    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully',
      data: {
        paid_amount: finalPaidAmount,
        outstanding_amount: updatedInvoices[0].total_amount - finalPaidAmount,
        status: updatedInvoices[0].status,
        invoice: updatedInvoices[0]
      }
    });
  } catch (error) {
    console.error('Error recording payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record payment'
    });
  }
});

// Delete invoice
router.delete('/:id', authorizePermission('invoices', 'delete'), async (req, res) => {
  try {
    const invoiceId = req.params.id;

    // Check if invoice exists (scoped to workspace)
    const wsDel = getWorkspaceFilter(req, '', 'workspace_id');
    const invoiceCheck = await dbQuery(
      `SELECT id FROM invoices WHERE id = ? ${wsDel.whereClause}`,
      [invoiceId, ...wsDel.whereParams]
    );
    if (invoiceCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Check if invoice has payments
    const paymentCheck = await dbQuery('SELECT id FROM payments WHERE invoice_id = ? LIMIT 1', [invoiceId]);
    if (paymentCheck.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete invoice with payments'
      });
    }

    // Delete invoice items first
    await dbQuery('DELETE FROM invoice_items WHERE invoice_id = ?', [invoiceId]);

    // Delete invoice
    const wsD = getWorkspaceFilter(req, '', 'workspace_id');
    await dbQuery(`DELETE FROM invoices WHERE id = ? ${wsD.whereClause}`, [invoiceId, ...wsD.whereParams]);

    res.json({
      success: true,
      message: 'Invoice deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete invoice'
    });
  }
});

// Get invoice statistics
router.get('/stats/overview', authorizePermission('invoices', 'view'), async (req, res) => {
  try {
    const ws = getWorkspaceFilter(req, '', 'workspace_id');
    const stats = await dbQuery(`
      SELECT
        COUNT(*) as total_invoices,
        COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_invoices,
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_invoices,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_invoices,
        COUNT(CASE WHEN status = 'partial' THEN 1 END) as partial_invoices,
        COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue_invoices,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_invoices,
        SUM(total_amount) as total_billed,
        SUM(paid_amount) as total_paid,
        SUM(total_amount - paid_amount) as total_outstanding,
        AVG(total_amount) as avg_invoice_amount
      FROM invoices
      WHERE 1=1 ${ws.whereClause}
    `, ws.whereParams);

    const recentInvoices = await dbQuery(`
      SELECT 
        i.*,
        c.full_name as client_name,
        c.company_name as client_company
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      WHERE 1=1 ${getWorkspaceFilter(req, 'i', 'workspace_id').whereClause}
      ORDER BY i.created_at DESC
      LIMIT 5
    `, getWorkspaceFilter(req, 'i', 'workspace_id').whereParams);

    const overdueInvoices = await dbQuery(`
      SELECT 
        i.*,
        c.full_name as client_name,
        c.company_name as client_company
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      WHERE 1=1 ${getWorkspaceFilter(req, 'i', 'workspace_id').whereClause}
        AND i.due_date < CURDATE() AND i.status NOT IN ('paid', 'cancelled')
      ORDER BY i.due_date ASC
      LIMIT 10
    `, getWorkspaceFilter(req, 'i', 'workspace_id').whereParams);

    res.json({
      success: true,
      data: {
        overview: stats[0],
        recent: recentInvoices,
        overdue: overdueInvoices
      }
    });
  } catch (error) {
    console.error('Error fetching invoice stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoice statistics'
    });
  }
});

// Download invoice as PDF
router.get('/:id/download', authorizePermission('invoices', 'view'), async (req, res) => {
  try {
    const invoiceId = req.params.id;
    const PDFDocument = require('pdfkit');

    // Fetch invoice data
    const ws = getWorkspaceFilter(req, 'i', 'workspace_id');
    const invoices = await dbQuery(
      `SELECT 
        i.*,
        c.full_name as client_name,
        c.company_name as client_company,
        c.email as client_email,
        c.phone as client_phone,
        c.address as client_address,
        c.city as client_city,
        c.state as client_state,
        c.country as client_country,
        c.postal_code as client_postal_code,
        p.title as project_title,
        qt.quote_number as quotation_number,
        u.full_name as created_by_name
       FROM invoices i
       LEFT JOIN clients c ON i.client_id = c.id
       LEFT JOIN projects p ON i.project_id = p.id
       LEFT JOIN quotations qt ON i.quotation_id = qt.id
       LEFT JOIN users u ON i.created_by = u.id
       WHERE i.id = ? ${ws.whereClause}`,
      [invoiceId, ...ws.whereParams]
    );

    if (invoices.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    const invoice = invoices[0];

    // Check if client user can access this invoice's data
    if (!canAccessClientData(req, invoice.client_id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only download invoices associated with your account.'
      });
    }

    // Get invoice items
    const items = await dbQuery(
      'SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id',
      [invoiceId]
    );

    // Get payments for this invoice
    const payments = await dbQuery(
      'SELECT * FROM payments WHERE invoice_id = ? ORDER BY payment_date DESC, created_at DESC',
      [invoiceId]
    );

    // Calculate subtotal from items if not present
    if (!invoice.subtotal && items && items.length > 0) {
      invoice.subtotal = items.reduce((sum, item) => sum + (parseFloat(item.total_price) || 0), 0);
    }

    // Create PDF document with optimized margins
    const doc = new PDFDocument({ 
      margin: 40, 
      size: 'A4',
      info: {
        Title: `Invoice ${invoice.invoice_number}`,
        Author: process.env.APP_NAME || 'Client Management System'
      }
    });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Invoice-${invoice.invoice_number}.pdf"`);

    // Pipe PDF to response
    doc.pipe(res);

    // Constants for layout (A4 = 595.28 x 841.89 pts; keep all content within contentWidth)
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = 40;
    const contentWidth = Math.min(pageWidth - (margin * 2), 515); // cap so table/summary never overflow
    const maxContentHeight = pageHeight - (margin * 2);
    
    // Table column layout - must fit within contentWidth (515)
    const colLayout = {
      item: { x: margin + 5, width: 72 },
      desc: { x: margin + 82, width: 228 },
      qty: { x: margin + 315, width: 32 },
      unit: { x: margin + 352, width: 78 },
      total: { x: margin + 435, width: 78 }
    };

    // Calculate available space for items (reserve space for header, from/to, summary, status badge, payment method, footer)
    const headerHeight = 85;
    const fromToHeight = 110;
    const summaryHeight = 180;
    const paymentMethodHeight = 20;
    const footerHeight = 60;
    const tableHeaderHeight = 28;
    const itemRowMinHeight = 28;
    const availableHeightForItems = maxContentHeight - headerHeight - fromToHeight - summaryHeight - paymentMethodHeight - footerHeight - tableHeaderHeight;
    const maxItemsPerPage = Math.max(1, Math.floor(availableHeightForItems / (itemRowMinHeight + 12))); // assume some rows may be taller for wrapped desc

    // Helper function to add header to each page
    const addPageHeader = (pageNum = 1) => {
      // Top border line
      doc.strokeColor('#E5E7EB').lineWidth(1);
      doc.moveTo(margin, margin).lineTo(pageWidth - margin, margin).stroke();
      
      // Title
      doc.fontSize(28).font('Helvetica-Bold').fillColor('#111827');
      doc.text('INVOICE', margin, margin + 10);
      
      // Invoice details (right aligned, within content width)
      doc.fontSize(10).font('Helvetica').fillColor('#6B7280');
      const contentRight = margin + contentWidth;
      const headerBlockWidth = 200;
      doc.text(`Invoice #: ${invoice.invoice_number}`, contentRight, margin + 15, { width: headerBlockWidth, align: 'right' });
      doc.text(`Date: ${new Date(invoice.invoice_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, contentRight, margin + 30, { width: headerBlockWidth, align: 'right' });
      doc.text(`Due Date: ${new Date(invoice.due_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, contentRight, margin + 45, { width: headerBlockWidth, align: 'right' });
    };

    // Helper function to add from/to section
    const addFromToSection = (startY) => {
      // From section
      doc.fontSize(9).fillColor('#6B7280').font('Helvetica-Bold');
      doc.text('FROM:', margin, startY);
      doc.fontSize(12).fillColor('#111827').font('Helvetica-Bold');
      doc.text(process.env.APP_NAME || 'Client Management System', margin, startY + 14);
      doc.fontSize(9).fillColor('#6B7280').font('Helvetica');
      doc.text('System Administrator', margin, startY + 28);
      
      // To section (within content width)
      const toX = margin + 280;
      const toBlockWidth = Math.max(200, (margin + contentWidth) - toX - 5);
      doc.fontSize(9).fillColor('#6B7280').font('Helvetica-Bold');
      doc.text('BILL TO:', toX, startY);
      doc.fontSize(12).fillColor('#111827').font('Helvetica-Bold');
      doc.text((invoice.client_name || '').toString(), toX, startY + 14, { width: toBlockWidth, ellipsis: true });

      let toY = startY + 28;
      if (invoice.client_company) {
        doc.fontSize(10).fillColor('#374151').font('Helvetica');
        doc.text(invoice.client_company.toString(), toX, toY, { width: toBlockWidth, ellipsis: true });
        toY += 14;
      }
      if (invoice.client_address) {
        doc.fontSize(9).fillColor('#6B7280').font('Helvetica');
        const addressLines = doc.heightOfString(invoice.client_address.toString(), { width: toBlockWidth });
        doc.text(invoice.client_address.toString(), toX, toY, { width: toBlockWidth });
        toY += Math.max(12, addressLines);
      }
      if (invoice.client_city || invoice.client_state || invoice.client_postal_code) {
        const cityState = [invoice.client_city, invoice.client_state, invoice.client_postal_code].filter(Boolean).join(', ');
        doc.text(cityState, toX, toY, { width: toBlockWidth, ellipsis: true });
        toY += 12;
      }
      if (invoice.client_email) {
        doc.text(`Email: ${invoice.client_email}`, toX, toY, { width: toBlockWidth, ellipsis: true });
        toY += 12;
      }
      if (invoice.client_phone) {
        doc.text(`Phone: ${invoice.client_phone}`, toX, toY, { width: toBlockWidth, ellipsis: true });
      }
    };

    // Helper function to add table header
    const addTableHeader = (y) => {
      const tableLeft = margin;
      const headerHeight = 28;

      doc.rect(tableLeft, y, contentWidth, headerHeight).fill('#4F46E5');
      doc.fontSize(10).fillColor('#FFFFFF').font('Helvetica-Bold');
      doc.text('Item', colLayout.item.x, y + 9, { width: colLayout.item.width });
      doc.text('Description', colLayout.desc.x, y + 9, { width: colLayout.desc.width });
      doc.text('Qty', colLayout.qty.x, y + 9, { width: colLayout.qty.width, align: 'right' });
      doc.text('Unit Price', colLayout.unit.x, y + 9, { width: colLayout.unit.width, align: 'right' });
      doc.text('Total', colLayout.total.x, y + 9, { width: colLayout.total.width, align: 'right' });
    };

    // Helper function to add summary section (all content within contentWidth)
    const addSummarySection = (y) => {
      const summaryWidth = Math.min(200, contentWidth - 20);
      const summaryRight = margin + contentWidth;
      const summaryLeft = summaryRight - summaryWidth;
      const labelWidth = 85;
      const valueWidth = 105;

      const subtotal = parseFloat(invoice.subtotal) || 0;
      const taxRate = parseFloat(invoice.tax_rate) || 0;
      const taxAmount = parseFloat(invoice.tax_amount) || 0;
      const totalAmount = parseFloat(invoice.total_amount) || 0;
      const paidAmount = parseFloat(invoice.paid_amount) || 0;
      const outstanding = Math.max(0, totalAmount - paidAmount);

      const boxHeight = 140;
      doc.strokeColor('#E5E7EB').lineWidth(1);
      doc.rect(summaryLeft, y - 10, summaryWidth, boxHeight).stroke();
      doc.fillColor('#FAFBFC');
      doc.rect(summaryLeft, y - 10, summaryWidth, boxHeight).fill();

      doc.fontSize(10).font('Helvetica-Bold').fillColor('#111827');
      doc.text('Summary', summaryLeft + 5, y - 5);

      doc.strokeColor('#E5E7EB').lineWidth(0.5);
      doc.moveTo(summaryLeft, y + 8).lineTo(summaryRight, y + 8).stroke();

      // Value box must end at summaryRight (PDFKit uses x as left edge of box, so x = summaryRight - valueWidth)
      const valueX = summaryRight - valueWidth;

      doc.fontSize(10).font('Helvetica').fillColor('#111827');
      doc.text('Subtotal:', summaryLeft + 5, y + 15, { width: labelWidth, align: 'right' });
      doc.text(formatCurrencyForPdf(subtotal, invoice.currency), valueX, y + 15, { width: valueWidth, align: 'right' });

      doc.text(`Tax (${taxRate.toFixed(2)}%):`, summaryLeft + 5, y + 32, { width: labelWidth, align: 'right' });
      doc.text(formatCurrencyForPdf(taxAmount, invoice.currency), valueX, y + 32, { width: valueWidth, align: 'right' });

      doc.strokeColor('#E5E7EB').lineWidth(0.5);
      doc.moveTo(summaryLeft, y + 48).lineTo(summaryRight, y + 48).stroke();

      doc.fontSize(13).font('Helvetica-Bold').fillColor('#111827');
      doc.text('Total:', summaryLeft + 5, y + 55, { width: labelWidth, align: 'right' });
      doc.text(formatCurrencyForPdf(totalAmount, invoice.currency), valueX, y + 55, { width: valueWidth, align: 'right' });

      doc.fontSize(10).font('Helvetica').fillColor('#111827');
      doc.text('Paid:', summaryLeft + 5, y + 75, { width: labelWidth, align: 'right' });
      doc.text(formatCurrencyForPdf(paidAmount, invoice.currency), valueX, y + 75, { width: valueWidth, align: 'right' });

      doc.fontSize(10).font('Helvetica-Bold').fillColor(outstanding > 0 ? '#DC2626' : '#10B981');
      doc.text('Outstanding:', summaryLeft + 5, y + 92, { width: labelWidth, align: 'right' });
      doc.text(formatCurrencyForPdf(outstanding, invoice.currency), valueX, y + 92, { width: valueWidth, align: 'right' });

      const statusY = y + 118;
      const statusColors = {
        'draft': '#9CA3AF',
        'sent': '#3B82F6',
        'paid': '#10B981',
        'partial': '#F59E0B',
        'overdue': '#EF4444',
        'cancelled': '#6B7280'
      };
      const statusColor = statusColors[invoice.status] || '#6B7280';
      const statusText = invoice.status ? invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1) : 'Draft';
      const badgeWidth = Math.min(90, summaryWidth - 10);
      const statusX = summaryRight - badgeWidth - 5;

      doc.roundedRect(statusX, statusY, badgeWidth, 18, 4).fill(statusColor);
      doc.fontSize(9).fillColor('#FFFFFF').font('Helvetica-Bold');
      doc.text(statusText, statusX + 4, statusY + 5, { width: badgeWidth - 8, align: 'center' });
    };

    // Helper function to add payment method section
    const addPaymentMethodSection = (y) => {
      if (!payments || payments.length === 0) {
        return;
      }
      
      // Get unique payment methods
      const paymentMethods = [...new Set(payments.map(p => p.payment_method).filter(Boolean))];
      
      if (paymentMethods.length === 0) {
        return;
      }
      
      doc.fontSize(9).fillColor('#374151').font('Helvetica-Bold');
      doc.text('Payment Type:', margin, y);
      doc.fontSize(9).fillColor('#6B7280').font('Helvetica');
      doc.text(paymentMethods.join(', '), margin + 80, y);
    };

    // Helper function to add footer
    const addFooter = (pageNum, totalPages) => {
      const footerY = pageHeight - margin - 50;
      
      // Footer divider line
      doc.strokeColor('#E5E7EB').lineWidth(0.5);
      doc.moveTo(margin, footerY - 15).lineTo(pageWidth - margin, footerY - 15).stroke();
      
      // Copyright and contact info
      doc.fontSize(8).fillColor('#6B7280').font('Helvetica');
      const copyrightText = `© ${new Date().getFullYear()} W | Technology. All rights reserved.`;
      doc.text(copyrightText, margin, footerY - 10, { width: contentWidth, align: 'center' });
      
      doc.fontSize(7).fillColor('#9CA3AF').font('Helvetica');
      const contactText = 'For any queries, please contact us at support@wtechnology.com or call +1 (555) 123-4567';
      doc.text(contactText, margin, footerY, { width: contentWidth, align: 'center' });
      
      // Generation info
      const genY = footerY + 12;
      doc.fontSize(7).fillColor('#9CA3AF').font('Helvetica');
      const footerText = `Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}${totalPages > 1 ? ` | Page ${pageNum} of ${totalPages}` : ''}`;
      doc.text(footerText, margin, genY, { width: contentWidth, align: 'center' });
    };

    // Calculate pagination
    const totalItems = items && items.length > 0 ? items.length : 1;
    const totalPages = Math.max(1, Math.ceil(totalItems / maxItemsPerPage));

    // Generate pages
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      if (pageNum > 1) {
        doc.addPage();
      }

      // Add header
      addPageHeader(pageNum);

      // Add from/to section
      const fromToY = margin + 85;
      addFromToSection(fromToY);

      // Calculate items for this page
      const startIndex = (pageNum - 1) * maxItemsPerPage;
      const endIndex = Math.min(startIndex + maxItemsPerPage, totalItems);
      const pageItems = items && items.length > 0 ? items.slice(startIndex, endIndex) : [];

      // Add table header
      const tableHeaderY = fromToY + 110;
      addTableHeader(tableHeaderY);

      // Add items (columns and description wrap within contentWidth)
      let currentY = tableHeaderY + 28;
      const tableLeft = margin;

      if (pageItems.length > 0) {
        pageItems.forEach((item, index) => {
          const descText = (item.description || 'N/A').toString();
          doc.fontSize(8);
          const descHeight = Math.ceil(doc.heightOfString(descText, { width: colLayout.desc.width }));
          const rowHeight = Math.max(itemRowMinHeight, descHeight + 14);

          if (currentY + rowHeight > pageHeight - margin - summaryHeight - paymentMethodHeight - footerHeight && pageNum < totalPages) {
            return;
          }

          const bgColor = (startIndex + index) % 2 === 0 ? '#F9FAFB' : '#FFFFFF';
          doc.rect(tableLeft, currentY, contentWidth, rowHeight).fill(bgColor);

          doc.fontSize(9).fillColor('#111827').font('Helvetica');
          doc.text((item.item_name || 'N/A').toString(), colLayout.item.x, currentY + 8, { width: colLayout.item.width, ellipsis: true });

          doc.fillColor('#6B7280').fontSize(8);
          doc.text(descText, colLayout.desc.x, currentY + 8, { width: colLayout.desc.width });

          doc.fillColor('#111827').fontSize(9);
          doc.text(String(item.quantity || 0), colLayout.qty.x, currentY + 8, { width: colLayout.qty.width, align: 'right' });
          doc.text(formatCurrencyForPdf(item.unit_price || 0, invoice.currency), colLayout.unit.x, currentY + 8, { width: colLayout.unit.width, align: 'right' });
          doc.font('Helvetica-Bold');
          doc.text(formatCurrencyForPdf(item.total_price || 0, invoice.currency), colLayout.total.x, currentY + 8, { width: colLayout.total.width, align: 'right' });

          currentY += rowHeight;
        });
      } else {
        doc.rect(tableLeft, currentY, contentWidth, itemRowMinHeight).fill('#F9FAFB');
        doc.fontSize(9).fillColor('#6B7280').font('Helvetica');
        doc.text('No items', colLayout.item.x, currentY + 9);
        currentY += itemRowMinHeight;
      }

      // Add summary section (only on last page)
      if (pageNum === totalPages) {
        // Ensure summary is positioned correctly
        const minSummaryY = currentY + 15;
        const maxSummaryY = pageHeight - margin - summaryHeight - paymentMethodHeight - footerHeight - 10;
        const summaryY = Math.min(minSummaryY, maxSummaryY);
        
        addSummarySection(summaryY);

        // Add payment method section (below status badge)
        const paymentMethodY = summaryY + 180;
        if (paymentMethodY + paymentMethodHeight < pageHeight - margin - footerHeight) {
          addPaymentMethodSection(paymentMethodY);
        }

        // Add notes if available and space permits
        const notesY = paymentMethodY + 25;
        if (invoice.notes && notesY + 50 < pageHeight - margin - footerHeight) {
          doc.fontSize(9).fillColor('#111827').font('Helvetica-Bold');
          doc.text('Notes:', margin, notesY);
          doc.fontSize(8).fillColor('#6B7280').font('Helvetica');
          const notesHeight = doc.heightOfString(invoice.notes, { width: contentWidth - 100 });
          doc.text(invoice.notes, margin, notesY + 12, { width: contentWidth - 100 });
        }
      }

      // Add footer
      addFooter(pageNum, totalPages);
    }

    // Finalize PDF
    doc.end();

  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate PDF'
    });
  }
});

// Helper function to format currency
function formatCurrency(amount, currency = 'USD') {
  // Normalize currency code (handle cases where it might be a symbol or invalid)
  let currencyCode = (currency || 'USD').toUpperCase().trim();
  
  // Map common currency symbols to codes
  const currencyMap = {
    '₹': 'INR',
    '$': 'USD',
    '€': 'EUR',
    '£': 'GBP',
    '¥': 'JPY'
  };
  
  if (currencyMap[currencyCode]) {
    currencyCode = currencyMap[currencyCode];
  }
  
  // Validate currency code (must be 3 letters)
  if (currencyCode.length !== 3 || !/^[A-Z]{3}$/.test(currencyCode)) {
    currencyCode = 'USD';
  }
  
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
    }).format(amount || 0);
  } catch (error) {
    // Fallback to USD if currency code is invalid
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount || 0);
  }
}

// PDF-safe currency format: use ASCII-only prefix so symbols like ₹ render correctly in Helvetica
function formatCurrencyForPdf(amount, currency = 'USD') {
  let currencyCode = (currency || 'USD').toUpperCase().trim();
  const currencyMap = { '₹': 'INR', '$': 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY' };
  if (currencyMap[currencyCode]) currencyCode = currencyMap[currencyCode];
  if (currencyCode.length !== 3 || !/^[A-Z]{3}$/.test(currencyCode)) currencyCode = 'USD';

  const num = Number(amount) || 0;
  const formatted = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
  if (currencyCode === 'INR') return `INR ${formatted}`;
  if (currencyCode === 'USD') return `$${formatted}`;
  if (currencyCode === 'EUR') return `EUR ${formatted}`;
  if (currencyCode === 'GBP') return `GBP ${formatted}`;
  return `${currencyCode} ${formatted}`;
}

module.exports = router;
