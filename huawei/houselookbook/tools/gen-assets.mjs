// Version: 1.0001
// Генератор на икона и splash екран като SVG (без бинарни файлове).
// Стартирай: node tools/gen-assets.mjs   (или npm run assets)
// Резултат: store/icon.svg и store/splash.svg
// За Android после преобразувай SVG → PNG с инструмент по избор
// (напр. @capacitor/assets) — виж README.
import { writeFileSync, mkdirSync } from 'node:fs';

// Huawei AppGallery акцент: червено (различава се от rustore изданието).
const ACCENT = '#c8102e';
const ACCENT2 = '#ff5252';
const BG = '#1a0608';
const LABEL = 'KCY Chat';

mkdirSync('store', { recursive: true });

// Икона 1024x1024 — закръглен квадрат с символ на чат балон.
const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${ACCENT}"/>
      <stop offset="1" stop-color="${ACCENT2}"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" rx="220" fill="${BG}"/>
  <rect x="80" y="80" width="864" height="864" rx="180" fill="url(#g)"/>
  <g fill="#ffffff">
    <path d="M512 280c-146 0-264 96-264 214 0 66 38 124 97 162-7 36-28 70-58 96 49-7 96-26 134-54 29 8 59 14 91 14 146 0 264-96 264-214S658 280 512 280z"/>
  </g>
  <g fill="${ACCENT}">
    <circle cx="420" cy="494" r="30"/>
    <circle cx="512" cy="494" r="30"/>
    <circle cx="604" cy="494" r="30"/>
  </g>
</svg>`;

// Splash 2048x2048 — фон + лого централно + надпис.
const splash = `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048" viewBox="0 0 2048 2048">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${ACCENT}"/>
      <stop offset="1" stop-color="${ACCENT2}"/>
    </linearGradient>
  </defs>
  <rect width="2048" height="2048" fill="${BG}"/>
  <g transform="translate(704,560)">
    <rect width="640" height="640" rx="140" fill="url(#g)"/>
    <g transform="translate(320,320) scale(0.55) translate(-512,-512)">
      <path fill="#ffffff" d="M512 280c-146 0-264 96-264 214 0 66 38 124 97 162-7 36-28 70-58 96 49-7 96-26 134-54 29 8 59 14 91 14 146 0 264-96 264-214S658 280 512 280z"/>
      <circle cx="420" cy="494" r="30" fill="${ACCENT}"/>
      <circle cx="512" cy="494" r="30" fill="${ACCENT}"/>
      <circle cx="604" cy="494" r="30" fill="${ACCENT}"/>
    </g>
  </g>
  <text x="1024" y="1480" font-family="system-ui,Segoe UI,Roboto,sans-serif" font-size="104" font-weight="700" fill="#f5e9ea" text-anchor="middle">${LABEL}</text>
</svg>`;

writeFileSync('store/icon.svg', icon);
writeFileSync('store/splash.svg', splash);
console.log('Generated store/icon.svg and store/splash.svg (Huawei accent ' + ACCENT + ')');
