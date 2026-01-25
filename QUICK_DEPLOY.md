# Quick Deployment Checklist

Use this checklist for a quick deployment to Render with Hostinger MySQL.

## ✅ Pre-Deployment Checklist

- [ ] Code is pushed to Git repository (GitHub/GitLab)
- [ ] Hostinger account with MySQL access
- [ ] Render account created
- [ ] Database schema file ready (`database/complete_schema.sql`)

---

## 🗄️ Database Setup (Hostinger)

- [ ] Created MySQL database in Hostinger hPanel
- [ ] Created database user with password
- [ ] Noted database credentials (host, name, user, password, port)
- [ ] Imported `database/complete_schema.sql` via phpMyAdmin
- [ ] Verified tables are created
- [ ] Configured remote access (if needed/available)

---

## 🚀 Backend Deployment (Render)

- [ ] Created new Web Service in Render
- [ ] Connected Git repository
- [ ] Set build command: `npm install`
- [ ] Set start command: `npm start`
- [ ] Added all environment variables (see below)
- [ ] Generated JWT_SECRET (32+ chars)
- [ ] Generated CREDENTIAL_ENCRYPTION_KEY (64-char hex)
- [ ] Deployed and verified backend URL

### Required Environment Variables:

```env
NODE_ENV=production
PORT=10000
DB_HOST=<hostinger-db-host>
DB_USER=<db-username>
DB_PASSWORD=<db-password>
DB_NAME=client_management
DB_PORT=3306
JWT_SECRET=<generated-secret>
CORS_ORIGIN=<frontend-url>
APP_NAME=Client Management System
APP_URL=<frontend-url>
API_URL=<backend-url>
UPLOAD_PATH=./uploads
CREDENTIAL_ENCRYPTION_KEY=<64-char-hex>
```

---

## 🎨 Frontend Deployment (Render)

- [ ] Created new Static Site in Render
- [ ] Connected Git repository
- [ ] Set build command: `cd client && npm install && npm run build`
- [ ] Set publish directory: `client/build`
- [ ] Added environment variable: `REACT_APP_API_URL=<backend-url>/api`
- [ ] Deployed and verified frontend URL
- [ ] Updated backend `CORS_ORIGIN` with frontend URL

---

## ✅ Post-Deployment Verification

- [ ] Backend health check works: `https://your-backend.onrender.com/api/health`
- [ ] Frontend loads: `https://your-frontend.onrender.com`
- [ ] Can login with admin credentials
- [ ] Database connection works (try creating a client)
- [ ] File uploads work (if using Render Disk or cloud storage)
- [ ] No errors in Render logs
- [ ] No errors in browser console

---

## 🔧 Quick Commands

### Generate JWT Secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Generate Encryption Key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Test Database Connection Locally:
```bash
# Update .env with Hostinger credentials, then:
node -e "require('dotenv').config(); const db = require('./server/config/database'); db.testConnection().then(() => process.exit(0)).catch(() => process.exit(1));"
```

---

## 🐛 Common Issues & Quick Fixes

| Issue | Quick Fix |
|-------|-----------|
| Database connection fails | Check credentials, verify remote access enabled |
| CORS errors | Update `CORS_ORIGIN` in backend env vars |
| Build fails | Check Node version, verify all dependencies |
| Files not persisting | Use Render Disk or cloud storage |
| 404 on frontend routes | Ensure static file serving is configured |

---

## 📚 Full Documentation

For detailed instructions, see:
- `DEPLOYMENT.md` - Complete deployment guide
- `HOSTINGER_SETUP.md` - Database setup details

---

**Time Estimate**: 30-60 minutes for first-time deployment
