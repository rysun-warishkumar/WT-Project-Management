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
  // SendGrid uses the literal username "apikey" for SMTP auth
  body('user')
    .optional()
    .trim()
    .custom((value) => value === 'apikey' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    .withMessage('User must be a valid email or "apikey" (SendGrid)'),
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
  // Accept either a real email (most providers) or "apikey" (SendGrid)
  body('user')
    .notEmpty()
    .custom((value) => value === 'apikey' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    .withMessage('Valid email or "apikey" (SendGrid) is required'),
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

    // If configured for SendGrid SMTP (host smtp.sendgrid.net + user apikey),
    // use SendGrid Web API over HTTPS (443). This works on Render even when SMTP ports are blocked.
    if ((host || '').toLowerCase() === 'smtp.sendgrid.net' && (user || '').toLowerCase() === 'apikey') {
      if (!from) {
        return res.status(400).json({
          success: false,
          message: 'From email is required for SendGrid test (must be a verified sender in SendGrid).',
        });
      }

      const https = require('https');
      const sendGridRequest = ({ method, path, apiKey, body }) =>
        new Promise((resolve, reject) => {
          const payload = body ? JSON.stringify(body) : null;
          const req2 = https.request(
            {
              hostname: 'api.sendgrid.com',
              port: 443,
              method,
              path,
              headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
              },
            },
            (resp) => {
              let data = '';
              resp.on('data', (chunk) => (data += chunk));
              resp.on('end', () => {
                const ok = resp.statusCode && resp.statusCode >= 200 && resp.statusCode < 300;
                if (!ok) return reject(new Error(`SendGrid API error (${resp.statusCode}): ${data || 'No response body'}`));
                resolve({ statusCode: resp.statusCode, body: data });
              });
            }
          );
          req2.on('error', reject);
          if (payload) req2.write(payload);
          req2.end();
        });

      // 1) Verify API key
      await sendGridRequest({ method: 'GET', path: '/v3/user/profile', apiKey: pass });

      // 2) Send a test email to the From address itself
      const payload = {
        personalizations: [{ to: [{ email: from }], subject: 'SMTP Configuration Test (SendGrid)' }],
        from: { email: from },
        content: [{ type: 'text/plain', value: 'This is a test email to verify SendGrid configuration.' }],
      };
      await sendGridRequest({ method: 'POST', path: '/v3/mail/send', apiKey: pass, body: payload });

      return res.json({
        success: true,
        message: 'SendGrid connection successful (tested via API)',
        data: { connection: true, testEmailSent: true },
      });
    }

    // Create temporary transporter for testing
    const nodemailer = require('nodemailer');
    const testTransporter = nodemailer.createTransport({
      host: host,
      port: parseInt(port) || 587,
      secure: secure === true || secure === 'true',
      auth: {
        user: user,
        pass: pass
      },
      // Add reasonable timeouts to fail faster on blocked connections
      connectionTimeout: 15000, // 15 seconds
      greetingTimeout: 10000,   // 10 seconds
      socketTimeout: 10000       // 10 seconds
    });

    // Test connection with timeout wrapper to prevent hanging
    const verifyWithTimeout = (transporter, timeoutMs = 20000) => {
      return Promise.race([
        transporter.verify(),
        new Promise((_, reject) => 
          setTimeout(() => {
            reject(new Error('Connection timeout: SMTP server did not respond. If you\'re using Render, they block outbound SMTP connections on ports 25, 587, and 465. Please use SendGrid (smtp.sendgrid.net, port 587) or another email service that works on Render.'));
          }, timeoutMs)
        )
      ]);
    };

    await verifyWithTimeout(testTransporter, 20000);

    // Optionally send a test email
    let testEmailSent = false;
    if (from) {
      try {
        // If user is "apikey" (SendGrid SMTP username), it is NOT a valid recipient email.
        // In that case, send the test email to the sender email instead.
        const testRecipient = (String(user).toLowerCase() === 'apikey') ? from : user;
        await testTransporter.sendMail({
          from: from,
          to: testRecipient,
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
    
    // Provide helpful error message for Render/hosting issues
    let errorMessage = error.message || 'Unknown error occurred';
    
    // Check if it's a timeout or connection issue (common on Render)
    if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT') || errorMessage.includes('ECONNREFUSED')) {
      errorMessage = `SMTP connection failed: ${errorMessage}. Note: Render blocks outbound SMTP connections. Use SendGrid (smtp.sendgrid.net, port 587) or Mailgun for email on Render.`;
    }
    
    res.status(400).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
