// Version: 1.0022
// deskew.js — ИЗРАВНЯВАНЕ НА НАДПИСИТЕ (искане 09.09.2026): снимката на опаковката рядко е под 0° — може да е
// на 15,56° или 95,3°. Апът САМ определя ъгъла на текстовите редове и завърта снимката, така че четенето
// (OCR) да става върху изравнена картинка.
// Метод (v1.0022, след стенда): ОРИЕНТАЦИЯ НА РЪБОВЕТЕ. Буквите са от вертикални и хоризонтални щрихи, така че
// градиентът по контурите им сочи в две взаимно перпендикулярни посоки. Хистограма на посоката на градиента
// (Собел) по силните ръбове, сгъната по модул 90°, дава пик точно при ъгъла на надписа — независимо от големи
// цветни петна, снимки и фон (те почти нямат ръбове и не тежат). Старият метод (проекционен профил на всички
// тъмни пиксели) се подвеждаше от фона на снимката и връщаше 0° при реално 15°.
// Резултатът е ъгъл в (−45°, 45°] — остатъкът по 90° (вертикален/обърнат надпис) се решава от OCR етапите
// 0/90/180/270 върху изравнената картинка. Изцяло на устройството, без библиотеки.

// Малко сиво копие (≤ maxW по дългата страна) → Float32Array.
function grayscale(src, maxW) {
  const w0 = src.width, h0 = src.height; const sc = Math.min(1, maxW / Math.max(w0, h0));
  const w = Math.max(16, Math.round(w0 * sc)), h = Math.max(16, Math.round(h0 * sc));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.drawImage(src, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data;
  const g = new Float32Array(w * h);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) g[j] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  return { g, w, h };
}
// Собел: за всеки вътрешен пиксел — сила и посока на градиента. Връща и списък на силните ръбове.
function edges(gm) {
  const { g, w, h } = gm; const mag = new Float32Array(w * h); const ang = new Float32Array(w * h);
  let sum = 0, n = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    const gx = (g[i - w + 1] + 2 * g[i + 1] + g[i + w + 1]) - (g[i - w - 1] + 2 * g[i - 1] + g[i + w - 1]);
    const gy = (g[i + w - 1] + 2 * g[i + w] + g[i + w + 1]) - (g[i - w - 1] + 2 * g[i - w] + g[i - w + 1]);
    const m = Math.hypot(gx, gy); mag[i] = m; ang[i] = Math.atan2(gy, gx); sum += m; n++;
  }
  const mean = n ? sum / n : 0; const thr = Math.max(24, mean * 2.5);   // само ясни контури (букви, ръбове)
  const pts = [];
  for (let i = 0; i < mag.length; i++) if (mag[i] > thr) pts.push(i);
  return { mag, ang, pts, w, h };
}
// Дисперсия на редовите проекции на ръбовете след завъртане на ъгъл deg (без нови платна) — за избор 0°/90°.
function rowVariance(ed, deg) {
  const { pts, w, h } = ed; const rad = deg * Math.PI / 180, cos = Math.cos(rad), sin = Math.sin(rad);
  const cx = w / 2, cy = h / 2; const R = Math.ceil(Math.hypot(w, h) / 2);
  const rows = new Float64Array(2 * R + 1);
  for (const i of pts) { const dx = (i % w) - cx, dy = ((i / w) | 0) - cy; const r = Math.round(-dx * sin + dy * cos) + R; if (r >= 0 && r < rows.length) rows[r]++; }
  let mean = 0, cnt = 0; for (let i = 0; i < rows.length; i++) if (rows[i]) { mean += rows[i]; cnt++; }
  if (!cnt) return 0; mean /= cnt; let v = 0; for (let i = 0; i < rows.length; i++) if (rows[i]) { const d = rows[i] - mean; v += d * d; }
  return v / cnt;
}
// Връща ъгъла (градуси, −45…45], на който снимката е завъртяна по часовниковата стрелка спрямо хоризонталния
// надпис — т.е. rotateAny(canvas, −angle) изравнява текста; и увереност 0..1 (колко ясно се откроява пикът).
export function estimateSkew(canvas) {
  let ed; try { ed = edges(grayscale(canvas, 480)); } catch (_) { return { angle: 0, confidence: 0 }; }
  if (ed.pts.length < 200) return { angle: 0, confidence: 0 };
  // Хистограма на посоката, сгъната по модул 90° (вертикалните и хоризонталните щрихи падат в един и същ кош).
  const BIN = 0.5, NB = Math.round(90 / BIN); const hist = new Float64Array(NB);
  for (const i of ed.pts) { let a = ed.ang[i] * 180 / Math.PI; a = ((a % 90) + 90) % 90; hist[Math.min(NB - 1, Math.round(a / BIN) % NB)] += ed.mag[i]; }
  // Леко изглаждане (кръгово) и пик.
  const sm = new Float64Array(NB); for (let i = 0; i < NB; i++) sm[i] = (hist[(i + NB - 1) % NB] + 2 * hist[i] + hist[(i + 1) % NB]) / 4;
  let pk = 0; for (let i = 1; i < NB; i++) if (sm[i] > sm[pk]) pk = i;
  // Параболична интерполация около пика за под-кошова точност.
  const l = sm[(pk + NB - 1) % NB], c = sm[pk], r = sm[(pk + 1) % NB]; const den = l - 2 * c + r; const off = den ? 0.5 * (l - r) / den : 0;
  let coarse = (pk + off) * BIN; if (coarse > 45) coarse -= 90;        // → (−45, 45]
  // Увереност: пикът спрямо средното ниво на хистограмата (равномерно = 1× → 0; ясни редове ≥ 4× → 1).
  let mean = 0; for (let i = 0; i < NB; i++) mean += sm[i]; mean /= NB;
  const confidence = mean > 0 ? Math.max(0, Math.min(1, (c / mean - 1) / 3)) : 0;
  // ФИНО ДОНАСТРОЙВАНЕ (стенд 09.09: грубият ъгъл от хистограмата плава ±10° заради снимки/криви):
  // около грубия ъгъл (и перпендикуляра му) търсим максимума на проекционната дисперсия на РЪБОВЕТЕ —
  // при верния ъгъл контурите на буквите се подреждат в ясни хоризонтални ивици. Стъпка 0,5° в ±8°, после 0,25°.
  let best = { a: coarse, v: -1 };
  for (const base of [coarse, coarse + 90, coarse - 90]) {
    if (base < -100 || base > 100) continue;
    for (let a = base - 8; a <= base + 8; a += 0.5) { const v = rowVariance(ed, a); if (v > best.v) best = { a, v }; }
  }
  for (let a = best.a - 0.5; a <= best.a + 0.5; a += 0.25) { const v = rowVariance(ed, a); if (v > best.v) best = { a, v }; }
  let linesAt = best.a;                                             // ъгъл, при който редовете лягат хоризонтално
  let angle = linesAt; while (angle > 45) angle -= 90; while (angle <= -45) angle += 90;
  return { angle: Math.round(angle * 100) / 100, confidence, horizontalAt: Math.round(linesAt * 100) / 100, coarse: Math.round(coarse * 100) / 100, edges: ed.pts.length };
}
// Завърта платно на произволен ъгъл (deg, по часовниковата стрелка), уголемено до обхващащия правоъгълник,
// с бял фон (OCR не обича прозрачни/черни ъгли).
export function rotateAny(src, deg) {
  const w = src.width, h = src.height, rad = deg * Math.PI / 180;
  const cos = Math.abs(Math.cos(rad)), sin = Math.abs(Math.sin(rad));
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * cos + h * sin)); c.height = Math.max(1, Math.round(w * sin + h * cos));
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
  x.translate(c.width / 2, c.height / 2); x.rotate(rad); x.drawImage(src, -w / 2, -h / 2);
  return c;
}
