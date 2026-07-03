// Version: 1.0001
// Брандинг като SVG в код (без бинарни файлове). Акцентът идва от config.js.
// gen-assets.mjs записва store/icon.svg и store/splash.svg.
import { ACCENT, ACCENT2, APP_NAME } from './config.js';

// Икона: радар/„следене" мотив — концентрични дъги + сканираща линия.
export function iconSVG(size = 1024) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${ACCENT}"/>
      <stop offset="100%" stop-color="${ACCENT2}"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" rx="200" fill="#0c0f14"/>
  <circle cx="512" cy="512" r="360" fill="none" stroke="${ACCENT2}" stroke-opacity="0.25" stroke-width="20"/>
  <circle cx="512" cy="512" r="250" fill="none" stroke="${ACCENT2}" stroke-opacity="0.35" stroke-width="20"/>
  <circle cx="512" cy="512" r="140" fill="none" stroke="${ACCENT2}" stroke-opacity="0.5" stroke-width="20"/>
  <!-- сканиращ сектор -->
  <path d="M512 512 L512 132 A380 380 0 0 1 820 330 Z" fill="url(#bg)" fill-opacity="0.85"/>
  <circle cx="512" cy="512" r="46" fill="url(#bg)"/>
  <text x="512" y="930" text-anchor="middle" font-family="system-ui,Arial" font-size="96"
        font-weight="800" fill="${ACCENT2}">${APP_NAME}</text>
</svg>`;
}

export function splashSVG() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1242" height="2436" viewBox="0 0 1242 2436">
  <defs>
    <radialGradient id="g" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="${ACCENT}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#0c0f14"/>
    </radialGradient>
  </defs>
  <rect width="1242" height="2436" fill="#0c0f14"/>
  <rect width="1242" height="2436" fill="url(#g)"/>
  <g transform="translate(621,1100)">
    <circle r="280" fill="none" stroke="${ACCENT2}" stroke-opacity="0.3" stroke-width="16"/>
    <circle r="180" fill="none" stroke="${ACCENT2}" stroke-opacity="0.45" stroke-width="16"/>
    <circle r="40" fill="${ACCENT}"/>
  </g>
  <text x="621" y="1480" text-anchor="middle" font-family="system-ui,Arial" font-size="84"
        font-weight="800" fill="${ACCENT2}">${APP_NAME}</text>
  <text x="621" y="1560" text-anchor="middle" font-family="system-ui,Arial" font-size="40"
        fill="#9aa6b5">следи източник · известява локално</text>
</svg>`;
}
