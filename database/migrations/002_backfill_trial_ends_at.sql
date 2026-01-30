-- =====================================================
-- Backfill trial_ends_at for existing workspaces
-- =====================================================
-- Run this if you already have workspaces without trial_ends_at.
-- New workspaces get trial_ends_at set on creation (30 days).
-- This sets trial_ends_at = created_at + 30 days for rows where
-- trial_ends_at IS NULL. Adjust the INTERVAL if you want a different trial length.
-- =====================================================

UPDATE workspaces
SET trial_ends_at = DATE_ADD(created_at, INTERVAL 30 DAY)
WHERE trial_ends_at IS NULL;
