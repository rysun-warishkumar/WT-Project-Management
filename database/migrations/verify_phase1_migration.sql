-- =====================================================
-- VERIFICATION SCRIPT - Phase 1 Migration
-- Run this after migration to verify everything worked
-- =====================================================

-- =====================================================
-- 1. Check New Tables Exist
-- =====================================================
SELECT 'Checking new tables...' AS step;

SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ workspaces table exists'
        ELSE '❌ workspaces table missing'
    END AS status
FROM information_schema.tables 
WHERE table_schema = DATABASE() 
AND table_name = 'workspaces';

SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ workspace_members table exists'
        ELSE '❌ workspace_members table missing'
    END AS status
FROM information_schema.tables 
WHERE table_schema = DATABASE() 
AND table_name = 'workspace_members';

-- =====================================================
-- 2. Check Default Workspace
-- =====================================================
SELECT 'Checking default workspace...' AS step;

SELECT 
    id,
    name,
    slug,
    owner_id,
    status,
    created_at
FROM workspaces 
WHERE slug = 'default';

-- =====================================================
-- 3. Check Super Admin User
-- =====================================================
SELECT 'Checking super admin user...' AS step;

SELECT 
    id,
    username,
    email,
    is_super_admin,
    workspace_id,
    email_verified
FROM users 
WHERE is_super_admin = TRUE;

-- =====================================================
-- 4. Check workspace_id Columns Added
-- =====================================================
SELECT 'Checking workspace_id columns...' AS step;

SELECT 
    table_name,
    column_name,
    is_nullable,
    column_type
FROM information_schema.columns
WHERE table_schema = DATABASE()
AND column_name = 'workspace_id'
ORDER BY table_name;

-- =====================================================
-- 5. Check Data Migration
-- =====================================================
SELECT 'Checking data migration...' AS step;

SELECT 
    'clients' AS table_name,
    COUNT(*) AS total_records,
    COUNT(workspace_id) AS records_with_workspace,
    COUNT(*) - COUNT(workspace_id) AS null_workspace_ids
FROM clients
UNION ALL
SELECT 
    'projects',
    COUNT(*),
    COUNT(workspace_id),
    COUNT(*) - COUNT(workspace_id)
FROM projects
UNION ALL
SELECT 
    'quotations',
    COUNT(*),
    COUNT(workspace_id),
    COUNT(*) - COUNT(workspace_id)
FROM quotations
UNION ALL
SELECT 
    'invoices',
    COUNT(*),
    COUNT(workspace_id),
    COUNT(*) - COUNT(workspace_id)
FROM invoices
UNION ALL
SELECT 
    'files',
    COUNT(*),
    COUNT(workspace_id),
    COUNT(*) - COUNT(workspace_id)
FROM files
UNION ALL
SELECT 
    'credentials',
    COUNT(*),
    COUNT(workspace_id),
    COUNT(*) - COUNT(workspace_id)
FROM credentials
UNION ALL
SELECT 
    'conversations',
    COUNT(*),
    COUNT(workspace_id),
    COUNT(*) - COUNT(workspace_id)
FROM conversations;

-- =====================================================
-- 6. Check Foreign Keys
-- =====================================================
SELECT 'Checking foreign keys...' AS step;

SELECT 
    table_name,
    constraint_name,
    referenced_table_name,
    referenced_column_name
FROM information_schema.key_column_usage
WHERE table_schema = DATABASE()
AND referenced_table_name = 'workspaces'
ORDER BY table_name;

-- =====================================================
-- 7. Check Indexes
-- =====================================================
SELECT 'Checking indexes...' AS step;

SELECT 
    table_name,
    index_name,
    column_name
FROM information_schema.statistics
WHERE table_schema = DATABASE()
AND index_name LIKE '%workspace%'
ORDER BY table_name, index_name;

-- =====================================================
-- 8. Check Workspace Members
-- =====================================================
SELECT 'Checking workspace members...' AS step;

SELECT 
    wm.id,
    w.name AS workspace_name,
    u.username,
    u.email,
    wm.role,
    wm.status,
    wm.joined_at
FROM workspace_members wm
JOIN workspaces w ON wm.workspace_id = w.id
JOIN users u ON wm.user_id = u.id;

-- =====================================================
-- 9. Summary Report
-- =====================================================
SELECT '=== MIGRATION SUMMARY ===' AS report;

SELECT 
    (SELECT COUNT(*) FROM workspaces) AS total_workspaces,
    (SELECT COUNT(*) FROM workspace_members) AS total_workspace_members,
    (SELECT COUNT(*) FROM users WHERE is_super_admin = TRUE) AS super_admins,
    (SELECT COUNT(*) FROM clients WHERE workspace_id IS NOT NULL) AS clients_migrated,
    (SELECT COUNT(*) FROM projects WHERE workspace_id IS NOT NULL) AS projects_migrated,
    (SELECT COUNT(*) FROM quotations WHERE workspace_id IS NOT NULL) AS quotations_migrated,
    (SELECT COUNT(*) FROM invoices WHERE workspace_id IS NOT NULL) AS invoices_migrated;

-- =====================================================
-- 10. Check for Issues
-- =====================================================
SELECT 'Checking for potential issues...' AS step;

-- Check for NULL workspace_ids (should be 0 after migration)
SELECT 
    'clients' AS table_name,
    COUNT(*) AS null_workspace_count
FROM clients 
WHERE workspace_id IS NULL
UNION ALL
SELECT 
    'projects',
    COUNT(*)
FROM projects 
WHERE workspace_id IS NULL
UNION ALL
SELECT 
    'quotations',
    COUNT(*)
FROM quotations 
WHERE workspace_id IS NULL
UNION ALL
SELECT 
    'invoices',
    COUNT(*)
FROM invoices 
WHERE workspace_id IS NULL;

-- If any NULLs found, they need to be fixed:
-- UPDATE table_name SET workspace_id = (SELECT id FROM workspaces WHERE slug = 'default') WHERE workspace_id IS NULL;

SELECT '=== VERIFICATION COMPLETE ===' AS status;
SELECT 'Review the results above. All checks should pass.' AS next_steps;
