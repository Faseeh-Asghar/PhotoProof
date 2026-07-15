const { Client } = require("@gradio/client");

async function test() {
  try {
    console.log("Connecting to Gradio Space...");
    // Let's try an existing public rembg space
    const client = await Client.connect("skytnt/rembg");
    
    const base64Image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";
    const buffer = Buffer.from(base64Image, 'base64');
    const blob = new Blob([buffer], { type: 'image/png' });

    console.log("Predicting...");
    const result = await client.predict("/predict", [
      blob,
      "u2net", // model name
      true, // return mask
      false, // alpha matting
      240, 10, 10 // alpha matting params
    ]);

    console.log("Result:", result.data);
  } catch (err) {
    console.error("Failed:", err);
  }
}

test();
