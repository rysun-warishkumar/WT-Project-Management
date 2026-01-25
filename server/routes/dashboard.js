const express = require('express');
const { authenticateToken, authorizePermission } = require('../middleware/auth');
const { query } = require('../config/database');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get dashboard overview
router.get('/overview', authorizePermission('dashboard', 'view'), async (req, res) => {
  try {
    // Get basic statistics
    const stats = await query(`
      SELECT 
        (SELECT COUNT(*) FROM clients WHERE status = 'active') as active_clients,
        (SELECT COUNT(*) FROM clients) as total_clients,
        (SELECT COUNT(*) FROM projects WHERE status = 'in_progress') as active_projects,
        (SELECT COUNT(*) FROM projects) as total_projects,
        (SELECT COUNT(*) FROM quotations WHERE status IN ('draft', 'sent')) as pending_quotations,
        (SELECT COUNT(*) FROM quotations) as total_quotations,
        (SELECT COUNT(*) FROM invoices WHERE status IN ('sent', 'partial', 'overdue')) as unpaid_invoices,
        (SELECT COUNT(*) FROM invoices) as total_invoices,
        (SELECT COUNT(*) FROM projects WHERE status = 'completed') as completed_projects,
        (SELECT COUNT(*) FROM clients WHERE onboarding_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)) as new_clients_month,
        (SELECT COUNT(*) FROM files) as total_files,
        (SELECT COUNT(*) FROM credentials) as total_credentials,
        (SELECT COUNT(*) FROM conversations) as total_conversations,
        (SELECT COUNT(*) FROM users WHERE is_active = 1) as active_users,
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT SUM(total_amount) FROM invoices WHERE status = 'paid') as total_revenue,
        (SELECT SUM(total_amount - paid_amount) FROM invoices WHERE status IN ('sent', 'partial', 'overdue')) as outstanding_amount
    `);

    // Get recent activities
    const recentActivities = await query(`
      SELECT 
        'client' as type,
        c.full_name as title,
        'New client added' as description,
        c.created_at as date
      FROM clients c
      WHERE c.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      
      UNION ALL
      
      SELECT 
        'project' as type,
        p.title as title,
        CONCAT('Project status changed to ', p.status) as description,
        p.updated_at as date
      FROM projects p
      WHERE p.updated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      
      UNION ALL
      
      SELECT 
        'invoice' as type,
        CONCAT('Invoice #', i.invoice_number) as title,
        CONCAT('Invoice ', i.status) as description,
        i.created_at as date
      FROM invoices i
      WHERE i.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      
      ORDER BY date DESC
      LIMIT 5
    `);

    // Get upcoming due dates
    const upcomingDueDates = await query(`
      SELECT 
        'invoice' as type,
        i.invoice_number as reference,
        i.due_date as due_date,
        i.total_amount as amount,
        c.full_name as client_name,
        'Invoice due' as description
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      WHERE i.due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
        AND i.status IN ('sent', 'partial')
      
      UNION ALL
      
      SELECT 
        'quotation' as type,
        q.quote_number as reference,
        q.valid_till_date as due_date,
        q.total_amount as amount,
        c.full_name as client_name,
        'Quotation expires' as description
      FROM quotations q
      JOIN clients c ON q.client_id = c.id
      WHERE q.valid_till_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
        AND q.status = 'sent'
      
      ORDER BY due_date ASC
      LIMIT 10
    `);

    // Get project status distribution
    const projectStatusDistribution = await query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM projects
      GROUP BY status
      ORDER BY count DESC
    `);

    // Get monthly revenue (last 6 months) - from invoice dates
    const monthlyRevenue = await query(`
      SELECT 
        DATE_FORMAT(invoice_date, '%Y-%m') as month,
        DATE_FORMAT(invoice_date, '%M %Y') as month_name,
        SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END) as revenue,
        COUNT(*) as invoice_count
      FROM invoices
      WHERE invoice_date >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(invoice_date, '%Y-%m'), DATE_FORMAT(invoice_date, '%M %Y')
      ORDER BY month DESC
      LIMIT 6
    `);

    // Get top clients by project count
    const topClients = await query(`
      SELECT 
        c.full_name,
        c.company_name,
        COUNT(p.id) as project_count,
        SUM(CASE WHEN p.status = 'completed' THEN 1 ELSE 0 END) as completed_projects
      FROM clients c
      LEFT JOIN projects p ON c.id = p.client_id
      GROUP BY c.id, c.full_name, c.company_name
      ORDER BY project_count DESC
      LIMIT 5
    `);

    res.json({
      success: true,
      data: {
        stats: stats[0],
        recentActivities,
        upcomingDueDates,
        projectStatusDistribution,
        monthlyRevenue,
        topClients
      }
    });
  } catch (error) {
    console.error('Dashboard overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data'
    });
  }
});

// Get quick stats
router.get('/quick-stats', authorizePermission('dashboard', 'view'), async (req, res) => {
  try {
    const quickStats = await query(`
      SELECT 
        (SELECT COUNT(*) FROM clients) as total_clients,
        (SELECT COUNT(*) FROM projects) as total_projects,
        (SELECT COUNT(*) FROM quotations) as total_quotations,
        (SELECT COUNT(*) FROM invoices) as total_invoices,
        (SELECT SUM(total_amount) FROM invoices WHERE status = 'paid') as total_revenue,
        (SELECT SUM(total_amount) FROM invoices WHERE status IN ('sent', 'partial', 'overdue')) as outstanding_amount
    `);

    res.json({
      success: true,
      data: quickStats[0]
    });
  } catch (error) {
    console.error('Quick stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch quick stats'
    });
  }
});

// Get notifications for dashboard
router.get('/notifications', authorizePermission('dashboard', 'view'), async (req, res) => {
  try {
    const notifications = await query(`
      SELECT 
        id,
        title,
        message,
        type,
        is_read,
        created_at
      FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `, [req.user.id]);

    res.json({
      success: true,
      data: notifications
    });
  } catch (error) {
    console.error('Dashboard notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications'
    });
  }
});

// Mark notification as read
router.put('/notifications/:id/read', authorizePermission('dashboard', 'view'), async (req, res) => {
  try {
    const notificationId = parseInt(req.params.id);
    
    if (isNaN(notificationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID'
      });
    }

    await query(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [notificationId, req.user.id]
    );

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read'
    });
  }
});

// Get recent projects
router.get('/recent-projects', authorizePermission('dashboard', 'view'), async (req, res) => {
  try {
    const recentProjects = await query(`
      SELECT 
        p.id,
        p.title,
        p.status,
        p.type,
        p.start_date,
        p.end_date,
        c.full_name as client_name,
        c.company_name
      FROM projects p
      JOIN clients c ON p.client_id = c.id
      ORDER BY p.created_at DESC
      LIMIT 5
    `);

    res.json({
      success: true,
      data: recentProjects
    });
  } catch (error) {
    console.error('Recent projects error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent projects'
    });
  }
});

// Get recent invoices
router.get('/recent-invoices', authorizePermission('dashboard', 'view'), async (req, res) => {
  try {
    const recentInvoices = await query(`
      SELECT 
        i.id,
        i.invoice_number,
        i.invoice_date,
        i.due_date,
        i.total_amount,
        i.status,
        c.full_name as client_name,
        c.company_name
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      ORDER BY i.created_at DESC
      LIMIT 5
    `);

    res.json({
      success: true,
      data: recentInvoices
    });
  } catch (error) {
    console.error('Recent invoices error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent invoices'
    });
  }
});

module.exports = router;
