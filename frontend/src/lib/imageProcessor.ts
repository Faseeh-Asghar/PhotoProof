export const MAX_SIZE_MB = 10;
export const MAX_SIZE_KB = 20;

export interface ProcessingOptions {
  width: number;
  height: number;
  maxSizeKb: number;
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
 * This runs locally in milliseconds and drastically reduces upload bandwidth.
 */
export async function processImageLocally(
  file: File,
  options: ProcessingOptions = { width: 600, height: 800, maxSizeKb: 20 },
  onProgress?: (status: string, progressPct: number) => void
): Promise<File> {
  try {
    if (onProgress) onProgress('Optimizing resolution...', 0);

    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = options.width;
    canvas.height = options.height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');
    
    // Fill with white background just in case it's transparent
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Contain scale logic (preserve aspect ratio, fit inside exactly)
    const scale = Math.min(canvas.width / bitmap.width, canvas.height / bitmap.height);
    const drawW = bitmap.width * scale;
    const drawH = bitmap.height * scale;
    const x = (canvas.width - drawW) / 2;
    const y = (canvas.height - drawH) / 2;
    
    // Draw the image
    ctx.drawImage(bitmap, x, y, drawW, drawH);

    if (onProgress) onProgress('Compressing file size...', 50);

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

    if (!bestBlob) {
      bestBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => b ? resolve(b) : reject(), 'image/jpeg', 0.1);
      });
    }

    if (onProgress) onProgress('Optimized successfully!', 100);

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
