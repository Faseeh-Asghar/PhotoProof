const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const { query } = require('../db');
const archiver = require('archiver');
const { imageQueue, PROCESSED_DIR } = require('../services/imageQueue');

const UPLOAD_DIR = path.join(__dirname, '../../uploads');
const ZIPS_DIR = path.join(__dirname, '../../zips');

// ─── Multer config ────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    require('fs').mkdirSync(UPLOAD_DIR, { recursive: true });
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    cb(null, uuidv4() + path.extname(file.originalname));
  }
});

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

  // Parse processing settings from request body
  const targetWidth = parseInt(req.body.targetWidth) || 600;
  const targetHeight = parseInt(req.body.targetHeight) || 800;
  const targetSizeKb = parseInt(req.body.targetSizeKb) || 20;

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
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Create pending job record
    await query(
      `INSERT INTO jobs (id, user_id, status, total_files, processed_files, failed_files, zip_url, zip_expires_at) 
       VALUES ($1, $2, 'processing', $3, 0, 0, $4, $5)`,
      [jobId, user.id, filesToProcess.length, `/api/upload/download/${jobId}`, expiresAt]
    );

    // Update user quota early
    await query(
      `UPDATE users SET images_processed = images_processed + $1 WHERE id = $2`,
      [filesToProcess.length, user.id]
    );

    // Queue files for processing
    for (const file of filesToProcess) {
      const fileId = uuidv4();
      
      // We rely on the body arrays if custom names were provided (this assumes frontend sends customNames[index] or similar, but for now we use originalname)
      await query(
        `INSERT INTO job_files (id, job_id, original_name, status, file_path) 
         VALUES ($1, $2, $3, 'pending', $4)`,
        [fileId, jobId, file.originalname, file.path]
      );

      await imageQueue.add({
        fileId,
        jobId,
        filePath: file.path,
        originalName: file.originalname,
        targetWidth,
        targetHeight,
        targetSizeKb
      }, { removeOnComplete: true });
    }

    return res.status(200).json({
      jobId,
      status: 'processing',
      totalFiles: filesToProcess.length,
      message: `Started processing ${filesToProcess.length} images.`,
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
                'sizeBytes', jf.processed_size_bytes,
                'processedPath', jf.processed_path
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
    
    // Check if we need to mark it as complete and zip it
    const completedCount = job.files.filter(f => f.status === 'completed').length;
    const failedCount = job.files.filter(f => f.status === 'failed').length;
    
    if (job.status === 'processing' && (completedCount + failedCount) === job.total_files) {
      job.status = 'completed';
      
      // Generate Zip
      await fs.mkdir(ZIPS_DIR, { recursive: true });
      const isSingle = job.total_files === 1;
      const zipPath = path.join(ZIPS_DIR, isSingle ? `${job.id}.jpeg` : `${job.id}.zip`);
      
      if (isSingle && completedCount === 1) {
        const singleFile = job.files.find(f => f.status === 'completed');
        await fs.rename(singleFile.processedPath, zipPath).catch(() => {});
      } else if (!isSingle && completedCount > 0) {
        const output = require('fs').createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 6 } });
        archive.pipe(output);
        
        job.files.forEach(f => {
          if (f.status === 'completed' && f.processedPath) {
             const customName = f.originalName;
             archive.file(f.processedPath, { name: customName });
          }
        });
        await archive.finalize();
        
        // Clean up individual processed images
        job.files.forEach(f => {
          if (f.status === 'completed' && f.processedPath) {
             fs.unlink(f.processedPath).catch(() => {});
          }
        });
      }
      
      await query(`UPDATE jobs SET status = 'completed', processed_files = $1, failed_files = $2 WHERE id = $3`, [completedCount, failedCount, job.id]);
      job.processed_files = completedCount;
      job.failed_files = failedCount;
    }

    const progressPct =
      job.total_files > 0
        ? Math.round(((job.processed_files + job.failed_files || completedCount + failedCount) / job.total_files) * 100)
        : 0;

    return res.json({
      id: job.id,
      status: job.status,
      totalFiles: job.total_files,
      processedFiles: job.processed_files || completedCount,
      failedFiles: job.failed_files || failedCount,
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

    let filePath = require('path').join(ZIPS_DIR, `${id}.png`);
    let isPng = true;
    
    try {
      await fs.access(filePath);
    } catch {
      // If PNG not found, fallback to ZIP
      isPng = false;
      filePath = require('path').join(ZIPS_DIR, `${id}.zip`);
      try {
        await fs.access(filePath);
      } catch {
        return res.status(404).json({ error: 'File not found. It may have been cleaned up.' });
      }
    }

    const filename = `photoproof_${new Date(job.created_at).toISOString().split('T')[0]}_${id.slice(0, 8)}${isPng ? '.png' : '.zip'}`;

    res.setHeader('Content-Type', isPng ? 'image/png' : 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const fileStream = require('fs').createReadStream(filePath);
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

  const { processImageBuffer } = require('../services/imageQueue');

  try {
    const finalBuffer = await processImageBuffer(req.file.path, 600, 800, 20);
    
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Disposition', `attachment; filename="photoproof_guest_${Date.now()}.jpg"`);
    
    res.send(finalBuffer);
  } catch (err) {
    console.error('Guest upload error:', err);
    res.status(500).json({ error: err.message || 'Processing failed.' });
  } finally {
    const fs = require('fs').promises;
    fs.unlink(req.file.path).catch(console.error);
  }
};

module.exports = { upload, uploadBatch, getJobStatus, listJobs, downloadZip, guestUpload };

