const { query } = require('../db');
const { sendApprovalEmail } = require('../services/email');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// ─── List all users ───────────────────────────────────────────────────────────
const listUsers = async (req, res) => {
  const { status, search, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  let whereClause = "WHERE 1=1";
  const params = [];
  let paramIdx = 1;

  if (status) {
    whereClause += ` AND u.status = $${paramIdx++}`;
    params.push(status);
  }

  if (search) {
    whereClause += ` AND (u.name ILIKE $${paramIdx} OR u.email ILIKE $${paramIdx} OR u.school_name ILIKE $${paramIdx})`;
    params.push(`%${search}%`);
    paramIdx++;
  }

  try {
    const countResult = await query(
      `SELECT COUNT(*) FROM users u ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
      `SELECT u.id, u.name, u.email, u.school_name, u.status, u.role,
              u.images_processed, u.quota_limit, u.transaction_id,
              u.payment_method, u.payment_note, u.payment_amount,
              u.created_at, u.approved_at,
              COUNT(DISTINCT j.id) as total_jobs,
              approver.name as approved_by_name
       FROM users u
       LEFT JOIN jobs j ON j.user_id = u.id
       LEFT JOIN users approver ON approver.id = u.approved_by
       ${whereClause}
       GROUP BY u.id, approver.name
       ORDER BY u.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, parseInt(limit), offset]
    );

    return res.json({
      users: result.rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('List users error:', err);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// ─── Approve user ─────────────────────────────────────────────────────────────
const approveUser = async (req, res) => {
  const { id } = req.params;
  const { quotaLimit = 500, sendEmail = true } = req.body;

  try {
    const userResult = await query('SELECT * FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    if (user.status === 'active') {
      return res.status(400).json({ error: 'User is already active' });
    }

    await query(
      `UPDATE users SET status = 'active', approved_by = $1, approved_at = NOW(), quota_limit = $2 WHERE id = $3`,
      [req.user.id, quotaLimit, id]
    );

    // Send approval email
    if (sendEmail) {
      try {
        await sendApprovalEmail(user.email, user.name);
      } catch (emailErr) {
        console.error('Failed to send approval email:', emailErr.message);
      }
    }

    // Audit log
    await query(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id, metadata)
       VALUES ($1, 'user_approved', 'user', $2, $3)`,
      [req.user.id, id, JSON.stringify({ quotaLimit })]
    );

    return res.json({ message: `User ${user.name} (${user.email}) has been approved and activated.` });
  } catch (err) {
    console.error('Approve user error:', err);
    return res.status(500).json({ error: 'Failed to approve user' });
  }
};

// ─── Suspend user ─────────────────────────────────────────────────────────────
const suspendUser = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  try {
    const userResult = await query('SELECT id, name, email, role FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const user = userResult.rows[0];
    if (user.role === 'admin') return res.status(403).json({ error: 'Cannot suspend admin' });

    await query(`UPDATE users SET status = 'suspended' WHERE id = $1`, [id]);

    await query(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id, metadata)
       VALUES ($1, 'user_suspended', 'user', $2, $3)`,
      [req.user.id, id, JSON.stringify({ reason })]
    );

    return res.json({ message: `User ${user.name} has been suspended.` });
  } catch (err) {
    console.error('Suspend user error:', err);
    return res.status(500).json({ error: 'Failed to suspend user' });
  }
};

// ─── Reactivate suspended user ────────────────────────────────────────────────
const reactivateUser = async (req, res) => {
  const { id } = req.params;
  try {
    await query(`UPDATE users SET status = 'active' WHERE id = $1`, [id]);
    await query(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id) VALUES ($1, 'user_reactivated', 'user', $2)`,
      [req.user.id, id]
    );
    return res.json({ message: 'User reactivated successfully.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to reactivate user' });
  }
};

// ─── Update user quota ────────────────────────────────────────────────────────
const updateQuota = async (req, res) => {
  const { id } = req.params;
  const { quotaLimit } = req.body;

  if (!quotaLimit || quotaLimit < 0) {
    return res.status(400).json({ error: 'Valid quota limit required' });
  }

  try {
    await query('UPDATE users SET quota_limit = $1 WHERE id = $2', [quotaLimit, id]);
    return res.json({ message: 'Quota updated successfully' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update quota' });
  }
};

// ─── Get admin dashboard stats ────────────────────────────────────────────────
const getStats = async (req, res) => {
  try {
    const [userStats, jobStats, processingStats] = await Promise.all([
      query(`
        SELECT
          COUNT(*) FILTER (WHERE role != 'admin') as total_users,
          COUNT(*) FILTER (WHERE status = 'active' AND role != 'admin') as active_users,
          COUNT(*) FILTER (WHERE status = 'pending_approval') as pending_users,
          COUNT(*) FILTER (WHERE status = 'suspended') as suspended_users,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days' AND role != 'admin') as new_this_month
        FROM users
      `),
      query(`
        SELECT
          COUNT(*) as total_jobs,
          COUNT(*) FILTER (WHERE status = 'completed') as completed_jobs,
          COUNT(*) FILTER (WHERE status = 'processing' OR status = 'queued') as active_jobs,
          COUNT(*) FILTER (WHERE status = 'failed') as failed_jobs,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as jobs_today
        FROM jobs
      `),
      query(`
        SELECT
          COALESCE(SUM(processed_files), 0) as total_images_processed,
          COALESCE(SUM(processed_files) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours'), 0) as images_today,
          COALESCE(SUM(processed_files) FILTER (WHERE created_at > NOW() - INTERVAL '30 days'), 0) as images_this_month
        FROM jobs WHERE status = 'completed'
      `),
    ]);

    return res.json({
      users: userStats.rows[0],
      jobs: jobStats.rows[0],
      processing: processingStats.rows[0],
    });
  } catch (err) {
    console.error('Stats error:', err);
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
};

// ─── List all jobs (admin view) ───────────────────────────────────────────────
const listAllJobs = async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  const params = [];
  let where = '';
  let paramIdx = 1;

  if (status) {
    where = `WHERE j.status = $${paramIdx++}`;
    params.push(status);
  }

  try {
    const result = await query(
      `SELECT j.*, u.name as user_name, u.email as user_email, u.school_name
       FROM jobs j JOIN users u ON u.id = j.user_id
       ${where}
       ORDER BY j.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, parseInt(limit), offset]
    );

    return res.json({ jobs: result.rows });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch jobs' });
  }
};

// ─── Update user role ──────────────────────────────────────────────────────────
const updateRole = async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!['admin', 'user'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    await query('UPDATE users SET role = $1 WHERE id = $2', [role, id]);
    return res.json({ message: 'Role updated successfully' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update role' });
  }
};

// ─── Update user password ──────────────────────────────────────────────────────
const updatePassword = async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);
    
    await query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [passwordHash, id]
    );
    
    return res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Password update error:', err);
    return res.status(500).json({ error: 'Failed to update password' });
  }
};

module.exports = {
  listUsers,
  approveUser,
  suspendUser,
  reactivateUser,
  updateQuota,
  updateRole,
  updatePassword,
  getStats,
  listAllJobs,
};
