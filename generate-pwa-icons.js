import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const outDir = path.resolve('public/icons');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 1. Regular Icon SVG (Solid navy blue background #0d172d, vibrant lime tennis ball #baff00 with curved white seams)
const createTennisBallSvg = (size, isMaskable = false) => {
  const ballRadius = isMaskable ? size * 0.33 : size * 0.38;
  const cx = size / 2;
  const cy = size / 2;
  const seamWidth = size * 0.032;

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0F1B38" />
      <stop offset="100%" stop-color="#080F20" />
    </linearGradient>

    <!-- Ball Base Gradient -->
    <radialGradient id="ballGrad" cx="35%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#E4FF38" />
      <stop offset="60%" stop-color="#BAFF00" />
      <stop offset="100%" stop-color="#88CC00" />
    </radialGradient>

    <!-- Ball Shadow Filter -->
    <filter id="dropShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="${size * 0.02}" stdDeviation="${size * 0.03}" flood-color="#000000" flood-opacity="0.5" />
    </filter>

    <!-- Clip Path for Tennis Ball Seams -->
    <clipPath id="ballClip">
      <circle cx="${cx}" cy="${cy}" r="${ballRadius}" />
    </clipPath>
  </defs>

  <!-- Background -->
  <rect width="${size}" height="${size}" fill="url(#bgGrad)" />

  <!-- Ball Circle with Shadow -->
  <g filter="url(#dropShadow)">
    <circle cx="${cx}" cy="${cy}" r="${ballRadius}" fill="url(#ballGrad)" />
  </g>

  <!-- Seams (Standard Tennis Ball Curves) inside clip path -->
  <g clip-path="url(#ballClip)">
    <!-- Subtle 3D Spherical Texture Overlay -->
    <ellipse cx="${cx - ballRadius * 0.2}" cy="${cy - ballRadius * 0.3}" rx="${ballRadius * 0.6}" ry="${ballRadius * 0.35}" fill="#ffffff" opacity="0.22" />
    
    <!-- Left Curve Seam -->
    <path d="M ${cx - ballRadius * 0.9} ${cy - ballRadius * 0.55} C ${cx - ballRadius * 0.15} ${cy - ballRadius * 0.35}, ${cx - ballRadius * 0.15} ${cy + ballRadius * 0.35}, ${cx - ballRadius * 0.9} ${cy + ballRadius * 0.55}"
      fill="none"
      stroke="#ffffff"
      stroke-width="${seamWidth}"
      stroke-linecap="round"
      opacity="0.95"
    />
    <path d="M ${cx - ballRadius * 0.9} ${cy - ballRadius * 0.55} C ${cx - ballRadius * 0.15} ${cy - ballRadius * 0.35}, ${cx - ballRadius * 0.15} ${cy + ballRadius * 0.35}, ${cx - ballRadius * 0.9} ${cy + ballRadius * 0.55}"
      fill="none"
      stroke="#6B9900"
      stroke-width="${seamWidth * 0.35}"
      stroke-linecap="round"
      opacity="0.4"
    />

    <!-- Right Curve Seam -->
    <path d="M ${cx + ballRadius * 0.9} ${cy - ballRadius * 0.55} C ${cx + ballRadius * 0.15} ${cy - ballRadius * 0.35}, ${cx + ballRadius * 0.15} ${cy + ballRadius * 0.35}, ${cx + ballRadius * 0.9} ${cy + ballRadius * 0.55}"
      fill="none"
      stroke="#ffffff"
      stroke-width="${seamWidth}"
      stroke-linecap="round"
      opacity="0.95"
    />
    <path d="M ${cx + ballRadius * 0.9} ${cy - ballRadius * 0.55} C ${cx + ballRadius * 0.15} ${cy - ballRadius * 0.35}, ${cx + ballRadius * 0.15} ${cy + ballRadius * 0.35}, ${cx + ballRadius * 0.9} ${cy + ballRadius * 0.55}"
      fill="none"
      stroke="#6B9900"
      stroke-width="${seamWidth * 0.35}"
      stroke-linecap="round"
      opacity="0.4"
    />
  </g>
</svg>`;
};

async function generate() {
  console.log('Generating PWA Icons...');
  
  // 192x192
  const svg192 = Buffer.from(createTennisBallSvg(192, false));
  await sharp(svg192).png().toFile('public/icons/icon-192x192.png');
  console.log('Created public/icons/icon-192x192.png');

  // 512x512
  const svg512 = Buffer.from(createTennisBallSvg(512, false));
  await sharp(svg512).png().toFile('public/icons/icon-512x512.png');
  console.log('Created public/icons/icon-512x512.png');

  // Maskable 192x192
  const svgMask192 = Buffer.from(createTennisBallSvg(192, true));
  await sharp(svgMask192).png().toFile('public/icons/icon-maskable-192x192.png');
  console.log('Created public/icons/icon-maskable-192x192.png');

  // Maskable 512x512
  const svgMask512 = Buffer.from(createTennisBallSvg(512, true));
  await sharp(svgMask512).png().toFile('public/icons/icon-maskable-512x512.png');
  console.log('Created public/icons/icon-maskable-512x512.png');

  // Apple touch icon 180x180
  const svgApple = Buffer.from(createTennisBallSvg(180, false));
  await sharp(svgApple).png().toFile('public/icons/apple-touch-icon.png');
  console.log('Created public/icons/apple-touch-icon.png');

  // Favicon 64x64 as png/ico
  const svgFavicon = Buffer.from(createTennisBallSvg(64, false));
  await sharp(svgFavicon).png().toFile('public/favicon.ico');
  await sharp(svgFavicon).png().toFile('public/favicon.png');
  console.log('Created public/favicon.ico');

  console.log('All icons generated successfully!');
}

generate().catch(console.error);
