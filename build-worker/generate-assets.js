'use strict';

/**
 * Step 5 — generate the app icon and splash screen.
 * Uses the uploaded PNG when provided, otherwise renders a branded
 * default icon (gradient + "</>" monogram) with sharp, then generates
 * all Android densities + adaptive icons via @capacitor/assets.
 */

const fs = require('fs');
const { execSync } = require('child_process');
const { loadConfig } = require('./lib-common');

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function shade(hex, factor) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * factor);
  const g = Math.round(((n >> 8) & 255) * factor);
  const b = Math.round((n & 255) * factor);
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}

function defaultIconSvg(bg) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${bg}"/>
      <stop offset="1" stop-color="${shade(bg, 0.55)}"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" rx="0" fill="url(#g)"/>
  <text x="512" y="560" font-family="DejaVu Sans, sans-serif" font-size="360" font-weight="bold" fill="#ffffff" text-anchor="middle">&lt;/&gt;</text>
</svg>`;
}

function splashSvg(bg, name) {
  const fontSize = Math.max(90, Math.min(240, Math.floor(2300 / Math.max(name.length, 1) * 1.25)));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${bg}"/>
      <stop offset="1" stop-color="${shade(bg, 0.6)}"/>
    </linearGradient>
  </defs>
  <rect width="2732" height="2732" fill="url(#g)"/>
  <text x="1366" y="1400" font-family="DejaVu Sans, sans-serif" font-size="${fontSize}" font-weight="bold" fill="#ffffff" text-anchor="middle">${esc(name)}</text>
</svg>`;
}

function main() {
  const cfg = loadConfig();
  const bg = cfg.appearance.themeColor || '#6D5EF8';

  execSync('npm install -D sharp@^0.33.4 @capacitor/assets@^3.0.5 --no-audit --no-fund --loglevel=error', {
    cwd: 'app',
    stdio: ['ignore', 'inherit', 'inherit'],
  });

  fs.mkdirSync('app/assets', { recursive: true });

  if (fs.existsSync('work/icon.png')) {
    const sharp = require(path.resolve('app/node_modules/sharp'));
    sharp('work/icon.png')
      .resize(1024, 1024, { fit: 'cover', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFileSync('app/assets/logo.png');
    console.log('Using uploaded icon');
  } else {
    const sharp = require(path.resolve('app/node_modules/sharp'));
    sharp(Buffer.from(defaultIconSvg(bg))).png().toFileSync('app/assets/logo.png');
    console.log('Generated default branded icon');
  }

  if (cfg.appearance.splashText || cfg.appName) {
    const sharp = require(path.resolve('app/node_modules/sharp'));
    sharp(Buffer.from(splashSvg(bg, cfg.appearance.splashText || cfg.appName))).png().toFileSync('app/assets/splash.png');
  }

  execSync(
    `npx capacitor-assets generate --android --assetPath assets ` +
      `--iconBackgroundColor "${bg}" --iconBackgroundColorDark "${shade(bg, 0.7)}" ` +
      `--splashBackgroundColor "${bg}" --splashBackgroundColorDark "${shade(bg, 0.7)}"`,
    { cwd: 'app', stdio: ['ignore', 'inherit', 'inherit'] }
  );
  console.log('Android icons + splash generated');
}

main();
