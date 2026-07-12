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
      publicPath: '/static/imgly/',
      progress: (key: string, current: number, total: number) => {
        if (onProgress && total > 0 && key.startsWith('fetch')) {
          onProgress(Math.round((current / total) * 100));
        }
      }
    });
    console.log('AI Model preloaded successfully');
  } catch (e) {
    console.error('Failed to preload AI Model', e);
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
      publicPath: '/static/imgly/',
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
    const canvas = document.createElement('canvas');
    canvas.width = options.width;
    canvas.height = options.height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');
    
    // Fill with white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Contain scale logic (preserve aspect ratio, fit inside exactly)
    const scale = Math.min(canvas.width / bitmap.width, canvas.height / bitmap.height);
    const drawW = bitmap.width * scale;
    const drawH = bitmap.height * scale;
    const x = (canvas.width - drawW) / 2;
    const y = (canvas.height - drawH) / 2;
    
    // Draw the image on top
    ctx.drawImage(bitmap, x, y, drawW, drawH);

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
