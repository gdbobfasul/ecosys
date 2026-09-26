// Version: 1.0020
// gif.js — мъничък GIF89a кодер (LZW) за таймлапс лентата. Изцяло на устройството, без
// библиотеки. Всички кадри ползват една обща 256-цветна палитра (8 нива R × 8 нива G ×
// 4 нива B), което е напълно достатъчно за кадри от охранителна камера и е много бързо.
//
// encodeGif(frames, { delayMs }) → Uint8Array
//   frames: [{ data: Uint8ClampedArray (RGBA), w, h }] — всички с еднакви размери.

const PALETTE = (() => {
  const p = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const r = (i >> 5) & 7, g = (i >> 2) & 7, b = i & 3;
    p[i * 3] = Math.round(r * 255 / 7);
    p[i * 3 + 1] = Math.round(g * 255 / 7);
    p[i * 3 + 2] = Math.round(b * 255 / 3);
  }
  return p;
})();

function quantize(rgba) {
  const n = rgba.length >> 2;
  const out = new Uint8Array(n);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    out[i] = ((rgba[p] >> 5) << 5) | ((rgba[p + 1] >> 5) << 2) | (rgba[p + 2] >> 6);
  }
  return out;
}

// Байтов буфер с нарастване.
function makeBuf() {
  let a = new Uint8Array(1 << 16), len = 0;
  const ensure = (k) => { if (len + k > a.length) { const b = new Uint8Array(Math.max(a.length * 2, len + k)); b.set(a); a = b; } };
  return {
    byte(v) { ensure(1); a[len++] = v & 255; },
    word(v) { ensure(2); a[len++] = v & 255; a[len++] = (v >> 8) & 255; },
    bytes(arr) { ensure(arr.length); a.set(arr, len); len += arr.length; },
    str(s) { for (let i = 0; i < s.length; i++) this.byte(s.charCodeAt(i)); },
    result() { return a.subarray(0, len); }
  };
}

// LZW кодиране на индексирани пиксели → под-блокове (≤255 байта) в буфера.
function lzwEncode(indices, out) {
  const MIN_CODE = 8;
  const CLEAR = 1 << MIN_CODE, EOI = CLEAR + 1;
  let codeSize = MIN_CODE + 1;
  let next = EOI + 1;
  let dict = new Map();

  // Битов писач с пакетиране в под-блокове.
  const block = new Uint8Array(255);
  let blockLen = 0;
  let cur = 0, curBits = 0;
  const flushBlock = () => { if (blockLen) { out.byte(blockLen); out.bytes(block.subarray(0, blockLen)); blockLen = 0; } };
  const emit = (code) => {
    cur |= code << curBits; curBits += codeSize;
    while (curBits >= 8) {
      block[blockLen++] = cur & 255; cur >>>= 8; curBits -= 8;
      if (blockLen === 255) flushBlock();
    }
  };

  out.byte(MIN_CODE);
  emit(CLEAR);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = (prefix << 8) | k;
    const found = dict.get(key);
    if (found !== undefined) { prefix = found; continue; }
    emit(prefix);
    if (next < 4096) {
      dict.set(key, next++);
      if (next > (1 << codeSize) && codeSize < 12) codeSize++;
    } else {
      emit(CLEAR);
      dict = new Map(); next = EOI + 1; codeSize = MIN_CODE + 1;
    }
    prefix = k;
  }
  emit(prefix);
  emit(EOI);
  if (curBits > 0) { block[blockLen++] = cur & 255; if (blockLen === 255) flushBlock(); }
  flushBlock();
  out.byte(0); // край на под-блоковете
}

export function encodeGif(frames, { delayMs = 200 } = {}) {
  if (!frames || !frames.length) return new Uint8Array(0);
  const w = frames[0].w, h = frames[0].h;
  const out = makeBuf();
  out.str('GIF89a');
  out.word(w); out.word(h);
  out.byte(0xF7); // глобална палитра, 8 бита/цвят, 256 цвята
  out.byte(0); out.byte(0);
  out.bytes(PALETTE);
  // безкрайно повторение (NETSCAPE2.0)
  out.byte(0x21); out.byte(0xFF); out.byte(0x0B); out.str('NETSCAPE2.0');
  out.byte(0x03); out.byte(0x01); out.word(0); out.byte(0);
  const delay = Math.max(2, Math.round(delayMs / 10));
  for (const f of frames) {
    if (f.w !== w || f.h !== h) continue;
    out.byte(0x21); out.byte(0xF9); out.byte(0x04); out.byte(0x00); out.word(delay); out.byte(0); out.byte(0);
    out.byte(0x2C); out.word(0); out.word(0); out.word(w); out.word(h); out.byte(0);
    lzwEncode(quantize(f.data), out);
  }
  out.byte(0x3B);
  return out.result();
}
