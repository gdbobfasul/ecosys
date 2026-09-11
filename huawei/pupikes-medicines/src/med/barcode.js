// Version: 1.0024
// barcode.js — БАРКОД НА УСТРОЙСТВОТО (11.09.2026): чете EAN-13 / EAN-8 / UPC-A / UPC-E / DataMatrix / QR / Code 128
// от снимката (камера или галерия) с @zxing/library (чист JS, без мрежа; зарежда се лениво като отделен чънк —
// началният пакет не расте). Връща { format, text, gtin } — GTIN-13/14 нормализиран от 1D кода или от GS1 AI (01)
// в DataMatrix/QR. Това е ПЪРВИЯТ етап на сканирането (преди OCR): при съвпадение в gtin-db картата идва веднага.
let Z = null;
async function lib() {
  if (Z) return Z;
  try { Z = await import('@zxing/library'); if (Z && !Z.MultiFormatReader && Z.default) Z = Z.default; } catch (_) { Z = null; }
  return Z && Z.MultiFormatReader ? Z : null;
}

// Сива матрица (Uint8ClampedArray w*h) от <canvas>, по избор смалена до maxSide по дългата страна.
function luminance(src, maxSide) {
  const w0 = src.width, h0 = src.height; const sc = Math.min(1, maxSide / Math.max(w0, h0));
  const w = Math.max(8, Math.round(w0 * sc)), h = Math.max(8, Math.round(h0 * sc));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.drawImage(src, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data; const out = new Uint8ClampedArray(w * h);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) out[j] = (d[i] * 77 + d[i + 1] * 151 + d[i + 2] * 28) >> 8;
  return { lum: out, w, h };
}
// Транспониране (завъртане на 90°) на сивата матрица — 1D кодовете се четат и вертикално.
function rotate90(m) {
  const { lum, w, h } = m; const out = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[x * h + (h - 1 - y)] = lum[y * w + x];
  return { lum: out, w: h, h: w };
}

// UPC-E (8 цифри) → UPC-A (12 цифри) по стандартното разгъване.
function upcEtoA(e) {
  const d = e.replace(/\D/g, ''); if (d.length !== 8) return '';
  const n = d[0], x = d.slice(1, 7), c = d[7]; const last = x[5]; let body = '';
  if (last === '0' || last === '1' || last === '2') body = x.slice(0, 2) + last + '0000' + x.slice(2, 5);
  else if (last === '3') body = x.slice(0, 3) + '00000' + x.slice(3, 5);
  else if (last === '4') body = x.slice(0, 4) + '00000' + x[4];
  else body = x.slice(0, 5) + '0000' + last;
  return n + body + c;
}
// Контролна цифра GTIN (mod 10, тегла 3/1 отдясно) за цифрите БЕЗ контролната.
export function gtinCheck(digits) { let s = 0; const d = String(digits); for (let i = 0; i < d.length; i++) s += (d.charCodeAt(d.length - 1 - i) - 48) * (i % 2 === 0 ? 3 : 1); return String((10 - (s % 10)) % 10); }
export function gtinValid(g) { const d = String(g || '').replace(/\D/g, ''); return d.length >= 8 && gtinCheck(d.slice(0, -1)) === d.slice(-1); }

// GTIN от прочетения текст според формата: 1D кодове = самите цифри; DataMatrix/QR = GS1 елемент AI (01) — 14 цифри
// след „01" в началото или след разделител GS (\x1d) / „]d2" / „]Q3"; иначе празно (напр. QR с адрес на листовка).
export function gtinFrom(format, text) {
  const t = String(text || '');
  if (/^(EAN_13|UPC_A|EAN_8)$/.test(format)) { const d = t.replace(/\D/g, ''); return gtinValid(d) ? d : ''; }
  if (format === 'UPC_E') { const a = upcEtoA(t); return gtinValid(a) ? a : ''; }
  const s = t.replace(/^\]?[dQC]\d/, '').replace(/[\x1d\x1e]/g, '\x1d');
  const m = s.match(/(?:^|\x1d|\(01\)|^01)(?:01)?(\d{14})/) || s.match(/\(01\)(\d{14})/);
  if (m && gtinValid(m[1])) return m[1];
  if (/^\d{8}$|^\d{12,14}$/.test(s) && gtinValid(s)) return s;
  return '';
}

// Опити: пълна сива матрица (≤1600 px), завъртяна на 90°, после смалена (≤900 px) за едри/размазани кодове.
export async function decodeBarcode(canvas) {
  const L = await lib(); if (!L || !canvas || !canvas.getContext) return null;
  const hints = new Map();
  hints.set(L.DecodeHintType.TRY_HARDER, true);
  hints.set(L.DecodeHintType.POSSIBLE_FORMATS, [L.BarcodeFormat.EAN_13, L.BarcodeFormat.UPC_A, L.BarcodeFormat.EAN_8, L.BarcodeFormat.UPC_E, L.BarcodeFormat.DATA_MATRIX, L.BarcodeFormat.QR_CODE, L.BarcodeFormat.CODE_128]);
  const reader = new L.MultiFormatReader(); reader.setHints(hints);
  const tryOn = (m) => {
    try {
      const src = new L.RGBLuminanceSource(m.lum, m.w, m.h);
      const res = reader.decode(new L.BinaryBitmap(new L.HybridBinarizer(src)));
      if (!res) return null;
      const format = String(L.BarcodeFormat[res.getBarcodeFormat()] || res.getBarcodeFormat());
      const text = String(res.getText() || '');
      return { format, text, gtin: gtinFrom(format, text) };
    } catch (_) { return null; }
  };
  const m1 = luminance(canvas, 1600);
  const attempts = [m1, () => rotate90(m1), () => luminance(canvas, 900), () => rotate90(luminance(canvas, 900))];
  let best = null;
  for (const a of attempts) {
    const m = typeof a === 'function' ? a() : a;
    const r = tryOn(m);
    if (r && r.gtin) return r;
    if (r && !best) best = r;   // прочетен код без GTIN (напр. QR с адрес) — връщаме го, ако няма по-добро
  }
  return best;
}
