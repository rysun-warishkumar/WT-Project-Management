# Quick Deployment Checklist
## Production Deployment - Multi-Tenant System

Use this checklist during deployment. Refer to `PRODUCTION_DEPLOYMENT_GUIDE.md` for detailed instructions.

---

## 🗄️ Database Migration (Hostinger)

### Pre-Migration
- [ ] **Backup database** (phpMyAdmin → Export → Quick → SQL)
- [ ] **Save backup file** securely
- [ ] **Review migration script**: `database/migrations/001_multi_tenant_phase1.sql`

### Execute Migration
- [ ] **Open phpMyAdmin** in Hostinger hPanel
- [ ] **Select production database**
- [ ] **Open SQL tab**
- [ ] **Copy entire script** from `001_multi_tenant_phase1.sql`
- [ ] **Paste and execute**
- [ ] **Wait for completion** (1-5 minutes)

### Verify Migration
- [ ] **Run verification script**: `database/migrations/verify_phase1_migration.sql`
- [ ] **Check all results pass**:
  - ✅ Workspaces table exists
  - ✅ Default workspace created
  - ✅ Super admin user exists
  - ✅ All workspace_id columns added
  - ✅ All data migrated (0 NULLs)
- [ ] **Manual check**: Run verification queries from guide

---

## 🚀 Code Deployment (Render)

### Backend Deployment
- [ ] **Commit all changes** to Git
- [ ] **Push to repository**
- [ ] **Update Render environment variables**:
  - [ ] `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
  - [ ] `JWT_SECRET` (32+ chars)
  - [ ] `CREDENTIAL_ENCRYPTION_KEY` (64-char hex)
  - [ ] `CORS_ORIGIN` (frontend URL)
  - [ ] `API_URL`, `APP_URL`
  - [ ] SMTP settings (if using)
- [ ] **Deploy backend** (Manual Deploy or auto-deploy)
- [ ] **Check logs** for "Server started" message
- [ ] **Verify no errors** in logs

### Frontend Deployment
- [ ] **Update environment variable**: `REACT_APP_API_URL`
- [ ] **Deploy frontend** (Manual Deploy or auto-deploy)
- [ ] **Check build logs** for success
- [ ] **Verify frontend loads** without errors

---

## ✅ Post-Deployment Testing

### Basic Functionality
- [ ] **Frontend loads** at production URL
- [ ] **Login works** with super admin credentials
- [ ] **Dashboard displays** correctly
- [ ] **Clients list** shows existing data
- [ ] **Projects list** shows existing data
- [ ] **Invoices list** shows existing data

### Critical Features
- [ ] **Financial Report** loads (test the fix)
- [ ] **Client Performance Report** loads (test the fix)
- [ ] **Create new client** works
- [ ] **Create new project** works
- [ ] **Data isolation** works (test with new user if possible)

### Server Health
- [ ] **Backend logs** show no errors
- [ ] **Database connection** successful
- [ ] **No CORS errors** in browser console
- [ ] **API requests** returning 200 status

---

## 🔄 Rollback Plan (If Needed)

- [ ] **Database rollback script ready**: `001_multi_tenant_phase1_rollback.sql`
- [ ] **Database backup file** accessible
- [ ] **Previous deployment** identified in Render
- [ ] **Rollback procedure** understood

---

## 📝 Quick Commands

### Generate Secrets
```bash
# JWT Secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Encryption Key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Verification Queries
```sql
-- Check default workspace
SELECT * FROM workspaces WHERE slug = 'default';

-- Check super admin
SELECT id, username, email, is_super_admin FROM users WHERE is_super_admin = TRUE;

-- Check data migration
SELECT COUNT(*) as total, COUNT(workspace_id) as migrated 
FROM clients WHERE workspace_id IS NULL;
```

---

## ⚠️ Critical Reminders

1. **Always backup database first**
2. **Test in staging first** (if available)
3. **Have rollback plan ready**
4. **Monitor logs during deployment**
5. **Test all features after deployment**
6. **Keep backup file until deployment is verified**

---

**Estimated Time**: 15-30 minutes total
**Downtime**: Minimal (migration is quick, deployment is automated)

---

For detailed instructions, see: `PRODUCTION_DEPLOYMENT_GUIDE.md`
