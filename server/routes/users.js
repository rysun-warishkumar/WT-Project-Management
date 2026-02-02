const express = require('express');
const { body, validationResult, query: validatorQuery } = require('express-validator');
const { authenticateToken, authorizePermission, adminOnly } = require('../middleware/auth');
const { query: dbQuery } = require('../config/database');
const bcrypt = require('bcryptjs');
const { sendClientCredentials } = require('../utils/email');
const { getWorkspaceFilter } = require('../utils/dataFiltering');
const { workspaceContext } = require('../middleware/workspaceContext');

const router = express.Router();

// Apply authentication + workspace context to all routes
router.use(authenticateToken);
router.use(workspaceContext);

// Validation middleware
const validateUser = [
  body('full_name').trim().notEmpty().withMessage('Full name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('username').optional().trim().isLength({ min: 3, max: 50 }).withMessage('Username must be between 3 and 50 characters'),
  body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['admin', 'po', 'manager', 'accountant', 'client', 'viewer']).withMessage('Valid role is required'),
  body('client_id').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }).withMessage('Valid client ID is required'),
  body('is_active').optional().isBoolean().withMessage('is_active must be a boolean'),
];

// Get all users with pagination and filters
router.get('/', authorizePermission('users', 'view'), [
  validatorQuery('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  validatorQuery('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 1000'),
  validatorQuery('search').optional().isString().withMessage('Search must be a string'),
  validatorQuery('role').optional().isIn(['admin', 'po', 'manager', 'accountant', 'client', 'viewer']).withMessage('Valid role is required'),
  validatorQuery('client_id').optional().custom((value) => {
    if (value === '' || value === null || value === undefined) return true;
    if (isNaN(value) || parseInt(value) < 1) {
      throw new Error('Valid client ID is required');
    }
    return true;
  }),
  validatorQuery('is_active').optional().isBoolean().withMessage('is_active must be a boolean'),
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
    const role = req.query.role || '';
    const clientId = req.query.client_id || '';
    const isActive = req.query.is_active;

    const isSuperAdmin = req.isSuperAdmin === true;

    // Build WHERE clause
    let whereClause = 'WHERE 1=1';
    const whereParams = [];

    // Workspace filter: super admin sees all users (workspace column shows affiliation); others see only their workspace
    if (!isSuperAdmin) {
      const ws = getWorkspaceFilter(req, 'u', 'workspace_id');
      whereClause += ws.whereClause;
      whereParams.push(...ws.whereParams);
    }

    if (search) {
      whereClause += ' AND (u.full_name LIKE ? OR u.email LIKE ? OR u.username LIKE ?)';
      const searchTerm = `%${search}%`;
      whereParams.push(searchTerm, searchTerm, searchTerm);
    }

    if (role) {
      whereClause += ' AND u.role = ?';
      whereParams.push(role);
    }

    if (clientId) {
      whereClause += ' AND u.client_id = ?';
      whereParams.push(clientId);
    }

    if (isActive !== undefined && isActive !== '') {
      whereClause += ' AND u.is_active = ?';
      whereParams.push(isActive === 'true' || isActive === true);
    }

    // Get users with related data (super admin also gets workspace name)
    const users = await dbQuery(
      `SELECT 
        u.id,
        u.username,
        u.email,
        u.full_name,
        u.role,
        u.avatar,
        u.is_active,
        u.client_id,
        u.last_login,
        u.created_at,
        u.updated_at,
        c.full_name as client_name,
        c.company_name as client_company,
        (SELECT COUNT(*) FROM user_projects WHERE user_id = u.id) as project_count
        ${isSuperAdmin ? ', w.name as workspace_name' : ''}
       FROM users u
       LEFT JOIN clients c ON u.client_id = c.id
       ${isSuperAdmin ? 'LEFT JOIN workspaces w ON u.workspace_id = w.id' : ''}
       ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?`,
      [...whereParams, limit, offset]
    );

    // Get projects assigned to each user (super admin: show all assigned; others: filter by workspace)
    for (const user of users) {
      const wsProj = isSuperAdmin ? { whereClause: '', whereParams: [] } : getWorkspaceFilter(req, 'p', 'workspace_id');
      const userProjects = await dbQuery(
        `SELECT p.id, p.title, p.status
         FROM projects p
         WHERE p.id IN (
           SELECT project_id FROM user_projects WHERE user_id = ?
         )
         ${wsProj.whereClause ? `AND 1=1 ${wsProj.whereClause}` : ''}
         LIMIT 5`,
        [user.id, ...wsProj.whereParams]
      );
      user.assigned_projects = userProjects;
    }

    // Get total count
    const countResult = await dbQuery(
      `SELECT COUNT(*) as total
       FROM users u
       ${whereClause}`,
      whereParams
    );

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        users,
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
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users'
    });
  }
});

