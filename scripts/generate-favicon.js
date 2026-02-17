
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const INPUT_PATH = path.join(__dirname, '../public/logo.png');
const OUTPUT_PATH = path.join(__dirname, '../public/favicon-square.png');

async function generateFavicon() {
    try {
        console.log('Generating favicon...');

        // 1. Resize generic logo to fit inside the box (e.g., 100% of the box size)
        const logoBuffer = await sharp(INPUT_PATH)
            .resize(320, 320, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .toBuffer();

        // 2. Create a white rounded square background (320x320)
        // We use SVG for the background to ensure perfect rounded corners
        const roundedSquareSvg = Buffer.from(`
      <svg width="320" height="320" viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="320" height="320" rx="64" ry="64" fill="white"/>
      </svg>
    `);

        // 3. Composite the logo onto the white background
        await sharp(roundedSquareSvg)
            .composite([{ input: logoBuffer, gravity: 'center' }])
            .png()
            .toFile(OUTPUT_PATH);

        console.log(`Favicon generated at: ${OUTPUT_PATH}`);

    } catch (error) {
        console.error('Error generating favicon:', error);
    }
}

generateFavicon();
