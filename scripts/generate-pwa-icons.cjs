const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const iconsDir = path.join(__dirname, '../public/icons');
const publicDir = path.join(__dirname, '../public');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Master SVG: Crisp, clean, filter-free geometry for 100% compatibility across all renderers and iOS Safari
const masterSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <!-- Background Gradient -->
    <radialGradient id="innerWhiteGlow" cx="50%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f3f6fa"/>
    </radialGradient>

    <!-- Navy squircle border gradient -->
    <linearGradient id="navySquircleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1b2538"/>
      <stop offset="60%" stop-color="#0D1428"/>
      <stop offset="100%" stop-color="#070b16"/>
    </linearGradient>

    <!-- Tennis ball 3D sphere gradient -->
    <radialGradient id="tennisBallGrad" cx="36%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#fdf041"/>
      <stop offset="25%" stop-color="#e2f714"/>
      <stop offset="60%" stop-color="#c1f005"/>
      <stop offset="88%" stop-color="#93ce00"/>
      <stop offset="100%" stop-color="#649100"/>
    </radialGradient>

    <!-- Ball shadow under base -->
    <radialGradient id="ballCastShadow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#0D1428" stop-opacity="0.22"/>
      <stop offset="65%" stop-color="#0D1428" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#0D1428" stop-opacity="0"/>
    </radialGradient>

    <!-- Clip path to keep seams inside ball circle -->
    <clipPath id="ballSphereClip">
      <circle cx="256" cy="256" r="118"/>
    </clipPath>
  </defs>

  <!-- 1. FULL SOLID WHITE BACKGROUND - NO ALPHA -->
  <rect width="512" height="512" fill="#ffffff"/>

  <!-- 2. DARK NAVY ROUNDED SQUARE (MOLDURA OFICIAL) -->
  <rect x="52" y="52" width="408" height="408" rx="98" ry="98" fill="url(#navySquircleGrad)"/>

  <!-- 3. INNER SOLID WHITE/LIGHT SQUIRCLE -->
  <rect x="76" y="76" width="360" height="360" rx="78" ry="78" fill="url(#innerWhiteGlow)"/>

  <!-- 4. SUBTLE SHADOW UNDER BALL -->
  <ellipse cx="256" cy="378" rx="98" ry="20" fill="url(#ballCastShadow)"/>

  <!-- 5. TENNIS BALL SPHERE -->
  <circle cx="256" cy="256" r="118" fill="url(#tennisBallGrad)"/>

  <!-- 6. TENNIS BALL SEAMS (CLIPPED) -->
  <g clip-path="url(#ballSphereClip)">
    <!-- Dark shadow track for seams -->
    <path d="M 148 160 C 218 202, 218 310, 148 352" fill="none" stroke="#527701" stroke-width="15" stroke-linecap="round"/>
    <path d="M 364 160 C 294 202, 294 310, 364 352" fill="none" stroke="#527701" stroke-width="15" stroke-linecap="round"/>

    <!-- Crisp White Seams -->
    <path d="M 148 160 C 218 202, 218 310, 148 352" fill="none" stroke="#ffffff" stroke-width="9.5" stroke-linecap="round"/>
    <path d="M 364 160 C 294 202, 294 310, 364 352" fill="none" stroke="#ffffff" stroke-width="9.5" stroke-linecap="round"/>
  </g>

  <!-- 7. SUBTLE RIM & SPECULAR HIGHLIGHT -->
  <circle cx="256" cy="256" r="118" fill="none" stroke="#486800" stroke-width="2" opacity="0.35"/>
  <ellipse cx="212" cy="192" rx="36" ry="22" transform="rotate(-28 212 192)" fill="#ffffff" opacity="0.32"/>
</svg>
`;

fs.writeFileSync(path.join(publicDir, 'icon.svg'), masterSvg.trim());

async function generateIcons() {
  const svgBuffer = Buffer.from(masterSvg);

  const targets = [
    // Apple Touch Icon v2 (Official requirement)
    { file: path.join(iconsDir, 'tennisplay-apple-touch-v2.png'), size: 180 },
    // Standard apple touch icon
    { file: path.join(iconsDir, 'apple-touch-icon.png'), size: 180 },
    { file: path.join(publicDir, 'apple-touch-icon.png'), size: 180 },
    // PWA standard & maskable icons
    { file: path.join(iconsDir, 'pwa-192x192.png'), size: 192 },
    { file: path.join(iconsDir, 'pwa-512x512.png'), size: 512 },
    { file: path.join(iconsDir, 'pwa-maskable-192x192.png'), size: 192 },
    { file: path.join(iconsDir, 'pwa-maskable-512x512.png'), size: 512 },
    // Backwards compatibility
    { file: path.join(iconsDir, 'icon-192x192.png'), size: 192 },
    { file: path.join(iconsDir, 'icon-512x512.png'), size: 512 },
    { file: path.join(iconsDir, 'icon-maskable-192x192.png'), size: 192 },
    { file: path.join(iconsDir, 'icon-maskable-512x512.png'), size: 512 },
    // Favicons
    { file: path.join(iconsDir, 'favicon-16x16.png'), size: 16 },
    { file: path.join(iconsDir, 'favicon-32x32.png'), size: 32 },
    { file: path.join(publicDir, 'favicon.png'), size: 64 },
  ];

  for (const t of targets) {
    await sharp(svgBuffer)
      .resize(t.size, t.size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .flatten({ background: '#ffffff' }) // Ensures solid white background, removes any transparency
      .removeAlpha() // 24-bit solid RGB (Prevents iOS from filling alpha with black)
      .png({ quality: 100, compressionLevel: 9 })
      .toFile(t.file);
    console.log(`Generated: ${t.file} (${t.size}x${t.size}) - Solid RGB`);
  }

  // Favicon ICO (Multi-size with 32x32 PNG)
  const ico32 = await sharp(svgBuffer)
    .resize(32, 32)
    .flatten({ background: '#ffffff' })
    .removeAlpha()
    .png()
    .toBuffer();

  const icoHeader = Buffer.from([
    0, 0, 1, 0, 1, 0,
    32, 32, 0, 0, 1, 0, 32, 0,
    ...intToBytes(ico32.length, 4),
    ...intToBytes(22, 4)
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
