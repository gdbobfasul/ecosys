// Version: 1.0021
// exif.js — чете основните EXIF данни от JPEG (самостоятелен помощник, без външни библиотеки).
// Връща { make, model, date, lat, lon, orientation } или null, ако файлът няма EXIF.
// Използва се от „Снимки като доказателство": кога е заснета снимката (по камерата), с какво устройство
// и къде (ако камерата е записала GPS). Нищо не се променя — само четене.
//   readExif(bufferOrBlob)

function ascii(dv, off, len) {
  let s = '';
  for (let i = 0; i < len && off + i < dv.byteLength; i++) { const c = dv.getUint8(off + i); if (!c) break; s += String.fromCharCode(c); }
  return s.trim();
}

// Чете един IFD → { tag: стойност } за нужните ни типове (ASCII, SHORT, LONG, RATIONAL).
function readIfd(dv, tiff, off, le) {
  const out = {};
  if (off + 2 > dv.byteLength) return out;
  const n = dv.getUint16(off, le);
  for (let i = 0; i < n; i++) {
    const e = off + 2 + i * 12; if (e + 12 > dv.byteLength) break;
    const tag = dv.getUint16(e, le), type = dv.getUint16(e + 2, le), cnt = dv.getUint32(e + 4, le);
    const size = ({ 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 })[type] || 1;
    const vOff = size * cnt > 4 ? tiff + dv.getUint32(e + 8, le) : e + 8;
    try {
      if (type === 2) out[tag] = ascii(dv, vOff, cnt);
      else if (type === 3) out[tag] = dv.getUint16(vOff, le);
      else if (type === 4) out[tag] = dv.getUint32(vOff, le);
      else if (type === 5) { const a = []; for (let k = 0; k < cnt; k++) { const d = dv.getUint32(vOff + k * 8 + 4, le); a.push(d ? dv.getUint32(vOff + k * 8, le) / d : 0); } out[tag] = a; }
    } catch (x) { /* повреден запис — прескачаме */ }
  }
  return out;
}

function dms(a, ref) {
  if (!Array.isArray(a) || a.length < 3) return null;
  let v = a[0] + a[1] / 60 + a[2] / 3600;
  if (ref === 'S' || ref === 'W') v = -v;
  return isFinite(v) ? Math.round(v * 1e6) / 1e6 : null;
}

export async function readExif(data) {
  try {
    const buf = data instanceof ArrayBuffer ? data : (data && data.arrayBuffer ? await data.slice(0, 262144).arrayBuffer() : null);
    if (!buf) return null;
    const dv = new DataView(buf);
    if (dv.byteLength < 4 || dv.getUint16(0) !== 0xFFD8) return null; // не е JPEG
    let p = 2;
    while (p + 4 < dv.byteLength) {
      const marker = dv.getUint16(p); const len = dv.getUint16(p + 2);
      if (marker === 0xFFE1 && ascii(dv, p + 4, 4) === 'Exif') {
        const tiff = p + 10; const le = dv.getUint16(tiff) === 0x4949;
        const ifd0 = readIfd(dv, tiff, tiff + dv.getUint32(tiff + 4, le), le);
        const ex = ifd0[0x8769] ? readIfd(dv, tiff, tiff + ifd0[0x8769], le) : {};
        const gps = ifd0[0x8825] ? readIfd(dv, tiff, tiff + ifd0[0x8825], le) : {};
        const r = {
          make: ifd0[0x010F] || '', model: ifd0[0x0110] || '',
          date: ex[0x9003] || ifd0[0x0132] || '', orientation: ifd0[0x0112] || 1,
          lat: dms(gps[2], gps[1]), lon: dms(gps[4], gps[3])
        };
        return (r.make || r.model || r.date || r.lat != null) ? r : null;
      }
      if ((marker & 0xFF00) !== 0xFF00 || marker === 0xFFDA) break; // начало на данните — няма EXIF
      p += 2 + len;
    }
  } catch (e) { /* нечетим файл */ }
  return null;
}

// „2026:08:12 14:03:55" → „2026-08-12 14:03:55" (за показване).
export function exifDateText(s) {
  const m = String(s || '').match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}:\d{2}(:\d{2})?)/);
  return m ? `${m[1]}-${m[2]}-${m[3]} ${m[4]}` : String(s || '');
}
