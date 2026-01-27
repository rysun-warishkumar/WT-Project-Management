const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, authorizePermission } = require('../../middleware/auth');
const { query: dbQuery } = require('../../config/database');
const { getEffectiveWorkspaceRole } = require('../../utils/roleMapper');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get workspace settings
router.get('/workspace/:workspaceId', authorizePermission('projects', 'view'), async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const userId = req.user.id;

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

    // Get workspace details
    const [workspace] = await dbQuery(
      `SELECT 
        w.*,
        p.title as project_title,
        c.full_name as client_name,
        c.company_name as client_company
       FROM pm_workspaces w
       LEFT JOIN projects p ON w.project_id = p.id
       LEFT JOIN clients c ON w.client_id = c.id
       WHERE w.id = ?`,
      [workspaceId]
    );

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found'
      });
    }

    // Get workspace members
    const members = await dbQuery(
      `SELECT 
        wm.*,
        u.full_name,
        u.email,
        u.username
       FROM pm_workspace_members wm
       JOIN users u ON wm.user_id = u.id
       WHERE wm.workspace_id = ?
       ORDER BY 
         CASE wm.role
           WHEN 'owner' THEN 1
           WHEN 'admin' THEN 2
           WHEN 'member' THEN 3
           ELSE 4
         END,
         wm.joined_at`,
      [workspaceId]
    );

    // Get CI/CD integrations
    const integrations = await dbQuery(
      `SELECT * FROM pm_ci_cd_integrations
       WHERE workspace_id = ?
       ORDER BY created_at DESC`,
      [workspaceId]
    );

    res.json({
      success: true,
      data: {
        workspace,
        members,
        integrations,
        user_role: workspaceAccess.role
      }
    });
  } catch (error) {
    console.error('Error fetching workspace settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch workspace settings'
    });
  }
});

