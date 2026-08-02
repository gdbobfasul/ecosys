// Version: 1.0001
// Генератор на икона и splash екран като SVG (без бинарни файлове).
// Стартирай: node generate-assets.mjs
// Резултат: assets/icon.svg и assets/splash.svg
// За Capacitor/Android после преобразувай SVG → PNG с инструмент по избор
// (напр. @capacitor/assets или онлайн конвертор) — виж README.
import { writeFileSync, mkdirSync } from 'node:fs';

const ACCENT = '#c8102e';        // Huawei червено
const ACCENT2 = '#e8536a';
const BG = '#0d1117';

mkdirSync('assets', { recursive: true });

// Икона 1024x1024 — закръглен квадрат с инструмент-символ (гаечен ключ + QR акцент).
const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${ACCENT}"/>
      <stop offset="1" stop-color="${ACCENT2}"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" rx="220" fill="${BG}"/>
  <rect x="80" y="80" width="864" height="864" rx="180" fill="url(#g)"/>
  <g fill="none" stroke="#ffffff" stroke-width="46" stroke-linecap="round" stroke-linejoin="round">
    <path d="M620 360a120 120 0 0 1-150 150L360 620l44 44 110-110a120 120 0 0 0 150-150z"/>
    <rect x="300" y="300" width="120" height="120" rx="18"/>
    <rect x="604" y="604" width="120" height="120" rx="18"/>
  </g>
</svg>`;

// Splash 2048x2048 — фон + лого централно.
const splash = `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048" viewBox="0 0 2048 2048">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${ACCENT}"/>
      <stop offset="1" stop-color="${ACCENT2}"/>
    </linearGradient>
  </defs>
  <rect width="2048" height="2048" fill="${BG}"/>
  <g transform="translate(704,624)">
    <rect width="640" height="640" rx="140" fill="url(#g)"/>
    <g fill="none" stroke="#ffffff" stroke-width="34" stroke-linecap="round" stroke-linejoin="round" transform="translate(120,120) scale(0.62)">
      <path d="M620 360a120 120 0 0 1-150 150L360 620l44 44 110-110a120 120 0 0 0 150-150z"/>
      <rect x="300" y="300" width="120" height="120" rx="18"/>
      <rect x="604" y="604" width="120" height="120" rx="18"/>
    </g>
  </g>
  <text x="1024" y="1480" font-family="system-ui,Segoe UI,Roboto,sans-serif" font-size="96" font-weight="700" fill="#e6edf3" text-anchor="middle">Services Toolkit</text>
</svg>`;

writeFileSync('assets/icon.svg', icon);
writeFileSync('assets/splash.svg', splash);
console.log('Generated assets/icon.svg and assets/splash.svg');
