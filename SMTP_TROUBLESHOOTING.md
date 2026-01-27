# SMTP Connection Test Troubleshooting Guide
## For Render Deployment

This guide helps diagnose and fix SMTP connection test failures on Render.

---

## 🔴 Common Issues on Render

### 1. **Render Blocks Outbound SMTP Ports**

**Problem**: Render's free tier and some paid tiers **block outbound connections** on common SMTP ports:
- Port **25** (SMTP) - **BLOCKED** on all Render tiers
- Port **587** (SMTP with STARTTLS) - May be blocked
- Port **465** (SMTPS/SSL) - May be blocked

**Solution**: Use a third-party email service that provides an API or uses different ports:
- **SendGrid** (Recommended) - API-based, no SMTP port issues
- **Mailgun** - API-based
- **AWS SES** - API or SMTP on port 2587
- **Postmark** - API-based
- **Resend** - Modern API-based service

---

### 2. **Timeout Issues**

**Problem**: SMTP connection test times out after 30 seconds.

**Symptoms**:
- Frontend shows: `timeout of 30000ms exceeded`
- Request takes 29+ seconds before failing
- No error message from backend

**Solutions**:

**A. Check Backend Logs in Render**
1. Go to Render Dashboard → Your Backend Service → **Logs** tab
2. Look for SMTP-related errors
3. Check for network errors like `ECONNREFUSED`, `ETIMEDOUT`, `EHOSTUNREACH`

**B. Test SMTP Connection from Render Server**
Add a test endpoint to verify connectivity:

```javascript
// Add to server/routes/settings.js (temporary for testing)
router.get('/smtp/debug', async (req, res) => {
  const net = require('net');
  const testHost = 'smtp.gmail.com';
  const testPort = 587;
  
  const socket = new net.Socket();
  const timeout = 5000;
  
  socket.setTimeout(timeout);
  socket.on('timeout', () => {
    socket.destroy();
    res.json({ error: 'Connection timeout', host: testHost, port: testPort });
  });
  
  socket.on('error', (err) => {
    res.json({ error: err.message, host: testHost, port: testPort });
  });
  
  socket.on('connect', () => {
    socket.destroy();
    res.json({ success: true, message: 'Port is reachable', host: testHost, port: testPort });
  });
  
  socket.connect(testPort, testHost);
});
```

**C. Verify SMTP Settings**
- Double-check host, port, username, and password
- For Gmail: Use **App Password** (not regular password)
- Ensure "Less secure app access" is enabled (if using Gmail without App Password)

---

### 3. **Gmail-Specific Issues**

**Problem**: Gmail SMTP connection fails.

**Common Causes**:
1. **Using regular password instead of App Password**
2. **2FA not enabled** (required for App Passwords)
3. **"Less secure app access" disabled** (if not using App Password)

**Solution - Gmail App Password**:

