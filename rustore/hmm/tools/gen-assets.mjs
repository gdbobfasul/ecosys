// Version: 1.0001
// Генератор на икона и splash като SVG (код, не бинарни файлове).
// Стартиране:  node tools/gen-assets.mjs
// Резултат:    store/icon.svg, store/splash.svg
// За магазина после конвертирай SVG -> PNG (виж store/CHECKLIST.md).
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'store');

// Тема за RUStore (топло злато / мед — в духа на HMM).
const THEME = {
  bgTop: '#2a1a10',
  bgBottom: '#06060a',
  primary: '#caa45a',
  accent: '#f8c450',
  edge: '#f0d896',
  store: 'RUStore'
};

// Кръстосани мечове + щит — символ на отборната битка.
function emblem(cx, cy, s) {
  const blade = (ang) => {
    return `<g transform="rotate(${ang} ${cx} ${cy})">
      <rect x="${cx - s * 0.05}" y="${cy - s}" width="${s * 0.1}" height="${s * 1.5}" rx="${s * 0.03}" fill="url(#steel)"/>
      <rect x="${cx - s * 0.18}" y="${cy + s * 0.35}" width="${s * 0.36}" height="${s * 0.08}" rx="3" fill="${THEME.primary}"/>
      <rect x="${cx - s * 0.04}" y="${cy + s * 0.4}" width="${s * 0.08}" height="${s * 0.3}" fill="${THEME.primary}"/>
    </g>`;
  };
  return `${blade(45)}${blade(-45)}`;
}

function icon(size) {
  const cx = 256, cy = 256, s = 150;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="75%">
      <stop offset="0%" stop-color="${THEME.bgTop}"/>
      <stop offset="100%" stop-color="${THEME.bgBottom}"/>
    </radialGradient>
    <linearGradient id="steel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${THEME.edge}"/>
      <stop offset="100%" stop-color="#9a8862"/>
    </linearGradient>
    <linearGradient id="shield" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${THEME.primary}"/>
      <stop offset="100%" stop-color="#5a3a1e"/>
    </linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="8" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#bg)"/>
  <path d="M 256 96 L 392 150 L 392 300 Q 392 400 256 432 Q 120 400 120 300 L 120 150 Z"
        fill="url(#shield)" stroke="${THEME.accent}" stroke-width="6" opacity="0.92"/>
  <g filter="url(#glow)">${emblem(cx, cy, s)}</g>
</svg>`;
}

function splash() {
  const cx = 540, cy = 760, s = 170;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${THEME.bgTop}"/>
      <stop offset="100%" stop-color="${THEME.bgBottom}"/>
    </linearGradient>
    <linearGradient id="steel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${THEME.edge}"/>
      <stop offset="100%" stop-color="#9a8862"/>
    </linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="14" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="1080" height="1920" fill="url(#sky)"/>
  <g filter="url(#glow)">${emblem(cx, cy, s)}</g>
  <text x="540" y="1180" font-family="Georgia, serif" font-size="92"
        font-weight="bold" fill="${THEME.accent}" text-anchor="middle">БИТКА НА ТЕРЕН</text>
  <text x="540" y="1250" font-family="Georgia, serif" font-size="44"
        fill="${THEME.primary}" text-anchor="middle">HMM · ${THEME.store} издание</text>
</svg>`;
}

mkdirSync(OUT, { recursive: true });
writeFileSync(resolve(OUT, 'icon.svg'), icon(512));
writeFileSync(resolve(OUT, 'splash.svg'), splash());
console.log('Готово: store/icon.svg, store/splash.svg (' + THEME.store + ')');
