# Database Import Instructions for Hostinger

## ⚠️ Important: Before Importing

### Step 1: Update Database Name (if needed)

If your Hostinger database name is different from `client_management`, you need to update it in the SQL file:

1. Open `database/complete_schema.sql`
2. Find this line (around line 14):
   ```sql
   CREATE DATABASE IF NOT EXISTS client_management;
   USE client_management;
   ```
3. Replace `client_management` with your actual database name
4. Save the file

**Example**: If your database is `u524544702_clientdb`, change it to:
```sql
CREATE DATABASE IF NOT EXISTS u524544702_clientdb;
USE u524544702_clientdb;
```

### Step 2: Import via phpMyAdmin

1. Log in to Hostinger hPanel
2. Go to **phpMyAdmin**
3. Select your database from the left sidebar
4. Click the **Import** tab
5. Click **Choose File** and select `database/complete_schema.sql`
6. Scroll down and click **Go**
7. Wait for import to complete
8. Check for any errors

### Step 3: Verify Import

After import, verify these tables exist:
- ✅ `clients`
- ✅ `users`
- ✅ `projects`
- ✅ `quotations`
- ✅ `invoices`
- ✅ `roles`
- ✅ `permissions`
- ✅ `pm_workspaces`
- ✅ `pm_chat_rooms`
- And all other tables...

---

## 🐛 Common Import Errors

### Error: "Foreign key constraint is incorrectly formed"

**Cause**: Table creation order issue (already fixed in latest schema)

**Solution**: 
- Use the latest `complete_schema.sql` file
- The schema now creates `clients` table before `users` table

### Error: "Table already exists"

**Cause**: Tables already exist in database

**Solution**:
- Option 1: Drop existing tables first (be careful - this deletes data!)
- Option 2: Use `CREATE TABLE IF NOT EXISTS` (already in schema)
- Option 3: Import only missing tables

### Error: "Unknown database"

**Cause**: Database name mismatch

**Solution**:
- Update database name in SQL file (see Step 1 above)
- Or create the database first in Hostinger hPanel

### Error: "Access denied"

**Cause**: Database user doesn't have CREATE privileges

**Solution**:
- In Hostinger, ensure database user has all privileges
- Or use the main database user account

---

## ✅ Success Indicators

After successful import, you should see:
- All tables created without errors
- Default admin user inserted
- Default roles and permissions inserted
- No error messages in phpMyAdmin

---

## 🔍 Verify Default Data

After import, check:

1. **Admin User**:
   ```sql
   SELECT * FROM users WHERE username = 'admin';
   ```
   Should return 1 row with admin user

2. **Default Roles**:
   ```sql
   SELECT * FROM roles;
   ```
   Should return 6 roles: admin, po, manager, accountant, client, viewer

3. **Permissions**:
   ```sql
   SELECT COUNT(*) FROM permissions;
   ```
   Should return many permissions (50+)

---

## 📝 Next Steps

After successful import:
1. Update admin password (if needed)
2. Configure Render environment variables with database credentials
3. Test database connection from Render
4. Start using the application!

---

**Note**: The schema file uses `CREATE TABLE IF NOT EXISTS`, so it's safe to run multiple times. However, it will insert default data each time (use `INSERT ... ON DUPLICATE KEY UPDATE` to avoid duplicates).
