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

    // 2. Compress the result
    if (onProgress) {
      onProgress('Compressing image...', 100);
    }
    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 2000,
      useWebWorker: true,
      fileType: 'image/png' // Keep transparency
    };

    // Convert Blob to File for compression
    const bgRemovedFile = new File([bgRemovedBlob], file.name.replace(/\.[^/.]+$/, "") + ".png", { type: 'image/png' });
    const compressedBlob = await imageCompression(bgRemovedFile, options);

    const finalFile = new File([compressedBlob], bgRemovedFile.name, {
      type: compressedBlob.type,
      lastModified: Date.now(),
    });

    return finalFile;
  } catch (error) {
    console.error('Image compression error:', error);
    throw new Error('Failed to prepare image for upload');
  }
};
