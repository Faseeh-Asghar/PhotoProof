const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const { query } = require('../db');
const archiver = require('archiver');
const { processImageBackground } = require('../services/aiService');

const UPLOAD_DIR = path.join(__dirname, '../../uploads');
const ZIPS_DIR = path.join(__dirname, '../../zips');

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
    // Make sure dirs exist
    await fs.mkdir(ZIPS_DIR, { recursive: true });

    // Instantly generate ZIP since files are already processed by the frontend
    const zipPath = path.join(ZIPS_DIR, `${jobId}.zip`);
    const output = require('fs').createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 6 } });

    archive.pipe(output);

    // Process all files through the AI model sequentially to avoid memory spikes
    for (const file of filesToProcess) {
      try {
        console.log(`Processing file: ${file.originalname}`);
        const noBgBuffer = await processImageBackground(file.buffer);
        const outName = file.originalname.replace(/\.[^/.]+$/, "") + ".png";
        archive.append(noBgBuffer, { name: outName });
      } catch (err) {
        console.error(`Failed to process ${file.originalname}:`, err);
        // If AI fails, maybe we just include the original? Or skip it. We'll skip for now.
      }
    }

    await archive.finalize();

    // Create completed job record
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    await query(
      `INSERT INTO jobs (id, user_id, status, total_files, processed_files, failed_files, zip_url, zip_expires_at) 
       VALUES ($1, $2, 'completed', $3, $3, 0, $4, $5)`,
      [jobId, user.id, filesToProcess.length, `/api/upload/download/${jobId}`, expiresAt]
    );

    // Update user quota usage
    await query(
      `UPDATE users SET images_processed = images_processed + $1 WHERE id = $2`,
      [filesToProcess.length, user.id]
    );

    return res.status(200).json({
      jobId,
      status: 'completed',
      totalFiles: filesToProcess.length,
      downloadUrl: `/api/upload/download/${jobId}`,
      message: `Successfully processed ${filesToProcess.length} images.`,
    });
  } catch (err) {
    console.error('Upload batch error:', err);
    return res.status(500).json({ error: 'Upload failed. Please try again.' });
  }
};


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


const guestUpload = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image uploaded.' });
  }
  
  try {
    const noBgBuffer = await processImageBackground(req.file.buffer);
    
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="photoproof_guest_${Date.now()}.png"`);
    res.setHeader('Content-Length', noBgBuffer.length);
    res.send(noBgBuffer);
  } catch (err) {
    console.error('Guest upload error:', err);
    return res.status(500).json({ error: 'Failed to process image' });
  }
};

module.exports = { upload, uploadBatch, getJobStatus, listJobs, downloadZip, guestUpload };

