const sharp = require('sharp');
const fs = require('fs');

async function processImage(inputPath, outputPath) {
  // 1. Decode to raw pixels
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const pixels = new Uint8Array(data);

  // Helper to get pixel index
  const getIdx = (x, y) => (y * width + x) * channels;

  // Get background color from corners
  const bgColors = [
    getIdx(0, 0),
    getIdx(width - 1, 0),
    getIdx(0, height - 1),
    getIdx(width - 1, height - 1)
  ].map(idx => [pixels[idx], pixels[idx+1], pixels[idx+2]]);

  // Simple average of corner colors to guess background
  const avgBg = [0, 0, 0];
  bgColors.forEach(c => { avgBg[0]+=c[0]; avgBg[1]+=c[1]; avgBg[2]+=c[2]; });
  avgBg[0] /= 4; avgBg[1] /= 4; avgBg[2] /= 4;

  const colorDistance = (r1, g1, b1, r2, g2, b2) => {
    return Math.sqrt((r1-r2)**2 + (g1-g2)**2 + (b1-b2)**2);
  };

  const tolerance = 60; // 0-255
  const visited = new Uint8Array(width * height);
  const queue = [];

  // Seed edges
  for (let x = 0; x < width; x++) { queue.push([x, 0]); queue.push([x, height - 1]); }
  for (let y = 0; y < height; y++) { queue.push([0, y]); queue.push([width - 1, y]); }

  let qHead = 0;
  while (qHead < queue.length) {
    const [x, y] = queue[qHead++];
    const pIdx = y * width + x;
    if (visited[pIdx]) continue;
    visited[pIdx] = 1;

    const idx = pIdx * channels;
    const r = pixels[idx], g = pixels[idx+1], b = pixels[idx+2], a = pixels[idx+3];
    if (a === 0) continue; // Already transparent

    if (colorDistance(r, g, b, avgBg[0], avgBg[1], avgBg[2]) < tolerance) {
      pixels[idx + 3] = 0; // Make transparent
      if (x > 0) queue.push([x - 1, y]);
      if (x < width - 1) queue.push([x + 1, y]);
      if (y > 0) queue.push([x, y - 1]);
      if (y < height - 1) queue.push([x, y + 1]);
    }
  }

  // Composite over white
  await sharp({
    create: { width, height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } }
  })
  .composite([{ input: pixels, raw: { width, height, channels } }])
  .jpeg({ quality: 85 })
  .toFile(outputPath);
  
  console.log("Processed:", outputPath);
}

const inputImage = 'C:/Users/PC ZONE COMPUTERS/.gemini/antigravity/brain/ea59816e-d39c-41ec-b07d-c82bff0b6400/.tempmediaStorage/media_ea59816e-d39c-41ec-b07d-c82bff0b6400_1783848867289.jpg';
processImage(inputImage, 'output_floodfill.jpg').catch(console.error);
