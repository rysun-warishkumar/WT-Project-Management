-- =====================================================
-- WORKSPACES: active flag for soft delete (0 = deleted, 1 = active)
-- =====================================================
-- Run on live (and local) so workspace "delete" can set active=0
-- and all reads filter by active=1. Id of workspace should never be 0;
-- use app-side fix on create when insertId=0.
-- =====================================================

-- Add active flag (1 = active, 0 = soft-deleted/hidden). Ignore error if column/index already exists.
ALTER TABLE workspaces ADD COLUMN active TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE workspaces ADD INDEX idx_workspaces_active (active);
