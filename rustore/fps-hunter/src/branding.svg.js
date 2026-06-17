// Генератор на икона и splash като inline SVG (без бинарни файлове).
// Рендирай на 512/1024 за иконата и 1080x1920 за splash (виж store/CHECKLIST.md).
import { THEME } from './theme.js';

// Икона: мерник (crosshair) върху хълмист пейзаж — символ на FPS лов.
export function iconSVG(size = 512) {
  const a = THEME.accent;
  const a2 = THEME.accent2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#16324d"/>
      <stop offset="1" stop-color="${THEME.bg}"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#sky)"/>
  <path d="M0 360 Q128 300 256 350 T512 340 V512 H0 Z" fill="#1d3b2a"/>
  <path d="M0 410 Q160 360 320 400 T512 395 V512 H0 Z" fill="#142b1e"/>
  <g stroke="${a}" stroke-width="14" fill="none" opacity="0.95">
    <circle cx="256" cy="220" r="120"/>
    <line x1="256" y1="60" x2="256" y2="140"/>
    <line x1="256" y1="300" x2="256" y2="380"/>
    <line x1="96" y1="220" x2="176" y2="220"/>
    <line x1="336" y1="220" x2="416" y2="220"/>
  </g>
  <circle cx="256" cy="220" r="14" fill="${a2}"/>
</svg>`;
}

// Splash: вертикален, лого центрирано.
export function splashSVG(w = 1080, h = 1920) {
  const a = THEME.accent;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 1080 1920">
  <rect width="1080" height="1920" fill="${THEME.bg}"/>
  <g transform="translate(284,720) scale(1.0)">${iconSVG(512).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</g>
  <text x="540" y="1320" text-anchor="middle" fill="${a}"
        font-family="${THEME.fontStack}" font-size="72" font-weight="800"
        letter-spacing="6">FPS HUNTER</text>
  <text x="540" y="1390" text-anchor="middle" fill="#7a8a9a"
        font-family="${THEME.fontStack}" font-size="30" letter-spacing="4">100 LEVELS</text>
</svg>`;
}

// Помощник: data URL за директна употреба като <img src> при ръчно експортиране.
export function svgDataUrl(svg) {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
