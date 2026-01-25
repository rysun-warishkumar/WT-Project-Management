const express = require('express');
const { body, validationResult, query: validatorQuery } = require('express-validator');
const { authenticateToken, authorizePermission } = require('../middleware/auth');
const { query: dbQuery } = require('../config/database');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get all roles
router.get('/', authorizePermission('roles', 'view'), async (req, res) => {
  try {
    const roles = await dbQuery(
      `SELECT 
        r.*,
        COUNT(DISTINCT ur.user_id) as user_count,
        COUNT(DISTINCT rp.permission_id) as permission_count
       FROM roles r
       LEFT JOIN user_roles ur ON r.id = ur.role_id
       LEFT JOIN role_permissions rp ON r.id = rp.role_id
       GROUP BY r.id
       ORDER BY 
         CASE WHEN r.name = 'admin' THEN 0 ELSE 1 END,
         r.name`
    );

    res.json({
      success: true,
      data: roles
    });
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch roles'
    });
  }
});

// Get role by ID with permissions
router.get('/:id', authorizePermission('roles', 'view'), async (req, res) => {
  try {
    const roleId = req.params.id;

    const roles = await dbQuery('SELECT * FROM roles WHERE id = ?', [roleId]);
    if (roles.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }

    const permissions = await dbQuery(
      `SELECT p.*, rp.id as role_permission_id
       FROM permissions p
       INNER JOIN role_permissions rp ON p.id = rp.permission_id
       WHERE rp.role_id = ?
       ORDER BY p.module, p.action`,
      [roleId]
    );

    const role = roles[0];
    role.permissions = permissions;

    res.json({
      success: true,
      data: role
    });
  } catch (error) {
    console.error('Error fetching role:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch role'
    });
  }
});

// Get all permissions grouped by module
router.get('/permissions/list', authorizePermission('roles', 'view'), async (req, res) => {
  try {
    const permissions = await dbQuery(
      'SELECT * FROM permissions ORDER BY module, action'
    );

    // Group by module
    const grouped = permissions.reduce((acc, perm) => {
      if (!acc[perm.module]) {
        acc[perm.module] = [];
      }
      acc[perm.module].push(perm);
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        permissions,
        grouped
      }
    });
  } catch (error) {
    console.error('Error fetching permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch permissions'
    });
  }
});

// Update role permissions
router.put('/:id/permissions', authorizePermission('roles', 'edit'), [
  body('permission_ids').isArray().withMessage('permission_ids must be an array'),
  body('permission_ids.*').isInt({ min: 1 }).withMessage('Each permission ID must be a positive integer'),
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

    const roleId = req.params.id;
    const { permission_ids } = req.body;

    // Check if role exists
    const roleCheck = await dbQuery('SELECT id FROM roles WHERE id = ?', [roleId]);
    if (roleCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }

    // Prevent modifying super admin role (only "admin" role is protected)
    const role = await dbQuery('SELECT name FROM roles WHERE id = ?', [roleId]);
    if (role[0]?.name === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify super admin role permissions. This role is protected.'
      });
    }

    // Remove existing permissions
    await dbQuery('DELETE FROM role_permissions WHERE role_id = ?', [roleId]);

    // Add new permissions
    if (permission_ids.length > 0) {
      for (const permissionId of permission_ids) {
        // Verify permission exists
        const permissionCheck = await dbQuery('SELECT id FROM permissions WHERE id = ?', [permissionId]);
        if (permissionCheck.length > 0) {
          await dbQuery(
            'INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
            [roleId, permissionId]
          );
        }
      }
    }

    // Fetch updated role with permissions
    const roles = await dbQuery('SELECT * FROM roles WHERE id = ?', [roleId]);
    const permissions = await dbQuery(
      `SELECT p.*
       FROM permissions p
       INNER JOIN role_permissions rp ON p.id = rp.permission_id
       WHERE rp.role_id = ?
       ORDER BY p.module, p.action`,
      [roleId]
    );

    const updatedRole = roles[0];
    updatedRole.permissions = permissions;

    res.json({
      success: true,
      message: 'Role permissions updated successfully',
      data: updatedRole
    });
  } catch (error) {
    console.error('Error updating role permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update role permissions'
    });
  }
});

