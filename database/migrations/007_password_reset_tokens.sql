-- Password reset tokens for "Forgot Password" flow
-- Run this migration on your database before using Forgot Password.
--
-- Note: The table is created WITHOUT a foreign key to users(id) so it works
-- on both local (often INT) and live (often INT UNSIGNED). If you get errno 150
-- on live, it was due to type mismatch. To add referential integrity where your
-- users.id type matches, run 007_password_reset_tokens_add_fk.sql after this.

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  token VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_token (token),
  INDEX idx_user_id (user_id),
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
