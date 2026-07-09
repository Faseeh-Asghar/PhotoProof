const bcrypt = require('bcryptjs');
const { query } = require('../db');

/**
 * Seed the initial admin account.
 * Run once on startup — safe to call repeatedly (uses ON CONFLICT).
 */
async function seedAdmin() {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'faseehasghar167@gmail.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@PhotoProof2024';

    // Check if admin already has a real password hash
    const existing = await query('SELECT id, password_hash FROM users WHERE email = $1', [adminEmail]);

    if (existing.rows.length === 0) {
      const hash = await bcrypt.hash(adminPassword, 12);
      await query(
        `INSERT INTO users (name, email, password_hash, role, status)
         VALUES ($1, $2, $3, 'admin', 'active')
         ON CONFLICT (email) DO NOTHING`,
        ['Admin', adminEmail, hash]
      );
      console.log('✅ Admin account created:', adminEmail);
    } else if (existing.rows[0].password_hash.includes('placeholder')) {
      const hash = await bcrypt.hash(adminPassword, 12);
      await query('UPDATE users SET password_hash = $1 WHERE email = $2', [hash, adminEmail]);
      console.log('✅ Admin password updated:', adminEmail);
    }
  } catch (err) {
    console.error('Failed to seed admin:', err.message);
  }
}

module.exports = { seedAdmin };
