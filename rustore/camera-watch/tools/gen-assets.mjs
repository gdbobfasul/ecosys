// Version: 1.0001
// gen-assets.mjs — генерира store ресурси (PNG иконки/splash) от per-store акцент,
// БЕЗ външни зависимости. Записва и SVG източниците (icon.svg, splash.svg).
// Финалните store-PNG обикновено се правят с дизайнерски инструмент от SVG; тук правим
// валидни placeholder PNG-та, за да е build-ът самодостатъчен без Android SDK.

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import zlib from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const STORE = join(ROOT, 'store');
const ACCENT = '#00c2a8'; // RUStore акцент (тюркоаз)
const APP_TITLE = 'MotionHawk';

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

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

  writeFileSync(join(STORE, 'icon.svg'), iconSvg(ACCENT));
  console.log('  written icon.svg');
  writeFileSync(join(STORE, 'splash.svg'), splashSvg(ACCENT, APP_TITLE));
  console.log('  written splash.svg');

  console.log('gen-assets: готово (акцент ' + ACCENT + ').');
}

// Иконка: камера/око, което следи (страж).
function iconSvg(accent) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${accent}"/>
      <stop offset="1" stop-color="#2de0c6"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="#0b1020"/>
  <rect x="112" y="176" width="288" height="180" rx="28" fill="url(#g)"/>
  <rect x="176" y="140" width="96" height="44" rx="14" fill="url(#g)"/>
  <circle cx="256" cy="266" r="70" fill="#0b1020"/>
  <circle cx="256" cy="266" r="42" fill="url(#g)"/>
  <circle cx="256" cy="266" r="18" fill="#0b1020"/>
  <circle cx="356" cy="214" r="14" fill="#0b1020"/>
  <path d="M150 392 h212" stroke="url(#g)" stroke-width="14" stroke-linecap="round"/>
</svg>`;
}

function splashSvg(accent, title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <rect width="1080" height="1080" fill="#0b1020"/>
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${accent}"/>
      <stop offset="1" stop-color="#2de0c6"/>
    </linearGradient>
  </defs>
  <rect x="396" y="380" width="288" height="180" rx="28" fill="url(#g)"/>
  <circle cx="540" cy="470" r="70" fill="#0b1020"/>
  <circle cx="540" cy="470" r="42" fill="url(#g)"/>
  <circle cx="540" cy="470" r="18" fill="#0b1020"/>
  <text x="540" y="760" font-family="sans-serif" font-size="56" fill="#e8ecf5" text-anchor="middle">${title}</text>
  <text x="540" y="822" font-family="sans-serif" font-size="30" fill="#9aa6c4" text-anchor="middle">следи • засича • разпознава — локално</text>
</svg>`;
}

main();
