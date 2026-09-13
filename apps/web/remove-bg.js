import { pipeline, env } from '@xenova/transformers';
import fs from 'fs';
import path from 'path';

// Disable local models to fetch from HuggingFace
env.allowLocalModels = false;
env.backends.onnx.wasm.numThreads = 1;

async function removeBackground(inputPath, outputPath) {
  try {
    const remover = await pipeline('image-segmentation', 'Xenova/u2net');
    
    console.log("Processing image...");
    const result = await remover(inputPath);
    
    // The result contains the mask as a raw array or similar. We need to apply it.
    // However, Xenova/rmbg-1.4 returns an image with the background already removed?
    // Let's check what the pipeline returns.
    console.log("Saving image...");
    
    // Instead of doing it manually, we can just use the resulting image data.
    // The pipeline returns a list of objects or a single object.
    const mask = Array.isArray(result) ? result[0].mask : result.mask;
    
    if (!mask) {
       console.log(result);
       throw new Error("No mask found");
    }

    // Mask is a Jimp image or a raw data array.
    await mask.save(outputPath);
    console.log("Saved directly from output:", outputPath);
    
  } catch (error) {
    console.error("Error removing background:", error);
  }
}

const inputPath = 'C:\\Users\\mansu\\.gemini\\antigravity-ide\\brain\\46b5d152-6de1-4450-92f8-0c77016c5b7e\\.user_uploaded\\media_1789254455795.jpg';
const outputPath = path.join(process.cwd(), 'public', 'spiderman.png');

removeBackground(inputPath, outputPath);
