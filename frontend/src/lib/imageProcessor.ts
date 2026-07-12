import { removeBackground, Config } from '@imgly/background-removal';

export const TARGET_WIDTH = 600;
export const TARGET_HEIGHT = 800;
export const MIN_SIZE_KB = 10;
export const MAX_SIZE_KB = 20;

const config: Config = {
  debug: false,
};

/**
 * Removes background and composites onto a 600x800 white canvas, compressing to 10-20KB JPEG
 */
export async function processImageLocally(file: File, onProgress?: (progress: string) => void): Promise<File> {
  // 1. Remove Background using AI
  if (onProgress) onProgress('Removing background (AI)...');
  
  // NOTE: On first run, it downloads the ~40MB WASM model into browser cache.
  // Subsequent runs are instant.
  const transparentBlob = await removeBackground(file, {
    ...config,
    progress: (key, current, total) => {
      if (onProgress && total) {
        const pct = Math.round((current / total) * 100);
        onProgress(`Loading AI model... ${pct}%`);
      }
    }
  });

  if (onProgress) onProgress('Applying white background & resizing...');

  // 2. Draw to Canvas
  const canvas = document.createElement('canvas');
  canvas.width = TARGET_WIDTH;
  canvas.height = TARGET_HEIGHT;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) throw new Error('Canvas not supported');

  // Fill white background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, TARGET_WIDTH, TARGET_HEIGHT);

  // Load transparent image into an Image element
  const img = new Image();
  const imageUrl = URL.createObjectURL(transparentBlob);
  
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = imageUrl;
  });

  // Calculate dimensions to "contain" the image
  const scale = Math.min(TARGET_WIDTH / img.width, TARGET_HEIGHT / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  const x = (TARGET_WIDTH - w) / 2;
  const y = (TARGET_HEIGHT - h) / 2;

  // Draw subject onto white canvas
  ctx.drawImage(img, x, y, w, h);
  URL.revokeObjectURL(imageUrl);

  if (onProgress) onProgress('Optimizing size (10-20KB)...');

  // 3. Compress iteratively to hit 10-20KB target
  let quality = 0.82;
  let finalBlob: Blob | null = null;
  let attempts = 0;
  const maxAttempts = 15;

  do {
    finalBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
    });

    if (!finalBlob) break;

    const sizeKB = finalBlob.size / 1024;
    if (sizeKB >= MIN_SIZE_KB && sizeKB <= MAX_SIZE_KB) break;

    if (sizeKB > MAX_SIZE_KB) quality -= 0.05;
    if (sizeKB < MIN_SIZE_KB) quality += 0.03;

    quality = Math.max(0.05, Math.min(0.95, quality));
    attempts++;
  } while (attempts < maxAttempts);

  if (!finalBlob) {
    throw new Error('Failed to generate image blob');
  }

  // 4. Return as a File object
  const cleanName = file.name.replace(/\.[^/.]+$/, "") + "_photoproof.jpg";
  return new File([finalBlob], cleanName, { type: 'image/jpeg' });
}
