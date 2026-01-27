-- =====================================================
-- MULTI-TENANT MIGRATION - PHASE 1
-- Database Foundation
-- =====================================================
-- This migration adds multi-tenancy support to the system
-- IMPORTANT: Backup your database before running this!
-- =====================================================
-- 
-- INSTRUCTIONS FOR LOCAL USE:
-- 1. Open phpMyAdmin and select your database
-- 2. OR update the USE statement below with your database name
-- 3. Then run this script
-- =====================================================

-- Uncomment and update this line with your local database name:
-- USE your_local_database_name;

-- If using phpMyAdmin, you can skip the USE statement
-- Just select your database from the left sidebar before running

-- =====================================================
-- STEP 1: Create New Multi-Tenant Tables
-- =====================================================

-- Workspaces table
CREATE TABLE IF NOT EXISTS workspaces (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL COMMENT 'URL-friendly identifier',
    owner_id INT NOT NULL COMMENT 'User who created this workspace',
    plan_type ENUM('free', 'basic', 'premium', 'enterprise') DEFAULT 'free',
    max_users INT DEFAULT 5,
    max_projects INT DEFAULT 10,
    status ENUM('active', 'suspended', 'cancelled') DEFAULT 'active',
    subscription_id VARCHAR(255) NULL COMMENT 'For future billing integration',
    trial_ends_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_workspaces_owner (owner_id),
    INDEX idx_workspaces_slug (slug),
    INDEX idx_workspaces_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Workspace members table
CREATE TABLE IF NOT EXISTS workspace_members (
    id INT PRIMARY KEY AUTO_INCREMENT,
    workspace_id INT NOT NULL,
    user_id INT NOT NULL,
    role ENUM('admin', 'po', 'manager', 'accountant', 'viewer') DEFAULT 'viewer',
    invited_by INT NULL,
    invited_at DATETIME NULL,
    joined_at DATETIME NULL,
    status ENUM('pending', 'active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_workspace_user (workspace_id, user_id),
    INDEX idx_workspace_members_workspace (workspace_id),
    INDEX idx_workspace_members_user (user_id),
    INDEX idx_workspace_members_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- STEP 2: Modify Users Table
-- =====================================================

-- Add multi-tenant columns to users table
-- Check and add columns one by one (MySQL compatibility)

-- Add workspace_id
SET @col_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'workspace_id'
);

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE users ADD COLUMN workspace_id INT NULL AFTER id',
    'SELECT "Column workspace_id already exists" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add is_super_admin
SET @col_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'is_super_admin'
);

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE users ADD COLUMN is_super_admin BOOLEAN DEFAULT FALSE AFTER role',
    'SELECT "Column is_super_admin already exists" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add email_verified
SET @col_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'email_verified'
);

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE AFTER is_super_admin',
    'SELECT "Column email_verified already exists" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add email_verification_token
SET @col_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'email_verification_token'
);

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE users ADD COLUMN email_verification_token VARCHAR(255) NULL AFTER email_verified',
    'SELECT "Column email_verification_token already exists" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add registration_source
SET @col_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'registration_source'
);

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE users ADD COLUMN registration_source VARCHAR(50) DEFAULT ''web'' AFTER email_verification_token',
    'SELECT "Column registration_source already exists" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add foreign key for workspace_id (after workspaces table exists)
-- Note: This will be added after workspaces table is created
-- We'll add it in a separate statement to avoid dependency issues

