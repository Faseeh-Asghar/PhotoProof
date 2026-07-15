const axios = require('axios');

async function test() {
  const spaces = [
    "briaai-RMBG-1.4",
    "KenjieDec-RemBG",
    "InferenceAPI-RMBG-1.4",
    "not-lain-background-removal"
  ];

  const base64Image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";

  for (const space of spaces) {
    try {
      console.log(`Testing https://${space}.hf.space/api/predict`);
      const res = await axios.post(`https://${space}.hf.space/api/predict`, {
        data: [ `data:image/png;base64,${base64Image}` ]
      });
      console.log(`✅ Success with ${space}`);
    } catch (err) {
      console.log(`❌ Failed ${space}:`, err.response ? err.response.status : err.message);
    }
  }
}
test();
