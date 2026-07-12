const sharp = require('sharp');
const axios = require('axios');

const FAPIHUB_API_KEY = process.env.FAPIHUB_API_KEY;
const USE_BG_REMOVAL = process.env.USE_BG_REMOVAL === 'true';
const TARGET_WIDTH = 600;
const TARGET_HEIGHT = 800;
const MIN_SIZE_KB = 10;
const MAX_SIZE_KB = 20;

/**
 * Remove background via FAPIhub API (optional premium path)
 * Returns transparent PNG buffer or null on failure
 */
async function removeBackground(inputBuffer) {
  if (!FAPIHUB_API_KEY || !USE_BG_REMOVAL) return null;

  try {
    const FormData = require('form-data');
    const form = new FormData();
    form.append('image', inputBuffer, { filename: 'image.jpg', contentType: 'image/jpeg' });

    const response = await axios.post(
      'https://api.fapihub.com/v1/remove-background',
      form,
      {
        headers: { ...form.getHeaders(), Authorization: `Bearer ${FAPIHUB_API_KEY}` },
        responseType: 'arraybuffer',
        timeout: 30000,
      }
    );

    return Buffer.from(response.data);
  } catch (err) {
    console.warn('Background removal API failed, using local fallback:', err.message);
    return null;
  }
}

/**
 * Local background replacement using corner-sampling color detection.
 * Samples the 4 corners of the image to determine the background color,
 * then replaces pixels within that color range with white.
 * Works well for solid-color passport photo backgrounds (blue, gray, green, red).
 */
async function replaceBackgroundLocally(inputBuffer) {
  try {
    const image = sharp(inputBuffer).removeAlpha();
    const meta = await image.metadata();
    const { width, height } = meta;

    // Get raw RGB pixel data
    const rawData = await image.raw().toBuffer();
    const channels = 3;

    // ── Sample background color from corners (10x10 areas) ──
    const sampleSize = 10;
    const cornerOffsets = [
      [0, 0],                        // top-left
      [Math.max(0, width - sampleSize), 0],  // top-right
      [0, Math.max(0, height - sampleSize)], // bottom-left
      [Math.max(0, width - sampleSize), Math.max(0, height - sampleSize)], // bottom-right
    ];

    let totalR = 0, totalG = 0, totalB = 0, count = 0;

    for (const [startX, startY] of cornerOffsets) {
      for (let dy = 0; dy < sampleSize && startY + dy < height; dy++) {
        for (let dx = 0; dx < sampleSize && startX + dx < width; dx++) {
          const idx = ((startY + dy) * width + (startX + dx)) * channels;
          totalR += rawData[idx];
          totalG += rawData[idx + 1];
          totalB += rawData[idx + 2];
          count++;
        }
      }
    }

    const bgR = totalR / count;
    const bgG = totalG / count;
    const bgB = totalB / count;

    console.log(`Detected background color: rgb(${Math.round(bgR)}, ${Math.round(bgG)}, ${Math.round(bgB)})`);

    // ── Replace background pixels with white ──
    // Use a generous threshold to handle gradients and lighting variation
    const threshold = 55;
    const result = Buffer.from(rawData);

    for (let i = 0; i < result.length; i += channels) {
      const r = result[i];
      const g = result[i + 1];
      const b = result[i + 2];

      // Euclidean distance from detected background color
      const dist = Math.sqrt(
        (r - bgR) ** 2 +
        (g - bgG) ** 2 +
        (b - bgB) ** 2
      );

      if (dist < threshold) {
        result[i]     = 255; // R
        result[i + 1] = 255; // G
        result[i + 2] = 255; // B
      }
    }

    // Rebuild image from raw pixel buffer
    return sharp(result, {
      raw: { width, height, channels },
    }).png().toBuffer();

  } catch (err) {
    console.warn('Local background replacement failed, using original:', err.message);
    return null;
  }
}

/**
 * Main image processing function
 * Takes input buffer, returns processed JPEG buffer (600x800, white bg, 10-20 KB)
 */
async function processImage(inputBuffer) {
  // ── Step 1: Background removal ──────────────────────────────────────────────
  // Try premium API first, then local color-key replacement, then plain resize
  let subjectBuffer = null;

  const apiResult = await removeBackground(inputBuffer);

  if (apiResult) {
    // Premium path: API returned a transparent PNG
    subjectBuffer = apiResult;
    console.log('Using API background removal');
  } else {
    // Local path: color-key replacement
    subjectBuffer = await replaceBackgroundLocally(inputBuffer);
    console.log('Using local background replacement');
  }

  // ── Step 2: Build 600x800 white canvas ──────────────────────────────────────
  const whiteCanvas = await sharp({
    create: {
      width: TARGET_WIDTH,
      height: TARGET_HEIGHT,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  }).png().toBuffer();

  // ── Step 3: Composite subject onto white canvas ───────────────────────────
  let compositeBuffer;

  if (subjectBuffer) {
    // Resize subject to fit within canvas (contain = keep aspect ratio, pad with transparency)
    const resizedSubject = await sharp(subjectBuffer)
      .resize(TARGET_WIDTH, TARGET_HEIGHT, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      })
      .png()
      .toBuffer();

    compositeBuffer = await sharp(whiteCanvas)
      .composite([{ input: resizedSubject, top: 0, left: 0 }])
      .png()
      .toBuffer();
  } else {
    // Absolute fallback: just resize with white letterboxing
    compositeBuffer = await sharp(inputBuffer)
      .resize(TARGET_WIDTH, TARGET_HEIGHT, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255 },
      })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .png()
      .toBuffer();
  }

  // ── Step 4: Compress to JPEG within 10–20 KB ──────────────────────────────
  let quality = 82;
  let output;
  let attempts = 0;
  const maxAttempts = 20;

  do {
    output = await sharp(compositeBuffer)
      .jpeg({
        quality,
        progressive: true,
        chromaSubsampling: '4:2:0',
      })
      .toBuffer();

    const sizeKB = output.length / 1024;

    if (sizeKB >= MIN_SIZE_KB && sizeKB <= MAX_SIZE_KB) break;
    if (sizeKB > MAX_SIZE_KB) quality -= 5;
    if (sizeKB < MIN_SIZE_KB) quality += 3;

    quality = Math.max(5, Math.min(95, quality));
    attempts++;
  } while (attempts < maxAttempts);

  console.log(`Output: ${(output.length / 1024).toFixed(1)} KB at quality ${quality}`);
  return output;
}

/**
 * Validate uploaded image file
 */
async function validateImage(buffer, originalName) {
  const errors = [];

  if (buffer.length > 20 * 1024 * 1024) {
    errors.push(`${originalName}: File too large (max 20MB)`);
    return { valid: false, errors };
  }

  try {
    const meta = await sharp(buffer).metadata();
    const allowedFormats = ['jpeg', 'png', 'webp', 'tiff', 'bmp', 'heif'];
    if (!allowedFormats.includes(meta.format)) {
      errors.push(`${originalName}: Unsupported format (${meta.format})`);
      return { valid: false, errors };
    }
    if (meta.width < 50 || meta.height < 50) {
      errors.push(`${originalName}: Image too small (min 50x50px)`);
      return { valid: false, errors };
    }
  } catch (err) {
    errors.push(`${originalName}: Invalid or corrupt image file`);
    return { valid: false, errors };
  }

  return { valid: true, errors: [] };
}

module.exports = { processImage, validateImage, removeBackground };
