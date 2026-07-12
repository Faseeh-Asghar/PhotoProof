const { removeBackground } = require('@imgly/background-removal-node');

/**
 * Removes the background from an image buffer using a fast AI model.
 * 
 * @param {Buffer} imageBuffer The original image buffer
 * @returns {Promise<Buffer>} The image buffer with background removed (PNG format)
 */
async function processImageBackground(imageBuffer) {
  try {
    // Create a Blob from the Buffer, as required by @imgly/background-removal-node
    const blob = new Blob([imageBuffer], { type: 'image/jpeg' });
    
    // Process the image. We use the small model to save memory and ensure fast execution.
    const resultBlob = await removeBackground(blob, {
      model: 'medium', // Note: imgly-node expects 'small' | 'medium' | 'large'
      output: {
        format: 'image/png',
        quality: 1
      }
    });

    // Convert the resulting Blob back to a Node Buffer
    const arrayBuffer = await resultBlob.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error('Error during AI background removal:', error);
    throw new Error('AI background removal failed');
  }
}

module.exports = {
  processImageBackground
};