// Create custom role
router.post('/', authorizePermission('roles', 'edit'), [
  body('name').trim().notEmpty().isLength({ min: 2, max: 50 }).withMessage('Role name is required (2-50 characters)'),
  body('display_name').trim().notEmpty().isLength({ max: 100 }).withMessage('Display name is required (max 100 characters)'),
  body('description').optional().isString().withMessage('Description must be a string'),
  body('permission_ids').optional().isArray().withMessage('permission_ids must be an array'),
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

    const { name, display_name, description, permission_ids } = req.body;

    // Check if role name already exists
    const existingRole = await dbQuery('SELECT id FROM roles WHERE name = ?', [name]);
    if (existingRole.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Role with this name already exists'
      });
    }

    // Insert role
    const result = await dbQuery(
      `INSERT INTO roles (name, display_name, description, is_system_role)
       VALUES (?, ?, ?, FALSE)`,
      [name, display_name, description || null]
    );

    const roleId = result.insertId;

    // Add permissions if provided
    if (permission_ids && permission_ids.length > 0) {
      for (const permissionId of permission_ids) {
        const permissionCheck = await dbQuery('SELECT id FROM permissions WHERE id = ?', [permissionId]);
        if (permissionCheck.length > 0) {
          await dbQuery(
            'INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
            [roleId, permissionId]
          );
        }
      }
    }

    // Fetch created role
    const roles = await dbQuery('SELECT * FROM roles WHERE id = ?', [roleId]);
    const permissions = await dbQuery(
      `SELECT p.*
       FROM permissions p
       INNER JOIN role_permissions rp ON p.id = rp.permission_id
       WHERE rp.role_id = ?
       ORDER BY p.module, p.action`,
      [roleId]
    );

    const role = roles[0];
    role.permissions = permissions;

    res.status(201).json({
      success: true,
      message: 'Role created successfully',
      data: role
    });
  } catch (error) {
    console.error('Error creating role:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create role'
    });
  }
});

// Update role
router.put('/:id', authorizePermission('roles', 'edit'), [
  body('display_name').optional().trim().isLength({ max: 100 }).withMessage('Display name must be max 100 characters'),
  body('description').optional().isString().withMessage('Description must be a string'),
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

    const roleId = req.params.id;
    const { display_name, description } = req.body;

    // Check if role exists
    const roleCheck = await dbQuery('SELECT * FROM roles WHERE id = ?', [roleId]);
    if (roleCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }

    // Prevent modifying super admin role (only "admin" role is protected)
    if (roleCheck[0].name === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify super admin role. This role is protected.'
      });
    }

    // Build update query
    const updates = [];
    const updateParams = [];

    if (display_name !== undefined) {
      updates.push('display_name = ?');
      updateParams.push(display_name);
    }

    if (description !== undefined) {
      updates.push('description = ?');
      updateParams.push(description);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updateParams.push(roleId);

    await dbQuery(
      `UPDATE roles SET ${updates.join(', ')} WHERE id = ?`,
      updateParams
    );

    // Fetch updated role
    const roles = await dbQuery('SELECT * FROM roles WHERE id = ?', [roleId]);
    const permissions = await dbQuery(
      `SELECT p.*
       FROM permissions p
       INNER JOIN role_permissions rp ON p.id = rp.permission_id
       WHERE rp.role_id = ?
       ORDER BY p.module, p.action`,
      [roleId]
    );

    const role = roles[0];
    role.permissions = permissions;

    res.json({
      success: true,
      message: 'Role updated successfully',
      data: role
    });
  } catch (error) {
    console.error('Error updating role:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update role'
    });
  }
});

// Delete role
router.delete('/:id', authorizePermission('roles', 'edit'), async (req, res) => {
  try {
    const roleId = req.params.id;

    // Check if role exists
    const roleCheck = await dbQuery('SELECT * FROM roles WHERE id = ?', [roleId]);
    if (roleCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }

    // Prevent deleting super admin role (only "admin" role is protected)
    if (roleCheck[0].name === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete super admin role. This role is protected.'
      });
    }

    // Check if role is assigned to any users
    const userRoles = await dbQuery('SELECT COUNT(*) as count FROM user_roles WHERE role_id = ?', [roleId]);
    if (userRoles[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete role that is assigned to users. Please remove role assignments first.'
      });
    }

    // Delete role (permissions will be deleted via CASCADE)
    await dbQuery('DELETE FROM roles WHERE id = ?', [roleId]);

    res.json({
      success: true,
      message: 'Role deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting role:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete role'
    });
  }
});

// Assign role to user
router.post('/:id/assign-user', authorizePermission('roles', 'edit'), [
  body('user_id').isInt({ min: 1 }).withMessage('Valid user ID is required'),
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

    const roleId = req.params.id;
    const { user_id } = req.body;

    // Check if role exists
    const roleCheck = await dbQuery('SELECT id FROM roles WHERE id = ?', [roleId]);
    if (roleCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }

    // Check if user exists
    const userCheck = await dbQuery('SELECT id FROM users WHERE id = ?', [user_id]);
    if (userCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Assign role to user
    try {
      await dbQuery(
        'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)',
        [user_id, roleId]
      );
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({
          success: false,
          message: 'Role is already assigned to this user'
        });
      }
      throw error;
    }

    res.json({
      success: true,
      message: 'Role assigned to user successfully'
    });
  } catch (error) {
    console.error('Error assigning role to user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign role to user'
    });
  }
});

// Remove role from user
router.delete('/:id/assign-user/:userId', authorizePermission('roles', 'edit'), async (req, res) => {
  try {
    const roleId = req.params.id;
    const userId = req.params.userId;

    await dbQuery(
      'DELETE FROM user_roles WHERE user_id = ? AND role_id = ?',
      [userId, roleId]
    );

    res.json({
      success: true,
      message: 'Role removed from user successfully'
    });
  } catch (error) {
    console.error('Error removing role from user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove role from user'
    });
  }
});

module.exports = router;
