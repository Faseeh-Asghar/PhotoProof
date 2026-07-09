const Queue = require('bull');
const archiver = require('archiver');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { processImage, validateImage } = require('./imageProcessor');
const { query } = require('../db');

// ─── Queue Setup ─────────────────────────────────────────────────────────────
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const imageQueue = new Queue('image-processing', REDIS_URL, {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 50,
    removeOnFail: 100,
  },
});

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
const PROCESSED_DIR = path.join(process.cwd(), 'processed');
const ZIPS_DIR = path.join(process.cwd(), 'zips');

// Ensure dirs exist
[UPLOAD_DIR, PROCESSED_DIR, ZIPS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ─── Worker: Process single image ────────────────────────────────────────────
imageQueue.process('process-image', 5, async (job) => {
  const { fileId, jobId, inputPath, outputFileName } = job.data;

  try {
    // Update file status to processing
    await query(`UPDATE job_files SET status = 'processing', updated_at = NOW() WHERE id = $1`, [fileId]);

    // Read input file
    const inputBuffer = await fsPromises.readFile(inputPath);

    // Validate
    const { valid, errors } = await validateImage(inputBuffer, outputFileName);
    if (!valid) {
      throw new Error(errors.join(', '));
    }

    // Process
    const result = await processImage(inputBuffer);

    // Save processed file
    const outputPath = path.join(PROCESSED_DIR, jobId, outputFileName);
    await fsPromises.mkdir(path.dirname(outputPath), { recursive: true });
    await fsPromises.writeFile(outputPath, result.buffer);

    // Update DB
    await query(
      `UPDATE job_files
       SET status = 'completed', processed_name = $1,
           processed_size_bytes = $2, updated_at = NOW()
       WHERE id = $3`,
      [outputFileName, result.buffer.length, fileId]
    );

    // Update job progress
    await query(
      `UPDATE jobs
       SET processed_files = processed_files + 1, updated_at = NOW()
       WHERE id = $1`,
      [jobId]
    );

    job.progress(100);
    return { success: true, sizeKB: result.sizeKB };
  } catch (err) {
    console.error(`Image processing failed for file ${fileId}:`, err.message);

    await query(
      `UPDATE job_files SET status = 'failed', error_message = $1, updated_at = NOW() WHERE id = $2`,
      [err.message.substring(0, 500), fileId]
    );

    await query(
      `UPDATE jobs SET failed_files = failed_files + 1, updated_at = NOW() WHERE id = $1`,
      [jobId]
    );

    throw err;
  }
});

// ─── Worker: Finalize job (create ZIP) ───────────────────────────────────────
imageQueue.process('finalize-job', 2, async (job) => {
  const { jobId } = job.data;

  try {
    const jobDir = path.join(PROCESSED_DIR, jobId);
    const zipPath = path.join(ZIPS_DIR, `${jobId}.zip`);

    // Check processed files exist
    const files = await fsPromises.readdir(jobDir).catch(() => []);
    if (files.length === 0) {
      throw new Error('No processed files found');
    }

    // Create ZIP
    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 6 } });

      output.on('close', resolve);
      archive.on('error', reject);
      archive.pipe(output);
      archive.directory(jobDir, false);
      archive.finalize();
    });

    // Set expiry (7 days for paid users)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const zipUrl = `/api/upload/download/${jobId}`;

    // Update job as completed
    const jobResult = await query(
      `UPDATE jobs
       SET status = CASE
             WHEN failed_files = 0 THEN 'completed'
             WHEN processed_files = 0 THEN 'failed'
             ELSE 'partial'
           END,
           zip_url = $1, zip_expires_at = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING user_id, processed_files`,
      [zipUrl, expiresAt, jobId]
    );

    // Update user's total images processed
    if (jobResult.rows.length > 0) {
      const { user_id, processed_files } = jobResult.rows[0];
      await query(
        'UPDATE users SET images_processed = images_processed + $1 WHERE id = $2',
        [processed_files, user_id]
      );
    }

    // Cleanup input files to save disk space
    try {
      const inputJobDir = path.join(UPLOAD_DIR, jobId);
      await fsPromises.rm(inputJobDir, { recursive: true, force: true });
    } catch (e) { /* non-critical */ }

    return { success: true, zipPath };
  } catch (err) {
    console.error(`Job finalization failed for ${jobId}:`, err.message);
    await query(
      `UPDATE jobs SET status = 'failed', error_message = $1 WHERE id = $2`,
      [err.message, jobId]
    );
    throw err;
  }
});

// ─── Queue event logging ──────────────────────────────────────────────────────
imageQueue.on('failed', (job, err) => {
  console.error(`Job ${job.id} (${job.name}) failed after ${job.attemptsMade} attempts:`, err.message);
});

imageQueue.on('completed', (job) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`Job ${job.id} (${job.name}) completed`);
  }
});

// ─── Scheduled cleanup: Delete expired ZIPs ──────────────────────────────────
setInterval(async () => {
  try {
    const expired = await query(
      `SELECT id FROM jobs WHERE zip_expires_at < NOW() AND zip_url IS NOT NULL`
    );

    for (const job of expired.rows) {
      const zipPath = path.join(ZIPS_DIR, `${job.id}.zip`);
      await fsPromises.unlink(zipPath).catch(() => {});
      await query(`UPDATE jobs SET zip_url = NULL WHERE id = $1`, [job.id]);
    }
  } catch (err) { /* non-critical */ }
}, 60 * 60 * 1000); // Every hour

module.exports = { imageQueue, UPLOAD_DIR, PROCESSED_DIR, ZIPS_DIR };
