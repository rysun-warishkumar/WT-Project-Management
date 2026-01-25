# Fix: Foreign Key Constraint Error (#1005)

## Problem

When importing `complete_schema.sql` in phpMyAdmin, you get this error:

```
Error #1005: Can't create table `users` (errno: 150 "Foreign key constraint is incorrectly formed")
```

## Root Cause

The `users` table has a foreign key that references `clients(id)`, but the `clients` table was being created **after** the `users` table. MySQL cannot create a foreign key to a table that doesn't exist yet.

## ✅ Solution Applied

The schema has been **fixed** in the latest version. The `clients` table is now created **before** the `users` table.

### What Changed:

**Before (❌ Wrong Order)**:
1. Create `users` table (with FK to `clients`)
2. Create `clients` table

**After (✅ Correct Order)**:
1. Create `clients` table
2. Create `users` table (with FK to `clients`)

## How to Fix Your Import

### Option 1: Use the Fixed Schema (Recommended)

1. Download the latest `database/complete_schema.sql` file
2. Update the database name in the file (see line 15):
   ```sql
   USE your_database_name;
   ```
3. Import the file again in phpMyAdmin

### Option 2: Manual Fix (If you already have the file)

1. Open `database/complete_schema.sql` in a text editor
2. Find the `CREATE TABLE clients` section (around line 24)
3. Find the `CREATE TABLE users` section (around line 49)
4. Make sure `clients` table comes **before** `users` table
5. Save and re-import

### Option 3: Import in Two Steps

1. **Step 1**: Import only the `clients` table creation
2. **Step 2**: Import the rest of the schema

---

## Verification

After importing, verify the tables were created:

```sql
SHOW TABLES;
```

You should see:
- `clients` ✅
- `users` ✅
- `projects` ✅
- And all other tables...

---

## Additional Notes

- The schema now uses `CREATE TABLE IF NOT EXISTS`, so it's safe to run multiple times
- Foreign key constraints are properly ordered
- All dependencies are resolved before foreign keys are created

---

**Status**: ✅ Fixed in latest schema version
