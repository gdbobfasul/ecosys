// Генератор на икона и splash като SVG (код, не бинарни файлове).
// Стартиране:  node tools/gen-assets.mjs
// Резултат:    store/icon.svg, store/splash.svg
// За магазина после конвертирай SVG -> PNG (виж store/CHECKLIST.md).
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'store');

// Тема за Huawei AppGallery (хладен сапфирен акцент). Различава се от rustore копието.
const THEME = {
  bgTop: '#0c1b3a',
  bgBottom: '#06060a',
  primary: '#1f6feb',
  accent: '#4d9aff',
  edge: '#cfe2ff',
  store: 'AppGallery'
};

// Кръстосани мечове — мотив за дуела.
function swords(cx, cy, s) {
  const a = `M ${cx - s} ${cy + s} L ${cx + s} ${cy - s} L ${cx + s * 1.15} ${cy - s * 0.85} L ${cx - s * 0.85} ${cy + s * 1.15} Z`;
  const b = `M ${cx + s} ${cy + s} L ${cx - s} ${cy - s} L ${cx - s * 1.15} ${cy - s * 0.85} L ${cx + s * 0.85} ${cy + s * 1.15} Z`;
  return a + ' ' + b;
}

function icon(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="80%">
      <stop offset="0%" stop-color="${THEME.bgTop}"/>
      <stop offset="100%" stop-color="${THEME.bgBottom}"/>
    </radialGradient>
    <linearGradient id="blade" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${THEME.edge}"/>
      <stop offset="100%" stop-color="${THEME.primary}"/>
    </linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="9" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#bg)"/>
  <circle cx="120" cy="110" r="3" fill="#cfe2ff" opacity="0.7"/>
  <circle cx="400" cy="150" r="2.5" fill="${THEME.accent}" opacity="0.7"/>
  <circle cx="150" cy="400" r="2" fill="#cfe2ff" opacity="0.6"/>
  <path d="${swords(256, 256, 130)}" fill="url(#blade)" filter="url(#glow)"/>
  <circle cx="256" cy="256" r="26" fill="${THEME.accent}" opacity="0.85"/>
</svg>`;
}

function splash() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <defs>
    <radialGradient id="sky" cx="50%" cy="38%" r="80%">
      <stop offset="0%" stop-color="${THEME.bgTop}"/>
      <stop offset="100%" stop-color="${THEME.bgBottom}"/>
    </radialGradient>
    <linearGradient id="blade" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${THEME.edge}"/>
      <stop offset="100%" stop-color="${THEME.primary}"/>
    </linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="16" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="1080" height="1920" fill="url(#sky)"/>
  <path d="${swords(540, 760, 220)}" fill="url(#blade)" filter="url(#glow)"/>
  <circle cx="540" cy="760" r="40" fill="${THEME.accent}" opacity="0.85"/>
  <text x="540" y="1180" font-family="Georgia, serif" font-size="92"
        font-weight="bold" fill="#cfe2ff" text-anchor="middle">ДУЕЛ НА РИНГА</text>
  <text x="540" y="1250" font-family="system-ui, sans-serif" font-size="40"
        fill="${THEME.accent}" text-anchor="middle">${THEME.store} Edition</text>
</svg>`;
}

mkdirSync(OUT, { recursive: true });
writeFileSync(resolve(OUT, 'icon.svg'), icon(512));
writeFileSync(resolve(OUT, 'splash.svg'), splash());
console.log('Готово: store/icon.svg, store/splash.svg (' + THEME.store + ')');
