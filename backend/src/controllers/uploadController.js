const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const { query } = require('../db');
const { imageQueue, UPLOAD_DIR, ZIPS_DIR } = require('../services/queueWorker');
const { validateImage } = require('../services/imageProcessor');

// ─── Multer config ────────────────────────────────────────────────────────────
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/tiff', 'image/bmp', 'image/heic', 'image/heif'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB per file
    files: 100, // max 100 files per batch
  },
});

// ─── Upload batch ─────────────────────────────────────────────────────────────
const uploadBatch = async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  const user = req.user;

  // Check quota
  const remaining = user.quota_limit - user.images_processed;
  if (remaining <= 0) {
    return res.status(403).json({
      error: 'Image quota exceeded',
      quotaLimit: user.quota_limit,
      imagesProcessed: user.images_processed,
    });
  }

  const filesToProcess = req.files.slice(0, Math.min(req.files.length, remaining));
  const jobId = uuidv4();

  try {
    // Create job record
    await query(
      `INSERT INTO jobs (id, user_id, status, total_files) VALUES ($1, $2, 'queued', $3)`,
      [jobId, user.id, filesToProcess.length]
    );

    // Save files and create job_file records
    const jobUploadDir = path.join(UPLOAD_DIR, jobId);
    await fs.mkdir(jobUploadDir, { recursive: true });

    const jobFiles = [];
    const validationErrors = [];

    for (const file of filesToProcess) {
      const { valid, errors } = await validateImage(file.buffer, file.originalname);
      if (!valid) {
        validationErrors.push(...errors);
        continue;
      }

      const fileId = uuidv4();
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      const storedName = `${fileId}${ext}`;
      const outputName = `processed_${path.basename(file.originalname, ext)}.jpg`;
      const inputPath = path.join(jobUploadDir, storedName);

      await fs.writeFile(inputPath, file.buffer);

      await query(
        `INSERT INTO job_files (id, job_id, original_name, stored_name, processed_name, status, file_size_bytes)
         VALUES ($1, $2, $3, $4, $5, 'queued', $6)`,
        [fileId, jobId, file.originalname, storedName, outputName, file.buffer.length]
      );

      jobFiles.push({ fileId, inputPath, outputName });
    }

    // Update total if some were invalid
    if (validationErrors.length > 0) {
      await query(
        `UPDATE jobs SET total_files = $1, failed_files = $2 WHERE id = $3`,
        [jobFiles.length, validationErrors.length, jobId]
      );
    }

    if (jobFiles.length === 0) {
      await query(`UPDATE jobs SET status = 'failed', error_message = $1 WHERE id = $2`, [
        'All files failed validation',
        jobId,
      ]);
      return res.status(400).json({ error: 'All files failed validation', details: validationErrors });
    }

    // Set job to processing
    await query(`UPDATE jobs SET status = 'processing' WHERE id = $1`, [jobId]);

    // Queue all image processing jobs
    const queueJobs = jobFiles.map((f) =>
      imageQueue.add('process-image', {
        fileId: f.fileId,
        jobId,
        inputPath: f.inputPath,
        outputFileName: f.outputName,
      })
    );

    await Promise.all(queueJobs);

    // Queue finalization job (runs after all process-image jobs)
    // We use a delayed job that polls — or we use a separate mechanism
    // For simplicity, finalize-job is triggered after all images are done (via a callback approach)
    scheduleFinalization(jobId, jobFiles.length);

    return res.status(202).json({
      jobId,
      status: 'processing',
      totalFiles: jobFiles.length,
      skipped: validationErrors.length,
      validationErrors: validationErrors.slice(0, 10),
      message: `Processing ${jobFiles.length} image(s). Check status at /api/upload/job/${jobId}`,
    });
  } catch (err) {
    console.error('Upload batch error:', err);
    await query(`UPDATE jobs SET status = 'failed', error_message = $1 WHERE id = $2`, [
      err.message,
      jobId,
    ]).catch(() => {});
    return res.status(500).json({ error: 'Upload failed. Please try again.' });
  }
};

