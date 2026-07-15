const axios = require('axios');

async function test() {
  try {
    const base64Image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";
    const buffer = Buffer.from(base64Image, 'base64');
    const blob = new Blob([buffer], { type: 'image/png' });

    console.log("Sending POST to public gradio API...");
    const res = await axios.post("https://skytnt-rembg.hf.space/api/predict", {
      data: [
        `data:image/png;base64,${base64Image}`,
        "u2net",
        true,
        false,
        240, 10, 10
      ]
    });

    console.log("Response:", res.data);
  } catch (err) {
    console.error("Failed:", err.response ? err.response.data : err.message);
  }
}

test();
