// PWA Icon Generator Script
// Run this script to generate PNG icons from the SVG template
// Usage: node scripts/generate-icons.js

const fs = require('fs');
const path = require('path');

// Icon sizes needed for PWA
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Simple SVG template that scales well
const generateSVG = (size) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#3b82f6"/>
      <stop offset="100%" style="stop-color:#1d4ed8"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.1875)}" fill="url(#bg)"/>
  <g fill="white" transform="translate(${size * 0.1875}, ${size * 0.1875})">
    <!-- QR Code Pattern scaled to fit -->
    <g transform="scale(${size / 512 * 0.625})">
      <!-- Top-left corner -->
      <rect x="0" y="0" width="96" height="96" rx="8"/>
      <rect x="16" y="16" width="64" height="64" fill="#1d4ed8" rx="4"/>
      <rect x="32" y="32" width="32" height="32" fill="white" rx="2"/>
      
      <!-- Top-right corner -->
      <rect x="224" y="0" width="96" height="96" rx="8"/>
      <rect x="240" y="16" width="64" height="64" fill="#1d4ed8" rx="4"/>
      <rect x="256" y="32" width="32" height="32" fill="white" rx="2"/>
      
      <!-- Bottom-left corner -->
      <rect x="0" y="224" width="96" height="96" rx="8"/>
      <rect x="16" y="240" width="64" height="64" fill="#1d4ed8" rx="4"/>
      <rect x="32" y="256" width="32" height="32" fill="white" rx="2"/>
      
      <!-- Center pattern -->
      <rect x="128" y="128" width="64" height="64" rx="8"/>
      
      <!-- Bottom-right area -->
      <rect x="224" y="224" width="32" height="32" rx="4"/>
      <rect x="264" y="224" width="32" height="32" rx="4"/>
      <rect x="224" y="264" width="32" height="32" rx="4"/>
      <rect x="264" y="264" width="32" height="32" rx="4"/>
    </g>
  </g>
</svg>`;

// Create icons directory if it doesn't exist
const iconsDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate SVG files for each size
sizes.forEach(size => {
  const svg = generateSVG(size);
  const filename = `icon-${size}x${size}.svg`;
  fs.writeFileSync(path.join(iconsDir, filename), svg);
  console.log(`Generated: ${filename}`);
});

// Also create PNG placeholder message
console.log('\n📝 Note: SVG icons have been generated.');
console.log('For PNG icons, you can convert these SVGs using:');
console.log('- Online tools like cloudconvert.com');
console.log('- Or install sharp: npm install sharp');
console.log('- Or use a graphic editor like GIMP or Figma\n');

console.log('✅ PWA icons generated successfully!');
