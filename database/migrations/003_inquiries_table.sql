-- Inquiries from the public marketing website (Get in touch + Get started forms).
-- Stored in the main app DB; only super admins can view them via the CMS.

CREATE TABLE IF NOT EXISTS inquiries (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  subject VARCHAR(500) DEFAULT NULL,
  message TEXT NOT NULL,
  enquiry_type VARCHAR(50) NOT NULL DEFAULT 'contact' COMMENT 'contact | get_started',
  company VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_inquiries_created_at (created_at),
  INDEX idx_inquiries_email (email),
  INDEX idx_inquiries_enquiry_type (enquiry_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
