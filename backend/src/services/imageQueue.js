const Queue = require('bull');
const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const { removeBackground } = require('@imgly/background-removal-node');
const { query } = require('../db');

const imageQueue = new Queue('image-processing', {
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
  },
});

const PROCESSED_DIR = path.join(__dirname, '../../processed');

async function processImageJob(job) {
  const { fileId, filePath, jobId, targetWidth, targetHeight, targetSizeKb, originalName } = job.data;
  
  try {
    await fs.mkdir(PROCESSED_DIR, { recursive: true });

    job.progress(10); // Starting

    const finalBuffer = await processImageBuffer(filePath, targetWidth, targetHeight, targetSizeKb, (progress) => job.progress(progress));
    
    // Save final
    const finalPath = path.join(PROCESSED_DIR, `${jobId}_${path.basename(filePath)}`);
    await fs.writeFile(finalPath, finalBuffer);

    // Clean up original upload
    await fs.unlink(filePath).catch(() => {});

    // Update database
    await query(
      `UPDATE job_files SET status = 'completed', processed_name = $1, processed_size_bytes = $2 WHERE id = $3`,
      [finalPath, finalBuffer.length, fileId]
    );

    job.progress(100);
    return { finalPath, originalName, size: finalBuffer.length };

  } catch (err) {
    console.error(`Error processing job ${job.id}:`, err);
    await query(`UPDATE job_files SET status = 'failed', error_message = $1 WHERE id = $2`, [err.message, fileId]);
    throw err;
  }
}

async function processImageBuffer(filePath, targetWidth, targetHeight, targetSizeKb, reportProgress = () => {}) {
  // 1. Read input image and run AI Background Removal
  const fileUrl = 'file://' + filePath.replace(/\\/g, '/');
  
  let bgRemovedBlob;
  try {
    const config = {
      debug: false
    };
    bgRemovedBlob = await removeBackground(fileUrl, config);
  } catch (err) {
    console.error("AI Background Removal threw an error:", err);
    throw new Error("AI engine failed to process the image. Please try a different photo.");
  }

  const arrayBuf = await bgRemovedBlob.arrayBuffer();
  const bgRemovedBuffer = Buffer.from(arrayBuf);

  if (bgRemovedBuffer.length < 100) {
    throw new Error("AI engine returned an empty output. This may be due to low server memory or a corrupted input file.");
  }

  reportProgress(60);

  // 2. Perform Connected Component Analysis and Bounding Box Extraction
  const { data, info } = await sharp(bgRemovedBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const visited = new Uint8Array(width * height);
  const blobSizes = [];
  let currentBlobId = 1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const alpha = data[i * 4 + 3];
      
      if (alpha > 128 && visited[i] === 0) {
        let size = 0;
        const stack = [i];
        visited[i] = currentBlobId;
        
        while (stack.length > 0) {
          const curr = stack.pop();
          size++;
          
          const cx = curr % width;
          const cy = Math.floor(curr / width);
          
          const neighbors = [
            cx > 0 ? curr - 1 : -1,
            cx < width - 1 ? curr + 1 : -1,
            cy > 0 ? curr - width : -1,
            cy < height - 1 ? curr + width : -1
          ];
          
          for (const n of neighbors) {
            if (n !== -1 && visited[n] === 0 && data[n * 4 + 3] > 128) {
              visited[n] = currentBlobId;
              stack.push(n);
            }
          }
        }
        blobSizes.push({ id: currentBlobId, size });
        currentBlobId++;
      }
    }
  }

  blobSizes.sort((a, b) => b.size - a.size);
  const largestBlobId = blobSizes.length > 0 ? blobSizes[0].id : -1;

  if (largestBlobId === -1) {
    throw new Error("No subject detected in image. Please upload a clearer photo.");
  }

  let minX = width, minY = height, maxX = 0, maxY = 0;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (visited[i] !== largestBlobId) {
        data[i * 4 + 3] = 0; 
      } else {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (minX > maxX || minY > maxY) {
    minX = 0; minY = 0; maxX = width; maxY = height;
  }

  const cropWidth = maxX - minX;
  const cropHeight = maxY - minY;

  const cleanedBuffer = await sharp(data, {
    raw: { width, height, channels: 4 }
  })
    .extract({ left: minX, top: minY, width: cropWidth, height: cropHeight })
    .toBuffer();

  reportProgress(80);

  const outWidth = targetWidth || 600;
  const outHeight = targetHeight || 800;
  
  const paddingX = outWidth * 0.15;
  const paddingTop = outHeight * 0.08;
  const availableW = outWidth - paddingX;
  const availableH = outHeight - paddingTop;

  const scale = Math.min(availableW / cropWidth, availableH / cropHeight);
  const drawW = Math.round(cropWidth * scale);
  const drawH = Math.round(cropHeight * scale);
  
  const resizedSubject = await sharp(cleanedBuffer)
    .resize(drawW, drawH, { fit: 'fill' })
    .toBuffer();

  const finalX = Math.round((outWidth - drawW) / 2);
  const finalY = outHeight - drawH;

  let quality = 90;
  let finalBuffer;
  const maxBytes = (targetSizeKb || 20) * 1024;

  for (let attempts = 0; attempts < 5; attempts++) {
    finalBuffer = await sharp({
      create: {
        width: outWidth,
        height: outHeight,
        channels: 3,
        background: { r: 255, g: 255, b: 255 }
      }
    })
    .composite([{ input: resizedSubject, top: finalY, left: finalX }])
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();

    if (finalBuffer.length <= maxBytes) {
      break;
    }
    quality = Math.max(10, quality - 20);
  }
  return finalBuffer;
}

imageQueue.process(2, processImageJob);

module.exports = { imageQueue, PROCESSED_DIR, processImageBuffer };
