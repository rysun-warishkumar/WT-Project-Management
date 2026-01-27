# Deployment Files Reference
## Required Files for Production Deployment

This document lists all files needed for production deployment and their purposes.

---

## 📁 Database Migration Files

### Required Files

1. **`database/migrations/001_multi_tenant_phase1.sql`**
   - **Purpose**: Main migration script for Phase 1 multi-tenancy
   - **Usage**: Execute in production database via phpMyAdmin or MySQL CLI
   - **Location**: Run from Hostinger hPanel → phpMyAdmin
   - **Safe to run**: Yes (uses IF NOT EXISTS checks)

2. **`database/migrations/verify_phase1_migration.sql`**
   - **Purpose**: Verification script to check migration success
   - **Usage**: Run after migration to verify all steps completed
   - **Location**: Run from Hostinger hPanel → phpMyAdmin
   - **When to use**: Immediately after migration

3. **`database/migrations/001_multi_tenant_phase1_rollback.sql`**
   - **Purpose**: Rollback script to undo migration if needed
   - **Usage**: Only if migration fails or needs to be reversed
   - **Location**: Run from Hostinger hPanel → phpMyAdmin
   - **When to use**: Emergency rollback only

4. **`database/migrations/create_system_settings_table.sql`**
   - **Purpose**: Creates system_settings table (if not already created)
   - **Usage**: May be included in main migration or run separately
   - **Status**: Usually already included in Phase 1 migration

---

## 📁 Code Files (Auto-Deployed via Git)

### Backend Files (Node.js/Express)

All backend files are automatically deployed when you push to Git:

- **`server/`** - All server-side code
- **`package.json`** - Dependencies and scripts
- **`.gitignore`** - Files excluded from deployment

### Frontend Files (React)

All frontend files are automatically deployed when you push to Git:

- **`client/`** - All client-side React code
- **`client/package.json`** - Frontend dependencies
- **`client/build/`** - Built files (generated during deployment)

---

## 📁 Configuration Files

### Environment Variables (Set in Render Dashboard)

**Backend Environment Variables:**
```env
# Database
DB_HOST=your-production-db-host
DB_USER=your-production-db-user
DB_PASSWORD=your-production-db-password
DB_NAME=your-production-db-name
DB_PORT=3306

# Security
JWT_SECRET=your-jwt-secret-32-chars-min
CREDENTIAL_ENCRYPTION_KEY=your-64-char-hex-key

# URLs
CORS_ORIGIN=https://your-frontend-url.onrender.com
APP_URL=https://your-frontend-url.onrender.com
API_URL=https://your-backend-url.onrender.com

# Email (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourdomain.com

# Node
NODE_ENV=production
PORT=10000
```

**Frontend Environment Variables:**
```env
REACT_APP_API_URL=https://your-backend-url.onrender.com/api
```

---

## 📁 Documentation Files

### Deployment Guides

1. **`PRODUCTION_DEPLOYMENT_GUIDE.md`**
   - **Purpose**: Comprehensive step-by-step deployment guide
   - **Use**: Primary reference during deployment
   - **Contains**: Detailed instructions for database migration and code deployment

2. **`DEPLOYMENT_CHECKLIST.md`**
   - **Purpose**: Quick reference checklist
   - **Use**: During deployment to track progress
   - **Contains**: Condensed checklist format

3. **`DEPLOYMENT_FILES_REFERENCE.md`** (this file)
   - **Purpose**: Reference for all deployment files
   - **Use**: To understand what files are needed

### Other Documentation (Not Required for Deployment)

These files are in `.gitignore` and won't be deployed:
- `PHASE*_SUMMARY.md`
- `MULTI_TENANT_*.md`
- `database/migrations/*_GUIDE.md`
- `database/*_ERROR.md`
- `LOCAL_MIGRATION_GUIDE.md`

---

## 📁 Files NOT Deployed (In .gitignore)

The following files are excluded from deployment:

- **`.env`** - Local environment variables (use Render environment variables instead)
- **`node_modules/`** - Dependencies (installed during deployment)
- **`uploads/`** - User-uploaded files (use cloud storage in production)
- **Documentation files** - Various `.md` files (see `.gitignore`)

---

## 🔧 Build & Deploy Process

### Backend (Render Web Service)

1. **Git Push** → Triggers auto-deploy
2. **Build Command**: `npm install`
3. **Start Command**: `npm start`
4. **Output**: Server running on configured port

### Frontend (Render Static Site)

1. **Git Push** → Triggers auto-deploy
2. **Build Command**: `cd client && npm install && npm run build`
3. **Publish Directory**: `client/build`
4. **Output**: Static files served via CDN

---

## 📋 File Checklist Before Deployment

### Database Files
- [ ] `001_multi_tenant_phase1.sql` - Ready to execute
- [ ] `verify_phase1_migration.sql` - Ready for verification
- [ ] `001_multi_tenant_phase1_rollback.sql` - Available for rollback
- [ ] Database backup file - Saved securely

### Code Files
- [ ] All changes committed to Git
- [ ] Code pushed to repository
- [ ] `.gitignore` properly configured
- [ ] No sensitive data in code files

### Configuration
- [ ] Environment variables documented
- [ ] Secrets generated (JWT_SECRET, CREDENTIAL_ENCRYPTION_KEY)
- [ ] Database credentials ready
- [ ] URLs configured correctly

### Documentation
- [ ] Deployment guide reviewed
- [ ] Checklist printed/saved
- [ ] Rollback procedure understood

---

## 🚀 Deployment Order

1. **Database Migration** (Hostinger)
   - Backup database
   - Execute migration script
   - Verify migration

2. **Code Deployment** (Render)
   - Update environment variables
   - Deploy backend
   - Deploy frontend

3. **Verification**
   - Test application
   - Check logs
   - Verify functionality

---

## 📞 Quick Reference

### Migration Script Location
```
database/migrations/001_multi_tenant_phase1.sql
```

### Verification Script Location
```
database/migrations/verify_phase1_migration.sql
```

### Rollback Script Location
```
database/migrations/001_multi_tenant_phase1_rollback.sql
```

### Deployment Guides
- Main Guide: `PRODUCTION_DEPLOYMENT_GUIDE.md`
- Checklist: `DEPLOYMENT_CHECKLIST.md`

---

**Last Updated**: January 2026
