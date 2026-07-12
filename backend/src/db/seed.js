const bcrypt = require('bcryptjs');
const { query } = require('../db');

/**
 * Seed the initial admin account.
 * Run once on startup — safe to call repeatedly (uses ON CONFLICT DO UPDATE).
 */
async function seedAdmin() {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'faseehasghar167@gmail.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@PhotoProof2024';

    const hash = await bcrypt.hash(adminPassword, 12);

    // Upsert: always ensure admin exists with correct role/status/password
    await query(
      `INSERT INTO users (name, email, password_hash, role, status, quota_limit)
       VALUES ($1, $2, $3, 'admin', 'active', 999999)
       ON CONFLICT (email)
       DO UPDATE SET
         role = 'admin',
         status = 'active',
         password_hash = CASE
           WHEN users.role != 'admin' THEN $3
           ELSE users.password_hash
         END,
         quota_limit = 999999`,
      ['Admin', adminEmail, hash]
    );

    console.log('✅ Admin account ready:', adminEmail);
  } catch (err) {
    console.error('Failed to seed admin:', err.message);
  }
}

module.exports = { seedAdmin };
