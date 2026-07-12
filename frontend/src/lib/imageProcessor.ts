import imageCompression from 'browser-image-compression';

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
export const processImageLocally = async (
  file: File,
  onProgress: (status: string, progress?: number) => void
): Promise<File> => {
  try {
    onProgress('Preparing image...');
    
    // 1. Compress image to reduce upload size
    onProgress('Compressing image...');
    const compressedBlob = await imageCompression(file, {
      maxSizeMB: 2, // compress to max 2MB before sending to backend
      maxWidthOrHeight: 2000,
      useWebWorker: true,
    });
    
    onProgress('Ready for upload...');

    // Convert Blob to File
    const finalFile = new File([compressedBlob], file.name, {
      type: compressedBlob.type,
      lastModified: Date.now(),
    });

    return finalFile;
  } catch (error) {
    console.error('Image compression error:', error);
    throw new Error('Failed to prepare image for upload');
  }
};
