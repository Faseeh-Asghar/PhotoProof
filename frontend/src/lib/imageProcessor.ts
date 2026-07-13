import type { Config } from '@imgly/background-removal';

export const MAX_SIZE_MB = 10;
export const MAX_SIZE_KB = 20;

export interface ProcessingOptions {
  width: number;
  height: number;
  maxSizeKb: number;
}

let isPreloading = false;
export async function preloadAI(onProgress?: (pct: number) => void) {
  if (isPreloading) return;
  isPreloading = true;
  try {
    const { preload } = await import('@imgly/background-removal');
    await preload({
      model: 'isnet_quint8',
      progress: (key: string, current: number, total: number) => {
        if (onProgress && total > 0 && key.startsWith('fetch')) {
          onProgress(Math.round((current / total) * 100));
        }
      }
    });
    console.log('AI Model preloaded successfully');
  } catch (e) {
    console.error('Failed to preload AI Model', e);
    throw e;
  } finally {
    isPreloading = false;
  }
}

/**
 * Validates the image before upload.
 */
export const validateImage = (file: File): { valid: boolean; error?: string } => {
  if (!file.type.startsWith('image/')) {
    return { valid: false, error: 'File must be an image' };
  }

  const fileSizeMB = file.size / 1024 / 1024;
  if (fileSizeMB > MAX_SIZE_MB) {
    return { valid: false, error: `Image must be less than ${MAX_SIZE_MB}MB` };
  }

  return { valid: true };
};

/**
 * Compresses an image strictly maintaining dimensions and reducing quality to meet max size.
 */
export async function processImageLocally(
  file: File,
  options: ProcessingOptions = { width: 600, height: 800, maxSizeKb: 20 },
  onProgress?: (status: string, progressPct: number) => void
): Promise<File> {
  try {
    // 1. Remove background using AI locally
    if (onProgress) {
      onProgress('Downloading AI (First time only)...', 0);
    }

    const { removeBackground } = await import('@imgly/background-removal');

    const config: Config = {
      model: 'isnet_quint8', // small model ~40MB
      progress: (key: string, current: number, total: number) => {
        if (onProgress && total > 0) {
          const pct = Math.round((current / total) * 100);
          if (key.startsWith('fetch')) {
            onProgress(`Downloading AI Model (${pct}%) - First time only`, pct);
          } else if (key.startsWith('compute')) {
            onProgress(`Removing background (${pct}%)`, pct);
          }
        }
      },
    };

    const bgRemovedBlob = await removeBackground(file, config);

    // 2. Draw strictly to exact target dimensions
    if (onProgress) {
      onProgress('Adjusting resolution and layout...', 100);
    }

    const bitmap = await createImageBitmap(bgRemovedBlob);
    
    // Create an offscreen canvas to find bounding box
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = bitmap.width;
    tempCanvas.height = bitmap.height;
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    if (!tempCtx) throw new Error('Failed to get temp context');
    
    tempCtx.drawImage(bitmap, 0, 0);
    const imgData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const data = imgData.data;

    // Find bounding box by density, ignoring outer 2% to avoid AI edge artifacts
    const rowCounts = new Int32Array(tempCanvas.height);
    const colCounts = new Int32Array(tempCanvas.width);
    
    const marginX = Math.floor(tempCanvas.width * 0.02);
    const marginY = Math.floor(tempCanvas.height * 0.02);

    for (let y = marginY; y < tempCanvas.height - marginY; y++) {
      for (let x = marginX; x < tempCanvas.width - marginX; x++) {
        const alpha = data[(y * tempCanvas.width + x) * 4 + 3];
        if (alpha > 200) { // Solid pixels only
          rowCounts[y]++;
          colCounts[x]++;
        }
      }
    }

    let minX = tempCanvas.width, minY = tempCanvas.height, maxX = 0, maxY = 0;
    
    // Require a contiguous block or enough density: at least 1% of the dimension
    const thresholdX = tempCanvas.width * 0.01; 
    const thresholdY = tempCanvas.height * 0.01;

    for (let x = marginX; x < tempCanvas.width - marginX; x++) {
      if (colCounts[x] > thresholdY) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
    for (let y = marginY; y < tempCanvas.height - marginY; y++) {
      if (rowCounts[y] > thresholdX) {
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }

    // Fallback if image is completely transparent or empty
    if (minX > maxX || minY > maxY) {
      minX = 0; minY = 0; maxX = tempCanvas.width; maxY = tempCanvas.height;
    }
    
    const cropWidth = maxX - minX;
    const cropHeight = maxY - minY;

    const canvas = document.createElement('canvas');
    canvas.width = options.width;
    canvas.height = options.height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');
    
    // Fill with white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Contain scale logic for the CROPPED area
    // Leave padding around the sides and top, but anchor strictly to the bottom
    const paddingX = canvas.width * 0.15; // 15% total horizontal padding (7.5% per side)
    const paddingTop = canvas.height * 0.08; // 8% padding on top

    const availableW = canvas.width - paddingX;
    const availableH = canvas.height - paddingTop;

    const scale = Math.min(availableW / cropWidth, availableH / cropHeight);
    const drawW = cropWidth * scale;
    const drawH = cropHeight * scale;
    const x = (canvas.width - drawW) / 2;
    const y = canvas.height - drawH; // Anchor strictly to bottom!
    
    // Draw only the cropped portion on top
    ctx.drawImage(tempCanvas, minX, minY, cropWidth, cropHeight, x, y, drawW, drawH);

    // 3. Compress quality to meet strictly < targetSizeKb
    if (onProgress) {
      onProgress('Compressing file size...', 100);
    }

    let minQ = 0.0;
    let maxQ = 1.0;
    let quality = 0.9;
    let bestBlob: Blob | null = null;
    let attempts = 0;
    const targetBytes = options.maxSizeKb * 1024;

    while (attempts < 7) {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error('Canvas to Blob failed'));
        }, 'image/jpeg', quality);
      });
      
      if (blob.size <= targetBytes) {
        bestBlob = blob;
        minQ = quality; // try to get better quality since we are under limit
        quality = (quality + maxQ) / 2;
      } else {
        maxQ = quality; // file too big, need lower quality
        quality = (minQ + quality) / 2;
      }
      attempts++;
    }

    // Fallback if we couldn't hit the target size even at the lowest test
    if (!bestBlob) {
      bestBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => b ? resolve(b) : reject(), 'image/jpeg', 0.1);
      });
    }

    const finalFile = new File([bestBlob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });

    return finalFile;
  } catch (error) {
    console.error('Image compression error:', error);
    throw new Error('Failed to prepare image for upload');
  }
}
