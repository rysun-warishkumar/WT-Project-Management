const express = require('express');
const { query: validatorQuery, body, validationResult } = require('express-validator');
const { authenticateToken, authorizePermission } = require('../middleware/auth');
const { query: dbQuery } = require('../config/database');
const { getWorkspaceFilter } = require('../utils/dataFiltering');
const { workspaceContext } = require('../middleware/workspaceContext');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);
router.use(workspaceContext);

// Validation middleware
const validateReportParams = [
  validatorQuery('start_date').optional().isISO8601().withMessage('Start date must be a valid date'),
  validatorQuery('end_date').optional().isISO8601().withMessage('End date must be a valid date'),
  validatorQuery('client_id').optional().isInt({ min: 1 }).withMessage('Client ID must be a positive integer'),
  validatorQuery('project_id').optional().isInt({ min: 1 }).withMessage('Project ID must be a positive integer'),
  validatorQuery('format').optional().isIn(['json', 'pdf', 'excel', 'csv']).withMessage('Format must be json, pdf, excel, or csv'),
];

// Get financial report
router.get('/financial', authorizePermission('reports', 'view'), validateReportParams, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { start_date, end_date, client_id, project_id } = req.query;

    // Build WHERE clause
    let whereClause = 'WHERE 1=1';
    const whereParams = [];

    // Workspace filter (primary)
    const ws = getWorkspaceFilter(req, 'i', 'workspace_id');
    whereClause += ws.whereClause;
    whereParams.push(...ws.whereParams);

    if (start_date) {
      whereClause += ' AND i.invoice_date >= ?';
      whereParams.push(start_date);
    }

    if (end_date) {
      whereClause += ' AND i.invoice_date <= ?';
      whereParams.push(end_date);
    }

    if (client_id) {
      whereClause += ' AND i.client_id = ?';
      whereParams.push(client_id);
    }

    if (project_id) {
      whereClause += ' AND i.project_id = ?';
      whereParams.push(project_id);
    }

    // Get invoice statistics
    const invoiceStats = await dbQuery(`
      SELECT 
        COUNT(*) as total_invoices,
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_invoices,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent_invoices,
        SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END) as partial_invoices,
        SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue_invoices,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_invoices,
        SUM(total_amount) as total_amount,
        SUM(paid_amount) as total_paid,
        SUM(total_amount - paid_amount) as total_outstanding,
        AVG(total_amount) as average_invoice_amount
      FROM invoices i
      ${whereClause}
    `, whereParams);

    // Get revenue by month
    const revenueByMonth = await dbQuery(`
      SELECT 
        DATE_FORMAT(invoice_date, '%Y-%m') as month,
        DATE_FORMAT(invoice_date, '%M %Y') as month_name,
        COUNT(*) as invoice_count,
        SUM(total_amount) as total_amount,
        SUM(paid_amount) as total_paid,
        SUM(total_amount - paid_amount) as outstanding
      FROM invoices i
      ${whereClause}
      GROUP BY DATE_FORMAT(invoice_date, '%Y-%m'), DATE_FORMAT(invoice_date, '%M %Y')
      ORDER BY month DESC
      LIMIT 12
    `, whereParams);

    // Get revenue by client
    // Build separate WHERE clause for this query
    // Apply workspace filter for everyone including super admin (show only their workspace)
    let revenueByClientWhere = 'WHERE 1=1';
    const revenueByClientParams = [];
    const workspaceIdRevenue = req.workspaceId || req.workspaceFilter?.value || req.user?.workspace_id || req.user?.workspaceId;
    if (workspaceIdRevenue) {
      revenueByClientWhere += ' AND c.workspace_id = ?';
      revenueByClientParams.push(workspaceIdRevenue);
    } else {
      revenueByClientWhere += ' AND 1=0';
    }
    
    if (start_date) {
      revenueByClientWhere += ' AND i.invoice_date >= ?';
      revenueByClientParams.push(start_date);
    }
    if (end_date) {
      revenueByClientWhere += ' AND i.invoice_date <= ?';
      revenueByClientParams.push(end_date);
    }
    if (client_id) {
      revenueByClientWhere += ' AND i.client_id = ?';
      revenueByClientParams.push(client_id);
    }
    if (project_id) {
      revenueByClientWhere += ' AND i.project_id = ?';
      revenueByClientParams.push(project_id);
    }
    
    const revenueByClient = await dbQuery(`
      SELECT 
        c.id,
        c.full_name,
        c.company_name,
        COUNT(i.id) as invoice_count,
        SUM(i.total_amount) as total_amount,
        SUM(i.paid_amount) as total_paid,
        SUM(i.total_amount - i.paid_amount) as outstanding
      FROM clients c
      INNER JOIN invoices i ON c.id = i.client_id
      ${revenueByClientWhere}
      GROUP BY c.id, c.full_name, c.company_name
      ORDER BY total_amount DESC
      LIMIT 10
    `, revenueByClientParams);

    // Get payment history scoped by workspace (join invoices so we only include payments for this workspace's invoices)
    let paymentHistory = [];
    try {
      const paymentWs = getWorkspaceFilter(req, 'i', 'workspace_id');
      let paymentWhere = 'WHERE 1=1';
      const paymentParams = [...paymentWs.whereParams];

      if (start_date) {
        paymentWhere += ' AND p.payment_date >= ?';
        paymentParams.push(start_date);
      }
      if (end_date) {
        paymentWhere += ' AND p.payment_date <= ?';
        paymentParams.push(end_date);
      }

      paymentHistory = await dbQuery(`
        SELECT 
          DATE_FORMAT(p.payment_date, '%Y-%m-%d') as payment_date,
          COUNT(*) as payment_count,
          SUM(p.amount) as total_amount
        FROM payments p
        INNER JOIN invoices i ON p.invoice_id = i.id ${paymentWs.whereClause}
        ${paymentWhere}
        GROUP BY DATE_FORMAT(p.payment_date, '%Y-%m-%d')
        ORDER BY payment_date DESC
        LIMIT 30
      `, paymentParams);
    } catch (error) {
      console.warn('Payment history query failed:', error.message);
      // Continue without payment history if table doesn't exist or query fails
    }

    res.json({
      success: true,
      data: {
        summary: invoiceStats[0],
        revenue_by_month: revenueByMonth,
        revenue_by_client: revenueByClient,
        payment_history: paymentHistory,
        filters: {
          start_date: start_date || null,
          end_date: end_date || null,
          client_id: client_id || null,
          project_id: project_id || null,
        }
      }
    });
  } catch (error) {
    console.error('Financial report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate financial report',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get client performance report
router.get('/client-performance', authorizePermission('reports', 'view'), validateReportParams, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { start_date, end_date } = req.query;

    let whereClause = 'WHERE 1=1';
    const whereParams = [];

    // Workspace filter for everyone including super admin (show only their workspace)
    const workspaceIdClient = req.workspaceId || req.workspaceFilter?.value || req.user?.workspace_id || req.user?.workspaceId;
    if (workspaceIdClient) {
      whereClause += ' AND c.workspace_id = ?';
      whereParams.push(workspaceIdClient);
    } else {
      whereClause += ' AND 1=0';
    }

    if (start_date) {
      whereClause += ' AND c.onboarding_date >= ?';
      whereParams.push(start_date);
    }
    if (end_date) {
      whereClause += ' AND c.onboarding_date <= ?';
      whereParams.push(end_date);
    }

    // Get client statistics
    const clientStats = await dbQuery(`
      SELECT 
        c.id,
        c.full_name,
        c.company_name,
        c.email,
        c.phone,
        c.status,
        c.onboarding_date,
        COUNT(DISTINCT p.id) as project_count,
        COUNT(DISTINCT CASE WHEN p.status = 'completed' THEN p.id END) as completed_projects,
        COUNT(DISTINCT q.id) as quotation_count,
        COUNT(DISTINCT i.id) as invoice_count,
        COALESCE(SUM(i.total_amount), 0) as total_invoiced,
        COALESCE(SUM(i.paid_amount), 0) as total_paid,
        COALESCE(SUM(i.total_amount - i.paid_amount), 0) as outstanding_amount,
        COUNT(DISTINCT f.id) as file_count,
        COUNT(DISTINCT conv.id) as conversation_count
      FROM clients c
      LEFT JOIN projects p ON c.id = p.client_id
      LEFT JOIN quotations q ON c.id = q.client_id
      LEFT JOIN invoices i ON c.id = i.client_id
      LEFT JOIN files f ON c.id = f.client_id
      LEFT JOIN conversations conv ON c.id = conv.client_id
      ${whereClause}
      GROUP BY c.id, c.full_name, c.company_name, c.email, c.phone, c.status, c.onboarding_date
      ORDER BY total_invoiced DESC
    `, whereParams);

    // Get client status distribution (same workspace filter as above)
    let statusDistributionWhere = 'WHERE 1=1';
    const statusDistributionParams = [];
    if (workspaceIdClient) {
      statusDistributionWhere += ' AND c.workspace_id = ?';
      statusDistributionParams.push(workspaceIdClient);
    } else {
      statusDistributionWhere += ' AND 1=0';
    }
    if (start_date) {
      statusDistributionWhere += ' AND c.onboarding_date >= ?';
      statusDistributionParams.push(start_date);
    }
    if (end_date) {
      statusDistributionWhere += ' AND c.onboarding_date <= ?';
      statusDistributionParams.push(end_date);
    }
    
    const statusDistribution = await dbQuery(`
      SELECT 
        c.status,
        COUNT(*) as count
      FROM clients c
      ${statusDistributionWhere}
      GROUP BY c.status
    `, statusDistributionParams);

    res.json({
      success: true,
      data: {
        clients: clientStats,
        status_distribution: statusDistribution,
        total_clients: clientStats.length,
        filters: {
          start_date: start_date || null,
          end_date: end_date || null,
        }
      }
    });
  } catch (error) {
    console.error('Client performance report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate client performance report',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get project performance report
router.get('/project-performance', authorizePermission('reports', 'view'), validateReportParams, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { start_date, end_date, client_id } = req.query;

    let whereClause = 'WHERE 1=1';
    const whereParams = [];

    // Workspace filter (primary)
    const ws = getWorkspaceFilter(req, 'p', 'workspace_id');
    whereClause += ws.whereClause;
    whereParams.push(...ws.whereParams);

    if (start_date) {
      whereClause += ' AND p.start_date >= ?';
      whereParams.push(start_date);
    }

    if (end_date) {
      whereClause += ' AND p.start_date <= ?';
      whereParams.push(end_date);
    }

    if (client_id) {
      whereClause += ' AND p.client_id = ?';
      whereParams.push(client_id);
    }

    // Get project statistics
    const projectStats = await dbQuery(`
      SELECT 
        p.id,
        p.title,
        p.type,
        p.status,
        p.start_date,
        p.end_date,
        p.budget,
        p.actual_cost,
        c.full_name as client_name,
        c.company_name,
        DATEDIFF(COALESCE(p.end_date, CURDATE()), p.start_date) as duration_days,
        COUNT(DISTINCT i.id) as invoice_count,
        COALESCE(SUM(i.total_amount), 0) as total_invoiced,
        COUNT(DISTINCT q.id) as quotation_count,
        COUNT(DISTINCT f.id) as file_count,
        COUNT(DISTINCT conv.id) as conversation_count
      FROM projects p
      LEFT JOIN clients c ON p.client_id = c.id
      LEFT JOIN invoices i ON p.id = i.project_id
      LEFT JOIN quotations q ON p.id = q.project_id
      LEFT JOIN files f ON p.id = f.project_id
      LEFT JOIN conversations conv ON p.id = conv.project_id
      ${whereClause}
      GROUP BY p.id, p.title, p.type, p.status, p.start_date, p.end_date, p.budget, p.actual_cost, c.full_name, c.company_name
      ORDER BY p.created_at DESC
    `, whereParams);

    // Get project status distribution
    const statusDistribution = await dbQuery(`
      SELECT 
        status,
        COUNT(*) as count,
        AVG(budget) as avg_budget,
        AVG(actual_cost) as avg_actual_cost
      FROM projects
      ${whereClause.replace('p.', '')}
      GROUP BY status
    `, whereParams);

    // Get project type distribution
    const typeDistribution = await dbQuery(`
      SELECT 
        type,
        COUNT(*) as count
      FROM projects
      ${whereClause.replace('p.', '')}
      GROUP BY type
    `, whereParams);

    res.json({
      success: true,
      data: {
        projects: projectStats,
        status_distribution: statusDistribution,
        type_distribution: typeDistribution,
        total_projects: projectStats.length,
        filters: {
          start_date: start_date || null,
          end_date: end_date || null,
          client_id: client_id || null,
        }
      }
    });
  } catch (error) {
    console.error('Project performance report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate project performance report',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get invoice report
router.get('/invoices', authorizePermission('reports', 'view'), validateReportParams, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { start_date, end_date, client_id, status } = req.query;

    let whereClause = 'WHERE 1=1';
    const whereParams = [];

    // Workspace filter (primary)
    const ws = getWorkspaceFilter(req, 'i', 'workspace_id');
    whereClause += ws.whereClause;
    whereParams.push(...ws.whereParams);

    if (start_date) {
      whereClause += ' AND i.invoice_date >= ?';
      whereParams.push(start_date);
    }

    if (end_date) {
      whereClause += ' AND i.invoice_date <= ?';
      whereParams.push(end_date);
    }

    if (client_id) {
      whereClause += ' AND i.client_id = ?';
      whereParams.push(client_id);
    }

    if (status) {
      whereClause += ' AND i.status = ?';
      whereParams.push(status);
    }

    // Get invoice details
    const invoices = await dbQuery(`
      SELECT 
        i.id,
        i.invoice_number,
        i.invoice_date,
        i.due_date,
        i.total_amount,
        i.paid_amount,
        i.total_amount - i.paid_amount as outstanding_amount,
        i.status,
        i.tax_rate,
        i.tax_amount,
        c.full_name as client_name,
        c.company_name,
        c.email as client_email,
        p.title as project_title,
        COUNT(DISTINCT pay.id) as payment_count,
        MAX(pay.payment_date) as last_payment_date
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      LEFT JOIN projects p ON i.project_id = p.id
      LEFT JOIN payments pay ON i.id = pay.invoice_id
      ${whereClause}
      GROUP BY i.id, i.invoice_number, i.invoice_date, i.due_date, i.total_amount, i.paid_amount, i.status, i.tax_rate, i.tax_amount, c.full_name, c.company_name, c.email, p.title
      ORDER BY i.invoice_date DESC
    `, whereParams);

    // Get invoice status summary
    const statusSummary = await dbQuery(`
      SELECT 
        status,
        COUNT(*) as count,
        SUM(total_amount) as total_amount,
        SUM(paid_amount) as total_paid,
        SUM(total_amount - paid_amount) as total_outstanding
      FROM invoices i
      ${whereClause}
      GROUP BY status
    `, whereParams);

    res.json({
      success: true,
      data: {
        invoices,
        status_summary: statusSummary,
        total_invoices: invoices.length,
        filters: {
          start_date: start_date || null,
          end_date: end_date || null,
          client_id: client_id || null,
          status: status || null,
        }
      }
    });
  } catch (error) {
    console.error('Invoice report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate invoice report',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get summary report (all key metrics)
// Super admin also sees only their workspace data (req.workspaceId = Super admin workspace)
router.get('/summary', authorizePermission('reports', 'view'), async (req, res) => {
  try {
    const workspaceId = req.workspaceId || req.workspaceFilter?.value;
    const wsClause = workspaceId ? ' AND workspace_id = ?' : ' AND 1=0';
    const repeat = (n) => (workspaceId ? Array(n).fill(workspaceId) : []);

    // Get all key metrics
    const summary = await dbQuery(`
      SELECT 
        (SELECT COUNT(*) FROM clients WHERE 1=1${wsClause}) as total_clients,
        (SELECT COUNT(*) FROM clients WHERE status = 'active'${wsClause}) as active_clients,
        (SELECT COUNT(*) FROM projects WHERE 1=1${wsClause}) as total_projects,
        (SELECT COUNT(*) FROM projects WHERE status = 'in_progress'${wsClause}) as active_projects,
        (SELECT COUNT(*) FROM projects WHERE status = 'completed'${wsClause}) as completed_projects,
        (SELECT COUNT(*) FROM quotations WHERE 1=1${wsClause}) as total_quotations,
        (SELECT COUNT(*) FROM quotations WHERE status = 'sent'${wsClause}) as pending_quotations,
        (SELECT COUNT(*) FROM invoices WHERE 1=1${wsClause}) as total_invoices,
        (SELECT COUNT(*) FROM invoices WHERE status = 'paid'${wsClause}) as paid_invoices,
        (SELECT COUNT(*) FROM invoices WHERE status IN ('sent', 'partial', 'overdue')${wsClause}) as unpaid_invoices,
        (SELECT SUM(total_amount) FROM invoices WHERE status = 'paid'${wsClause}) as total_revenue,
        (SELECT SUM(total_amount - paid_amount) FROM invoices WHERE status IN ('sent', 'partial', 'overdue')${wsClause}) as outstanding_amount,
        (SELECT COUNT(*) FROM files WHERE 1=1${wsClause}) as total_files,
        (SELECT COUNT(*) FROM credentials WHERE 1=1${wsClause}) as total_credentials,
        (SELECT COUNT(*) FROM conversations WHERE 1=1${wsClause}) as total_conversations,
        (SELECT COUNT(*) FROM users WHERE is_active = 1${wsClause}) as active_users
    `, repeat(16));

    res.json({
      success: true,
      data: summary[0]
    });
  } catch (error) {
    console.error('Summary report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate summary report',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
