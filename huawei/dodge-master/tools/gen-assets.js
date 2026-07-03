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

// Тема за Huawei AppGallery (кехлибар / тюркоаз — по-хладна палитра).
const THEME = {
  bgTop: '#241626',
  bgBottom: '#0c0a10',
  primary: '#ff7a3c',
  accent: '#3ab0a0',
  danger: '#ff3b5b',
  skin: '#e8b894',
  cloth: '#6a3a52'
};

// Глава с шапка + рамене (top-down герой), центрирани в (cx,cy).
function hero(cx, cy, s) {
  return `
    <ellipse cx="${cx}" cy="${cy + s * 1.15}" rx="${s * 1.3}" ry="${s * 0.4}" fill="#000" opacity="0.3"/>
    <path d="M ${cx - s * 1.2} ${cy + s * 1.3} L ${cx - s * 0.85} ${cy + s * 0.2}
             L ${cx + s * 0.85} ${cy + s * 0.2} L ${cx + s * 1.2} ${cy + s * 1.3} Z"
          fill="${THEME.cloth}"/>
    <circle cx="${cx}" cy="${cy - s * 0.1}" r="${s}" fill="${THEME.skin}"/>
    <ellipse cx="${cx}" cy="${cy - s * 0.55}" rx="${s * 1.7}" ry="${s * 1.05}" fill="${THEME.primary}"/>
    <circle cx="${cx}" cy="${cy - s * 0.75}" r="${s * 0.55}" fill="#c59a3a"/>`;
}

// Летящ снаряд (камък) с warning-стрелка.
function projectile(cx, cy, s, color) {
  return `<circle cx="${cx}" cy="${cy}" r="${s}" fill="${color}"/>
          <circle cx="${cx - s * 0.3}" cy="${cy - s * 0.3}" r="${s * 0.35}" fill="#fff" opacity="0.4"/>`;
}

function icon(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="42%" r="75%">
      <stop offset="0%" stop-color="${THEME.bgTop}"/>
      <stop offset="100%" stop-color="${THEME.bgBottom}"/>
    </radialGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="6" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#bg)"/>
  ${hero(256, 250, 90)}
  ${projectile(110, 120, 26, '#7d7468')}
  ${projectile(410, 150, 22, '#b5703a')}
  ${projectile(120, 400, 20, '#eaf4ff')}
  ${projectile(400, 410, 24, THEME.danger)}
  <path d="M 150 90 L 200 130 L 168 132 L 178 165 L 150 90 Z" fill="${THEME.danger}" opacity="0.9"/>
</svg>`;
}

function splash() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${THEME.bgTop}"/>
      <stop offset="100%" stop-color="${THEME.bgBottom}"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1920" fill="url(#sky)"/>
  ${hero(540, 720, 150)}
  ${projectile(220, 380, 40, '#7d7468')}
  ${projectile(860, 420, 34, '#b5703a')}
  ${projectile(260, 1020, 32, '#eaf4ff')}
  ${projectile(820, 1000, 38, THEME.danger)}
  <text x="540" y="1320" font-family="system-ui, sans-serif" font-size="96"
        font-weight="bold" fill="${THEME.primary}" text-anchor="middle">DODGE MASTER</text>
  <text x="540" y="1390" font-family="system-ui, sans-serif" font-size="40"
        fill="${THEME.accent}" text-anchor="middle">AppGallery Edition</text>
</svg>`;
}

mkdirSync(OUT, { recursive: true });
writeFileSync(resolve(OUT, 'icon.svg'), icon(512));
writeFileSync(resolve(OUT, 'splash.svg'), splash());
console.log('Готово: store/icon.svg, store/splash.svg');
