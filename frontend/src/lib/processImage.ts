import { removeBackground } from '@imgly/background-removal';

export async function processImageLocally(
  file: File,
  targetWidth = 600,
  targetHeight = 800,
  targetSizeKb = 20,
  onProgress?: (msg: string) => void
): Promise<Blob> {
  try {
    if (onProgress) onProgress('Removing background...');

    // 1. Run AI background removal. In the browser, this automatically uses WASM.
    // It returns a Blob containing a transparent PNG.
    const bgRemovedBlob = await removeBackground(file, {
      publicPath: 'https://unpkg.com/@imgly/background-removal-data@1.4.5/dist/',
      progress: (key, current, total) => {
        // e.g., fetching model
        if (key.includes('fetch') && onProgress) {
          onProgress(`Downloading AI model... ${Math.round((current / total) * 100)}%`);
        }
      }
    });

    if (onProgress) onProgress('Cropping & Resizing...');

    // 2. Load the transparent PNG into a Canvas to analyze pixels
    const img = await createImageBitmap(bgRemovedBlob);
    const width = img.width;
    const height = img.height;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Could not get 2d context');

    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // 3. Custom Connected Component Analysis (CCA) to find the largest person/blob
    const visited = new Uint8Array(width * height);
    const blobSizes: { id: number; size: number }[] = [];
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
            const curr = stack.pop()!;
            size++;

            const cx = curr % width;
            const cy = Math.floor(curr / width);

            // Check 4 neighbors
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
      throw new Error('No subject detected in image.');
    }

    // 4. Find Bounding Box of the largest blob
    let minX = width, minY = height, maxX = 0, maxY = 0;

    // Also erase any pixels that aren't part of the largest blob (removes floating artifacts)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (visited[i] !== largestBlobId) {
          data[i * 4 + 3] = 0; // Make transparent
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

    // Put cleaned pixels back so we don't draw artifacts
    ctx.putImageData(imageData, 0, 0);

    // 5. Create Final Canvas (600x800 white background)
    if (onProgress) onProgress('Compressing...');
    
    const outCanvas = document.createElement('canvas');
    outCanvas.width = targetWidth;
    outCanvas.height = targetHeight;
    const outCtx = outCanvas.getContext('2d');
    if (!outCtx) throw new Error('Could not get final 2d context');

    // Fill white
    outCtx.fillStyle = '#FFFFFF';
    outCtx.fillRect(0, 0, targetWidth, targetHeight);

    // Calculate scaling to fit exactly within paddings
    const paddingX = targetWidth * 0.15;
    const paddingTop = targetHeight * 0.08;
    const availableW = targetWidth - paddingX;
    const availableH = targetHeight - paddingTop;

    const scale = Math.min(availableW / cropWidth, availableH / cropHeight);
    const drawW = Math.round(cropWidth * scale);
    const drawH = Math.round(cropHeight * scale);

    const finalX = Math.round((targetWidth - drawW) / 2);
    const finalY = targetHeight - drawH; // align to bottom

    // Draw the cropped subject onto the white background
    outCtx.drawImage(canvas, minX, minY, cropWidth, cropHeight, finalX, finalY, drawW, drawH);

    // 6. Compress to target KB
    const maxBytes = targetSizeKb * 1024;
    let quality = 0.95;
    let finalBlob: Blob | null = null;

    // Iterative compression (usually hits it in 1-2 tries in browser)
    for (let attempts = 0; attempts < 5; attempts++) {
      finalBlob = await new Promise<Blob | null>(res => outCanvas.toBlob(res, 'image/jpeg', quality));
      if (finalBlob && finalBlob.size <= maxBytes) {
        break;
      }
      quality = Math.max(0.1, quality - 0.2);
    }

    if (!finalBlob) throw new Error('Compression failed');

    return finalBlob;

  } catch (err: any) {
    console.error('Local processing error:', err);
    throw new Error(err.message || 'Image processing failed');
  }
}
