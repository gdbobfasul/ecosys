// gen-assets.mjs — генерира прости PNG-подобни ресурси от SVG за store/иконата.
// БЕЗ външни зависимости: записва SVG копия с per-store акцент и прави
// „placeholder" PNG-та чрез вграден минимален PNG (плътен цвят с акцента).
// Целта е build-ът да е самодостатъчен без Android SDK/native инструменти.
//
// Реалните store-икони (512x512 PNG, feature graphic) се правят от store/icon.svg
// с дизайнерски инструмент при публикация — тук правим валидни placeholder файлове.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import zlib from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const STORE = join(ROOT, 'store');
const ACCENT = '#d92b2b'; // Huawei акцент

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// Минимален валиден PNG с плътен цвят (size x size).
function solidPng(size, rgb) {
  const [r, g, b] = rgb;
  const width = size, height = size;
  const bytesPerPixel = 3;
  const rowLen = width * bytesPerPixel + 1; // +1 filter byte
  const raw = Buffer.alloc(rowLen * height);
  for (let y = 0; y < height; y++) {
    const off = y * rowLen;
    raw[off] = 0; // filter: none
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
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type: truecolor RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idatData),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// CRC32 за PNG chunk-ове.
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

  // 1. Иконка PNG-та от акцента.
  const sizes = { 'icon-512.png': 512, 'icon-192.png': 192, 'splash-1080.png': 1080 };
  for (const [name, size] of Object.entries(sizes)) {
    writeFileSync(join(STORE, name), solidPng(size, rgb));
    console.log('  written', name, `(${size}x${size})`);
  }

  // 2. Уверяваме се, че SVG източниците са налични (ако липсват — създаваме).
  ensureSvg(join(STORE, 'icon.svg'), iconSvg(ACCENT));
  ensureSvg(join(STORE, 'splash.svg'), splashSvg(ACCENT));

  console.log('gen-assets: готово (акцент ' + ACCENT + ').');
}

function ensureSvg(path, content) {
  if (!existsSync(path)) { writeFileSync(path, content); console.log('  created', path); }
}

function iconSvg(accent) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="${accent}"/>
  <rect x="136" y="170" width="240" height="180" rx="28" fill="#ffffff"/>
  <circle cx="206" cy="250" r="22" fill="${accent}"/>
  <circle cx="306" cy="250" r="22" fill="${accent}"/>
  <rect x="196" y="300" width="120" height="16" rx="8" fill="${accent}"/>
  <rect x="248" y="120" width="16" height="50" fill="#ffffff"/>
  <circle cx="256" cy="116" r="14" fill="#ffffff"/>
</svg>`;
}
function splashSvg(accent) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <rect width="1080" height="1080" fill="#0b1020"/>
  <g transform="translate(420,420)">
    <rect width="240" height="180" rx="28" fill="${accent}"/>
    <circle cx="70" cy="80" r="22" fill="#fff"/>
    <circle cx="170" cy="80" r="22" fill="#fff"/>
  </g>
  <text x="540" y="700" font-family="sans-serif" font-size="46" fill="#e8ecf5" text-anchor="middle">Бизнес FAQ робот</text>
</svg>`;
}

main();
