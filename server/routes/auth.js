const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const { query, transaction } = require('../config/database');
const { authenticateToken, generateToken } = require('../middleware/auth');
const { generateUniqueSlug, getUserWorkspaceContext } = require('../utils/workspaceUtils');
const { sendVerificationEmail } = require('../utils/email');

const router = express.Router();

// Login validation
const loginValidation = [
  body('username').notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required')
];

// Login route
router.post('/login', loginValidation, async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { username, password } = req.body;

    // Find user by username or email
    const users = await query(
      'SELECT * FROM users WHERE (username = ? OR email = ?) AND is_active = 1',
      [username, username]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const user = users[0];

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    await query(
      'UPDATE users SET last_login = NOW() WHERE id = ?',
      [user.id]
    );

    // Check email verification (if not super admin)
    if (!user.is_super_admin && !user.email_verified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email address before logging in. Check your inbox for the verification link.',
        requiresVerification: true
      });
    }

    // Get workspace context
    const workspaceContext = await getUserWorkspaceContext(user.id);
    
    // Generate token with workspace context
    const token = await generateToken(user.id, workspaceContext ? workspaceContext.workspace_id : null);

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    // Prepare response with workspace info
    const responseData = {
      user: {
        ...userWithoutPassword,
        is_super_admin: user.is_super_admin === true || user.is_super_admin === 1,
        email_verified: user.email_verified === true || user.email_verified === 1
      },
      token,
      workspace: workspaceContext ? {
        id: workspaceContext.workspace_id,
        name: workspaceContext.workspace_name,
        slug: workspaceContext.workspace_slug,
        role: workspaceContext.workspace_role
      } : null
    };

    res.json({
      success: true,
      message: 'Login successful',
      data: responseData
    });
  } catch (error) {
    console.error('Login error:', error);
    console.error('Error details:', error.message);
    console.error('Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get current user profile with permissions
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    let users;
    try {
      users = await query(
        `SELECT id, username, email, full_name, role, avatar, is_active, last_login, 
                created_at, updated_at, client_id, workspace_id, is_super_admin, email_verified
         FROM users WHERE id = ?`,
        [req.user.id]
      );
    } catch (err) {
      if (err && (err.code === 'ER_BAD_FIELD_ERROR' || String(err.message || '').includes('Unknown column'))) {
        users = await query(
          'SELECT id, username, email, full_name, role, avatar, is_active, last_login, created_at, updated_at, client_id FROM users WHERE id = ?',
          [req.user.id]
        );
      } else {
        throw err;
      }
    }

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const userData = users[0];
    
    // Include permissions in response
    userData.permissions = req.user.permissions || [];
    
    // Include workspace context
    if (req.user.workspace) {
      userData.workspace = {
        id: req.user.workspace.id,
        name: req.user.workspace.name,
        slug: req.user.workspace.slug,
        role: req.user.workspace.workspace_role || req.user.workspace.role
      };
    }
    
    // Ensure boolean values
    userData.is_super_admin = userData.is_super_admin === true || userData.is_super_admin === 1;
    userData.email_verified = userData.email_verified === true || userData.email_verified === 1;

    res.json({
      success: true,
      data: userData
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile'
    });
  }
});

// Get current user permissions
router.get('/permissions', authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        permissions: req.user.permissions || [],
        role: req.user.role
      }
    });
  } catch (error) {
    console.error('Get permissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get permissions'
    });
  }
});

