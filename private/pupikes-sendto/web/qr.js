'use strict';
// Компактен, самостоятелен QR генератор (byte mode, версии 1–40, ECC L/M/Q/H, избор на маска по
// наказателни точки) → връща SVG. Без външни зависимости (работи и офлайн/в APK). Порт на алгоритъма
// на Nayuki (public domain), свит до нужното за PupikesSendTo (кодиране на кратък URL/текст).
// Използване: PSQR.svg('https://…', { ecl:'M', border:2, scale:6 }) → SVG низ.
(function (root) {
  // ── Галоа GF(256) ──
  function mul(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; }
    return z & 0xFF;
  }
  function rsDivisor(degree) {
    const result = []; for (let i = 0; i < degree; i++) result.push(0); result[degree - 1] = 1;
    let root = 1;
    for (let i = 0; i < degree; i++) {
      for (let j = 0; j < result.length; j++) { result[j] = mul(result[j], root); if (j + 1 < result.length) result[j] ^= result[j + 1]; }
      root = mul(root, 0x02);
    }
    return result;
  }
  function rsRemainder(data, divisor) {
    const result = divisor.map(() => 0);
    for (const b of data) {
      const factor = b ^ result.shift(); result.push(0);
      for (let i = 0; i < result.length; i++) result[i] ^= mul(divisor[i], factor);
    }
    return result;
  }

  // ── таблици ──
  const ECC_CODEWORDS_PER_BLOCK = [
    [-1,7,10,15,20,26,18,20,24,30,18,20,24,26,30,22,24,28,30,28,28,28,28,30,30,26,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
    [-1,10,16,26,18,24,16,18,22,22,26,30,22,22,24,24,28,28,26,26,26,26,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28],
    [-1,13,22,18,26,18,24,18,22,20,24,28,26,24,20,30,24,28,28,26,30,28,30,30,30,30,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
    [-1,17,28,22,16,22,28,26,26,24,28,24,28,22,24,24,30,28,28,26,28,30,24,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30]
  ];
  const NUM_ERROR_CORRECTION_BLOCKS = [
    [-1,1,1,1,1,1,2,2,2,2,4,4,4,4,4,6,6,6,6,7,8,8,9,9,10,12,12,12,13,14,15,16,17,18,19,19,20,21,22,24,25],
    [-1,1,1,1,2,2,4,4,4,5,5,5,8,9,9,10,10,11,13,14,16,17,17,18,20,21,23,25,26,28,29,31,33,35,37,38,40,43,45,47,49],
    [-1,1,1,2,2,4,4,6,6,8,8,8,10,12,16,12,17,16,18,21,20,23,23,25,27,29,34,34,35,38,40,43,45,48,51,53,56,59,62,65,68],
    [-1,1,1,2,4,4,4,5,6,8,8,11,11,16,16,18,16,19,21,25,25,25,34,30,32,35,37,40,42,45,48,51,54,57,60,63,66,70,74,77,81]
  ];
  const ECL = { L: 0, M: 1, Q: 2, H: 3 };
  const ECL_BITS = { L: 1, M: 0, Q: 3, H: 2 };

  function numRawDataModules(ver) {
    let result = (16 * ver + 128) * ver + 64;
    if (ver >= 2) { const numAlign = Math.floor(ver / 7) + 2; result -= (25 * numAlign - 10) * numAlign - 55; if (ver >= 7) result -= 36; }
    return result;
  }
  function numDataCodewords(ver, ecl) {
    return Math.floor(numRawDataModules(ver) / 8) - ECC_CODEWORDS_PER_BLOCK[ecl][ver] * NUM_ERROR_CORRECTION_BLOCKS[ecl][ver];
  }

  // ── кодиране ──
  function encode(text, eclName) {
    const ecl = ECL[eclName] != null ? ECL[eclName] : ECL.M;
    // UTF-8 байтове
    const bytes = utf8(text);
    // избери версия
    let version = 1;
    for (; version <= 40; version++) {
      const cap = numDataCodewords(version, ecl) * 8;
      const ccBits = version < 10 ? 8 : 16;   // byte mode char-count bits
      const need = 4 + ccBits + bytes.length * 8;
      if (need <= cap) break;
    }
    if (version > 40) throw new Error('данните са твърде дълги за QR');

    const ccBits = version < 10 ? 8 : 16;
    const bb = [];
    const append = (val, len) => { for (let i = len - 1; i >= 0; i--) bb.push((val >>> i) & 1); };
    append(0x4, 4);                 // режим: byte
    append(bytes.length, ccBits);   // брой байтове
    for (const b of bytes) append(b, 8);

    const dataCapacityBits = numDataCodewords(version, ecl) * 8;
    append(0, Math.min(4, dataCapacityBits - bb.length));   // терминатор
    while (bb.length % 8 !== 0) bb.push(0);                  // до цял байт
    for (let pad = 0xEC; bb.length < dataCapacityBits; pad ^= 0xEC ^ 0x11) append(pad, 8);  // padding

    // байтове
    const dataCodewords = [];
    for (let i = 0; i < bb.length; i += 8) { let v = 0; for (let j = 0; j < 8; j++) v = (v << 1) | bb[i + j]; dataCodewords.push(v); }

    return buildMatrix(version, ecl, dataCodewords);
  }

  function utf8(str) {
    const out = [];
    for (const ch of str) {
      let c = ch.codePointAt(0);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) { out.push(0xC0 | (c >> 6), 0x80 | (c & 0x3F)); }
      else if (c < 0x10000) { out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F)); }
      else { out.push(0xF0 | (c >> 18), 0x80 | ((c >> 12) & 0x3F), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F)); }
    }
    return out;
  }

  function buildMatrix(version, ecl, dataCodewords) {
    const size = version * 4 + 17;
    const modules = Array.from({ length: size }, () => new Array(size).fill(false));
    const isFn = Array.from({ length: size }, () => new Array(size).fill(false));

    const setFn = (x, y, dark) => { if (x >= 0 && x < size && y >= 0 && y < size) { modules[y][x] = dark; isFn[y][x] = true; } };
    const drawFinder = (x, y) => {
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy)); const xx = x + dx, yy = y + dy;
        if (xx >= 0 && xx < size && yy >= 0 && yy < size) setFn(xx, yy, dist !== 2 && dist !== 4);
      }
    };
    // timing
    for (let i = 0; i < size; i++) { setFn(6, i, i % 2 === 0); setFn(i, 6, i % 2 === 0); }
    // finders
    drawFinder(3, 3); drawFinder(size - 4, 3); drawFinder(3, size - 4);
    // alignment
    const alignPos = alignmentPatternPositions(version);
    const n = alignPos.length;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
      drawAlign(alignPos[i], alignPos[j], setFn);
    }
    // резервни места за формат/версия (маркирай като функционални)
    drawFormatBits(0, version, ecl, setFn, modules, isFn, size, true);
    if (version >= 7) drawVersion(version, setFn, size);

    // данни + ECC
    const allCodewords = addEcc(version, ecl, dataCodewords);
    placeData(allCodewords, modules, isFn, size);

    // избор на маска
    let bestMask = 0, minPenalty = Infinity;
    for (let m = 0; m < 8; m++) {
      applyMask(m, modules, isFn, size);
      drawFormatBits(m, version, ecl, setFn, modules, isFn, size, false);
      const p = penalty(modules, size);
      if (p < minPenalty) { minPenalty = p; bestMask = m; }
      applyMask(m, modules, isFn, size);   // върни (XOR обратно)
    }
    applyMask(bestMask, modules, isFn, size);
    drawFormatBits(bestMask, version, ecl, setFn, modules, isFn, size, false);

    return modules;
  }

  function alignmentPatternPositions(ver) {
    if (ver === 1) return [];
    const numAlign = Math.floor(ver / 7) + 2;
    const step = Math.floor((ver * 4 + 4) / (numAlign - 1) / 2) * 2;
    const result = [6];
    for (let pos = ver * 4 + 10; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
    return result;
  }
  function drawAlign(cx, cy, setFn) {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++)
      setFn(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }

  function addEcc(version, ecl, data) {
    const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[ecl][version];
    const blockEccLen = ECC_CODEWORDS_PER_BLOCK[ecl][version];
    const rawCodewords = Math.floor(numRawDataModules(version) / 8);
    const numShort = numBlocks - rawCodewords % numBlocks;
    const shortLen = Math.floor(rawCodewords / numBlocks);
    const blocks = [];
    const divisor = rsDivisor(blockEccLen);
    let k = 0;
    for (let i = 0; i < numBlocks; i++) {
      const datLen = shortLen - blockEccLen + (i < numShort ? 0 : 1);
      const dat = data.slice(k, k + datLen); k += datLen;
      const ecc = rsRemainder(dat, divisor);
      blocks.push({ dat, ecc });
    }
    const result = [];
    for (let i = 0; i < shortLen - blockEccLen + 1; i++) for (let j = 0; j < numBlocks; j++) {
      if (i < blocks[j].dat.length) result.push(blocks[j].dat[i]);
    }
    for (let i = 0; i < blockEccLen; i++) for (let j = 0; j < numBlocks; j++) result.push(blocks[j].ecc[i]);
    return result;
  }

  function placeData(codewords, modules, isFn, size) {
    let i = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) {
        for (let k = 0; k < 2; k++) {
          const x = right - k;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vert : vert;
          if (!isFn[y][x] && i < codewords.length * 8) {
            modules[y][x] = ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0; i++;
          }
        }
      }
    }
  }

  function applyMask(mask, modules, isFn, size) {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (isFn[y][x]) continue;
      let invert = false;
      switch (mask) {
        case 0: invert = (x + y) % 2 === 0; break;
        case 1: invert = y % 2 === 0; break;
        case 2: invert = x % 3 === 0; break;
        case 3: invert = (x + y) % 3 === 0; break;
        case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
        case 5: invert = (x * y) % 2 + (x * y) % 3 === 0; break;
        case 6: invert = ((x * y) % 2 + (x * y) % 3) % 2 === 0; break;
        case 7: invert = ((x + y) % 2 + (x * y) % 3) % 2 === 0; break;
      }
      if (invert) modules[y][x] = !modules[y][x];
    }
  }

  function drawFormatBits(mask, version, ecl, setFn, modules, isFn, size, reserveOnly) {
    if (reserveOnly) {
      for (let i = 0; i <= 8; i++) { setFn(8, i, false); setFn(i, 8, false); }
      for (let i = 0; i < 8; i++) { setFn(size - 1 - i, 8, false); setFn(8, size - 1 - i, false); }
      setFn(8, size - 8, true);   // dark module
      return;
    }
    const data = (ECL_BITS[Object.keys(ECL)[ecl]] << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    const put = (x, y, b) => { modules[y][x] = b; };
    for (let i = 0; i <= 5; i++) put(8, i, ((bits >>> i) & 1) !== 0);
    put(8, 7, ((bits >>> 6) & 1) !== 0); put(8, 8, ((bits >>> 7) & 1) !== 0); put(7, 8, ((bits >>> 8) & 1) !== 0);
    for (let i = 9; i < 15; i++) put(14 - i, 8, ((bits >>> i) & 1) !== 0);
    for (let i = 0; i < 8; i++) put(size - 1 - i, 8, ((bits >>> i) & 1) !== 0);
    for (let i = 8; i < 15; i++) put(8, size - 15 + i, ((bits >>> i) & 1) !== 0);
    put(8, size - 8, true);
  }

  function drawVersion(version, setFn, size) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
    const bits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const b = ((bits >>> i) & 1) !== 0; const a = size - 11 + i % 3, bb = Math.floor(i / 3);
      setFn(a, bb, b); setFn(bb, a, b);
    }
  }

  function penalty(m, size) {
    let p = 0;
    // правила 1: поредици
    for (let y = 0; y < size; y++) { let run = 1; for (let x = 1; x < size; x++) { if (m[y][x] === m[y][x-1]) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; } }
    for (let x = 0; x < size; x++) { let run = 1; for (let y = 1; y < size; y++) { if (m[y][x] === m[y-1][x]) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; } }
    // правило 2: 2x2 блокове
    for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) { const c = m[y][x]; if (c === m[y][x+1] && c === m[y+1][x] && c === m[y+1][x+1]) p += 3; }
    // правило 3: шаблон finder-подобен
    const pat = [true,false,true,true,true,false,true];
    const check = (arr) => { for (let i = 0; i + 7 <= arr.length; i++) { let ok = true; for (let j = 0; j < 7; j++) if (arr[i+j] !== pat[j]) { ok = false; break; } if (ok) { const before = i >= 4 && arr.slice(i-4,i).every(v=>!v); const after = i+11 <= arr.length && arr.slice(i+7,i+11).every(v=>!v); if (before || after) p += 40; } } };
    for (let y = 0; y < size; y++) check(m[y]);
    for (let x = 0; x < size; x++) { const col = []; for (let y = 0; y < size; y++) col.push(m[y][x]); check(col); }
    // правило 4: баланс тъмно/светло
    let dark = 0; for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (m[y][x]) dark++;
    const total = size * size; const k = Math.floor((Math.abs(dark * 20 - total * 10) + total - 1) / total) - 1; p += Math.max(k, 0) * 10;
    return p;
  }

  // ── SVG изход ──
  function svg(text, opts) {
    opts = opts || {};
    const m = encode(text, opts.ecl || 'M');
    const size = m.length;
    const border = opts.border != null ? opts.border : 2;
    const scale = opts.scale != null ? opts.scale : 6;
    const dim = (size + border * 2) * scale;
    const light = opts.light || '#ffffff', dark = opts.dark || '#0b0f14';
    let path = '';
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (m[y][x]) path += 'M' + ((x + border) * scale) + ',' + ((y + border) * scale) + 'h' + scale + 'v' + scale + 'h-' + scale + 'z';
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + dim + '" height="' + dim + '" viewBox="0 0 ' + dim + ' ' + dim + '" shape-rendering="crispEdges">'
      + '<rect width="100%" height="100%" fill="' + light + '"/>'
      + '<path d="' + path + '" fill="' + dark + '"/></svg>';
  }

  root.PSQR = { svg, encode };
})(typeof window !== 'undefined' ? window : this);
