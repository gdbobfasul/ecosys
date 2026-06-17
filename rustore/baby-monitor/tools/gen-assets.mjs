// gen-assets.mjs — генерира store ресурси (PNG иконки/splash) от per-store акцент,
// БЕЗ външни зависимости. Записва и SVG източниците (icon.svg, splash.svg).
// Реалните финални store-PNG обикновено се правят с дизайнерски инструмент от SVG;
// тук правим валидни placeholder PNG-та, за да е build-ът самодостатъчен без Android SDK.

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import zlib from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const STORE = join(ROOT, 'store');
const ACCENT = '#5cc8b0'; // RUStore акцент (мента)
const ACCENT_2 = '#8fe0cf';
const BG = '#0e1a17';
const APP_TITLE = 'Детегледачка';

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// Минимален валиден PNG с плътен цвят (size x size).
function solidPng(size, rgb) {
  const [r, g, b] = rgb;
  const width = size, height = size;
  const bytesPerPixel = 3;
  const rowLen = width * bytesPerPixel + 1;
  const raw = Buffer.alloc(rowLen * height);
  for (let y = 0; y < height; y++) {
    const off = y * rowLen;
    raw[off] = 0;
    for (let x = 0; x < width; x++) {
      const p = off + 1 + x * bytesPerPixel;
      raw[p] = r; raw[p + 1] = g; raw[p + 2] = b;
    }
  }
  const idatData = zlib.deflateSync(raw);

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const body = Buffer.concat([typeBuf, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0, 0);
    return Buffer.concat([len, body, crc]);
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idatData), chunk('IEND', Buffer.alloc(0))]);
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function main() {
  if (!existsSync(STORE)) mkdirSync(STORE, { recursive: true });
  const rgb = hexToRgb(ACCENT);

  const sizes = { 'icon-512.png': 512, 'icon-192.png': 192, 'splash-1080.png': 1080 };
  for (const [name, size] of Object.entries(sizes)) {
    writeFileSync(join(STORE, name), solidPng(size, rgb));
    console.log('  written', name, `(${size}x${size})`);
  }

  writeFileSync(join(STORE, 'icon.svg'), iconSvg());
  console.log('  written icon.svg');
  writeFileSync(join(STORE, 'splash.svg'), splashSvg());
  console.log('  written splash.svg');

  console.log('gen-assets: готово (акцент ' + ACCENT + ').');
}

// Иконка: нежна луна + спящо детенце (бебешка тема).
function iconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${ACCENT}"/>
      <stop offset="1" stop-color="${ACCENT_2}"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="${BG}"/>
  <path d="M360 150 a120 120 0 1 0 0 212 a96 96 0 0 1 0-212 z" fill="url(#g)"/>
  <circle cx="180" cy="300" r="58" fill="url(#g)"/>
  <circle cx="164" cy="294" r="7" fill="${BG}"/>
  <circle cx="196" cy="294" r="7" fill="${BG}"/>
  <path d="M168 320 q12 12 24 0" stroke="${BG}" stroke-width="6" fill="none" stroke-linecap="round"/>
  <circle cx="120" cy="150" r="6" fill="${ACCENT_2}"/>
  <circle cx="150" cy="120" r="4" fill="${ACCENT_2}"/>
  <circle cx="100" cy="200" r="4" fill="${ACCENT_2}"/>
</svg>`;
}

function splashSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <rect width="1080" height="1080" fill="${BG}"/>
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${ACCENT}"/>
      <stop offset="1" stop-color="${ACCENT_2}"/>
    </linearGradient>
  </defs>
  <path d="M650 340 a150 150 0 1 0 0 265 a120 120 0 0 1 0-265 z" fill="url(#g)"/>
  <circle cx="430" cy="540" r="78" fill="url(#g)"/>
  <circle cx="408" cy="532" r="9" fill="${BG}"/>
  <circle cx="452" cy="532" r="9" fill="${BG}"/>
  <path d="M412 566 q18 16 36 0" stroke="${BG}" stroke-width="8" fill="none" stroke-linecap="round"/>
  <text x="540" y="800" font-family="sans-serif" font-size="54" fill="#eaf4f0" text-anchor="middle">${APP_TITLE}</text>
  <text x="540" y="860" font-family="sans-serif" font-size="30" fill="#9fc2b8" text-anchor="middle">нежно • локално • без проследяване</text>
</svg>`;
}

main();