-- Add indexes for users table
SET @idx_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_users_workspace');
SET @sql = IF(@idx_exists = 0, 'CREATE INDEX idx_users_workspace ON users(workspace_id)', 'SELECT "Index already exists" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_users_super_admin');
SET @sql = IF(@idx_exists = 0, 'CREATE INDEX idx_users_super_admin ON users(is_super_admin)', 'SELECT "Index already exists" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_users_email_verified');
SET @sql = IF(@idx_exists = 0, 'CREATE INDEX idx_users_email_verified ON users(email_verified)', 'SELECT "Index already exists" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================================
-- STEP 3: Create Default Workspace for Existing Data
-- =====================================================

-- Find the first admin user (or create one if none exists)
SET @admin_user_id = (SELECT id FROM users WHERE role = 'admin' OR username = 'admin' LIMIT 1);

-- If no admin exists, we'll use user ID 1 (or create a placeholder)
SET @admin_user_id = COALESCE(@admin_user_id, 1);

-- Create default workspace for existing data
INSERT INTO workspaces (
    name, 
    slug, 
    owner_id, 
    plan_type, 
    max_users, 
    max_projects, 
    status
) VALUES (
    'Default Workspace',
    'default',
    @admin_user_id,
    'enterprise',
    999,
    999,
    'active'
) ON DUPLICATE KEY UPDATE name = name;

-- Get the default workspace ID
SET @default_workspace_id = (SELECT id FROM workspaces WHERE slug = 'default' LIMIT 1);

-- =====================================================
-- STEP 4: Migrate Existing Admin to Super Admin
-- =====================================================

-- Set existing admin user as super admin
UPDATE users 
SET is_super_admin = TRUE,
    workspace_id = NULL,
    email_verified = TRUE
WHERE (role = 'admin' OR username = 'admin')
  AND is_super_admin = FALSE;

-- =====================================================
-- STEP 5: Add workspace_id to All Data Tables
-- =====================================================

-- Add workspace_id to data tables (with existence checks)

-- Clients table
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clients' AND COLUMN_NAME = 'workspace_id');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE clients ADD COLUMN workspace_id INT NULL AFTER id', 'SELECT "Column already exists" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Projects table
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'projects' AND COLUMN_NAME = 'workspace_id');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE projects ADD COLUMN workspace_id INT NULL AFTER id', 'SELECT "Column already exists" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Quotations table
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quotations' AND COLUMN_NAME = 'workspace_id');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE quotations ADD COLUMN workspace_id INT NULL AFTER id', 'SELECT "Column already exists" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Invoices table
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'workspace_id');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE invoices ADD COLUMN workspace_id INT NULL AFTER id', 'SELECT "Column already exists" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Files table
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'files' AND COLUMN_NAME = 'workspace_id');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE files ADD COLUMN workspace_id INT NULL AFTER id', 'SELECT "Column already exists" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Credentials table
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'credentials' AND COLUMN_NAME = 'workspace_id');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE credentials ADD COLUMN workspace_id INT NULL AFTER id', 'SELECT "Column already exists" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Conversations table
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'conversations' AND COLUMN_NAME = 'workspace_id');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE conversations ADD COLUMN workspace_id INT NULL AFTER id', 'SELECT "Column already exists" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PM Workspaces - Link to main workspaces table
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pm_workspaces' AND COLUMN_NAME = 'main_workspace_id');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE pm_workspaces ADD COLUMN main_workspace_id INT NULL AFTER id', 'SELECT "Column already exists" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================================
-- STEP 6: Migrate Existing Data to Default Workspace
-- =====================================================

-- Migrate clients
UPDATE clients 
SET workspace_id = @default_workspace_id 
WHERE workspace_id IS NULL;

-- Migrate projects
UPDATE projects 
SET workspace_id = @default_workspace_id 
WHERE workspace_id IS NULL;

-- Migrate quotations
UPDATE quotations 
SET workspace_id = @default_workspace_id 
WHERE workspace_id IS NULL;

-- Migrate invoices
UPDATE invoices 
SET workspace_id = @default_workspace_id 
WHERE workspace_id IS NULL;

-- Migrate files
UPDATE files 
SET workspace_id = @default_workspace_id 
WHERE workspace_id IS NULL;

-- Migrate credentials
UPDATE credentials 
SET workspace_id = @default_workspace_id 
WHERE workspace_id IS NULL;

-- Migrate conversations
UPDATE conversations 
SET workspace_id = @default_workspace_id 
WHERE workspace_id IS NULL;

-- Migrate PM workspaces (link to default workspace)
UPDATE pm_workspaces 
SET main_workspace_id = @default_workspace_id 
WHERE main_workspace_id IS NULL;

-- =====================================================
-- STEP 7: Add Foreign Keys and Indexes
-- =====================================================

-- Add foreign key for users.workspace_id (if not exists)
-- Check if foreign key exists before adding
SET @fk_exists = (
    SELECT COUNT(*) 
    FROM information_schema.TABLE_CONSTRAINTS 
    WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND CONSTRAINT_NAME = 'fk_users_workspace'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);

