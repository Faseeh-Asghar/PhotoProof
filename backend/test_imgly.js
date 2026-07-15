const { removeBackground } = require('@imgly/background-removal-node');
const path = require('path');
async function test() {
  try {
    const p = 'file://' + path.join(__dirname, 'node_modules/@imgly/background-removal-node/dist/').replace(/\\/g, '/');
    console.log("publicPath: ", p);
    
    // We will use a real image if we have one, otherwise just anything
    const res = await removeBackground('file://' + path.join(__dirname, 'test_dummy.png').replace(/\\/g, '/'), { 
      publicPath: p, 
      debug: true 
    });
    console.log('success! Result blob size:', res.size);
  } catch(e) {
    console.error("ERROR CAUGHT:");
    console.error(e);
  }
}
test();
