const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { authenticate } = require('../middleware/auth');
const { upload, uploadBatch, getJobStatus, listJobs, downloadZip, guestUpload, deleteJob } = require('../controllers/uploadController');

// ─── Rate limiters ────────────────────────────────────────────────────────────
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many uploads. Please wait a moment.' },
});

// Guest: 3 free tries
const guestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: { error: 'Free limit reached. Sign up for unlimited batch processing.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Authenticated routes ─────────────────────────────────────────────────────
router.post('/batch', authenticate, uploadLimiter, upload.array('images', 100), uploadBatch);
router.get('/jobs', authenticate, listJobs);
router.get('/job/:id', authenticate, getJobStatus);
router.delete('/job/:id', authenticate, deleteJob);
router.get('/download/:id', authenticate, downloadZip);

// ─── Guest route (no auth, 1 image only) ─────────────────────────────────────
router.post('/guest', guestLimiter, upload.single('image'), guestUpload);

module.exports = router;