SET @sql = IF(@fk_exists = 0,
    'ALTER TABLE users ADD CONSTRAINT fk_users_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL',
    'SELECT "Foreign key fk_users_workspace already exists" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add foreign keys for all data tables
-- Clients
SET @fk_exists = (
    SELECT COUNT(*) 
    FROM information_schema.TABLE_CONSTRAINTS 
    WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'clients'
    AND CONSTRAINT_NAME = 'fk_clients_workspace'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);

SET @sql = IF(@fk_exists = 0,
    'ALTER TABLE clients ADD CONSTRAINT fk_clients_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE',
    'SELECT "Foreign key fk_clients_workspace already exists" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Projects
SET @fk_exists = (
    SELECT COUNT(*) 
    FROM information_schema.TABLE_CONSTRAINTS 
    WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'projects'
    AND CONSTRAINT_NAME = 'fk_projects_workspace'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);

SET @sql = IF(@fk_exists = 0,
    'ALTER TABLE projects ADD CONSTRAINT fk_projects_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE',
    'SELECT "Foreign key fk_projects_workspace already exists" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Quotations
SET @fk_exists = (
    SELECT COUNT(*) 
    FROM information_schema.TABLE_CONSTRAINTS 
    WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'quotations'
    AND CONSTRAINT_NAME = 'fk_quotations_workspace'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);

SET @sql = IF(@fk_exists = 0,
    'ALTER TABLE quotations ADD CONSTRAINT fk_quotations_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE',
    'SELECT "Foreign key fk_quotations_workspace already exists" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Invoices
SET @fk_exists = (
    SELECT COUNT(*) 
    FROM information_schema.TABLE_CONSTRAINTS 
    WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'invoices'
    AND CONSTRAINT_NAME = 'fk_invoices_workspace'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);

SET @sql = IF(@fk_exists = 0,
    'ALTER TABLE invoices ADD CONSTRAINT fk_invoices_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE',
    'SELECT "Foreign key fk_invoices_workspace already exists" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Files
SET @fk_exists = (
    SELECT COUNT(*) 
    FROM information_schema.TABLE_CONSTRAINTS 
    WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'files'
    AND CONSTRAINT_NAME = 'fk_files_workspace'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);

SET @sql = IF(@fk_exists = 0,
    'ALTER TABLE files ADD CONSTRAINT fk_files_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE',
    'SELECT "Foreign key fk_files_workspace already exists" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Credentials
SET @fk_exists = (
    SELECT COUNT(*) 
    FROM information_schema.TABLE_CONSTRAINTS 
    WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'credentials'
    AND CONSTRAINT_NAME = 'fk_credentials_workspace'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);

SET @sql = IF(@fk_exists = 0,
    'ALTER TABLE credentials ADD CONSTRAINT fk_credentials_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE',
    'SELECT "Foreign key fk_credentials_workspace already exists" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Conversations
SET @fk_exists = (
    SELECT COUNT(*) 
    FROM information_schema.TABLE_CONSTRAINTS 
    WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'conversations'
    AND CONSTRAINT_NAME = 'fk_conversations_workspace'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);

SET @sql = IF(@fk_exists = 0,
    'ALTER TABLE conversations ADD CONSTRAINT fk_conversations_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE',
    'SELECT "Foreign key fk_conversations_workspace already exists" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- PM Workspaces
SET @fk_exists = (
    SELECT COUNT(*) 
    FROM information_schema.TABLE_CONSTRAINTS 
    WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'pm_workspaces'
    AND CONSTRAINT_NAME = 'fk_pm_workspaces_main_workspace'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);

SET @sql = IF(@fk_exists = 0,
    'ALTER TABLE pm_workspaces ADD CONSTRAINT fk_pm_workspaces_main_workspace FOREIGN KEY (main_workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE',
    'SELECT "Foreign key fk_pm_workspaces_main_workspace already exists" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =====================================================
-- STEP 8: Add Indexes for Performance
-- =====================================================

-- Add indexes on workspace_id columns for better query performance
-- Check if index exists before creating (MySQL compatibility)

-- Clients workspace index
SET @idx_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clients' AND INDEX_NAME = 'idx_clients_workspace');
SET @sql = IF(@idx_exists = 0, 'CREATE INDEX idx_clients_workspace ON clients(workspace_id)', 'SELECT "Index already exists" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Projects workspace index
SET @idx_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'projects' AND INDEX_NAME = 'idx_projects_workspace');
SET @sql = IF(@idx_exists = 0, 'CREATE INDEX idx_projects_workspace ON projects(workspace_id)', 'SELECT "Index already exists" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Quotations workspace index
SET @idx_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quotations' AND INDEX_NAME = 'idx_quotations_workspace');
SET @sql = IF(@idx_exists = 0, 'CREATE INDEX idx_quotations_workspace ON quotations(workspace_id)', 'SELECT "Index already exists" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Invoices workspace index
SET @idx_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invoices' AND INDEX_NAME = 'idx_invoices_workspace');
SET @sql = IF(@idx_exists = 0, 'CREATE INDEX idx_invoices_workspace ON invoices(workspace_id)', 'SELECT "Index already exists" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Files workspace index
SET @idx_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'files' AND INDEX_NAME = 'idx_files_workspace');
SET @sql = IF(@idx_exists = 0, 'CREATE INDEX idx_files_workspace ON files(workspace_id)', 'SELECT "Index already exists" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Credentials workspace index
SET @idx_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'credentials' AND INDEX_NAME = 'idx_credentials_workspace');
SET @sql = IF(@idx_exists = 0, 'CREATE INDEX idx_credentials_workspace ON credentials(workspace_id)', 'SELECT "Index already exists" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Conversations workspace index
SET @idx_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'conversations' AND INDEX_NAME = 'idx_conversations_workspace');
SET @sql = IF(@idx_exists = 0, 'CREATE INDEX idx_conversations_workspace ON conversations(workspace_id)', 'SELECT "Index already exists" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PM Workspaces main_workspace_id index
SET @idx_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pm_workspaces' AND INDEX_NAME = 'idx_pm_workspaces_main_workspace');
SET @sql = IF(@idx_exists = 0, 'CREATE INDEX idx_pm_workspaces_main_workspace ON pm_workspaces(main_workspace_id)', 'SELECT "Index already exists" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Composite indexes for common queries
SET @idx_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clients' AND INDEX_NAME = 'idx_clients_workspace_status');
SET @sql = IF(@idx_exists = 0, 'CREATE INDEX idx_clients_workspace_status ON clients(workspace_id, status)', 'SELECT "Index already exists" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'projects' AND INDEX_NAME = 'idx_projects_workspace_status');
SET @sql = IF(@idx_exists = 0, 'CREATE INDEX idx_projects_workspace_status ON projects(workspace_id, status)', 'SELECT "Index already exists" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quotations' AND INDEX_NAME = 'idx_quotations_workspace_status');
SET @sql = IF(@idx_exists = 0, 'CREATE INDEX idx_quotations_workspace_status ON quotations(workspace_id, status)', 'SELECT "Index already exists" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invoices' AND INDEX_NAME = 'idx_invoices_workspace_status');
SET @sql = IF(@idx_exists = 0, 'CREATE INDEX idx_invoices_workspace_status ON invoices(workspace_id, status)', 'SELECT "Index already exists" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================================
-- STEP 9: Make workspace_id NOT NULL (After Data Migration)
-- =====================================================

-- Now that all data is migrated, make workspace_id required
-- Note: We'll do this carefully to avoid breaking existing data

-- First, ensure all records have workspace_id
UPDATE clients SET workspace_id = @default_workspace_id WHERE workspace_id IS NULL;
UPDATE projects SET workspace_id = @default_workspace_id WHERE workspace_id IS NULL;
UPDATE quotations SET workspace_id = @default_workspace_id WHERE workspace_id IS NULL;
UPDATE invoices SET workspace_id = @default_workspace_id WHERE workspace_id IS NULL;
UPDATE files SET workspace_id = @default_workspace_id WHERE workspace_id IS NULL;
UPDATE credentials SET workspace_id = @default_workspace_id WHERE workspace_id IS NULL;
UPDATE conversations SET workspace_id = @default_workspace_id WHERE workspace_id IS NULL;

-- Now make workspace_id NOT NULL (except for users table where super admin can have NULL)
ALTER TABLE clients MODIFY COLUMN workspace_id INT NOT NULL;
ALTER TABLE projects MODIFY COLUMN workspace_id INT NOT NULL;
ALTER TABLE quotations MODIFY COLUMN workspace_id INT NOT NULL;
ALTER TABLE invoices MODIFY COLUMN workspace_id INT NOT NULL;
ALTER TABLE files MODIFY COLUMN workspace_id INT NOT NULL;
ALTER TABLE credentials MODIFY COLUMN workspace_id INT NOT NULL;
ALTER TABLE conversations MODIFY COLUMN workspace_id INT NOT NULL;

-- =====================================================
-- STEP 10: Create Workspace Member for Existing Admin
-- =====================================================

-- Add existing admin user as member of default workspace
INSERT INTO workspace_members (
    workspace_id,
    user_id,
    role,
    status,
    joined_at
)
SELECT 
    @default_workspace_id,
    id,
    'admin',
    'active',
    NOW()
FROM users
WHERE is_super_admin = TRUE
  AND id NOT IN (
      SELECT user_id 
      FROM workspace_members 
      WHERE workspace_id = @default_workspace_id
  )
LIMIT 1;

-- =====================================================
-- STEP 11: Verification Queries
-- =====================================================

-- Verify migration
SELECT 'Migration Complete!' AS status;
SELECT COUNT(*) AS total_workspaces FROM workspaces;
SELECT COUNT(*) AS total_workspace_members FROM workspace_members;
SELECT COUNT(*) AS super_admins FROM users WHERE is_super_admin = TRUE;
SELECT COUNT(*) AS clients_in_default_workspace FROM clients WHERE workspace_id = @default_workspace_id;
SELECT COUNT(*) AS projects_in_default_workspace FROM projects WHERE workspace_id = @default_workspace_id;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Next Steps:
-- 1. Verify all data is correctly migrated
-- 2. Test application functionality
-- 3. Proceed to Phase 2: Authentication Updates
-- =====================================================