1. **Enable 2-Factor Authentication**:
   - Go to [Google Account Security](https://myaccount.google.com/security)
   - Enable 2-Step Verification

2. **Generate App Password**:
   - Go to [App Passwords](https://myaccount.google.com/apppasswords)
   - Select "Mail" and "Other (Custom name)"
   - Enter "Client Management System"
   - Copy the 16-character password

3. **Use App Password in SMTP Settings**:
   - Host: `smtp.gmail.com`
   - Port: `587`
   - Secure: `false` (TLS)
   - User: Your Gmail address
   - Password: The 16-character App Password (not your regular password)

---

### 4. **Network/Firewall Issues**

**Problem**: Render's network blocks SMTP connections.

**Check**:
1. **Render Logs**: Look for `ECONNREFUSED` or `EHOSTUNREACH`
2. **Test from Local Machine**: If SMTP works locally but not on Render, it's a Render network issue
3. **Try Different Port**: Some providers support multiple ports

**Alternative Ports to Try**:
- Gmail: Port `465` (SSL) instead of `587` (TLS)
- Outlook: Port `587` (TLS) or `25` (not recommended)
- Custom SMTP: Check provider documentation

---

### 5. **TLS/SSL Certificate Issues**

**Problem**: TLS handshake fails.

**Symptoms**:
- Error: `self signed certificate`
- Error: `certificate verify failed`
- Connection hangs during TLS negotiation

**Solution**: The code now includes `rejectUnauthorized: false` for testing, but for production:
- Use proper SSL certificates
- Verify SMTP server supports TLS
- Check if `secure: true` vs `secure: false` is correct for your port

---

## ✅ Recommended Solutions

### Option 1: Use SendGrid (Easiest for Render)

**Why**: SendGrid provides an API, so no SMTP port blocking issues.

**Steps**:

1. **Sign up for SendGrid** (free tier: 100 emails/day)
   - Go to [sendgrid.com](https://sendgrid.com)
   - Create account and verify email

2. **Create API Key**:
   - Dashboard → Settings → API Keys
   - Create API Key with "Mail Send" permissions
   - Copy the API key

3. **Update Your Code** (optional - can use SMTP too):
   ```bash
   npm install @sendgrid/mail
   ```

4. **Use SendGrid SMTP** (easier - no code changes):
   - Host: `smtp.sendgrid.net`
   - Port: `587`
   - Secure: `false` (TLS)
   - User: `apikey`
   - Password: Your SendGrid API Key
   - From: Your verified sender email in SendGrid

---

### Option 2: Use AWS SES

**Why**: AWS SES works well with Render and provides both API and SMTP.

**Steps**:

1. **Set up AWS SES**:
   - Verify your email domain or email address
   - Get SMTP credentials from SES Console

2. **Use AWS SES SMTP**:
   - Host: `email-smtp.[region].amazonaws.com` (e.g., `email-smtp.us-east-1.amazonaws.com`)
   - Port: `587` (TLS) or `2587` (alternative)
   - Secure: `false` for port 587, `true` for port 465
   - User: Your SMTP username
   - Password: Your SMTP password

---

### Option 3: Use Mailgun

**Why**: API-based, no SMTP port issues.

**Steps**:

1. **Sign up for Mailgun**
2. **Get SMTP credentials**:
   - Dashboard → Sending → Domain Settings → SMTP credentials
   - Use provided SMTP settings

---

## 🔧 Quick Fixes Applied

The code has been updated with:

1. **Timeout Configuration**:
   - Connection timeout: 10 seconds
   - Greeting timeout: 10 seconds
   - Socket timeout: 10 seconds
   - Overall test timeout: 15 seconds

2. **Better Error Messages**:
   - More descriptive timeout errors
   - Network error details in development mode

3. **TLS Configuration**:
   - Accepts self-signed certificates (for testing)
   - Proper cipher configuration

---

## 🧪 Testing Steps

### Step 1: Check Render Logs

1. Go to Render Dashboard
2. Select your backend service
3. Open **Logs** tab
4. Try SMTP test again
5. Look for errors like:
   - `ECONNREFUSED` - Port blocked or wrong host
   - `ETIMEDOUT` - Network timeout
   - `EHOSTUNREACH` - Host not reachable
   - `EAUTH` - Authentication failed

### Step 2: Test SMTP Settings Locally

1. **Test from your local machine** (if SMTP works locally but not on Render, it's a Render network issue):
   ```bash
   # Using telnet (if available)
   telnet smtp.gmail.com 587
   
   # Or use Node.js test script
   node -e "
   const nodemailer = require('nodemailer');
   const transporter = nodemailer.createTransport({
     host: 'smtp.gmail.com',
     port: 587,
     secure: false,
     auth: { user: 'your-email@gmail.com', pass: 'your-app-password' }
   });
   transporter.verify().then(() => console.log('SMTP OK')).catch(console.error);
   "
   ```

### Step 3: Verify SMTP Provider Settings

**For Gmail**:
- ✅ Using App Password (not regular password)
- ✅ 2FA enabled
- ✅ Host: `smtp.gmail.com`
- ✅ Port: `587` (TLS) or `465` (SSL)
- ✅ Secure: `false` for 587, `true` for 465

**For Outlook/Hotmail**:
- ✅ Host: `smtp-mail.outlook.com`
- ✅ Port: `587`
- ✅ Secure: `false` (TLS)

**For Yahoo**:
- ✅ Host: `smtp.mail.yahoo.com`
- ✅ Port: `587`
- ✅ Secure: `false` (TLS)

---

## 📋 Checklist

Before reporting SMTP issues, verify:

- [ ] SMTP settings are correct (host, port, user, password)
- [ ] Using App Password for Gmail (not regular password)
- [ ] Tested SMTP connection from local machine (works?)
- [ ] Checked Render logs for specific error messages
- [ ] Verified SMTP provider allows connections from Render's IPs
- [ ] Tried alternative SMTP service (SendGrid, Mailgun, etc.)
- [ ] Increased timeout if needed (already done in code)
- [ ] Checked if port is blocked by Render (ports 25, 587, 465)

---

## 🚨 If Nothing Works

**Last Resort Options**:

1. **Use Email Service API Instead of SMTP**:
   - SendGrid API
   - Mailgun API
   - AWS SES API
   - Postmark API

2. **Contact Render Support**:
   - Ask about SMTP port restrictions
   - Request whitelist for your SMTP provider's IPs

3. **Use Different Hosting**:
   - Some providers (Heroku, Railway) have better SMTP support
   - Or use a dedicated email service

---

## 📞 Support Resources

- **Render Docs**: [render.com/docs](https://render.com/docs)
- **SendGrid Docs**: [docs.sendgrid.com](https://docs.sendgrid.com)
- **Gmail App Passwords**: [support.google.com/accounts/answer/185833](https://support.google.com/accounts/answer/185833)
- **Nodemailer Docs**: [nodemailer.com](https://nodemailer.com)

---

**Last Updated**: January 2026
