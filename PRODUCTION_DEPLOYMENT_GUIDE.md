# Production Deployment Guide
## Multi-Tenant Client & Project Management System

This guide provides step-by-step instructions for deploying the multi-tenant system to production, including database migration and code deployment.

---

## 📋 Pre-Deployment Checklist

Before starting, ensure you have:

- [ ] **Database Backup**: Full backup of production database
- [ ] **Access Credentials**: 
  - Production database credentials (Hostinger/hPanel)
  - Render account credentials
  - Git repository access
- [ ] **Environment Variables**: List of all required environment variables
- [ ] **Maintenance Window**: Schedule downtime if needed (migration takes 5-15 minutes)
- [ ] **Tested Locally**: All features tested in local environment

---

## 🗄️ PART 1: MySQL Database Migration (Production)

### Step 1: Backup Production Database

**⚠️ CRITICAL: Always backup before migration!**

1. Log in to **Hostinger hPanel**
2. Navigate to **Databases** → **phpMyAdmin**
3. Select your production database
4. Click **Export** tab
5. Choose **Quick** export method
6. Select **SQL** format
7. Click **Go** to download backup
8. **Save the backup file securely** (you'll need it for rollback if anything goes wrong)

**Alternative: Use hPanel Backup**
- Go to **Backups** in hPanel
- Create a full backup including database
- Download and verify backup file

---

### Step 2: Review Migration Script

1. Open `database/migrations/001_multi_tenant_phase1.sql`
2. Review the migration steps (it's safe - uses `IF NOT EXISTS` and `IF EXISTS` checks)
3. Note: The script is idempotent (can be run multiple times safely)

**What the migration does:**
- Creates `workspaces` and `workspace_members` tables
- Adds `workspace_id` column to all data tables
- Creates a default workspace
- Migrates existing admin to super admin
- Migrates all existing data to default workspace
- Adds foreign keys and indexes

---

### Step 3: Execute Migration Script

**Option A: Using phpMyAdmin (Recommended)**

1. Log in to **Hostinger hPanel**
2. Navigate to **Databases** → **phpMyAdmin**
3. Select your **production database** from the left sidebar
4. Click **SQL** tab at the top
5. Open `database/migrations/001_multi_tenant_phase1.sql` in a text editor
6. **Copy the entire SQL script** (all 625 lines)
7. **Paste into the SQL query box** in phpMyAdmin
8. Click **Go** button
9. **Wait for execution to complete** (may take 1-5 minutes depending on data size)
10. Check for any errors in the results

**Option B: Using MySQL Command Line**

```bash
# Connect to production database
mysql -h your-db-host -u your-db-user -p your-db-name

# Run migration
source database/migrations/001_multi_tenant_phase1.sql

# Or directly:
mysql -h your-db-host -u your-db-user -p your-db-name < database/migrations/001_multi_tenant_phase1.sql
```

---

### Step 4: Verify Migration

1. In phpMyAdmin, click **SQL** tab again
2. Open `database/migrations/verify_phase1_migration.sql`
3. Copy and paste the verification script
4. Click **Go**
5. **Review all results** - all checks should pass:

   ✅ **Expected Results:**
   - `workspaces` table exists
   - `workspace_members` table exists
   - Default workspace created
   - Super admin user exists
   - All `workspace_id` columns added
   - All data migrated (no NULL workspace_ids)
   - Foreign keys created
   - Indexes created

6. **If any checks fail**, review the error messages and fix issues before proceeding

---

### Step 5: Manual Verification Queries

Run these queries to double-check:

```sql
-- Check default workspace
SELECT * FROM workspaces WHERE slug = 'default';

-- Check super admin
SELECT id, username, email, is_super_admin, workspace_id 
FROM users 
WHERE is_super_admin = TRUE;

-- Check data migration (should show 0 NULLs)
SELECT 
    'clients' AS table_name,
    COUNT(*) AS total,
    COUNT(workspace_id) AS with_workspace,
    COUNT(*) - COUNT(workspace_id) AS nulls
FROM clients
UNION ALL
SELECT 'projects', COUNT(*), COUNT(workspace_id), COUNT(*) - COUNT(workspace_id) FROM projects
UNION ALL
SELECT 'invoices', COUNT(*), COUNT(workspace_id), COUNT(*) - COUNT(workspace_id) FROM invoices;
```

**All `nulls` should be 0** - if not, run:
```sql
SET @default_workspace_id = (SELECT id FROM workspaces WHERE slug = 'default' LIMIT 1);
UPDATE clients SET workspace_id = @default_workspace_id WHERE workspace_id IS NULL;
UPDATE projects SET workspace_id = @default_workspace_id WHERE workspace_id IS NULL;
UPDATE invoices SET workspace_id = @default_workspace_id WHERE workspace_id IS NULL;
-- Repeat for other tables if needed
```

---

## 🚀 PART 2: Code Deployment to Render

### Step 1: Prepare Code for Deployment

1. **Commit all changes** to Git:
   ```bash
   git add .
   git commit -m "Multi-tenant migration: Phase 1-4 complete"
   git push origin main
   ```

2. **Verify .gitignore** includes:
   - `node_modules/`
   - `.env`
   - `uploads/`
   - Documentation files (already configured)

---

### Step 2: Update Backend Environment Variables

1. Log in to **Render Dashboard**
2. Go to your **Backend Web Service**
3. Navigate to **Environment** tab
4. **Add/Update** these variables:

```env
# Database (Production - from Hostinger)
DB_HOST=your-production-db-host
DB_USER=your-production-db-user
DB_PASSWORD=your-production-db-password
DB_NAME=your-production-db-name
DB_PORT=3306

# JWT Secret (must be strong - 32+ characters)
JWT_SECRET=your-production-jwt-secret-min-32-chars

# CORS (your frontend URL)
CORS_ORIGIN=https://your-frontend-url.onrender.com

# Application URLs
APP_NAME=Client Management System
APP_URL=https://your-frontend-url.onrender.com
API_URL=https://your-backend-url.onrender.com

# Credential Encryption (64-character hex)
CREDENTIAL_ENCRYPTION_KEY=your-64-character-hex-key

# Email Configuration (if using SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourdomain.com

# File Upload
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760

# Node Environment
NODE_ENV=production
PORT=10000
```

**Generate Secrets:**
```bash
# JWT Secret (32+ characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Credential Encryption Key (64-character hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### Step 3: Deploy Backend

1. In Render Dashboard, go to your **Backend Web Service**
2. Click **Manual Deploy** → **Deploy latest commit**
3. **OR** push to Git (auto-deploy will trigger)
4. Monitor the **Logs** tab for:
   - Build progress
   - Any errors
   - "Server started on port..." message
5. Wait for deployment to complete (usually 2-5 minutes)

**Verify Backend:**
- Check logs for "Server started" message
- Test API endpoint: `https://your-backend-url.onrender.com/api/health` (if available)
- Check for database connection errors

---

### Step 4: Update Frontend Environment Variables

1. Go to your **Frontend Static Site** in Render
2. Navigate to **Environment** tab
3. **Update** this variable:

```env
REACT_APP_API_URL=https://your-backend-url.onrender.com/api
```

---

### Step 5: Deploy Frontend

1. In Render Dashboard, go to your **Frontend Static Site**
2. Click **Manual Deploy** → **Deploy latest commit**
3. **OR** push to Git (auto-deploy will trigger)
4. Monitor the **Logs** tab for build progress
5. Wait for deployment to complete (usually 3-7 minutes)

---

### Step 6: Update Backend CORS (if needed)

1. Go back to **Backend Web Service**
2. Update `CORS_ORIGIN` to match your frontend URL exactly:
   ```env
   CORS_ORIGIN=https://your-frontend-url.onrender.com
   ```
3. Save and redeploy if needed

---

## ✅ PART 3: Post-Deployment Verification

### Step 1: Test Application Access

1. **Open frontend URL**: `https://your-frontend-url.onrender.com`
2. **Verify page loads** without errors
3. **Check browser console** for any errors

---

### Step 2: Test Authentication

1. **Login with Super Admin credentials** (your existing admin account)
2. **Verify login succeeds**
3. **Check user profile** - should show as "Super Admin"
4. **Verify workspace context** - should show default workspace or workspace selector

---

### Step 3: Test Core Functionality

Test these features to ensure everything works:

- [ ] **Dashboard** loads correctly
- [ ] **Clients** list shows existing clients
- [ ] **Projects** list shows existing projects
- [ ] **Invoices** list shows existing invoices
- [ ] **Create new client** (should assign to workspace)
- [ ] **Create new project** (should assign to workspace)
- [ ] **Financial Report** loads (test the fix we made)
- [ ] **Client Performance Report** loads (test the fix we made)
- [ ] **User Registration** (if enabled)
- [ ] **Email Verification** (if SMTP configured)

---

### Step 4: Verify Data Isolation

1. **Create a test user** (if registration is enabled)
2. **Login as test user**
3. **Verify**:
   - User can only see their workspace data
   - Cannot access other workspace data
   - Reports show only their workspace data

---

### Step 5: Check Server Logs

1. In Render Dashboard, check **Backend Logs**
2. Look for:
   - ✅ No database connection errors
   - ✅ No authentication errors
   - ✅ No workspace filtering errors
   - ✅ Successful API requests

---

## 🔄 Rollback Procedure (If Needed)

### If Migration Fails or Issues Occur

**Step 1: Restore Database Backup**

1. Log in to **Hostinger hPanel** → **phpMyAdmin**
2. Select your database
3. Click **Import** tab
4. Choose your backup file
5. Click **Go** to restore

**OR use rollback script:**

1. Open `database/migrations/001_multi_tenant_phase1_rollback.sql`
2. Copy and paste into phpMyAdmin SQL tab
3. Execute to remove multi-tenant structure
4. Restore from backup if needed

**Step 2: Revert Code Deployment**

1. In Render Dashboard, go to **Backend Web Service**
2. Click **Deploys** tab
3. Find the previous working deployment
4. Click **...** → **Redeploy**
5. Repeat for **Frontend** if needed

---

## 🐛 Troubleshooting

### Database Connection Errors

**Error**: `ECONNREFUSED` or `ETIMEDOUT`
- **Solution**: 
  - Verify database host, user, password in Render environment variables
  - Check if Hostinger allows remote MySQL connections
  - Verify firewall settings

**Error**: `Access denied for user`
- **Solution**: 
  - Verify database credentials
  - Check user permissions in Hostinger
  - Ensure user can connect from Render's IP

### Migration Errors

**Error**: `Table already exists`
- **Solution**: This is normal - the script uses `IF NOT EXISTS`, so it's safe to ignore

**Error**: `Column already exists`
- **Solution**: This is normal - the script checks before adding columns

**Error**: `Foreign key constraint fails`
- **Solution**: 
  - Check if all data has `workspace_id` set
  - Run verification queries to find NULL values
  - Fix NULL values before adding foreign keys

### Application Errors

**Error**: `Column 'workspace_id' in where clause is ambiguous`
- **Solution**: This should be fixed in the latest code. Restart backend server.

**Error**: Reports not loading
- **Solution**: 
  - Check backend logs for SQL errors
  - Verify workspace filtering is working
  - Test with super admin account first

**Error**: CORS errors
- **Solution**: 
  - Verify `CORS_ORIGIN` matches frontend URL exactly
  - Include `https://` in the URL
  - Check for trailing slashes

---

## 📊 Monitoring After Deployment

### Daily Checks (First Week)

1. **Check Render Logs** for errors
2. **Monitor database** usage in Hostinger
3. **Test critical features** daily
4. **Check user registrations** (if enabled)
5. **Monitor email delivery** (if SMTP configured)

### Weekly Checks

1. **Review error logs**
2. **Check database performance**
3. **Verify backups** are running
4. **Test all major features**

---

## 📝 Post-Deployment Notes

### Important Reminders

1. **Super Admin Access**: Your existing admin account is now a super admin with access to all workspaces
2. **Default Workspace**: All existing data is in the "Default Workspace"
3. **New Users**: New registrations will create their own workspaces
4. **Data Isolation**: Each workspace's data is isolated from others
5. **Reports**: Fixed to work correctly for both super admin and workspace users

### Next Steps (Future Phases)

- Phase 5: Workspace Management UI (for super admin)
- Workspace switcher component
- Workspace settings page
- User onboarding flow improvements

---

## 📞 Support & Resources

- **Migration Scripts**: `database/migrations/`
- **Verification Script**: `database/migrations/verify_phase1_migration.sql`
- **Rollback Script**: `database/migrations/001_multi_tenant_phase1_rollback.sql`
- **Render Docs**: [render.com/docs](https://render.com/docs)
- **Hostinger Support**: Check hPanel support section

---

## ✅ Deployment Checklist Summary

- [ ] Database backup created
- [ ] Migration script reviewed
- [ ] Migration executed successfully
- [ ] Verification script passed
- [ ] Code committed and pushed to Git
- [ ] Backend environment variables configured
- [ ] Backend deployed successfully
- [ ] Frontend environment variables configured
- [ ] Frontend deployed successfully
- [ ] Application tested and working
- [ ] All features verified
- [ ] Logs checked for errors
- [ ] Rollback plan ready (if needed)

---

**Last Updated**: January 2026
**Version**: 1.0

---

## 🎉 Deployment Complete!

Your multi-tenant Client & Project Management System is now live in production!

If you encounter any issues, refer to the troubleshooting section or check the server logs in Render Dashboard.
