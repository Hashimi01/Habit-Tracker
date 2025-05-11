const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const SOURCE_SVG = path.join(ASSETS_DIR, 'logo.svg');

async function generateIcon(size, outputName, options = {}) {
    const { fit = 'contain', background = { r: 255, g: 255, b: 255, alpha: 1 } } = options;
    
    await sharp(SOURCE_SVG)
        .resize(size, size, {
            fit,
            background
        })
        .png()
        .toFile(path.join(ASSETS_DIR, outputName));
    console.log(`Generated ${outputName}`);
}

async function generateSplash(outputName) {
    // Create a larger canvas for the splash screen with padding
    const size = 1242;
    const logoSize = Math.floor(size * 0.7); // Logo takes 70% of the space
    
    await sharp({
        create: {
            width: size,
            height: size,
            channels: 4,
            background: { r: 255, g: 255, b: 255, alpha: 1 }
        }
    })
    .composite([{
        input: await sharp(SOURCE_SVG)
            .resize(logoSize, logoSize, {
                fit: 'contain',
                background: { r: 255, g: 255, b: 255, alpha: 0 }
            })
            .toBuffer(),
        gravity: 'center'
    }])
    .png()
    .toFile(path.join(ASSETS_DIR, outputName));
    
    console.log(`Generated ${outputName}`);
}

async function main() {
    // Ensure assets directory exists
    if (!fs.existsSync(ASSETS_DIR)) {
        fs.mkdirSync(ASSETS_DIR, { recursive: true });
    }

    try {
        // Clean up old files
        const filesToDelete = ['splash-icon.png'];
        for (const file of filesToDelete) {
            const filePath = path.join(ASSETS_DIR, file);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`Deleted ${file}`);
            }
        }

        // Generate icons
        await generateIcon(1024, 'icon.png');
        await generateIcon(1024, 'adaptive-icon.png');
        await generateIcon(48, 'favicon.png');
        
        // Generate splash screen
        await generateSplash('splash.png');

        console.log('All icons generated successfully!');
    } catch (error) {
        console.error('Error generating icons:', error);
        process.exit(1);
    }
}

main(); 