// Get user by ID
router.get('/:id', authorizePermission('users', 'view'), async (req, res) => {
  try {
    const userId = req.params.id;

    const ws = getWorkspaceFilter(req, 'u', 'workspace_id');
    const users = await dbQuery(
      `SELECT 
        u.*,
        c.full_name as client_name,
        c.company_name as client_company,
        c.email as client_email
       FROM users u
       LEFT JOIN clients c ON u.client_id = c.id
       WHERE u.id = ? ${ws.whereClause}`,
      [userId, ...ws.whereParams]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get assigned projects
    const wsProj = getWorkspaceFilter(req, 'p', 'workspace_id');
    const projects = await dbQuery(
      `SELECT p.id, p.title, p.status, p.client_id
       FROM projects p
       WHERE p.id IN (
         SELECT project_id FROM user_projects WHERE user_id = ?
       ) ${wsProj.whereClause ? `AND 1=1 ${wsProj.whereClause}` : ''}`,
      [userId, ...wsProj.whereParams]
    );

    // Get assigned roles (if using role_permissions system)
    const roles = await dbQuery(
      `SELECT r.id, r.name, r.display_name
       FROM roles r
       INNER JOIN user_roles ur ON r.id = ur.role_id
       WHERE ur.user_id = ?`,
      [userId]
    );

    const user = users[0];
    user.assigned_projects = projects;
    user.assigned_roles = roles;

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user'
    });
  }
});

