/**
 * Reset admin password for username 'admin' to 'admin123'.
 *
 * Usage (from project root, PowerShell):
 *   node database/reset_admin_password.js
 */

require('dotenv').config();

const bcrypt = require('bcryptjs');
const { query } = require('../server/config/database');

async function main() {
  const username = 'admin';
  const newPassword = 'admin123';
  const saltRounds = 12;

  const users = await query('SELECT id, username FROM users WHERE username = ? LIMIT 1', [username]);
  if (!users || users.length === 0) {
    console.error(`❌ User '${username}' not found in users table.`);
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
  await query('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE username = ?', [
    hashedPassword,
    username,
  ]);

  console.log(`✅ Password updated for user '${username}'. New password: ${newPassword}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Failed to reset admin password:', err);
  process.exit(1);
});