// Poll-based finalization: check every 3 seconds if all files are done
function scheduleFinalization(jobId, totalFiles) {
  const maxWait = 10 * 60 * 1000; // 10 minutes max
  const interval = 3000;
  const startTime = Date.now();

  const timer = setInterval(async () => {
    try {
      if (Date.now() - startTime > maxWait) {
        clearInterval(timer);
        imageQueue.add('finalize-job', { jobId });
        return;
      }

      const result = await query(
        `SELECT processed_files, failed_files FROM jobs WHERE id = $1`,
        [jobId]
      );

      if (result.rows.length === 0) {
        clearInterval(timer);
        return;
      }

      const { processed_files, failed_files } = result.rows[0];
      if (processed_files + failed_files >= totalFiles) {
        clearInterval(timer);
        imageQueue.add('finalize-job', { jobId });
      }
    } catch (err) {
      clearInterval(timer);
      imageQueue.add('finalize-job', { jobId });
    }
  }, interval);
}

// ─── Get job status ───────────────────────────────────────────────────────────
const getJobStatus = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query(
      `SELECT j.*, 
              json_agg(json_build_object(
                'id', jf.id, 'originalName', jf.original_name,
                'status', jf.status, 'error', jf.error_message,
                'sizeBytes', jf.processed_size_bytes
              ) ORDER BY jf.created_at) as files
       FROM jobs j
       LEFT JOIN job_files jf ON jf.job_id = j.id
       WHERE j.id = $1 AND j.user_id = $2
       GROUP BY j.id`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const job = result.rows[0];
    const progressPct =
      job.total_files > 0
        ? Math.round(((job.processed_files + job.failed_files) / job.total_files) * 100)
        : 0;

    return res.json({
      id: job.id,
      status: job.status,
      totalFiles: job.total_files,
      processedFiles: job.processed_files,
      failedFiles: job.failed_files,
      progress: progressPct,
      downloadUrl: job.zip_url,
      expiresAt: job.zip_expires_at,
      createdAt: job.created_at,
      files: job.files,
    });
  } catch (err) {
    console.error('Job status error:', err);
    return res.status(500).json({ error: 'Failed to fetch job status' });
  }
};

// ─── List user's jobs ─────────────────────────────────────────────────────────
const listJobs = async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  try {
    const result = await query(
      `SELECT id, status, total_files, processed_files, failed_files,
              zip_url, zip_expires_at, created_at, updated_at
       FROM jobs
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, parseInt(limit), offset]
    );

    const countResult = await query(`SELECT COUNT(*) FROM jobs WHERE user_id = $1`, [req.user.id]);

    return res.json({
      jobs: result.rows,
      total: parseInt(countResult.rows[0].count),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch jobs' });
  }
};

// ─── Download ZIP ─────────────────────────────────────────────────────────────
const downloadZip = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query(
      `SELECT j.*, u.name as user_name
       FROM jobs j JOIN users u ON u.id = j.user_id
       WHERE j.id = $1 AND (j.user_id = $2 OR $3 = 'admin')`,
      [id, req.user.id, req.user.role]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const job = result.rows[0];

    if (job.status !== 'completed' && job.status !== 'partial') {
      return res.status(400).json({ error: `Job is not ready (status: ${job.status})` });
    }

    if (job.zip_expires_at && new Date(job.zip_expires_at) < new Date()) {
      return res.status(410).json({ error: 'Download link has expired' });
    }

    const zipPath = require('path').join(ZIPS_DIR, `${id}.zip`);

    try {
      await fs.access(zipPath);
    } catch {
      return res.status(404).json({ error: 'ZIP file not found. It may have been cleaned up.' });
    }

    const filename = `photoproof_${new Date(job.created_at).toISOString().split('T')[0]}_${id.slice(0, 8)}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const fileStream = require('fs').createReadStream(zipPath);
    fileStream.pipe(res);
  } catch (err) {
    console.error('Download error:', err);
    return res.status(500).json({ error: 'Download failed' });
  }
};


// ─── Guest Upload (no auth, 1 image, returns processed file directly) ─────────
const guestUpload = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image uploaded. Please select one image file.' });
  }

  try {
    const { processImage } = require('../services/imageProcessor');

    // Process in-memory — no DB, no queue
    const processedBuffer = await processImage(req.file.buffer, req.file.originalname);

    const outputName = `photoproof_guest_${Date.now()}.jpg`;

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Disposition', `attachment; filename="${outputName}"`);
    res.setHeader('X-PhotoProof-Size', processedBuffer.length);
    res.send(processedBuffer);
  } catch (err) {
    console.error('Guest upload error:', err);
    return res.status(500).json({ error: 'Processing failed. Please try a different image.' });
  }
};

module.exports = { upload, uploadBatch, getJobStatus, listJobs, downloadZip, guestUpload };