// Create user
router.post('/', authorizePermission('users', 'create'), validateUser, async (req, res) => {
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
      full_name,
      email,
      username,
      password,
      role,
      client_id,
      is_active,
      send_credentials_email
    } = req.body;

    // Check if email already exists
    const emailCheck = await dbQuery('SELECT id FROM users WHERE email = ?', [email]);
    if (emailCheck.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Generate username if not provided
    let finalUsername = username;
    if (!finalUsername) {
      const usernameBase = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      finalUsername = usernameBase;
      let counter = 1;
      
      while (true) {
        const usernameCheck = await dbQuery('SELECT id FROM users WHERE username = ?', [finalUsername]);
        if (usernameCheck.length === 0) break;
        finalUsername = `${usernameBase}${counter}`;
        counter++;
      }
    } else {
      // Check if username already exists
      const usernameCheck = await dbQuery('SELECT id FROM users WHERE username = ?', [finalUsername]);
      if (usernameCheck.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Username already exists'
        });
      }
    }

    // Generate password if not provided
    let finalPassword = password;
    let generatedPassword = null;
    if (!finalPassword) {
      generatedPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8) + 'A1!';
      finalPassword = generatedPassword;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(finalPassword, 12);

    // Check if client exists (if provided)
    if (client_id) {
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
    }

    // Insert user
    const workspaceId = req.workspaceId || req.workspaceFilter?.value;
    const result = await dbQuery(
      `INSERT INTO users (username, email, password, full_name, role, client_id, is_active, workspace_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        finalUsername,
        email,
        hashedPassword,
        full_name,
        role,
        client_id || null,
        is_active !== undefined ? is_active : true,
        workspaceId || null
      ]
    );

    let userId = result.insertId != null ? Number(result.insertId) : 0;
    if (userId <= 0) {
      const nextRows = await dbQuery(
        'SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM users WHERE id > 0'
      );
      const nextId = nextRows?.[0]?.next_id ? Number(nextRows[0].next_id) : 1;
      try {
        const updateResult = await dbQuery(
          'UPDATE users SET id = ? WHERE id = 0 AND email = ? LIMIT 1',
          [nextId, email]
        );
        const affected = updateResult?.affectedRows;
        if (affected >= 1) {
          userId = nextId;
          try {
            await dbQuery(`ALTER TABLE users AUTO_INCREMENT = ${Number(nextId) + 1}`);
          } catch (e) {
            console.warn('Could not bump users AUTO_INCREMENT:', e.message);
          }
        }
      } catch (err) {
        if (err.code !== 'ER_DUP_ENTRY') throw err;
      }
    }
    if (!userId || userId <= 0) {
      const fallback = await dbQuery(
        'SELECT id FROM users WHERE email = ? ORDER BY id DESC LIMIT 1',
        [email]
      );
      if (fallback?.[0]?.id) userId = Number(fallback[0].id);
    }

    // Fetch the created user
    const users = await dbQuery(
      `SELECT 
        u.id,
        u.username,
        u.email,
        u.full_name,
        u.role,
        u.avatar,
        u.is_active,
        u.client_id,
        u.last_login,
        u.created_at,
        u.updated_at,
        c.full_name as client_name,
        c.company_name as client_company
       FROM users u
       LEFT JOIN clients c ON u.client_id = c.id
       WHERE u.id = ? ${getWorkspaceFilter(req, 'u', 'workspace_id').whereClause}`,
      [userId, ...getWorkspaceFilter(req, 'u', 'workspace_id').whereParams]
    );

    // Send credentials email if requested and password was generated
    let emailSent = false;
    if (send_credentials_email && generatedPassword) {
      const clientData = users[0].client_id ? await dbQuery('SELECT * FROM clients WHERE id = ?', [users[0].client_id]) : [];
      if (clientData.length > 0) {
        const emailResult = await sendClientCredentials(clientData[0], {
          email: email,
          password: generatedPassword,
          username: finalUsername
        });
        emailSent = emailResult.success;
      }
    }

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: users[0],
      credentials: send_credentials_email && generatedPassword ? {
        email: email,
        password: generatedPassword,
        username: finalUsername,
        email_sent: emailSent
      } : null
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create user'
    });
  }
});

// Update user
router.put('/:id', authorizePermission('users', 'edit'), [
  body('full_name').optional().trim().notEmpty().withMessage('Full name cannot be empty'),
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('username').optional().trim().isLength({ min: 3, max: 50 }).withMessage('Username must be between 3 and 50 characters'),
  body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['admin', 'po', 'manager', 'accountant', 'client', 'viewer']).withMessage('Valid role is required'),
  body('client_id').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }).withMessage('Valid client ID is required'),
  body('is_active').optional().isBoolean().withMessage('is_active must be a boolean'),
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

    const userId = req.params.id;
    const {
      full_name,
      email,
      username,
      password,
      role,
      client_id,
      is_active
    } = req.body;

    // Check if user exists
    const ws = getWorkspaceFilter(req, '', 'workspace_id');
    const userCheck = await dbQuery(
      `SELECT * FROM users WHERE id = ? ${ws.whereClause}`,
      [userId, ...ws.whereParams]
    );
    if (userCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if email is already taken by another user
    if (email) {
      const emailCheck = await dbQuery('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
      if (emailCheck.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Email already exists'
        });
      }
    }

    // Check if username is already taken by another user
    if (username) {
      const usernameCheck = await dbQuery('SELECT id FROM users WHERE username = ? AND id != ?', [username, userId]);
      if (usernameCheck.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Username already exists'
        });
      }
    }

    // Check if client exists (if provided)
    if (client_id !== undefined) {
      if (client_id) {
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
      }
    }

    // Build update query
    const updates = [];
    const updateParams = [];

    if (full_name !== undefined) {
      updates.push('full_name = ?');
      updateParams.push(full_name);
    }

    if (email !== undefined) {
      updates.push('email = ?');
      updateParams.push(email);
    }

    if (username !== undefined) {
      updates.push('username = ?');
      updateParams.push(username);
    }

    if (password !== undefined) {
      const hashedPassword = await bcrypt.hash(password, 12);
      updates.push('password = ?');
      updateParams.push(hashedPassword);
    }

    if (role !== undefined) {
      updates.push('role = ?');
      updateParams.push(role);
    }

    if (client_id !== undefined) {
      updates.push('client_id = ?');
      updateParams.push(client_id || null);
    }

    if (is_active !== undefined) {
      updates.push('is_active = ?');
      updateParams.push(is_active);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updateParams.push(userId);

    const wsUpd = getWorkspaceFilter(req, '', 'workspace_id');
    await dbQuery(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ? ${wsUpd.whereClause}`,
      [...updateParams, ...wsUpd.whereParams]
    );

    // Fetch updated user
    const users = await dbQuery(
      `SELECT 
        u.id,
        u.username,
        u.email,
        u.full_name,
        u.role,
        u.avatar,
        u.is_active,
        u.client_id,
        u.last_login,
        u.created_at,
        u.updated_at,
        c.full_name as client_name,
        c.company_name as client_company
       FROM users u
       LEFT JOIN clients c ON u.client_id = c.id
       WHERE u.id = ? ${getWorkspaceFilter(req, 'u', 'workspace_id').whereClause}`,
      [userId, ...getWorkspaceFilter(req, 'u', 'workspace_id').whereParams]
    );

    res.json({
      success: true,
      message: 'User updated successfully',
      data: users[0]
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user'
    });
  }
});

