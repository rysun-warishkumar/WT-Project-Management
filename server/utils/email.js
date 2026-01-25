const nodemailer = require('nodemailer');
require('dotenv').config();

// Create transporter
const createTransporter = () => {
  // If SMTP is configured, use it; otherwise use a test account
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
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
    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@example.com',
      to: clientData.email,
      subject: `Welcome to ${process.env.APP_NAME || 'Client Management System'} - Your Login Credentials`,
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
            <h1 style="margin: 0;">Welcome to ${process.env.APP_NAME || 'Client Management System'}</h1>
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
              <strong>${process.env.APP_NAME || 'Client Management System'} Team</strong>
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 20px; padding: 20px; color: #6b7280; font-size: 12px;">
            <p style="margin: 0;">
              This is an automated email. Please do not reply to this message.
            </p>
            <p style="margin: 5px 0 0 0;">
              © ${new Date().getFullYear()} ${process.env.APP_NAME || 'Client Management System'}. All rights reserved.
            </p>
          </div>
        </body>
        </html>
      `,
      text: `
Welcome to ${process.env.APP_NAME || 'Client Management System'}

Dear ${clientData.full_name},

Your account has been created successfully. You can now access the client portal using the credentials below:

Login URL: ${process.env.CLIENT_URL || 'http://localhost:3000'}/login
Email: ${credentials.email}
Password: ${credentials.password}

⚠️ Security Notice: Please change your password after your first login for security purposes.

If you have any questions or need assistance, please don't hesitate to contact us.

Best regards,
${process.env.APP_NAME || 'Client Management System'} Team
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

module.exports = {
  sendClientCredentials,
  createTransporter,
};
