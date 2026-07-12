const { removeBackground } = require('@imgly/background-removal-node');
const fs = require('fs');
const path = require('path');

async function test() {
  const imagePath = "C:\\Users\\PC ZONE COMPUTERS\\OneDrive\\Desktop\\New folder (2)\\WhatsApp Image 2026-07-08 at 5.03.14 PM (1).jpeg";
  
  if (!fs.existsSync(imagePath)) {
    console.log("Image not found at path. Please provide a valid path.");
    return;
  }

  const buffer = fs.readFileSync(imagePath);
  console.log("Image loaded, size:", buffer.length);

  try {
    // Some versions require a Blob
    const blob = new Blob([buffer], { type: 'image/jpeg' });
    const resultBlob = await removeBackground(blob);
    const arrayBuffer = await resultBlob.arrayBuffer();
    const outBuffer = Buffer.from(arrayBuffer);

    fs.writeFileSync('test_output.png', outBuffer);
    console.log("Success! Wrote test_output.png, size:", outBuffer.length);
  } catch (err) {
    console.error("Error during background removal:", err);
  }
}

test();
