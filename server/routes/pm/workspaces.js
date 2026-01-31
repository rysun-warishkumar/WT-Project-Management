const express = require('express');
const { body, validationResult, query: validatorQuery } = require('express-validator');
const { authenticateToken, authorizePermission } = require('../../middleware/auth');
const { query: dbQuery } = require('../../config/database');
const { checkProjectAvailable } = require('../../utils/pmProjectCheck');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get all workspaces (user has access to)
router.get('/', authorizePermission('projects', 'view'), async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get workspaces where user is a member or owns (only where project still exists; after soft delete add AND p.deleted_at IS NULL)
    const workspaces = await dbQuery(
      `SELECT 
        w.*,
        p.title as project_title,
        c.full_name as client_name,
        c.company_name as client_company,
        COUNT(DISTINCT wm.user_id) as member_count
       FROM pm_workspaces w
       INNER JOIN projects p ON w.project_id = p.id AND p.deleted_at IS NULL
       LEFT JOIN clients c ON w.client_id = c.id
       LEFT JOIN pm_workspace_members wm ON w.id = wm.workspace_id
       WHERE (w.id IN (
         SELECT workspace_id 
         FROM pm_workspace_members 
         WHERE user_id = ?
       ) OR w.created_by = ?)
       GROUP BY w.id
       ORDER BY w.created_at DESC`,
      [userId, userId]
    );

    res.json({
      success: true,
      data: workspaces
    });
  } catch (error) {
    console.error('Error fetching workspaces:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch workspaces'
    });
  }
});

// Get workspace by ID
router.get('/:id', authorizePermission('projects', 'view'), async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const userId = req.user.id;

    // Check if user has access to this workspace
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
        p.description as project_description,
        c.full_name as client_name,
        c.company_name as client_company,
        c.email as client_email
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

    const projectCheck = await checkProjectAvailable(workspaceId);
    if (projectCheck) {
      return res.status(projectCheck.status).json({
        success: false,
        message: projectCheck.message
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

    workspace.members = members;
    workspace.user_role = workspaceAccess.role;

    res.json({
      success: true,
      data: workspace
    });
  } catch (error) {
    console.error('Error fetching workspace:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch workspace'
    });
  }
});

// Get or create workspace for a project
router.get('/project/:projectId', authorizePermission('projects', 'view'), async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const userId = req.user.id;

    // Check if project exists (not soft-deleted) and user has access
    const [project] = await dbQuery(
      `SELECT p.*, c.id as client_id 
       FROM projects p
       LEFT JOIN clients c ON p.client_id = c.id
       WHERE p.id = ? AND p.deleted_at IS NULL`,
      [projectId]
    );

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Check if workspace already exists for this project
    let [workspace] = await dbQuery(
      'SELECT * FROM pm_workspaces WHERE project_id = ?',
      [projectId]
    );

    if (!workspace) {
      // Create new workspace
      const result = await dbQuery(
        `INSERT INTO pm_workspaces 
         (name, description, project_id, client_id, workspace_type, created_by)
         VALUES (?, ?, ?, ?, 'scrum', ?)`,
        [
          `${project.title} - Workspace`,
          project.description || `Project management workspace for ${project.title}`,
          projectId,
          project.client_id,
          userId
        ]
      );

      const workspaceId = result.insertId;

      // Add creator as owner
      await dbQuery(
        `INSERT INTO pm_workspace_members (workspace_id, user_id, role)
         VALUES (?, ?, 'owner')`,
        [workspaceId, userId]
      );

      // Get the created workspace
      [workspace] = await dbQuery(
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

      workspace.members = [{
        user_id: userId,
        role: 'owner',
        full_name: req.user.full_name,
        email: req.user.email
      }];
      workspace.user_role = 'owner';
    } else {
      // Check if user has access to existing workspace
      const [workspaceAccess] = await dbQuery(
        `SELECT wm.role 
         FROM pm_workspace_members wm
         WHERE wm.workspace_id = ? AND wm.user_id = ?
         UNION
         SELECT 'owner' as role
         FROM pm_workspaces w
         WHERE w.id = ? AND w.created_by = ?`,
        [workspace.id, userId, workspace.id, userId]
      );

      if (!workspaceAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You do not have access to this workspace.'
        });
      }

      // Get workspace details
      [workspace] = await dbQuery(
        `SELECT 
          w.*,
          p.title as project_title,
          c.full_name as client_name,
          c.company_name as client_company
         FROM pm_workspaces w
         LEFT JOIN projects p ON w.project_id = p.id
         LEFT JOIN clients c ON w.client_id = c.id
         WHERE w.id = ?`,
        [workspace.id]
      );

      // Get members
      const members = await dbQuery(
        `SELECT 
          wm.*,
          u.full_name,
          u.email,
          u.username
         FROM pm_workspace_members wm
         JOIN users u ON wm.user_id = u.id
         WHERE wm.workspace_id = ?`,
        [workspace.id]
      );

      workspace.members = members;
      workspace.user_role = workspaceAccess.role;
    }

    res.json({
      success: true,
      data: workspace
    });
  } catch (error) {
    console.error('Error getting/creating workspace:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get or create workspace'
    });
  }
});

// Create workspace
router.post('/', authorizePermission('projects', 'create'), [
  body('name').trim().notEmpty().withMessage('Workspace name is required'),
  body('project_id').optional().isInt().withMessage('Project ID must be a valid integer'),
  body('workspace_type').optional().isIn(['scrum', 'kanban', 'hybrid']).withMessage('Invalid workspace type')
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

    const { name, description, project_id, client_id, workspace_type = 'scrum' } = req.body;
    const userId = req.user.id;

    // If project_id provided, verify it exists
    if (project_id) {
      const [project] = await dbQuery('SELECT * FROM projects WHERE id = ?', [project_id]);
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }
    }

    // Create workspace
    const result = await dbQuery(
      `INSERT INTO pm_workspaces 
       (name, description, project_id, client_id, workspace_type, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, description || null, project_id || null, client_id || null, workspace_type, userId]
    );

    const workspaceId = result.insertId;

    // Add creator as owner
    await dbQuery(
      `INSERT INTO pm_workspace_members (workspace_id, user_id, role)
       VALUES (?, ?, 'owner')`,
      [workspaceId, userId]
    );

    // Get created workspace
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

    res.status(201).json({
      success: true,
      message: 'Workspace created successfully',
      data: workspace
    });
  } catch (error) {
    console.error('Error creating workspace:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create workspace'
    });
  }
});

// Update workspace
router.put('/:id', authorizePermission('projects', 'edit'), [
  body('name').optional().trim().notEmpty().withMessage('Workspace name cannot be empty'),
  body('workspace_type').optional().isIn(['scrum', 'kanban', 'hybrid']).withMessage('Invalid workspace type')
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

    const workspaceId = req.params.id;
    const userId = req.user.id;
    const { name, description, workspace_type } = req.body;

    // Check if user has admin/owner access
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
        message: 'Access denied. Only workspace owners and admins can update workspace settings.'
      });
    }

    // Update workspace
    const updateFields = [];
    const updateValues = [];

    if (name) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description);
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
       SET ${updateFields.join(', ')}
       WHERE id = ?`,
      updateValues
    );

    // Get updated workspace
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

    res.json({
      success: true,
      message: 'Workspace updated successfully',
      data: workspace
    });
  } catch (error) {
    console.error('Error updating workspace:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update workspace'
    });
  }
});

module.exports = router;
