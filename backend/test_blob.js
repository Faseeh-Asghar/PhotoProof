const { removeBackground } = require('@imgly/background-removal-node');
const fs = require('fs').promises;
const path = require('path');

async function test() {
  try {
    const buffer = await fs.readFile(path.join(__dirname, 'test_dummy.png'));
    const blob = new Blob([buffer], { type: 'image/png' });
    
    console.log("Processing blob...");
    const res = await removeBackground(blob, { debug: true, model: "small" });
    console.log("Success:", res.size);
  } catch(e) {
    console.error("ERROR:");
    console.error(e);
  }
}
test();
