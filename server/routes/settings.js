const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticateToken, authorizePermission } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get system settings
router.get('/', authorizePermission('settings', 'view'), async (req, res) => {
  try {
    // Ensure system_settings table exists
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS system_settings (
          id INT PRIMARY KEY AUTO_INCREMENT,
          setting_key VARCHAR(100) UNIQUE NOT NULL,
          setting_value TEXT,
          description VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_setting_key (setting_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    } catch (createError) {
      // Table might already exist, continue
      console.log('System settings table check:', createError.message);
    }

    // Get SMTP settings from database (if exists) or environment
    const settings = await query(
      `SELECT setting_key, setting_value 
       FROM system_settings 
       WHERE setting_key LIKE 'smtp_%' 
       ORDER BY setting_key`
    );

    // Convert to object
    const smtpSettings = {};
    settings.forEach(setting => {
      const key = setting.setting_key.replace('smtp_', '');
      smtpSettings[key] = setting.setting_value;
    });

    // Merge with environment variables (env takes precedence if not in DB)
    const smtpConfig = {
      host: smtpSettings.host || process.env.SMTP_HOST || '',
      port: smtpSettings.port || process.env.SMTP_PORT || '587',
      secure: smtpSettings.secure === 'true' || process.env.SMTP_SECURE === 'true' || false,
      user: smtpSettings.user || process.env.SMTP_USER || '',
      pass: smtpSettings.pass ? '***' : (process.env.SMTP_PASS ? '***' : ''), // Don't expose password
      from: smtpSettings.from || process.env.SMTP_FROM || process.env.SMTP_USER || '',
      enabled: smtpSettings.enabled === 'true' || (process.env.SMTP_HOST ? true : false)
    };

    res.json({
      success: true,
      data: {
        smtp: smtpConfig
      }
    });
  } catch (error) {
    console.error('Get settings error:', error);
    
    // If system_settings table doesn't exist, return env-based config
    if (error.code === 'ER_NO_SUCH_TABLE') {
      const smtpConfig = {
        host: process.env.SMTP_HOST || '',
        port: process.env.SMTP_PORT || '587',
        secure: process.env.SMTP_SECURE === 'true' || false,
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS ? '***' : '',
        from: process.env.SMTP_FROM || process.env.SMTP_USER || '',
        enabled: !!process.env.SMTP_HOST
      };

      return res.json({
        success: true,
        data: {
          smtp: smtpConfig
        }
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to get settings'
    });
  }
});

// Update SMTP settings
router.put('/smtp', authorizePermission('settings', 'edit'), [
  body('host').optional().trim().isLength({ min: 1, max: 255 }).withMessage('Host must be between 1 and 255 characters'),
  body('port').optional().isInt({ min: 1, max: 65535 }).withMessage('Port must be between 1 and 65535'),
  body('secure').optional().isBoolean().withMessage('Secure must be a boolean'),
  body('user').optional().trim().isEmail().withMessage('User must be a valid email'),
  body('pass').optional().trim().isLength({ min: 1 }).withMessage('Password cannot be empty'),
  body('from').optional().trim().isEmail().withMessage('From must be a valid email'),
  body('enabled').optional().isBoolean().withMessage('Enabled must be a boolean')
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

    const { host, port, secure, user, pass, from, enabled } = req.body;

    // Create system_settings table if it doesn't exist
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS system_settings (
          id INT PRIMARY KEY AUTO_INCREMENT,
          setting_key VARCHAR(100) UNIQUE NOT NULL,
          setting_value TEXT,
          description VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_setting_key (setting_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    } catch (createError) {
      // Table might already exist, continue
      console.log('System settings table check:', createError.message);
    }

    // Update or insert SMTP settings
    const settingsToUpdate = [
      { key: 'smtp_host', value: host },
      { key: 'smtp_port', value: port ? String(port) : null },
      { key: 'smtp_secure', value: secure !== undefined ? String(secure) : null },
      { key: 'smtp_user', value: user },
      { key: 'smtp_pass', value: pass }, // Will be stored (encrypted in future)
      { key: 'smtp_from', value: from },
      { key: 'smtp_enabled', value: enabled !== undefined ? String(enabled) : null }
    ];

    for (const setting of settingsToUpdate) {
      if (setting.value !== undefined && setting.value !== null) {
        await query(
          `INSERT INTO system_settings (setting_key, setting_value) 
           VALUES (?, ?) 
           ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()`,
          [setting.key, setting.value]
        );
      }
    }

    // Test SMTP connection if enabled
    let testResult = null;
    if (enabled && host && user && pass) {
      try {
        const { createTransporter } = require('../utils/email');
        const transporter = createTransporter();
        
        // Try to verify connection
        if (transporter.verify) {
          await transporter.verify();
          testResult = { success: true, message: 'SMTP connection successful' };
        } else {
          testResult = { success: true, message: 'SMTP configuration saved' };
        }
      } catch (testError) {
        testResult = { 
          success: false, 
          message: `SMTP test failed: ${testError.message}` 
        };
      }
    }

    res.json({
      success: true,
      message: 'SMTP settings updated successfully',
      data: {
        test: testResult
      }
    });
  } catch (error) {
    console.error('Update SMTP settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update SMTP settings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Test SMTP connection
router.post('/smtp/test', authorizePermission('settings', 'edit'), [
  body('host').notEmpty().withMessage('Host is required'),
  body('port').notEmpty().isInt({ min: 1, max: 65535 }).withMessage('Valid port is required'),
  body('user').notEmpty().isEmail().withMessage('Valid email is required'),
  body('pass').notEmpty().withMessage('Password is required'),
  body('from').optional().isEmail().withMessage('From must be a valid email')
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

    const { host, port, secure, user, pass, from } = req.body;

    // Create temporary transporter for testing
    const nodemailer = require('nodemailer');
    const testTransporter = nodemailer.createTransport({
      host: host,
      port: parseInt(port) || 587,
      secure: secure === true || secure === 'true',
      auth: {
        user: user,
        pass: pass
      }
    });

    // Test connection
    await testTransporter.verify();

    // Optionally send a test email
    let testEmailSent = false;
    if (from) {
      try {
        await testTransporter.sendMail({
          from: from,
          to: user, // Send test email to the SMTP user
          subject: 'SMTP Configuration Test',
          text: 'This is a test email to verify SMTP configuration.',
          html: '<p>This is a test email to verify SMTP configuration.</p>'
        });
        testEmailSent = true;
      } catch (emailError) {
        console.error('Test email send error:', emailError);
      }
    }

    res.json({
      success: true,
      message: 'SMTP connection successful',
      data: {
        connection: true,
        testEmailSent: testEmailSent
      }
    });
  } catch (error) {
    console.error('SMTP test error:', error);
    res.status(400).json({
      success: false,
      message: `SMTP connection failed: ${error.message}`,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