// Delete user
router.delete('/:id', authorizePermission('users', 'delete'), async (req, res) => {
  try {
    const userId = req.params.id;

    // Prevent deleting yourself
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }

    // Check if user exists
    const wsDel = getWorkspaceFilter(req, '', 'workspace_id');
    const userCheck = await dbQuery(
      `SELECT id FROM users WHERE id = ? ${wsDel.whereClause}`,
      [userId, ...wsDel.whereParams]
    );
    if (userCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Delete user
    const wsD = getWorkspaceFilter(req, '', 'workspace_id');
    await dbQuery(`DELETE FROM users WHERE id = ? ${wsD.whereClause}`, [userId, ...wsD.whereParams]);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user'
    });
  }
});

// Assign projects to user
router.post('/:id/projects', authorizePermission('users', 'edit'), [
  body('project_ids').isArray().withMessage('project_ids must be an array'),
  body('project_ids.*').isInt({ min: 1 }).withMessage('Each project ID must be a positive integer'),
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

    const userId = req.params.id;
    const { project_ids } = req.body;

    // Check if user exists
    const wsAssign = getWorkspaceFilter(req, '', 'workspace_id');
    const userCheck = await dbQuery(
      `SELECT id FROM users WHERE id = ? ${wsAssign.whereClause}`,
      [userId, ...wsAssign.whereParams]
    );
    if (userCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Ensure projects belong to this workspace (super admin bypass)
    const wsProj = getWorkspaceFilter(req, '', 'workspace_id');
    if (wsProj.whereClause) {
      const placeholders = project_ids.map(() => '?').join(',');
      const allowedProjects = await dbQuery(
        `SELECT id FROM projects WHERE id IN (${placeholders}) ${wsProj.whereClause}`,
        [...project_ids, ...wsProj.whereParams]
      );
      if (allowedProjects.length !== project_ids.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more projects are not available in your workspace'
        });
      }
    }

    // Check if user_projects table exists, if not create it
    try {
      await dbQuery('SELECT 1 FROM user_projects LIMIT 1');
    } catch {
      // Create user_projects table if it doesn't exist
      await dbQuery(`
        CREATE TABLE IF NOT EXISTS user_projects (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          project_id INT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
          UNIQUE KEY unique_user_project (user_id, project_id)
        )
      `);
    }

    // Remove existing assignments
    await dbQuery('DELETE FROM user_projects WHERE user_id = ?', [userId]);

    // Add new assignments
    if (project_ids.length > 0) {
      for (const projectId of project_ids) {
        // Verify project exists
        const projectCheck = await dbQuery('SELECT id FROM projects WHERE id = ?', [projectId]);
        if (projectCheck.length > 0) {
          await dbQuery(
            'INSERT INTO user_projects (user_id, project_id) VALUES (?, ?)',
            [userId, projectId]
          );
        }
      }
    }

    res.json({
      success: true,
      message: 'Projects assigned successfully'
    });
  } catch (error) {
    console.error('Error assigning projects:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign projects'
    });
  }
});

module.exports = router;
