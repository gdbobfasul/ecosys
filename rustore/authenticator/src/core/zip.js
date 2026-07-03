// Version: 1.0001
// zip.js — минимален ZIP конструктор (метод „store", без компресия). PNG-ите вече
// са компресирани, затова store е достатъчен. Без външни библиотеки.
// Употреба: const blob = zipStore([{ name:'a.png', data: Uint8Array }, ...]);

let CRC_TABLE = null;
function crcTable() {
  if (CRC_TABLE) return CRC_TABLE;
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  CRC_TABLE = t;
  return t;
}
function crc32(bytes) {
  const t = crcTable();
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = t[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

const enc = new TextEncoder();

export function zipStore(files) {
  const parts = [];          // парчета за тялото (local headers + данни)
  const central = [];        // записи в централната директория
  let offset = 0;

  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const data = f.data;
    const crc = crc32(data);
    const size = data.length;

    // --- Local file header ---
    const lh = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(lh.buffer);
    lv.setUint32(0, 0x04034b50, true);   // подпис
    lv.setUint16(4, 20, true);           // версия за разпакетиране
    lv.setUint16(6, 0x0800, true);       // флаг: UTF-8 имена
    lv.setUint16(8, 0, true);            // метод: store
    lv.setUint16(10, 0, true);           // мод. време
    lv.setUint16(12, 0, true);           // мод. дата
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);        // компресиран размер
    lv.setUint32(22, size, true);        // некомпресиран размер
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);           // extra len
    lh.set(nameBytes, 30);

    parts.push(lh, data);

    // --- Central directory record ---
    const ch = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(ch.buffer);
    cv.setUint32(0, 0x02014b50, true);   // подпис
    cv.setUint16(4, 20, true);           // version made by
    cv.setUint16(6, 20, true);           // version needed
    cv.setUint16(8, 0x0800, true);       // флаг: UTF-8
    cv.setUint16(10, 0, true);           // метод
    cv.setUint16(12, 0, true); cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);           // extra
    cv.setUint16(32, 0, true);           // comment
    cv.setUint16(34, 0, true);           // disk start
    cv.setUint16(36, 0, true);           // internal attr
    cv.setUint32(38, 0, true);           // external attr
    cv.setUint32(42, offset, true);      // отместване на local header
    ch.set(nameBytes, 46);
    central.push(ch);

    offset += lh.length + data.length;
  }

  const centralSize = central.reduce((s, c) => s + c.length, 0);
  const centralOffset = offset;

  // --- End of central directory ---
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, centralOffset, true);

  return new Blob([...parts, ...central, eocd], { type: 'application/zip' });
}
