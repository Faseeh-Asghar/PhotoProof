const { removeBackground } = require('@imgly/background-removal-node');
const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');

async function test() {
  try {
    const inputPath = path.join(__dirname, 'test_input.png');
    // create a simple dummy image with sharp to test
    await sharp({
      create: { width: 100, height: 100, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } }
    }).png().toFile(inputPath);

    const buffer = await fs.readFile(inputPath);
    const blob = new Blob([buffer], { type: 'image/png' });
    
    console.log("Processing blob...");
    const config = { model: "small", debug: true };
    const res = await removeBackground(blob, config);
    
    const arrayBuf = await res.arrayBuffer();
    const outBuffer = Buffer.from(arrayBuf);
    
    const outputPath = path.join(__dirname, 'test_output.png');
    await fs.writeFile(outputPath, outBuffer);
    console.log("Success! File saved to:", outputPath);
    
  } catch(e) {
    console.error("ERROR:", e);
  }
}
test();
