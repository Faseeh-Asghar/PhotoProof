const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { authenticate } = require('../middleware/auth');
const { upload, uploadBatchProcessed, getJobStatus, listJobs, downloadZip, deleteJob } = require('../controllers/uploadController');

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many uploads. Please wait a moment.' },
});

router.post('/batch-processed', authenticate, uploadLimiter, upload.array('images', 100), uploadBatchProcessed);
router.get('/jobs', authenticate, listJobs);
router.get('/job/:id', authenticate, getJobStatus);
router.delete('/job/:id', authenticate, deleteJob);
router.get('/download/:id', authenticate, downloadZip);

module.exports = router;
