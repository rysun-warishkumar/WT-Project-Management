const nodemailer = require('nodemailer');
require('dotenv').config();
const https = require('https');

// Email branding constants
const APP_NAME = process.env.APP_NAME || 'W | Technology CMS';
const COMPANY_NAME = 'W | Technology';
const COMPANY_URL = 'https://wtechnology.in';
const SUPPORT_EMAIL = 'info@wtechnology.in';

const isSendGridSmtpConfig = (smtpConfig) => {
  const host = (smtpConfig?.host || '').toLowerCase();
  const user = (smtpConfig?.auth?.user || '').toLowerCase();
  return host === 'smtp.sendgrid.net' && user === 'apikey';
};

const sendGridRequest = ({ method, path, apiKey, body }) => {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;

    const req = https.request(
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
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          // SendGrid returns 202 for success on mail send, 200 for profile calls
          const ok = res.statusCode && res.statusCode >= 200 && res.statusCode < 300;
          if (!ok) {
            return reject(
              new Error(
                `SendGrid API error (${res.statusCode}): ${data || 'No response body'}`
              )
            );
          }
          resolve({ statusCode: res.statusCode, body: data });
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
};

const verifySendGridApiKey = async (apiKey) => {
  // Lightweight endpoint to validate the API key
  await sendGridRequest({ method: 'GET', path: '/v3/user/profile', apiKey });
  return true;
};

const sendViaSendGridApi = async (apiKey, mailOptions) => {
  // Convert nodemailer-like options to SendGrid payload
  // mailOptions.from may be `"Name" <email@domain.com>` or plain email
  const fromRaw = mailOptions.from || '';
  const fromMatch = fromRaw.match(/<([^>]+)>/);
  const fromEmail = (fromMatch ? fromMatch[1] : fromRaw).trim();

  const toRaw = mailOptions.to || '';
  const to = Array.isArray(toRaw) ? toRaw : String(toRaw).split(',').map((s) => s.trim()).filter(Boolean);

  if (!fromEmail) throw new Error('SendGrid: from email is required');
  if (!to.length) throw new Error('SendGrid: to email is required');

  const payload = {
    personalizations: [
      {
        to: to.map((email) => ({ email })),
        subject: mailOptions.subject || '',
      },
    ],
    from: { email: fromEmail, name: APP_NAME },
    content: [
      ...(mailOptions.text ? [{ type: 'text/plain', value: mailOptions.text }] : []),
      ...(mailOptions.html ? [{ type: 'text/html', value: mailOptions.html }] : []),
    ],
  };

  await sendGridRequest({ method: 'POST', path: '/v3/mail/send', apiKey, body: payload });
  return { messageId: 'sendgrid-api' };
};

// Reusable email footer HTML
const getEmailFooter = () => {
  return `
    <div style="border-top: 2px solid #e5e7eb; margin-top: 40px; padding-top: 30px; text-align: center; color: #6b7280; font-size: 12px;">
      <p style="margin: 0 0 10px 0;">
        Powered By <a href="${COMPANY_URL}" style="color: #4F46E5; text-decoration: none; font-weight: bold;">${COMPANY_NAME}</a>
      </p>
      <p style="margin: 5px 0;">
        Contact or report any issue on <a href="mailto:${SUPPORT_EMAIL}" style="color: #4F46E5; text-decoration: none;">${SUPPORT_EMAIL}</a>
      </p>
      <p style="margin: 15px 0 0 0; font-size: 11px;">
        © ${new Date().getFullYear()} ${COMPANY_NAME}. All rights reserved.
      </p>
    </div>
  `;
};

// Reusable email footer text (for plain text emails)
const getEmailFooterText = () => {
  return `
---
Powered By ${COMPANY_NAME} (${COMPANY_URL})
Contact or report any issue on ${SUPPORT_EMAIL}
© ${new Date().getFullYear()} ${COMPANY_NAME}. All rights reserved.
  `.trim();
};

/**
 * Get SMTP configuration from database settings or environment
 * @returns {Promise<Object>} SMTP configuration
 */
const getSmtpConfig = async () => {
  try {
    // Try to get from database settings first
    const { query } = require('../config/database');
    const settings = await query(
      `SELECT setting_key, setting_value 
       FROM system_settings 
       WHERE setting_key LIKE 'smtp_%'`
    );

    if (settings.length > 0) {
      const smtpConfig = {};
      settings.forEach(setting => {
        const key = setting.setting_key.replace('smtp_', '');
        smtpConfig[key] = setting.setting_value;
      });

      // Check if SMTP is enabled in settings
      if (smtpConfig.enabled === 'true' && smtpConfig.host && smtpConfig.user && smtpConfig.pass) {
        return {
          host: smtpConfig.host,
          port: parseInt(smtpConfig.port) || 587,
          secure: smtpConfig.secure === 'true',
          auth: {
            user: smtpConfig.user,
            pass: smtpConfig.pass
          },
          from: smtpConfig.from || smtpConfig.user
        };
      }
    }
  } catch (error) {
    // If system_settings table doesn't exist or query fails, fall back to env
    console.log('Using environment SMTP configuration:', error.message);
  }

  // Fall back to environment variables
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      from: process.env.SMTP_FROM || process.env.SMTP_USER
    };
  }

  return null;
};