// Update profile
router.put('/profile', authenticateToken, [
  body('full_name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Full name must be between 2 and 100 characters'),
  body('email').optional().trim().isEmail().withMessage('Invalid email format'),
  body('username').optional().trim().isLength({ min: 3, max: 50 }).withMessage('Username must be between 3 and 50 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { full_name, email, username } = req.body;
    const updateFields = [];
    const updateValues = [];

    if (full_name !== undefined) {
      if (!full_name || full_name.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Full name must be at least 2 characters'
        });
      }
      updateFields.push('full_name = ?');
      updateValues.push(full_name.trim());
    }

    if (email !== undefined) {
      if (!email || !email.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Email is required'
        });
      }
      
      // Check if email is already taken
      const existingUsers = await query(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email.trim(), req.user.id]
      );

      if (existingUsers.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Email already exists'
        });
      }

      updateFields.push('email = ?');
      updateValues.push(email.trim());
    }

    if (username !== undefined) {
      if (!username || username.trim().length < 3) {
        return res.status(400).json({
          success: false,
          message: 'Username must be at least 3 characters'
        });
      }

      // Check if username is already taken
      const existingUsers = await query(
        'SELECT id FROM users WHERE username = ? AND id != ?',
        [username.trim(), req.user.id]
      );

      if (existingUsers.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Username already exists'
        });
      }

      updateFields.push('username = ?');
      updateValues.push(username.trim());
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updateValues.push(req.user.id);

    await query(
      `UPDATE users SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      updateValues
    );

    // Fetch updated user
    const users = await query(
      'SELECT id, username, email, full_name, role, avatar, is_active, last_login, created_at, updated_at FROM users WHERE id = ?',
      [req.user.id]
    );

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: users[0]
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Change password
router.put('/change-password', authenticateToken, [
  body('currentPassword').notEmpty().trim().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6, max: 100 }).withMessage('New password must be between 6 and 100 characters'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error('Passwords do not match');
    }
    return true;
  })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !currentPassword.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Current password is required'
      });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters'
      });
    }

    // Check if new password is same as current
    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from current password'
      });
    }

    // Get current user with password
    const users = await query(
      'SELECT password FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword.trim(), users[0].password);
    if (!isValidPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await query(
      'UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?',
      [hashedPassword, req.user.id]
    );

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Registration validation
const registerValidation = [
  body('email').trim().isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('full_name').trim().isLength({ min: 2, max: 100 }).withMessage('Full name must be between 2 and 100 characters'),
  body('workspace_name').trim().isLength({ min: 2, max: 100 }).withMessage('Workspace name must be between 2 and 100 characters')
];

// Registration route
router.post('/register', registerValidation, async (req, res) => {
  try {
    console.log('Registration request received:', { email: req.body.email, workspace_name: req.body.workspace_name });
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { email, password, full_name, workspace_name } = req.body;

    // Check if email already exists
    const existingUsers = await query(
      'SELECT id FROM users WHERE email = ?',
      [email.trim().toLowerCase()]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate unique workspace slug
    const workspaceSlug = await generateUniqueSlug(workspace_name);

    // Create user, workspace, and workspace_member in a transaction
    const result = await transaction(async (connection) => {
      // 1. Create user (unverified)
      const [userResult] = await connection.execute(
        `INSERT INTO users (email, password, full_name, username, role, email_verified, email_verification_token, registration_source, is_active)
         VALUES (?, ?, ?, ?, 'admin', FALSE, ?, 'web', TRUE)`,
        [email.trim().toLowerCase(), hashedPassword, full_name.trim(), email.trim().toLowerCase(), verificationToken]
      );

      const userId = userResult.insertId;

      // 2. Create workspace
      const [workspaceResult] = await connection.execute(
        `INSERT INTO workspaces (name, slug, owner_id, plan_type, status)
         VALUES (?, ?, ?, 'free', 'active')`,
        [workspace_name.trim(), workspaceSlug, userId]
      );

      const workspaceId = workspaceResult.insertId;

      // 3. Update user with workspace_id
      await connection.execute(
        'UPDATE users SET workspace_id = ? WHERE id = ?',
        [workspaceId, userId]
      );

      // 4. Create workspace member (user as admin)
      await connection.execute(
        `INSERT INTO workspace_members (workspace_id, user_id, role, status, joined_at)
         VALUES (?, ?, 'admin', 'active', NOW())`,
        [workspaceId, userId]
      );

      return { userId, workspaceId, verificationToken };
    });

    // Send verification email
    let emailSent = false;
    try {
      console.log('Sending verification email. Token (first 30 chars):', result.verificationToken.substring(0, 30));
      const emailResult = await sendVerificationEmail(
        { email: email.trim().toLowerCase(), full_name: full_name.trim() },
        result.verificationToken
      );
      emailSent = emailResult.success;
      if (!emailSent) {
        console.error('Failed to send verification email:', emailResult.error);
      } else {
        console.log('Verification email sent successfully. Token stored in DB:', result.verificationToken.substring(0, 30));
      }
    } catch (emailError) {
      console.error('Error sending verification email:', emailError);
      // Don't fail registration if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Registration successful! Please check your email to verify your account.',
      data: {
        user_id: result.userId,
        workspace_id: result.workspaceId,
        requires_verification: true
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Email verification route
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Verification token is required'
      });
    }

    // Decode token if it's URL encoded (try both encoded and original)
    let decodedToken;
    try {
      decodedToken = decodeURIComponent(token);
    } catch (e) {
      decodedToken = token; // If decoding fails, use original
    }
    
    console.log('Verification attempt - Token received:', token ? `Length: ${token.length}, First 30: ${token.substring(0, 30)}` : 'null');
    console.log('Verification attempt - Decoded token:', decodedToken ? `Length: ${decodedToken.length}, First 30: ${decodedToken.substring(0, 30)}` : 'null');
    
    // Find user with this token (try both decoded and original)
    let users = await query(
      'SELECT id, email, email_verified, email_verification_token, LENGTH(email_verification_token) as token_length FROM users WHERE email_verification_token = ?',
      [decodedToken]
    );

    // If not found with decoded token, try with original token
    if (users.length === 0 && decodedToken !== token) {
      console.log('Trying with original token (not decoded)');
      users = await query(
        'SELECT id, email, email_verified, email_verification_token, LENGTH(email_verification_token) as token_length FROM users WHERE email_verification_token = ?',
        [token]
      );
    }
    
    // If still not found, try trimming whitespace
    if (users.length === 0) {
      const trimmedToken = token.trim();
      const trimmedDecoded = decodedToken.trim();
      
      if (trimmedToken !== token || trimmedDecoded !== decodedToken) {
        console.log('Trying with trimmed tokens');
        users = await query(
          'SELECT id, email, email_verified, email_verification_token, LENGTH(email_verification_token) as token_length FROM users WHERE TRIM(email_verification_token) = ?',
          [trimmedDecoded]
        );
        
        if (users.length === 0 && trimmedDecoded !== trimmedToken) {
          users = await query(
            'SELECT id, email, email_verified, email_verification_token, LENGTH(email_verification_token) as token_length FROM users WHERE TRIM(email_verification_token) = ?',
            [trimmedToken]
          );
        }
      }
    }

    if (users.length === 0) {
      // Debug: Log token details and check database
      console.log('❌ Verification token not found.');
      console.log('   Token received (length):', token ? token.length : 0);
      console.log('   Token received (first 30 chars):', token ? token.substring(0, 30) : 'null');
      console.log('   Decoded token (first 30 chars):', decodedToken ? decodedToken.substring(0, 30) : 'null');
      
      // Check if token exists in database (for debugging)
      const allTokens = await query(
        'SELECT id, email, email_verification_token, LENGTH(email_verification_token) as token_length FROM users WHERE email_verification_token IS NOT NULL LIMIT 5'
      );
      console.log('   Sample tokens in database:');
      allTokens.forEach(u => {
        console.log(`     - ${u.email}: length=${u.token_length}, start=${u.email_verification_token ? u.email_verification_token.substring(0, 30) : 'null'}`);
      });
      
      // Try to find by partial match (first 20 chars) for debugging
      if (token && token.length >= 20) {
        const partialMatch = await query(
          'SELECT id, email, email_verification_token FROM users WHERE email_verification_token LIKE ? LIMIT 1',
          [`${token.substring(0, 20)}%`]
        );
        if (partialMatch.length > 0) {
          console.log('   ⚠️  Found partial match! Full token in DB:', partialMatch[0].email_verification_token);
          console.log('   ⚠️  Requested token:', token);
          console.log('   ⚠️  Tokens match?', partialMatch[0].email_verification_token === token || partialMatch[0].email_verification_token === decodedToken);
        }
      }
      
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token'
      });
    }

    const user = users[0];

    if (user.email_verified) {
      return res.status(400).json({
        success: false,
        message: 'Email already verified'
      });
    }

    // Verify email
    await query(
      'UPDATE users SET email_verified = TRUE, email_verification_token = NULL WHERE id = ?',
      [user.id]
    );
    
    console.log('Email verified successfully for user:', user.email);

    res.json({
      success: true,
      message: 'Email verified successfully! You can now log in.'
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Email verification failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Resend verification email
router.post('/resend-verification', [
  body('email').trim().isEmail().withMessage('Valid email is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { email } = req.body;

    // Find user
    const users = await query(
      'SELECT id, email, full_name, email_verified, email_verification_token FROM users WHERE email = ?',
      [email.trim().toLowerCase()]
    );

    if (users.length === 0) {
      // Don't reveal if email exists (security)
      return res.json({
        success: true,
        message: 'If the email exists and is not verified, a verification email has been sent.'
      });
    }

    const user = users[0];

    if (user.email_verified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified'
      });
    }

    // Generate new token if none exists
    let verificationToken = user.email_verification_token;
    if (!verificationToken) {
      verificationToken = crypto.randomBytes(32).toString('hex');
      await query(
        'UPDATE users SET email_verification_token = ? WHERE id = ?',
        [verificationToken, user.id]
      );
    }

    // Send verification email
    try {
      const emailResult = await sendVerificationEmail(
        { email: user.email, full_name: user.full_name },
        verificationToken
      );
      
      if (!emailResult.success) {
        console.error('Failed to send verification email:', emailResult.error);
        return res.status(500).json({
          success: false,
          message: `Failed to send verification email: ${emailResult.error || 'Unknown error'}`
        });
      }
      
      console.log('Verification email sent successfully to:', user.email);
    } catch (emailError) {
      console.error('Error sending verification email:', emailError);
      return res.status(500).json({
        success: false,
        message: `Failed to send verification email: ${emailError.message || 'Unknown error'}`
      });
    }

    res.json({
      success: true,
      message: 'Verification email sent successfully'
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resend verification email',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Logout (client-side token removal)
router.post('/logout', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: 'Logout successful'
  });
});

module.exports = router;
