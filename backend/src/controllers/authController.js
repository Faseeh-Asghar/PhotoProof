const bcrypt = require('bcryptjs');
const { validationResult, body } = require('express-validator');
const { query } = require('../db');
const { generateToken } = require('../middleware/auth');
const { sendWelcomeEmail, sendOtpEmail } = require('../services/email');
const crypto = require('crypto');

// ─── Register ────────────────────────────────────────────────────────────────
const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[A-Za-z])(?=.*\d)/)
    .withMessage('Password must contain letters and numbers'),
];

const register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, email, password, schoolName, transactionId, paymentMethod, paymentNote } = req.body;

  try {
    // Check duplicate email
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await query(
      `INSERT INTO users (name, email, password_hash, school_name, status, transaction_id, payment_method, payment_note)
       VALUES ($1, $2, $3, $4, 'pending_approval', $5, $6, $7)
       RETURNING id, name, email, school_name, status, created_at`,
      [name, email, passwordHash, schoolName, transactionId || null, paymentMethod || null, paymentNote || null]
    );

    const user = result.rows[0];

    // Log audit
    await query(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id, metadata)
       VALUES ($1, 'user_registered', 'user', $2, $3)`,
      [user.id, user.id, JSON.stringify({ email, schoolName })]
    );

    return res.status(201).json({
      message: 'Registration successful! Your account is pending payment verification. The admin will activate your account shortly.',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        status: user.status,
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
};

// ─── Login ────────────────────────────────────────────────────────────────────
const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required'),
];

const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    const result = await query(
      'SELECT id, name, email, password_hash, role, status, school_name, quota_limit, images_processed FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Account suspended. Contact admin.' });
    }

    if (user.status === 'pending_payment') {
      return res.status(403).json({
        error: 'Account pending payment',
        status: 'pending_payment',
        message: 'Please complete payment and wait for admin activation.',
      });
    }

    if (user.status === 'pending_approval') {
      return res.status(403).json({
        error: 'Account pending admin approval',
        status: 'pending_approval',
        message: 'Your payment is being verified. You will be notified once approved.',
      });
    }

    const token = generateToken(user.id);

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        schoolName: user.school_name,
        quotaLimit: user.quota_limit,
        imagesProcessed: user.images_processed,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
};

// ─── Get current user ─────────────────────────────────────────────────────────
const me = async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.name, u.email, u.role, u.status, u.school_name,
              u.quota_limit, u.images_processed, u.created_at,
              COUNT(j.id) as total_jobs,
              SUM(CASE WHEN j.status = 'completed' THEN j.processed_files ELSE 0 END) as total_processed
       FROM users u
       LEFT JOIN jobs j ON j.user_id = u.id
       WHERE u.id = $1
       GROUP BY u.id`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const u = result.rows[0];
    return res.json({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      schoolName: u.school_name,
      quotaLimit: u.quota_limit,
      imagesProcessed: u.images_processed,
      totalJobs: parseInt(u.total_jobs),
      totalProcessed: parseInt(u.total_processed) || 0,
      createdAt: u.created_at,
    });
  } catch (err) {
    console.error('Me error:', err);
    return res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

// ─── Change Password ──────────────────────────────────────────────────────────
const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'Invalid password data' });
  }

  try {
    const result = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];

    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user.id]);

    return res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    return res.status(500).json({ error: 'Failed to update password' });
  }
};

module.exports = {
  register,
  registerValidation,
  login,
  loginValidation,
  me,
  changePassword,
};
