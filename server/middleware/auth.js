const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

async function getUserByIdSafe(userId) {
  // Some older DBs may not have users.client_id yet; fall back gracefully.
  try {
    const users = await query(
      `SELECT u.id, u.username, u.email, u.full_name, u.role, u.is_active, u.client_id
       FROM users u
       WHERE u.id = ?`,
      [userId]
    );
    return users;
  } catch (err) {
    // ER_BAD_FIELD_ERROR if client_id column does not exist
    if (err && (err.code === 'ER_BAD_FIELD_ERROR' || String(err.message || '').includes('Unknown column'))) {
      return await query(
        `SELECT u.id, u.username, u.email, u.full_name, u.role, u.is_active
         FROM users u
         WHERE u.id = ?`,
        [userId]
      );
    }
    throw err;
  }
}

// Authentication middleware
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database (safe across schema versions)
    const users = await getUserByIdSafe(decoded.userId);

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];

    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'User account is deactivated'
      });
    }

    // Get user's permissions from roles
    // First, get role IDs from user_roles table or use the role from users table
    let roleIds = [];
    
    // Check if user has roles in user_roles table
    const userRoles = await query(
      'SELECT role_id FROM user_roles WHERE user_id = ?',
      [user.id]
    );

    if (userRoles.length > 0) {
      // User has roles in user_roles table
      roleIds = userRoles.map(ur => ur.role_id);
    } else {
      // Fallback to role from users table
      const roleFromTable = await query(
        'SELECT id FROM roles WHERE name = ?',
        [user.role]
      );
      if (roleFromTable.length > 0) {
        roleIds = [roleFromTable[0].id];
      }
    }

    // Get permissions for all user roles
    let permissions = [];
    if (roleIds.length > 0) {
      const placeholders = roleIds.map(() => '?').join(',');
      const permissionsResult = await query(
        `SELECT DISTINCT p.module, p.action, p.id, p.description
         FROM permissions p
         INNER JOIN role_permissions rp ON p.id = rp.permission_id
         WHERE rp.role_id IN (${placeholders})
         ORDER BY p.module, p.action`,
        roleIds
      );
      permissions = permissionsResult;
    }

    // Ensure client_id is properly set (convert to integer if exists)
    if (user.client_id) {
      user.client_id = parseInt(user.client_id);
    }

    // Add user and permissions to request object
    req.user = user;
    req.user.permissions = permissions;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

// Role-based authorization middleware
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

// Permission-based authorization middleware
const authorizePermission = (module, action) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Admin always has all permissions
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if user has the required permission
    const hasPermission = req.user.permissions?.some(
      perm => perm.module === module && perm.action === action
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: `Insufficient permissions: ${module}.${action} required`
      });
    }

    next();
  };
};

// Check multiple permissions (OR logic - user needs at least one)
const authorizeAnyPermission = (...permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Admin always has all permissions
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if user has at least one of the required permissions
    const hasAnyPermission = permissions.some(([module, action]) =>
      req.user.permissions?.some(
        perm => perm.module === module && perm.action === action
      )
    );

    if (!hasAnyPermission) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

// Admin only middleware
const adminOnly = authorizeRoles('admin');

// Manager and admin middleware
const managerAndAdmin = authorizeRoles('admin', 'manager');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

module.exports = {
  authenticateToken,
  authorizeRoles,
  authorizePermission,
  authorizeAnyPermission,
  adminOnly,
  managerAndAdmin,
  generateToken
};
