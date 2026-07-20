// Version: 1.0001
// gen-assets.mjs — генерира store/icon.svg и store/splash.svg (SVG като код).
// Стартиране:  node tools/gen-assets.mjs
// За store-овете после конвертирай SVG -> PNG (виж store/CHECKLIST.md).
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'store');

// Тема за RUStore — синьо.
const THEME = {
  bgTop: '#13203f',
  bgBottom: '#0b1020',
  accent: '#3a7afe',
  accent2: '#6aa6ff',
  bubble: '#1d2742',
  ok: '#3ad29f'
};

// Глава на робот + чат балон (символика на авто-отговор).
function robot(cx, cy, s) {
  return `
    <rect x="${cx - s}" y="${cy - s * 0.8}" width="${s * 2}" height="${s * 1.6}" rx="${s * 0.35}" fill="${THEME.accent}"/>
    <circle cx="${cx - s * 0.4}" cy="${cy - s * 0.05}" r="${s * 0.22}" fill="#06122b"/>
    <circle cx="${cx + s * 0.4}" cy="${cy - s * 0.05}" r="${s * 0.22}" fill="#06122b"/>
    <rect x="${cx - s * 0.45}" y="${cy + s * 0.35}" width="${s * 0.9}" height="${s * 0.16}" rx="${s * 0.08}" fill="#06122b"/>
    <line x1="${cx}" y1="${cy - s * 0.8}" x2="${cx}" y2="${cy - s * 1.25}" stroke="${THEME.accent2}" stroke-width="${s * 0.12}"/>
    <circle cx="${cx}" cy="${cy - s * 1.3}" r="${s * 0.16}" fill="${THEME.ok}"/>`;
}

function bubble(cx, cy, s) {
  return `
    <rect x="${cx - s}" y="${cy - s * 0.6}" width="${s * 2}" height="${s * 1.2}" rx="${s * 0.3}" fill="${THEME.bubble}"/>
    <path d="M ${cx - s * 0.3} ${cy + s * 0.55} L ${cx - s * 0.05} ${cy + s * 0.95} L ${cx + s * 0.2} ${cy + s * 0.55} Z" fill="${THEME.bubble}"/>
    <circle cx="${cx - s * 0.45}" cy="${cy}" r="${s * 0.12}" fill="${THEME.accent2}"/>
    <circle cx="${cx}" cy="${cy}" r="${s * 0.12}" fill="${THEME.accent2}"/>
    <circle cx="${cx + s * 0.45}" cy="${cy}" r="${s * 0.12}" fill="${THEME.accent2}"/>`;
}

function icon(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="75%">
      <stop offset="0%" stop-color="${THEME.bgTop}"/>
      <stop offset="100%" stop-color="${THEME.bgBottom}"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#bg)"/>
  ${robot(256, 200, 95)}
  ${bubble(256, 380, 80)}
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
  ${robot(540, 760, 170)}
  ${bubble(540, 1080, 150)}
  <text x="540" y="1420" font-family="system-ui, sans-serif" font-size="84"
        font-weight="bold" fill="${THEME.accent2}" text-anchor="middle">Pupikes Auto Answer</text>
  <text x="540" y="1485" font-family="system-ui, sans-serif" font-size="38"
        fill="${THEME.ok}" text-anchor="middle">RUStore Edition</text>
</svg>`;
}

mkdirSync(OUT, { recursive: true });
writeFileSync(resolve(OUT, 'icon.svg'), icon(512));
writeFileSync(resolve(OUT, 'splash.svg'), splash());
console.log('Готово: store/icon.svg, store/splash.svg');
