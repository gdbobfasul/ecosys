// Version: 1.0001
// Генератор на иконата и splash-екрана като SVG (без бинарни файлове).
// Може да се извика от build-скрипт или ръчно, за да се изведе SVG/data-URI,
// който после се конвертира до PNG (ImageMagick/онлайн) за Capacitor ресурси.
// Huawei палитра: изумрудено зелено + златисто.

export const BRAND = {
  bg1: '#0e3322',
  bg2: '#05120c',
  accent: '#2ecf8f',
  accent2: '#ffd24a',
  name: 'GODFIST ARENA'
};

// Квадратна икона (1024x1024 по подразбиране за store-ресурси).
export function iconSVG(size = 1024) {
  const c = BRAND;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">
  <defs>
    <radialGradient id="bg" cx="50%" cy="38%" r="75%">
      <stop offset="0%" stop-color="${c.bg1}"/>
      <stop offset="100%" stop-color="${c.bg2}"/>
    </radialGradient>
    <linearGradient id="blade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#eaf6ff"/>
      <stop offset="100%" stop-color="#8ab4d8"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${c.accent}" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="${c.accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1024" rx="200" fill="url(#bg)"/>
  <circle cx="512" cy="470" r="360" fill="url(#glow)"/>
  <!-- две кръстосани остриета -->
  <g transform="translate(512,500)">
    <g transform="rotate(35)">
      <rect x="-26" y="-300" width="52" height="430" rx="20" fill="url(#blade)"/>
      <rect x="-70" y="120" width="140" height="40" rx="14" fill="${c.accent2}"/>
      <rect x="-22" y="150" width="44" height="120" rx="14" fill="#6a4a2a"/>
    </g>
    <g transform="rotate(-35)">
      <rect x="-26" y="-300" width="52" height="430" rx="20" fill="url(#blade)"/>
      <rect x="-70" y="120" width="140" height="40" rx="14" fill="${c.accent2}"/>
      <rect x="-22" y="150" width="44" height="120" rx="14" fill="#6a4a2a"/>
    </g>
  </g>
  <text x="512" y="900" text-anchor="middle" font-family="system-ui,Arial" font-size="120"
        font-weight="800" fill="${c.accent2}">GODFIST</text>
</svg>`;
}

// Splash (портретен 1080x1920) с градиент и заглавие.
export function splashSVG(w = 1080, h = 1920) {
  const c = BRAND;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${c.bg1}"/>
      <stop offset="100%" stop-color="${c.bg2}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="42%" r="55%">
      <stop offset="0%" stop-color="${c.accent}" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="${c.accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <circle cx="${w / 2}" cy="${h * 0.42}" r="${w * 0.55}" fill="url(#glow)"/>
  <text x="${w / 2}" y="${h * 0.46}" text-anchor="middle" font-family="system-ui,Arial"
        font-size="130" font-weight="800" fill="${c.accent}">GODFIST</text>
  <text x="${w / 2}" y="${h * 0.46 + 150}" text-anchor="middle" font-family="system-ui,Arial"
        font-size="130" font-weight="800" fill="${c.accent2}">ARENA</text>
  <text x="${w / 2}" y="${h * 0.92}" text-anchor="middle" font-family="system-ui,Arial"
        font-size="44" fill="#cfcfd8">AppGallery Edition</text>
</svg>`;
}

// data-URI помощник (за <img> или CSS), ако трябва inline.
export function toDataURI(svg) {
  return 'data:image/svg+xml;base64,' + (typeof btoa !== 'undefined'
    ? btoa(unescape(encodeURIComponent(svg)))
    : Buffer.from(svg).toString('base64'));
}
