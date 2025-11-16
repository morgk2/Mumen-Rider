/**
 * This script generates a valid 1024x1024 PNG icon from adaptive-icon.png
 * For Expo app icons
 * 
 * To use this script, you need sharp installed (already in devDependencies):
 * npm install --save-dev sharp
 * 
 * Then run: node scripts/generate-icon.js
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function generateIcon() {
  try {
    const adaptiveIconPath = path.join(__dirname, '../assets/adaptive-icon.png');
    const outputPath = path.join(__dirname, '../assets/icon.png');
    
    // Check if adaptive-icon.png exists
    if (!fs.existsSync(adaptiveIconPath)) {
      console.error('Error: adaptive-icon.png not found at:', adaptiveIconPath);
      console.log('\nTo create the icon manually:');
      console.log('1. Create a 1024x1024 PNG image');
      console.log('2. Save it as assets/icon.png');
      console.log('3. Make sure it\'s a valid PNG file (not corrupted)');
      process.exit(1);
    }
    
    console.log('Generating icon.png from adaptive-icon.png...');
    
    // Resize adaptive-icon to 1024x1024 (square, required for Expo)
    await sharp(adaptiveIconPath)
      .resize(1024, 1024, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 } // White background
      })
      .png()
      .toFile(outputPath);
    
    // Verify the generated file
    const metadata = await sharp(outputPath).metadata();
    console.log('\n✓ Icon generated successfully!');
    console.log(`  Location: ${outputPath}`);
    console.log(`  Size: ${metadata.width}x${metadata.height}px`);
    console.log(`  Format: ${metadata.format}`);
    console.log(`  File size: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB`);
    
    console.log('\nThe icon.png is now ready for use in your Expo app.');
    console.log('You can rebuild your Android app now.');
    
  } catch (error) {
    console.error('Error generating icon:', error.message);
    console.log('\nAlternative: Create the icon manually:');
    console.log('1. Create a 1024x1024 PNG image');
    console.log('2. Save it as assets/icon.png');
    console.log('3. Make sure it\'s a valid PNG file');
    process.exit(1);
  }
}

generateIcon();

