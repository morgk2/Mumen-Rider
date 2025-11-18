/**
 * This script generates a PNG splash image with a white unfilled circle
 * For Expo native splash screens
 * 
 * To use this script, you need to install sharp:
 * npm install --save-dev sharp
 * 
 * Then run: node scripts/generate-splash-image.js
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is available
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.log('Sharp is not installed. Install it with: npm install --save-dev sharp');
  console.log('Alternatively, you can create the splash image manually:');
  console.log('1. Create a 1284x2778 PNG image with transparent background');
  console.log('2. Draw a white unfilled circle in the center (radius: ~300px, stroke: 8px)');
  console.log('3. Save it as assets/splash.png');
  process.exit(1);
}

const width = 1284;
const height = 2778;
const centerX = width / 2;
const centerY = height / 2;
const radius = 200; // Reduced from 300 to make logo smaller
const strokeWidth = 6; // Reduced from 8 to match smaller size

// Create SVG with circle
const svg = `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <circle cx="${centerX}" cy="${centerY}" r="${radius}" stroke="white" stroke-width="${strokeWidth}" fill="none"/>
</svg>
`;

// Convert SVG to PNG
async function generateSplashImage() {
  try {
    const outputPath = path.join(__dirname, '../assets/splash.png');
    
    await sharp(Buffer.from(svg))
      .png()
      .resize(width, height, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
      })
      .toFile(outputPath);
    
    console.log(`Splash image generated successfully at: ${outputPath}`);
    console.log(`Size: ${width}x${height}px`);
    console.log('Circle: white, radius:', radius, 'px, stroke:', strokeWidth, 'px');
  } catch (error) {
    console.error('Error generating splash image:', error);
    process.exit(1);
  }
}

generateSplashImage();



