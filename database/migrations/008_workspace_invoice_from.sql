-- Workspace Invoice "From" details (for PDF)
-- Used when generating invoice PDF: if set, show these in the From section; otherwise show workspace name only.
-- Only workspace administrators can update these; all workspace members can view.
-- Run once; if you get "Duplicate column" errors, the migration was already applied.

ALTER TABLE workspaces ADD COLUMN invoice_from_name VARCHAR(255) NULL COMMENT 'Display name in invoice From section';
ALTER TABLE workspaces ADD COLUMN invoice_from_email VARCHAR(255) NULL COMMENT 'Email in invoice From section';
ALTER TABLE workspaces ADD COLUMN invoice_from_phone VARCHAR(100) NULL COMMENT 'Contact number in invoice From section';
ALTER TABLE workspaces ADD COLUMN invoice_from_address TEXT NULL COMMENT 'Address in invoice From section';
