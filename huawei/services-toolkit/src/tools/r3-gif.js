// Version: 1.0020
// r3-gif.js — миниатюрен АНИМИРАН GIF кодер (GIF89a), изцяло на устройството, без библиотека.
// Ползва се от „360°" в 3D Rotate: поредица кадри (ImageData с еднакъв размер) → един GIF файл.
//   • Палитра: фиксиран цветови куб 6×7×6 (252 цвята) + 1 прозрачен индекс → ЕДНАКВА палитра за
//     всички кадри (няма „трептене" между кадрите, каквото дава палитра по кадър).
//   • Подреден (Байер 4×4) дитеринг → гладки преходи без шум, стабилен между кадрите.
//   • LZW компресия по стандарта на GIF (речник до 4096 кода, Clear при препълване).
//   • NETSCAPE2.0 разширение → безкрайно повторение.
// encodeGif(frames, w, h, delayMs, transparent) → Uint8Array

const TRANSP = 255;                       // индекс за прозрачно
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

// Глобална палитра: 6 нива R × 7 нива G × 6 нива B = 252 записа; 252–254 черно; 255 прозрачно (черно).
function buildPalette() {
  const pal = new Uint8Array(256 * 3); let k = 0;
  for (let r = 0; r < 6; r++) for (let g = 0; g < 7; g++) for (let b = 0; b < 6; b++) {
    pal[k++] = Math.round(r * 255 / 5); pal[k++] = Math.round(g * 255 / 6); pal[k++] = Math.round(b * 255 / 5);
  }
  return pal;
}

// RGBA пиксели → индекси в палитрата (с дитеринг). alpha < 128 → прозрачно (ако е разрешено).
function quantize(rgba, w, h, transparent) {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, p = y * w + x;
    if (transparent && rgba[i + 3] < 128) { out[p] = TRANSP; continue; }
    const d = (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5);   // −0.5..+0.5 стъпка на дитеринга
    const r = Math.max(0, Math.min(5, Math.round(rgba[i]     / 255 * 5 + d)));
    const g = Math.max(0, Math.min(6, Math.round(rgba[i + 1] / 255 * 6 + d)));
    const b = Math.max(0, Math.min(5, Math.round(rgba[i + 2] / 255 * 5 + d)));
    out[p] = r * 42 + g * 6 + b;
  }
  return out;
}

// Байтов буфер с растеж.
class Bytes {
  constructor(n) { this.a = new Uint8Array(n || 65536); this.n = 0; }
  push(b) { if (this.n >= this.a.length) { const t = new Uint8Array(this.a.length * 2); t.set(this.a); this.a = t; } this.a[this.n++] = b; }
  pushMany(arr) { for (let i = 0; i < arr.length; i++) this.push(arr[i]); }
  u16(v) { this.push(v & 255); this.push((v >> 8) & 255); }
  str(s) { for (let i = 0; i < s.length; i++) this.push(s.charCodeAt(i)); }
  bytes() { return this.a.subarray(0, this.n); }
}

// LZW (GIF вариант): indices → под-блокове по ≤255 байта в out. Минимален размер на кода = 8.
function lzw(indices, out) {
  const MIN = 8, CLEAR = 1 << MIN, EOI = CLEAR + 1;
  const dict = new Int32Array(1 << 20);      // ключ = префикс·256 + байт → код
  let codeSize = MIN + 1, next = EOI + 1;
  let bitBuf = 0, bitCnt = 0;
  const block = new Uint8Array(255); let bn = 0;
  const flushBlock = () => { if (bn) { out.push(bn); for (let i = 0; i < bn; i++) out.push(block[i]); bn = 0; } };
  const emit = (code) => {
    bitBuf |= code << bitCnt; bitCnt += codeSize;
    while (bitCnt >= 8) { block[bn++] = bitBuf & 255; if (bn === 255) flushBlock(); bitBuf >>>= 8; bitCnt -= 8; }
  };
  out.push(MIN);
  dict.fill(-1); emit(CLEAR);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const c = indices[i], key = prefix * 256 + c, found = dict[key];
    if (found >= 0) { prefix = found; continue; }
    emit(prefix);
    if (next < 4096) { dict[key] = next++; if (next > (1 << codeSize) && codeSize < 12) codeSize++; }
    else { emit(CLEAR); dict.fill(-1); next = EOI + 1; codeSize = MIN + 1; }
    prefix = c;
  }
  emit(prefix); emit(EOI);
  if (bitCnt > 0) { block[bn++] = bitBuf & 255; if (bn === 255) flushBlock(); }
  flushBlock();
  out.push(0);                                // край на данните
}

// frames: масив от Uint8ClampedArray/Uint8Array (RGBA, w·h·4). delayMs: пауза между кадрите.
export function encodeGif(frames, w, h, delayMs, transparent) {
  const out = new Bytes(w * h * frames.length >> 2);
  const pal = buildPalette();
  out.str('GIF89a');
  out.u16(w); out.u16(h);
  out.push(0xF7);                             // глобална палитра, 8 бита/цвят, 256 записа
  out.push(0); out.push(0);                   // фонов индекс, съотношение на пикселите
  out.pushMany(pal);
  // безкрайно повторение
  out.pushMany([0x21, 0xFF, 0x0B]); out.str('NETSCAPE2.0'); out.pushMany([0x03, 0x01, 0x00, 0x00, 0x00]);
  const delay = Math.max(2, Math.round((delayMs || 100) / 10));
  for (const f of frames) {
    // Graphic Control Extension: прозрачно → изчисти до фона (2), иначе остави (1)
    out.pushMany([0x21, 0xF9, 0x04, transparent ? (2 << 2) | 1 : (1 << 2)]);
    out.u16(delay); out.push(transparent ? TRANSP : 0); out.push(0);
    // Image Descriptor
    out.push(0x2C); out.u16(0); out.u16(0); out.u16(w); out.u16(h); out.push(0);
    lzw(quantize(f, w, h, transparent), out);
  }
  out.push(0x3B);
  return out.bytes();
}
