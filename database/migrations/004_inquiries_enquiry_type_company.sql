-- Add enquiry_type and company to inquiries (Contact vs Get Started).
-- Run after 003_inquiries_table.sql. Skip if columns already exist.

ALTER TABLE inquiries
  ADD COLUMN enquiry_type VARCHAR(50) NOT NULL DEFAULT 'contact'
    COMMENT 'contact = Get in touch, get_started = Get started form';

ALTER TABLE inquiries
  ADD COLUMN company VARCHAR(255) NULL
    COMMENT 'From Get Started form';

CREATE INDEX idx_inquiries_enquiry_type ON inquiries (enquiry_type);
