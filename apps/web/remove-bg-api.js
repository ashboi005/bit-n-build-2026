import { client } from "@gradio/client";
import fs from "fs";

async function run() {
  try {
    console.log("Connecting to Gradio space...");
    const app = await client("briaai/BRIA-RMBG-2.0");
    
    console.log("Uploading and predicting...");
    const inputFile = process.argv[2];
    const outputFile = process.argv[3];
    
    console.log("Uploading and predicting...", inputFile);
    const imageBlob = new Blob([fs.readFileSync(inputFile)]);
    const result = await app.predict("/image", [
      imageBlob,
    ]);
    
    console.log("Result received!");
    if (result.data && result.data[1] && result.data[1].url) {
        const response = await fetch(result.data[1].url);
        const buffer = await response.arrayBuffer();
        fs.writeFileSync(outputFile, Buffer.from(buffer));
        console.log("Saved to " + outputFile);
    } else {
        console.log("Unexpected result format:", result.data);
    }
  } catch(e) {
    console.error("Error:", e);
  }
}
run();
