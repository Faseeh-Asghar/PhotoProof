const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const {
  listUsers, approveUser, suspendUser, reactivateUser,
  updateQuota, getStats, listAllJobs
} = require('../controllers/adminController');

router.use(authenticate, requireAdmin);

router.get('/stats', getStats);
router.get('/users', listUsers);
router.patch('/users/:id/approve', approveUser);
router.patch('/users/:id/suspend', suspendUser);
router.patch('/users/:id/reactivate', reactivateUser);
router.patch('/users/:id/quota', updateQuota);
router.get('/jobs', listAllJobs);

module.exports = router;
