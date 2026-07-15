const axios = require('axios');

async function test() {
  const base64Image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";

  const url = "https://briaai-rmbg-1-4.hf.space/api/predict";
  console.log(`Testing ${url}...`);

  try {
    const res = await axios.post(url, {
      data: [ `data:image/png;base64,${base64Image}` ]
    });
    console.log(`✅ Success! Response:`, res.data);
  } catch (err) {
    console.log(`❌ Failed:`, err.response ? err.response.status + " " + err.response.statusText : err.message);
  }
}
test();