// Update workspace settings
router.put('/workspace/:workspaceId', authorizePermission('projects', 'edit'), [
  body('name').optional().trim().notEmpty().withMessage('Workspace name cannot be empty'),
  body('description').optional().trim(),
  body('workspace_type').optional().isIn(['scrum', 'kanban', 'hybrid']).withMessage('Invalid workspace type'),
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

    const workspaceId = req.params.workspaceId;
    const userId = req.user.id;
    const { name, description, workspace_type } = req.body;

    // Check if user is owner or admin
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

    if (!workspaceAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only workspace owners and admins can update settings.'
      });
    }

    // Build update query
    const updateFields = [];
    const updateValues = [];

    if (name) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description || null);
    }
    if (workspace_type) {
      updateFields.push('workspace_type = ?');
      updateValues.push(workspace_type);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updateValues.push(workspaceId);

    await dbQuery(
      `UPDATE pm_workspaces 
       SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      updateValues
    );

    // Get updated workspace
    const [workspace] = await dbQuery(
      `SELECT * FROM pm_workspaces WHERE id = ?`,
      [workspaceId]
    );

    res.json({
      success: true,
      message: 'Workspace settings updated successfully',
      data: workspace
    });
  } catch (error) {
    console.error('Error updating workspace settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update workspace settings'
    });
  }
});

// Add workspace member
router.post('/workspace/:workspaceId/members', authorizePermission('projects', 'edit'), [
  body('user_id').isInt().withMessage('User ID is required'),
  body('role').isIn(['admin', 'member', 'viewer']).withMessage('Invalid role'),
  body('capacity_hours_per_sprint').optional().isInt({ min: 0 }).withMessage('Capacity must be a non-negative integer'),
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

    const workspaceId = req.params.workspaceId;
    const userId = req.user.id;
    const { user_id, role, capacity_hours_per_sprint } = req.body;

    // Check if user is owner or admin
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

    if (!workspaceAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only workspace owners and admins can add members.'
      });
    }

    // Check if user exists and get their CMS role
    const [user] = await dbQuery('SELECT id, full_name, email, role FROM users WHERE id = ?', [user_id]);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user is already a member
    const [existingMember] = await dbQuery(
      'SELECT * FROM pm_workspace_members WHERE workspace_id = ? AND user_id = ?',
      [workspaceId, user_id]
    );

    if (existingMember) {
      return res.status(400).json({
        success: false,
        message: 'User is already a member of this workspace'
      });
    }

    // If role not explicitly provided, use effective role based on CMS role
    let effectiveRole = role || 'member';
    if (user) {
      if (!role) {
        effectiveRole = getEffectiveWorkspaceRole(user.role, null);
      } else {
        // Ensure role doesn't exceed user's CMS role capabilities
        const cmsBasedRole = getEffectiveWorkspaceRole(user.role, null);
        // If trying to assign higher role than CMS allows, use CMS-based role
        if (['admin', 'owner'].includes(role) && !['admin', 'po', 'manager'].includes(user.role)) {
          effectiveRole = cmsBasedRole;
        } else {
          effectiveRole = role;
        }
      }
    }

    // Add member
    await dbQuery(
      `INSERT INTO pm_workspace_members (workspace_id, user_id, role, capacity_hours_per_sprint)
       VALUES (?, ?, ?, ?)`,
      [workspaceId, user_id, effectiveRole, capacity_hours_per_sprint || 0]
    );

    // Get added member
    const [member] = await dbQuery(
      `SELECT 
        wm.*,
        u.full_name,
        u.email,
        u.username
       FROM pm_workspace_members wm
       JOIN users u ON wm.user_id = u.id
       WHERE wm.workspace_id = ? AND wm.user_id = ?`,
      [workspaceId, user_id]
    );

    res.status(201).json({
      success: true,
      message: 'Member added successfully',
      data: member
    });
  } catch (error) {
    console.error('Error adding workspace member:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add workspace member'
    });
  }
});

// Update workspace member
router.put('/workspace/:workspaceId/members/:memberId', authorizePermission('projects', 'edit'), [
  body('role').optional().isIn(['admin', 'member', 'viewer']).withMessage('Invalid role'),
  body('capacity_hours_per_sprint').optional().isInt({ min: 0 }).withMessage('Capacity must be a non-negative integer'),
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

    const workspaceId = req.params.workspaceId;
    const memberId = req.params.memberId;
    const userId = req.user.id;
    const { role, capacity_hours_per_sprint } = req.body;

    // Check if user is owner or admin
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

    if (!workspaceAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only workspace owners and admins can update members.'
      });
    }

    // Check if member exists
    const [member] = await dbQuery(
      'SELECT * FROM pm_workspace_members WHERE id = ? AND workspace_id = ?',
      [memberId, workspaceId]
    );

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    // Prevent changing owner role
    if (member.role === 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Cannot modify owner role'
      });
    }

    // Get user's CMS role to validate role assignment
    const [user] = await dbQuery(
      'SELECT role FROM users WHERE id = ?',
      [member.user_id]
    );

    // Build update query
    const updateFields = [];
    const updateValues = [];

    if (role) {
      // Validate role assignment based on CMS role
      let effectiveRole = role;
      if (user) {
        const cmsBasedRole = getEffectiveWorkspaceRole(user.role, null);
        // If trying to assign higher role than CMS allows, use CMS-based role
        if (['admin', 'owner'].includes(role) && !['admin', 'po', 'manager'].includes(user.role)) {
          effectiveRole = cmsBasedRole;
        }
      }
      updateFields.push('role = ?');
      updateValues.push(effectiveRole);
    }
    if (capacity_hours_per_sprint !== undefined) {
      updateFields.push('capacity_hours_per_sprint = ?');
      updateValues.push(capacity_hours_per_sprint);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updateValues.push(memberId, workspaceId);

    await dbQuery(
      `UPDATE pm_workspace_members 
       SET ${updateFields.join(', ')}
       WHERE id = ? AND workspace_id = ?`,
      updateValues
    );

    // Get updated member
    const [updatedMember] = await dbQuery(
      `SELECT 
        wm.*,
        u.full_name,
        u.email,
        u.username
       FROM pm_workspace_members wm
       JOIN users u ON wm.user_id = u.id
       WHERE wm.id = ? AND wm.workspace_id = ?`,
      [memberId, workspaceId]
    );

    res.json({
      success: true,
      message: 'Member updated successfully',
      data: updatedMember
    });
  } catch (error) {
    console.error('Error updating workspace member:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update workspace member'
    });
  }
});

// Remove workspace member
router.delete('/workspace/:workspaceId/members/:memberId', authorizePermission('projects', 'edit'), async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const memberId = req.params.memberId;
    const userId = req.user.id;

    // Check if user is owner or admin
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

    if (!workspaceAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only workspace owners and admins can remove members.'
      });
    }

    // Check if member exists
    const [member] = await dbQuery(
      'SELECT * FROM pm_workspace_members WHERE id = ? AND workspace_id = ?',
      [memberId, workspaceId]
    );

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    // Prevent removing owner
    if (member.role === 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Cannot remove workspace owner'
      });
    }

    // Remove member
    await dbQuery(
      'DELETE FROM pm_workspace_members WHERE id = ? AND workspace_id = ?',
      [memberId, workspaceId]
    );

    res.json({
      success: true,
      message: 'Member removed successfully'
    });
  } catch (error) {
    console.error('Error removing workspace member:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove workspace member'
    });
  }
});

// Get users for adding members (filtered by workspace)
router.get('/users', authorizePermission('projects', 'view'), async (req, res) => {
  try {
    const { search, workspace_id } = req.query;
    
    if (!workspace_id) {
      return res.status(400).json({
        success: false,
        message: 'Workspace ID is required'
      });
    }

    // Get the main workspace ID from the PM workspace
    const [pmWorkspace] = await dbQuery(
      'SELECT main_workspace_id FROM pm_workspaces WHERE id = ?',
      [workspace_id]
    );

    if (!pmWorkspace || !pmWorkspace.main_workspace_id) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found or not linked to a main workspace'
      });
    }

    const mainWorkspaceId = pmWorkspace.main_workspace_id;
    
    // Build query to get users from the same workspace
    // Exclude users who are already members of this PM workspace
    let query = `
      SELECT DISTINCT u.id, u.full_name, u.email, u.username 
      FROM users u
      WHERE u.workspace_id = ?
        AND u.is_active = 1
        AND u.id NOT IN (
          SELECT wm.user_id 
          FROM pm_workspace_members wm 
          WHERE wm.workspace_id = ?
        )
    `;
    const params = [mainWorkspaceId, workspace_id];

    if (search) {
      query += ' AND (u.full_name LIKE ? OR u.email LIKE ? OR u.username LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ' ORDER BY u.full_name ASC LIMIT 50';

    const users = await dbQuery(query, params);

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users'
    });
  }
});

module.exports = router;