// Create transporter
const createTransporter = async () => {
  // Get SMTP config from database or environment
  const smtpConfig = await getSmtpConfig();

  if (smtpConfig) {
    // Render often blocks outbound SMTP ports. If user configured SendGrid SMTP
    // using username "apikey", use SendGrid Web API over HTTPS (port 443) instead.
    if (isSendGridSmtpConfig(smtpConfig)) {
      const apiKey = smtpConfig.auth?.pass;
      return {
        verify: async () => verifySendGridApiKey(apiKey),
        sendMail: async (options) => sendViaSendGridApi(apiKey, options),
      };
    }

    return nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: smtpConfig.auth
    });
  } else {
    // For development, use console logging instead of actual email
    console.warn('SMTP not configured. Email will be logged to console only.');
    return {
      sendMail: async (options) => {
        console.log('=== EMAIL (Not Sent - SMTP not configured) ===');
        console.log('To:', options.to);
        console.log('Subject:', options.subject);
        console.log('HTML:', options.html);
        console.log('==========================================');
        return { messageId: 'console-log' };
      }
    };
  }
};

// Send client credentials email
const sendClientCredentials = async (clientData, credentials) => {
  try {
    // Get SMTP config to use the correct 'from' address
    const smtpConfig = await getSmtpConfig();
    const transporter = await createTransporter();
    
    // Use the 'from' address from SMTP config, or fallback to user email
    // Format: "Display Name" <email@address.com>
    const fromEmail = smtpConfig?.from || smtpConfig?.auth?.user || process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@example.com';
    const fromAddress = `"${APP_NAME}" <${fromEmail}>`;
    
    const mailOptions = {
      from: fromAddress,
      to: clientData.email,
      subject: `Welcome to ${APP_NAME} - Your Login Credentials`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Your Login Credentials</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0;">Welcome to ${APP_NAME}</h1>
          </div>
          
          <div style="background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Dear ${clientData.full_name},</p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Your account has been created successfully. You can now access the client portal using the credentials below:
            </p>
            
            <div style="background-color: white; border: 2px solid #4F46E5; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #4F46E5; margin-top: 0;">Your Login Credentials</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px; font-weight: bold; width: 120px;">Login URL:</td>
                  <td style="padding: 10px;">
                    <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/login" style="color: #4F46E5; text-decoration: none;">
                      ${process.env.CLIENT_URL || 'http://localhost:3000'}/login
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px; font-weight: bold;">Email:</td>
                  <td style="padding: 10px;">${credentials.email}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; font-weight: bold;">Password:</td>
                  <td style="padding: 10px; font-family: monospace; font-size: 18px; color: #059669; font-weight: bold;">
                    ${credentials.password}
                  </td>
                </tr>
              </table>
            </div>
            
            <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; font-size: 14px;">
                <strong>⚠️ Security Notice:</strong> Please change your password after your first login for security purposes.
              </p>
            </div>
            
            <p style="font-size: 16px; margin-top: 30px;">
              If you have any questions or need assistance, please don't hesitate to contact us.
            </p>
            
            <p style="font-size: 16px; margin-top: 20px;">
              Best regards,<br>
              <strong>${APP_NAME} Team</strong>
            </p>
            ${getEmailFooter()}
          </div>
        </body>
        </html>
      `,
      text: `
Welcome to ${APP_NAME}

Dear ${clientData.full_name},

Your account has been created successfully. You can now access the client portal using the credentials below:

Login URL: ${process.env.CLIENT_URL || 'http://localhost:3000'}/login
Email: ${credentials.email}
Password: ${credentials.password}

⚠️ Security Notice: Please change your password after your first login for security purposes.

If you have any questions or need assistance, please don't hesitate to contact us.

Best regards,
${APP_NAME} Team

${getEmailFooterText()}
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
};

// Send email verification email
const sendVerificationEmail = async (userData, verificationToken) => {
  try {
    // Get SMTP config to use the correct 'from' address
    const smtpConfig = await getSmtpConfig();
    const transporter = await createTransporter();
    
    // Use the 'from' address from SMTP config, or fallback to user email
    // Format: "Display Name" <email@address.com>
    const fromEmail = smtpConfig?.from || smtpConfig?.auth?.user || process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@example.com';
    const fromAddress = `"${APP_NAME}" <${fromEmail}>`;
    
    // Use CLIENT_URL for frontend URLs, fallback to APP_URL or localhost
    const baseUrl = process.env.CLIENT_URL || process.env.APP_URL || 'http://localhost:3000';
    const verificationUrl = `${baseUrl.replace(/\/+$/, '')}/verify-email?token=${encodeURIComponent(
      verificationToken
    )}`;
    
    const mailOptions = {
      from: fromAddress,
      to: userData.email,
      subject: `Verify Your Email - ${APP_NAME}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0;">Verify Your Email Address</h1>
          </div>
          
          <div style="background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Dear ${userData.full_name || userData.email},</p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Thank you for registering with ${APP_NAME}! 
              Please verify your email address by clicking the button below:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" target="_blank" rel="noopener noreferrer"
                 style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Verify Email Address
              </a>
            </div>
            
            <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
              Or copy and paste this link into your browser:<br>
              <a href="${verificationUrl}" target="_blank" rel="noopener noreferrer" style="color: #4F46E5; word-break: break-all;">${verificationUrl}</a>
            </p>
            
            <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; font-size: 14px;">
                <strong>⚠️ Important:</strong> This verification link will expire in 24 hours. 
                If you didn't create an account, please ignore this email.
              </p>
            </div>
            
            <p style="font-size: 16px; margin-top: 30px;">
              Best regards,<br>
              <strong>${APP_NAME} Team</strong>
            </p>
            ${getEmailFooter()}
          </div>
        </body>
        </html>
      `,
      text: `
Verify Your Email Address

Dear ${userData.full_name || userData.email},

Thank you for registering with ${APP_NAME}! 
Please verify your email address by visiting this link:

${verificationUrl}

⚠️ Important: This verification link will expire in 24 hours. 
If you didn't create an account, please ignore this email.

Best regards,
${APP_NAME} Team

${getEmailFooterText()}
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Verification email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending verification email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendClientCredentials,
  sendVerificationEmail,
  createTransporter,
  getSmtpConfig,
};
