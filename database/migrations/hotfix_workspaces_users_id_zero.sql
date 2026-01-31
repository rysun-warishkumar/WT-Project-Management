-- =====================================================
-- HOTFIX: Workspaces and users with id = 0 (run on LIVE)
-- =====================================================
-- Run this in phpMyAdmin on live to fix existing rows
-- with id=0 and restore AUTO_INCREMENT. Run after
-- 006_workspaces_active_soft_delete.sql if you use active.
-- =====================================================

-- 1) Fix workspaces with id=0 (assign next id, update refs, bump AUTO_INCREMENT)
SET @next = (SELECT COALESCE(MAX(id), 0) + 1 FROM workspaces WHERE id > 0);

-- Fix first workspace with id=0 (match by slug; adjust slug to match your row)
UPDATE workspaces SET id = @next WHERE id = 0 AND slug = 'rysun-workspace-2' LIMIT 1;
UPDATE users SET workspace_id = @next WHERE workspace_id = 0;
UPDATE workspace_members SET workspace_id = @next WHERE workspace_id = 0;
UPDATE clients SET workspace_id = @next WHERE workspace_id = 0;
SET @next = @next + 1;

-- Fix second workspace with id=0
UPDATE workspaces SET id = @next WHERE id = 0 AND slug = 'rysun-workspace-3' LIMIT 1;
UPDATE users SET workspace_id = @next WHERE workspace_id = 0;
UPDATE workspace_members SET workspace_id = @next WHERE workspace_id = 0;
UPDATE clients SET workspace_id = @next WHERE workspace_id = 0;
SET @next = @next + 1;

-- Restore workspaces AUTO_INCREMENT
SET @sql = CONCAT('ALTER TABLE workspaces AUTO_INCREMENT = ', @next);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2) Fix users with id=0 (assign next id, update refs, bump AUTO_INCREMENT)
SET @next = (SELECT COALESCE(MAX(id), 0) + 1 FROM users WHERE id > 0);

-- Fix user with id=0 (match by email; adjust email to match your row)
UPDATE users SET id = @next WHERE id = 0 AND email = 'testrysun@gmail.com' LIMIT 1;
UPDATE workspace_members SET user_id = @next WHERE user_id = 0;
UPDATE workspaces SET owner_id = @next WHERE owner_id = 0;
SET @next = @next + 1;

-- Restore users AUTO_INCREMENT
SET @sql = CONCAT('ALTER TABLE users AUTO_INCREMENT = ', @next);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =====================================================
-- If you have more id=0 rows: list them first:
--   SELECT id, slug FROM workspaces WHERE id = 0;
--   SELECT id, email FROM users WHERE id = 0;
-- Then run UPDATE ... WHERE id = 0 AND slug = '...' (or email = '...')
-- for each, incrementing @next and updating FKs each time.
-- =====================================================
