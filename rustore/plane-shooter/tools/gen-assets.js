// Version: 1.0001
// Генератор на икона и splash като SVG (код, не бинарни файлове).
// Стартиране:  node tools/gen-assets.js
// Резултат:    store/icon.svg, store/splash.svg
// За store-овете после конвертирай SVG -> PNG (виж store/CHECKLIST.md).
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'store');

// Тема за RUStore (студено синьо / циан).
const THEME = {
  bgTop: '#0b1430',
  bgBottom: '#05060f',
  primary: '#3aa0ff',
  accent: '#00e5ff',
  edge: '#cdefff'
};

function planePath(cx, cy, s) {
  // Прост триъгълен самолет, центриран в (cx,cy), мащаб s.
  const top = cy - s, bot = cy + s * 0.7, wing = s * 0.9;
  return `M ${cx} ${top} L ${cx + wing} ${bot} L ${cx} ${cy + s * 0.3} L ${cx - wing} ${bot} Z`;
}

function icon(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="75%">
      <stop offset="0%" stop-color="${THEME.bgTop}"/>
      <stop offset="100%" stop-color="${THEME.bgBottom}"/>
    </radialGradient>
    <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${THEME.edge}"/>
      <stop offset="100%" stop-color="${THEME.primary}"/>
    </linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="10" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#bg)"/>
  <circle cx="120" cy="110" r="3" fill="#fff" opacity="0.8"/>
  <circle cx="400" cy="160" r="2.5" fill="#9fd8ff" opacity="0.7"/>
  <circle cx="360" cy="380" r="3" fill="#fff" opacity="0.6"/>
  <circle cx="150" cy="400" r="2" fill="#9fd8ff" opacity="0.6"/>
  <path d="${planePath(256, 256, 150)}" fill="url(#body)" filter="url(#glow)"/>
  <ellipse cx="256" cy="200" rx="14" ry="26" fill="#ffffff" opacity="0.9"/>
</svg>`;
}

function splash() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${THEME.bgTop}"/>
      <stop offset="100%" stop-color="${THEME.bgBottom}"/>
    </linearGradient>
    <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${THEME.edge}"/>
      <stop offset="100%" stop-color="${THEME.primary}"/>
    </linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="16" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="1080" height="1920" fill="url(#sky)"/>
  <path d="${planePath(540, 820, 180)}" fill="url(#body)" filter="url(#glow)"/>
  <text x="540" y="1180" font-family="system-ui, sans-serif" font-size="84"
        font-weight="bold" fill="#ffffff" text-anchor="middle">PLANE SHOOTER</text>
  <text x="540" y="1250" font-family="system-ui, sans-serif" font-size="40"
        fill="${THEME.accent}" text-anchor="middle">RUStore Edition</text>
</svg>`;
}

mkdirSync(OUT, { recursive: true });
writeFileSync(resolve(OUT, 'icon.svg'), icon(512));
writeFileSync(resolve(OUT, 'splash.svg'), splash());
console.log('Готово: store/icon.svg, store/splash.svg');
