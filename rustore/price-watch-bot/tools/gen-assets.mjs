// Version: 1.0001
// Генератор на икона и splash като SVG (без бинарни файлове).
// Стартирай: node tools/gen-assets.mjs
// Резултат: store/icon.svg и store/splash.svg
// За Android после конвертирай SVG → PNG (напр. @capacitor/assets) — виж README.
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ACCENT = '#0a84ff';   // RUStore акцент
const ACCENT2 = '#5ac8fa';
const BG = '#0d1117';

const here = dirname(fileURLToPath(import.meta.url));
const storeDir = join(here, '..', 'store');
mkdirSync(storeDir, { recursive: true });

// Робот-глава с „поглед към графика" — символ на ценовия робот.
const glyph = (sw) => `
  <g fill="none" stroke="#ffffff" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">
    <rect x="312" y="360" width="400" height="300" rx="60"/>
    <circle cx="430" cy="500" r="34" fill="#ffffff" stroke="none"/>
    <circle cx="594" cy="500" r="34" fill="#ffffff" stroke="none"/>
    <line x1="512" y1="300" x2="512" y2="360"/>
    <circle cx="512" cy="280" r="22" fill="#ffffff" stroke="none"/>
    <polyline points="360,600 430,560 500,590 580,520 660,560"/>
  </g>`;

const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${ACCENT}"/><stop offset="1" stop-color="${ACCENT2}"/>
  </linearGradient></defs>
  <rect width="1024" height="1024" rx="220" fill="${BG}"/>
  <rect x="80" y="80" width="864" height="864" rx="180" fill="url(#g)"/>
  ${glyph(40)}
</svg>`;

const splash = `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048" viewBox="0 0 2048 2048">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${ACCENT}"/><stop offset="1" stop-color="${ACCENT2}"/>
  </linearGradient></defs>
  <rect width="2048" height="2048" fill="${BG}"/>
  <g transform="translate(704,560)">
    <rect width="640" height="640" rx="140" fill="url(#g)"/>
    <g transform="scale(0.625)">${glyph(34)}</g>
  </g>
  <text x="1024" y="1480" font-family="system-ui,Segoe UI,Roboto,sans-serif" font-size="92" font-weight="700" fill="#e6edf3" text-anchor="middle">Pupikes Toolkit Price Watch</text>
</svg>`;

writeFileSync(join(storeDir, 'icon.svg'), icon);
writeFileSync(join(storeDir, 'splash.svg'), splash);
console.log('Generated store/icon.svg and store/splash.svg (accent ' + ACCENT + ')');
