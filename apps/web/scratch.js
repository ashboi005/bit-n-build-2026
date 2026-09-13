import { Jimp } from "jimp";

async function run() {
  console.log("Loading image...");
  const image = await Jimp.read("C:\\Users\\mansu\\.gemini\\antigravity-ide\\brain\\46b5d152-6de1-4450-92f8-0c77016c5b7e\\.user_uploaded\\media_1789256563882.png");
  
  image.scan((x, y, idx) => {
    var r = image.bitmap.data[idx + 0];
    var g = image.bitmap.data[idx + 1];
    var b = image.bitmap.data[idx + 2];

    const whiteness = Math.min(g, b);
    let opacity = 255 - whiteness;
    
    if (whiteness > 220) {
       opacity = 0;
    } else if (whiteness < 100) {
       opacity = 255;
    }

    image.bitmap.data[idx + 3] = opacity;
  });

  // Crop out the transparent padding
  image.autocrop();

  await image.write("public/thwip-logo-transparent.png");
  console.log("Done cropping and saving!");
}
run();
