// Version: 1.0001
// gen-assets.mjs — генерира store ресурси (PNG иконки/splash) от per-store акцент,
// БЕЗ външни зависимости. Записва и SVG източниците (icon.svg, splash.svg), ако липсват.
// Реалните финални store-PNG обикновено се правят с дизайнерски инструмент от SVG;
// тук правим валидни placeholder PNG-та, за да е build-ът самодостатъчен без Android SDK.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import zlib from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const STORE = join(ROOT, 'store');
const ACCENT = '#7b5cff'; // RUStore акцент (виолетов)
const APP_TITLE = 'Самообучаващ се приятел';

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

  ensureSvg(join(STORE, 'icon.svg'), iconSvg(ACCENT));
  ensureSvg(join(STORE, 'splash.svg'), splashSvg(ACCENT, APP_TITLE));

  console.log('gen-assets: готово (акцент ' + ACCENT + ').');
}

function ensureSvg(path, content) {
  writeFileSync(path, content);
  console.log('  written', path.split(/[\\/]/).pop());
}

// Иконка: дружелюбно лице на героя (приятел).
function iconSvg(accent) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${accent}"/>
      <stop offset="1" stop-color="#a98bff"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="#0b1020"/>
  <circle cx="256" cy="248" r="150" fill="url(#g)"/>
  <circle cx="206" cy="232" r="26" fill="#0b1020"/>
  <circle cx="306" cy="232" r="26" fill="#0b1020"/>
  <circle cx="214" cy="224" r="9" fill="#fff"/>
  <circle cx="314" cy="224" r="9" fill="#fff"/>
  <path d="M196 300 q60 56 120 0" stroke="#0b1020" stroke-width="14" fill="none" stroke-linecap="round"/>
  <circle cx="256" cy="112" r="14" fill="#a98bff"/>
  <rect x="250" y="120" width="12" height="34" fill="#a98bff"/>
</svg>`;
}

function splashSvg(accent, title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <rect width="1080" height="1080" fill="#0b1020"/>
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${accent}"/>
      <stop offset="1" stop-color="#a98bff"/>
    </linearGradient>
  </defs>
  <circle cx="540" cy="470" r="170" fill="url(#g)"/>
  <circle cx="486" cy="452" r="28" fill="#0b1020"/>
  <circle cx="594" cy="452" r="28" fill="#0b1020"/>
  <path d="M476 524 q64 60 128 0" stroke="#0b1020" stroke-width="16" fill="none" stroke-linecap="round"/>
  <text x="540" y="760" font-family="sans-serif" font-size="52" fill="#e8ecf5" text-anchor="middle">${title}</text>
  <text x="540" y="820" font-family="sans-serif" font-size="30" fill="#9aa6c4" text-anchor="middle">личен • локален • само твой</text>
</svg>`;
}

main();
