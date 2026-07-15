const { HfInference } = require("@huggingface/inference");
const hf = new HfInference(); // Free tier

async function test() {
  const base64Image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";
  const buffer = Buffer.from(base64Image, 'base64');
  const blob = new Blob([buffer], { type: 'image/png' });

  const modelsToTest = [
    "facebook/detr-resnet-50-panoptic",
    "facebook/mask2former-swin-large-cityscapes-semantic",
    "nvidia/segformer-b0-finetuned-ade-512-512"
  ];

  for (const model of modelsToTest) {
    try {
      console.log(`Testing ${model}...`);
      const result = await hf.imageSegmentation({ model, data: blob });
      console.log(`✅ Success with ${model}`);
    } catch (e) {
      console.log(`❌ Failed ${model}:`, e.message);
    }
  }
}
test();
