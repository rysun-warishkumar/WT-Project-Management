-- =====================================================
-- SOFT DELETE FOR CLIENTS AND PROJECTS
-- =====================================================
-- When a user deletes a client or project, the row is kept
-- but marked as deleted (deleted_at set). Data remains for
-- auditing; user-facing lists and PM checks exclude deleted rows.
-- =====================================================

-- Add deleted_at to projects (nullable; NULL = not deleted)
-- Ignore error if column already exists.
ALTER TABLE projects ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL;
ALTER TABLE projects ADD INDEX idx_projects_deleted_at (deleted_at);

-- Add deleted_at to clients (nullable; NULL = not deleted)
ALTER TABLE clients ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL;
ALTER TABLE clients ADD INDEX idx_clients_deleted_at (deleted_at);
