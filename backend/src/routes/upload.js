const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { authenticate } = require('../middleware/auth');
const { upload, uploadBatch, getJobStatus, listJobs, downloadZip } = require('../controllers/uploadController');

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many uploads. Please wait a moment.' },
});

router.post('/batch', authenticate, uploadLimiter, upload.array('images', 100), uploadBatch);
router.get('/jobs', authenticate, listJobs);
router.get('/job/:id', authenticate, getJobStatus);
router.get('/download/:id', authenticate, downloadZip);

module.exports = router;
