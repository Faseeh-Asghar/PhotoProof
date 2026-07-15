const { HfInference } = require("@huggingface/inference");
const fs = require('fs');

const hf = new HfInference(); // No API key means free tier rate limits (often enough for testing)

async function test() {
  try {
    console.log("Connecting to HF Inference API...");
    // Create a tiny 1x1 white pixel blob
    const base64Image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";
    const buffer = Buffer.from(base64Image, 'base64');
    const blob = new Blob([buffer], { type: 'image/png' });

    console.log("Sending image segmentation request...");
    const result = await hf.imageSegmentation({
      model: 'briaai/RMBG-1.4',
      data: blob
    });

    console.log("Result received:", result);
  } catch (err) {
    console.error("HF Inference test failed:", err);
  }
}

test();
