import imageCompression from 'browser-image-compression';
import { removeBackground, Config } from '@imgly/background-removal';
export const MAX_SIZE_MB = 10;
export const MAX_SIZE_KB = 20;

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
 * Compresses an image before sending to the backend for background removal.
 */
export async function processImageLocally(
  file: File,
  onProgress?: (status: string, progressPct: number) => void
): Promise<File> {
  try {
    // 1. Remove background using AI locally
    if (onProgress) {
      onProgress('Downloading AI (First time only)...', 0);
    }

    const config: Config = {
      model: 'isnet_quint8', // small model ~40MB
      progress: (key: string, current: number, total: number) => {
        if (onProgress && total > 0) {
          // key can be 'fetch:isnet_quint8.onnx' or 'compute:inference'
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

    // 2. Convert transparent PNG to JPEG with white background
    if (onProgress) {
      onProgress('Compressing image...', 100);
    }

    const bitmap = await createImageBitmap(bgRemovedBlob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');
    
    // Fill with white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Draw the image on top
    ctx.drawImage(bitmap, 0, 0);

    const jpegBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error('Canvas to Blob failed'));
      }, 'image/jpeg', 0.9);
    });

    // 3. Compress the JPEG to target <20kb and max height 800px
    const options = {
      maxSizeMB: 0.02, // 20kb max
      maxWidthOrHeight: 800,
      useWebWorker: true,
      fileType: 'image/jpeg'
    };

    const jpegFile = new File([jpegBlob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: 'image/jpeg' });
    const compressedBlob = await imageCompression(jpegFile, options);

    const finalFile = new File([compressedBlob], jpegFile.name, {
      type: compressedBlob.type,
      lastModified: Date.now(),
    });

    return finalFile;
  } catch (error) {
    console.error('Image compression error:', error);
    throw new Error('Failed to prepare image for upload');
  }
};
