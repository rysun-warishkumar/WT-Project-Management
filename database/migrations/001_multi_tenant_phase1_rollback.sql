-- =====================================================
-- MULTI-TENANT MIGRATION ROLLBACK - PHASE 1
-- Use this script to rollback Phase 1 migration
-- WARNING: This will remove multi-tenant structure
-- =====================================================

-- =====================================================
-- STEP 1: Remove Foreign Keys
-- =====================================================

-- Remove foreign keys
ALTER TABLE users DROP FOREIGN KEY IF EXISTS fk_users_workspace;
ALTER TABLE clients DROP FOREIGN KEY IF EXISTS fk_clients_workspace;
ALTER TABLE projects DROP FOREIGN KEY IF EXISTS fk_projects_workspace;
ALTER TABLE quotations DROP FOREIGN KEY IF EXISTS fk_quotations_workspace;
ALTER TABLE invoices DROP FOREIGN KEY IF EXISTS fk_invoices_workspace;
ALTER TABLE files DROP FOREIGN KEY IF EXISTS fk_files_workspace;
ALTER TABLE credentials DROP FOREIGN KEY IF EXISTS fk_credentials_workspace;
ALTER TABLE conversations DROP FOREIGN KEY IF EXISTS fk_conversations_workspace;
ALTER TABLE pm_workspaces DROP FOREIGN KEY IF EXISTS fk_pm_workspaces_main_workspace;

-- =====================================================
-- STEP 2: Remove workspace_id Columns
-- =====================================================

ALTER TABLE users DROP COLUMN IF EXISTS workspace_id;
ALTER TABLE users DROP COLUMN IF EXISTS is_super_admin;
ALTER TABLE users DROP COLUMN IF EXISTS email_verified;
ALTER TABLE users DROP COLUMN IF EXISTS email_verification_token;
ALTER TABLE users DROP COLUMN IF EXISTS registration_source;

ALTER TABLE clients DROP COLUMN IF EXISTS workspace_id;
ALTER TABLE projects DROP COLUMN IF EXISTS workspace_id;
ALTER TABLE quotations DROP COLUMN IF EXISTS workspace_id;
ALTER TABLE invoices DROP COLUMN IF EXISTS workspace_id;
ALTER TABLE files DROP COLUMN IF EXISTS workspace_id;
ALTER TABLE credentials DROP COLUMN IF EXISTS workspace_id;
ALTER TABLE conversations DROP COLUMN IF EXISTS workspace_id;
ALTER TABLE pm_workspaces DROP COLUMN IF EXISTS main_workspace_id;

-- =====================================================
-- STEP 3: Drop New Tables
-- =====================================================

DROP TABLE IF EXISTS workspace_members;
DROP TABLE IF EXISTS workspaces;

-- =====================================================
-- ROLLBACK COMPLETE
-- =====================================================
