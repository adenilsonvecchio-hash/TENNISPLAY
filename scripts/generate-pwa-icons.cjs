const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Ensure output directories exist
const iconsDir = path.join(__dirname, '../public/icons');
const publicDir = path.join(__dirname, '../public');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// 1. Master SVG with high-detail Tennis Ball in dark navy rounded square
const masterSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <!-- Background subtle gradient -->
    <radialGradient id="bgGlow" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f1f5f9"/>
    </radialGradient>

    <!-- Navy squircle border gradient -->
    <linearGradient id="navyBorder" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="50%" stop-color="#0D1428"/>
      <stop offset="100%" stop-color="#090d1a"/>
    </linearGradient>

    <!-- Tennis ball 3D sphere gradient -->
    <radialGradient id="ballSphere" cx="38%" cy="32%" r="68%">
      <stop offset="0%" stop-color="#facc15" stop-opacity="1"/>
      <stop offset="20%" stop-color="#e8f81e" stop-opacity="1"/>
      <stop offset="55%" stop-color="#c4f408" stop-opacity="1"/>
      <stop offset="85%" stop-color="#9ad402" stop-opacity="1"/>
      <stop offset="100%" stop-color="#6b9b00" stop-opacity="1"/>
    </radialGradient>

    <!-- Ball shadow underneath -->
    <radialGradient id="ballShadow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#090d1a" stop-opacity="0.28"/>
      <stop offset="60%" stop-color="#090d1a" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#090d1a" stop-opacity="0"/>
    </radialGradient>

    <!-- Seam inner shadow -->
    <filter id="seamShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="#557500" flood-opacity="0.5"/>
    </filter>

    <!-- Clip path to keep seams inside ball -->
    <clipPath id="ballClip">
      <circle cx="256" cy="256" r="116"/>
    </clipPath>
  </defs>

  <!-- Canvas Background for safe masking -->
  <rect width="512" height="512" fill="#ffffff"/>

  <!-- Subtle shadow under navy squircle -->
  <rect x="52" y="58" width="408" height="408" rx="100" ry="100" fill="#000000" opacity="0.08"/>
  <rect x="56" y="60" width="400" height="400" rx="96" ry="96" fill="#000000" opacity="0.12"/>

  <!-- Dark navy rounded square container (outer) -->
  <rect x="56" y="56" width="400" height="400" rx="96" ry="96" fill="url(#navyBorder)"/>

  <!-- Inner white pill / squircle -->
  <rect x="80" y="80" width="352" height="352" rx="76" ry="76" fill="url(#bgGlow)"/>

  <!-- Ball cast shadow inside container -->
  <ellipse cx="256" cy="378" rx="104" ry="24" fill="url(#ballShadow)"/>

  <!-- Tennis Ball Main Body -->
  <circle cx="256" cy="256" r="116" fill="url(#ballSphere)"/>

  <!-- Tennis Ball Seams (Clipped to sphere) -->
  <g clip-path="url(#ballClip)">
    <!-- Seam Line 1 (Left / Upper Curve) -->
    <!-- Darker backing for depth -->
    <path d="M 140 180 C 190 205, 230 170, 256 140 C 275 118, 290 140, 310 148" fill="none" stroke="#688a04" stroke-width="15" stroke-linecap="round"/>
    <!-- White seam ribbon -->
    <path d="M 120 190 Q 210 235 240 140 Q 256 90 280 140" fill="none" stroke="#ffffff" stroke-width="10" stroke-linecap="round" opacity="0.95" filter="url(#seamShadow)"/>

    <!-- Realistic dual arched tennis seams -->
    <!-- Left Arched Seam -->
    <path d="M 152 165 C 220 205, 220 307, 152 347" fill="none" stroke="#5d7e02" stroke-width="15" stroke-linecap="round"/>
    <path d="M 152 165 C 220 205, 220 307, 152 347" fill="none" stroke="#ffffff" stroke-width="10" stroke-linecap="round" opacity="0.95"/>

    <!-- Right Arched Seam -->
    <path d="M 360 165 C 292 205, 292 307, 360 347" fill="none" stroke="#5d7e02" stroke-width="15" stroke-linecap="round"/>
    <path d="M 360 165 C 292 205, 292 307, 360 347" fill="none" stroke="#ffffff" stroke-width="10" stroke-linecap="round" opacity="0.95"/>

    <!-- Subtle ball texture highlight -->
    <path d="M 180 170 A 100 100 0 0 1 320 170" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" opacity="0.25"/>
  </g>

  <!-- Tennis Ball 3D Rim / Ambient Occlusion -->
  <circle cx="256" cy="256" r="116" fill="none" stroke="#486800" stroke-width="2.5" opacity="0.4"/>
  <!-- Specular top-left light gleam -->
  <ellipse cx="215" cy="195" rx="34" ry="22" transform="rotate(-30 215 195)" fill="#ffffff" opacity="0.35"/>
</svg>
`;

// Save master SVG
fs.writeFileSync(path.join(publicDir, 'icon.svg'), masterSvg.trim());

async function generateIcons() {
  const svgBuffer = Buffer.from(masterSvg);

  const targets = [
    { file: path.join(iconsDir, 'favicon-16x16.png'), size: 16 },
    { file: path.join(iconsDir, 'favicon-32x32.png'), size: 32 },
    { file: path.join(iconsDir, 'apple-touch-icon.png'), size: 180 },
    { file: path.join(iconsDir, 'pwa-192x192.png'), size: 192 },
    { file: path.join(iconsDir, 'pwa-512x512.png'), size: 512 },
    { file: path.join(iconsDir, 'pwa-maskable-192x192.png'), size: 192 },
    { file: path.join(iconsDir, 'pwa-maskable-512x512.png'), size: 512 },
    // Backward compatibility with previous icon references
    { file: path.join(iconsDir, 'icon-192x192.png'), size: 192 },
    { file: path.join(iconsDir, 'icon-512x512.png'), size: 512 },
    { file: path.join(iconsDir, 'icon-maskable-192x192.png'), size: 192 },
    { file: path.join(iconsDir, 'icon-maskable-512x512.png'), size: 512 },
    { file: path.join(publicDir, 'favicon.png'), size: 64 },
  ];

  for (const t of targets) {
    await sharp(svgBuffer)
      .resize(t.size, t.size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png({ quality: 100, compressionLevel: 9 })
      .toFile(t.file);
    console.log(`Generated: ${t.file} (${t.size}x${t.size})`);
  }

  // Generate multi-size favicon.ico
  const ico32 = await sharp(svgBuffer).resize(32, 32).png().toBuffer();
  // Simple ICO wrapper for 32x32 PNG
  const icoHeader = Buffer.from([
    0, 0, // Reserved
    1, 0, // Type: 1 = ICO
    1, 0, // Number of images: 1
    32,   // Width: 32
    32,   // Height: 32
    0,    // Color palette
    0,    // Reserved
    1, 0, // Color planes
    32, 0,// Bits per pixel
    ...intToBytes(ico32.length, 4), // Image size
    ...intToBytes(22, 4)            // Offset of image data
  ]);

  const icoBuffer = Buffer.concat([icoHeader, ico32]);
  fs.writeFileSync(path.join(iconsDir, 'favicon.ico'), icoBuffer);
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoBuffer);
  console.log('Generated favicon.ico (public & icons)');
}

function intToBytes(value, byteCount) {
  const bytes = [];
  for (let i = 0; i < byteCount; i++) {
    bytes.push((value >> (i * 8)) & 0xff);
  }
  return bytes;
}

generateIcons().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
