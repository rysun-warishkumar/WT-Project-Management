-- =====================================================
-- CLEAR ALL DATA (LOCAL) - KEEP SUPER ADMIN USER ONLY
-- =====================================================
-- Run this on your LOCAL database to remove all data
-- except the super admin user(s). Roles, permissions,
-- and role_permissions are kept. system_settings is kept.
--
-- INSTRUCTIONS:
-- 1. Backup your local database first.
-- 2. In MySQL/phpMyAdmin, select your local database
--    (e.g. client_management).
-- 3. If using phpMyAdmin: uncheck "Enable foreign key checks"
--    in the SQL tab so the script can run.
-- 4. Run this ENTIRE script in one go.
-- =====================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ---------- Invoice & payment data ----------
DELETE FROM invoice_items;
DELETE FROM payments;
DELETE FROM invoices;

-- ---------- Quotation data ----------
DELETE FROM quotation_items;
DELETE FROM quotations;

-- ---------- Files, credentials, conversations ----------
DELETE FROM files;
DELETE FROM credentials;
DELETE FROM conversations;

-- ---------- Notifications & activity ----------
DELETE FROM notifications;
DELETE FROM activity_logs;

-- ---------- User-project assignments ----------
DELETE FROM user_projects;

-- ---------- PM: Chat ----------
DELETE FROM pm_chat_message_reads;
DELETE FROM pm_chat_messages;
DELETE FROM pm_chat_participants;
DELETE FROM pm_chat_rooms;

-- ---------- PM: Tasks, links, time logs, comments, attachments ----------
DELETE FROM pm_task_ci_cd_links;
DELETE FROM pm_time_logs;
DELETE FROM pm_comments;
DELETE FROM pm_attachments;
DELETE FROM pm_task_links;
DELETE FROM pm_tasks;
DELETE FROM pm_user_stories;
DELETE FROM pm_epics;
DELETE FROM pm_sprints;

-- ---------- PM: CI/CD, assignment history, activities ----------
DELETE FROM pm_ci_cd_integrations;
DELETE FROM pm_assignment_history;
DELETE FROM pm_activities;

-- ---------- PM: Workspace members & workspaces ----------
DELETE FROM pm_workspace_members;
DELETE FROM pm_workspaces;

-- ---------- Main app: workspace members, inquiries ----------
DELETE FROM workspace_members;
DELETE FROM inquiries;

-- ---------- Projects, clients, workspaces ----------
DELETE FROM projects;
DELETE FROM clients;
DELETE FROM workspaces;

-- ---------- User roles: remove only for non-super-admin users ----------
DELETE ur FROM user_roles ur
INNER JOIN users u ON ur.user_id = u.id
WHERE COALESCE(u.is_super_admin, 0) = 0;

-- ---------- Users: delete all except super admin ----------
DELETE FROM users WHERE COALESCE(is_super_admin, 0) = 0;

-- ---------- Super admin: clear client_id and workspace_id (no longer valid) ----------
UPDATE users SET client_id = NULL, workspace_id = NULL WHERE COALESCE(is_super_admin, 0) = 1;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------- Optional: reset auto-increment on key tables (so new IDs start from 1) ----------
-- Uncomment if you want fresh IDs after clear:
-- ALTER TABLE users AUTO_INCREMENT = 1;
-- ALTER TABLE workspaces AUTO_INCREMENT = 1;
-- ALTER TABLE clients AUTO_INCREMENT = 1;
-- ALTER TABLE projects AUTO_INCREMENT = 1;
-- ALTER TABLE quotations AUTO_INCREMENT = 1;
-- ALTER TABLE invoices AUTO_INCREMENT = 1;

SELECT 'Clear complete. Super admin user(s) preserved.' AS message;
SELECT id, username, email, full_name, is_super_admin FROM users;
