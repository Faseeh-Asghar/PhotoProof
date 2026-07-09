const sharp = require('sharp');
const axios = require('axios');
const path = require('path');
const fs = require('fs').promises;

const FAPIHUB_API_KEY = process.env.FAPIHUB_API_KEY;
const USE_BG_REMOVAL = process.env.USE_BG_REMOVAL === 'true';
const TARGET_WIDTH = 600;
const TARGET_HEIGHT = 800;
const MIN_SIZE_KB = 10;
const MAX_SIZE_KB = 20;

/**
 * Remove background via FAPIhub API
 * Returns transparent PNG buffer
 */
async function removeBackground(inputBuffer) {
  if (!FAPIHUB_API_KEY || !USE_BG_REMOVAL) {
    // If no API key, skip background removal and just use sharp flatten
    return null;
  }

  try {
    const FormData = require('form-data');
    const form = new FormData();
    form.append('image', inputBuffer, { filename: 'image.jpg', contentType: 'image/jpeg' });

    const response = await axios.post(
      'https://api.fapihub.com/v1/remove-background',
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${FAPIHUB_API_KEY}`,
        },
        responseType: 'arraybuffer',
        timeout: 30000,
      }
    );

    return Buffer.from(response.data);
  } catch (err) {
    console.warn('Background removal API failed, using fallback:', err.message);
    return null;
  }
}

/**
 * Main image processing function
 * Takes input buffer, returns processed JPEG buffer
 * Output: 600x800, white background, 10–20 KB
 */
async function processImage(inputBuffer) {
  // Step 1: Try background removal (optional, via FAPIhub)
  const transparentPng = await removeBackground(inputBuffer);

  // Step 2: Create white 600x800 base
  const whiteBase = await sharp({
    create: {
      width: TARGET_WIDTH,
      height: TARGET_HEIGHT,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .png()
    .toBuffer();

  let compositeBuffer;

  if (transparentPng) {
    // If background was removed — composite transparent subject over white base
    const subject = await sharp(transparentPng)
      .resize(TARGET_WIDTH, TARGET_HEIGHT, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();

    compositeBuffer = await sharp(whiteBase)
      .composite([{ input: subject, top: 0, left: 0 }])
      .png()
      .toBuffer();
  } else {
    // No background removal — flatten existing photo onto white background
    compositeBuffer = await sharp(inputBuffer)
      .resize(TARGET_WIDTH, TARGET_HEIGHT, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255 },
      })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .png()
      .toBuffer();
  }

  // Step 3: Adaptive quality compression to hit 10–20 KB target
  let quality = 82;
  let output;
  let attempts = 0;
  const maxAttempts = 15;

  do {
    output = await sharp(compositeBuffer)
      .jpeg({
        quality,
        progressive: true,
        mozjpeg: true,
        chromaSubsampling: '4:2:0',
      })
      .toBuffer();

    const sizeKB = output.length / 1024;

    if (sizeKB >= MIN_SIZE_KB && sizeKB <= MAX_SIZE_KB) break;
    if (sizeKB > MAX_SIZE_KB) quality -= 5;
    if (sizeKB < MIN_SIZE_KB) quality += 3;

    // Clamp quality
    quality = Math.max(5, Math.min(95, quality));
    attempts++;
  } while (attempts < maxAttempts);

  const finalSizeKB = Math.round(output.length / 1024 * 10) / 10;

  return {
    buffer: output,
    width: TARGET_WIDTH,
    height: TARGET_HEIGHT,
    sizeKB: finalSizeKB,
    quality,
  };
}

/**
 * Validate uploaded image file
 */
async function validateImage(buffer, originalName) {
  const errors = [];

  // Check file size (max 20 MB input)
  if (buffer.length > 20 * 1024 * 1024) {
    errors.push(`${originalName}: File too large (max 20MB)`);
    return { valid: false, errors };
  }

  // Check it's a real image
  try {
    const meta = await sharp(buffer).metadata();
    const allowedFormats = ['jpeg', 'png', 'webp', 'tiff', 'bmp', 'heif'];
    if (!allowedFormats.includes(meta.format)) {
      errors.push(`${originalName}: Unsupported format (${meta.format})`);
      return { valid: false, errors };
    }

    // Minimum dimensions
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
