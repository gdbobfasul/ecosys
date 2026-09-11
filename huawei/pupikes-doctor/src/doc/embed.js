// Version: 1.0023
// embed.js — НЕВРОННО ВГРАЖДАНЕ НА СНИМКАТА на устройството (11.09.2026).
// MobileNetV3-Small (TensorFlow.js, вграден в апа: models/mnv3s, float16 ~3 MB, без CDN/интернет) → 1024-мерен
// отпечатък → PCA до 128 измерения (pca.bin, сметнат при билд) → косинусова близост срещу библиотека от вграждания
// (reference/emb/part-N.bin, int8, пресметната при билд от снимковия корпус + 100+ проверени снимки на състояние;
// deploy-scripts/gen-doctor-embeddings.mjs) → претеглено гласуване на най-близките K → топ-3 състояния с вероятности.
//
// Снимката е ВТОРИ ГЛАС: въпросникът (област/болка/оплаквания) води; тук само подсказваме „прилича на…".
// Работи и без модела: при слаб телефон (≤ 1 GB), липсващ файл, грешка в WebGL/паметта или изтекло време
// състоянието става 'off'/'error' с причина и analyze.js минава по стария път (ръчни отпечатъци) — никога тих провал.
const NN = { status: 'idle', reason: '', n: 0, loaded: 0, total: 0, dim: 128, raw: 1024, scale: 1, labels: [], parts: [], pca: null, model: null, tf: null, backend: '', ms: 0 };
let nnPromise = null; const listeners = [];
export function nnState() { return { status: NN.status, reason: NN.reason, n: NN.n, loaded: NN.loaded, total: NN.total, backend: NN.backend, ms: NN.ms }; }
export function onNN(fn) { listeners.push(fn); }
function emit() { const s = nnState(); for (const f of listeners) { try { f(s); } catch (_) {} } }
async function fetchBin(p) { const r = await fetch(p); if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + p); return new Uint8Array(await r.arrayBuffer()); }

// Зарежда библиотеката (manifest + pca + части) и модела (TF.js динамично — главният пакет не тежи с него).
export function preloadNN() {
  if (nnPromise) return nnPromise;
  nnPromise = (async () => {
    let mem = 0; try { mem = Number(navigator.deviceMemory) || 0; } catch (_) {}
    if (mem > 0 && mem <= 1) { NN.status = 'off'; NN.reason = 'lowmem'; emit(); return nnState(); }
    NN.status = 'loading'; emit();
    try {
      let man = null; try { const r = await fetch('reference/emb/manifest.json'); man = r.ok ? await r.json() : null; } catch (_) {}
      if (!man || !man.parts || !man.parts.length) throw new Error('nolib');
      NN.dim = man.dim | 0; NN.raw = man.raw | 0; NN.scale = Number(man.scale) || 1; NN.labels = man.labels || []; NN.total = man.parts.length + 2;
      const pca = await fetchBin('reference/emb/pca.bin');
      if (pca.length < (NN.raw + NN.dim * NN.raw) * 4) throw new Error('pca short');
      const f = new Float32Array(pca.buffer, pca.byteOffset, NN.raw + NN.dim * NN.raw);
      NN.pca = { mean: f.subarray(0, NN.raw), W: f.subarray(NN.raw) }; NN.loaded++; emit();
      for (const p of man.parts) {
        const buf = await fetchBin('reference/emb/' + p.file); const n = p.n | 0;
        if (buf.length < n * 2 + n * NN.dim) throw new Error('short ' + p.file);
        const labs = new Uint16Array(n); for (let i = 0; i < n; i++) labs[i] = buf[i * 2] | (buf[i * 2 + 1] << 8);
        NN.parts.push({ n, labs, flat: new Int8Array(buf.buffer, buf.byteOffset + n * 2, n * NN.dim) }); NN.n += n; NN.loaded++; emit();
      }
      // Моделът: TF.js (динамичен import → отделен пакет), WebGL → при провал CPU.
      const t0 = Date.now();
      const tf = await import('@tensorflow/tfjs'); NN.tf = tf;
      try { await tf.setBackend('webgl'); await tf.ready(); } catch (_) { await tf.setBackend('cpu'); await tf.ready(); }
      NN.backend = tf.getBackend();
      NN.model = await tf.loadGraphModel('models/mnv3s/model.json');
      // загрявка (първото предсказване компилира шейдърите) — с празна снимка
      tf.tidy(() => { const y = NN.model.predict(tf.zeros([1, 224, 224, 3])); y.dataSync(); });
      NN.ms = Date.now() - t0; NN.loaded++;
      NN.status = 'ready'; BUILT = String(man.built || '');
      try { const list = extraLoad(); if (list.length) extraRebuild(list); } catch (_) {}   // локалните допълнения (ако има)
      emit();
    } catch (e) {
      NN.status = NN.parts.length && !NN.model ? 'error' : 'error'; NN.reason = String((e && e.message) || e).slice(0, 80);
      try { if (NN.model) NN.model.dispose(); } catch (_) {} NN.model = null; emit();
    }
    return nnState();
  })();
  return nnPromise;
}
export async function waitForNN(ms) {
  try { await Promise.race([preloadNN(), new Promise((res) => setTimeout(res, ms || 10000))]); } catch (_) {}
  return nnState();
}

// ── Предварителна обработка: централно квадратно изрязване → 224×224 (+ завъртане 0/90/180/270) ──
function loadImg(file) {
  return new Promise((res, rej) => { const img = new Image(); const u = URL.createObjectURL(file); img.onload = () => { URL.revokeObjectURL(u); res(img); }; img.onerror = () => { URL.revokeObjectURL(u); rej(new Error('img')); }; img.src = u; });
}
const S = 224;
function square(img, rot) {
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height; const side = Math.max(2, Math.min(w, h));
  const c = document.createElement('canvas'); c.width = S; c.height = S; const x = c.getContext('2d');
  x.translate(S / 2, S / 2); x.rotate((rot || 0) * Math.PI / 180);
  x.drawImage(img, Math.floor((w - side) / 2), Math.floor((h - side) / 2), side, side, -S / 2, -S / 2, S, S);
  return c;
}
// L2-нормиран 1024-мерен вектор от платно.
function embedCanvas(c) {
  const tf = NN.tf;
  return tf.tidy(() => {
    const x = tf.browser.fromPixels(c).toFloat().div(255).expandDims(0);
    const v = NN.model.predict(x).dataSync(); let n = 0; for (let i = 0; i < v.length; i++) n += v[i] * v[i]; n = Math.sqrt(n) || 1;
    const out = new Float32Array(v.length); for (let i = 0; i < v.length; i++) out[i] = v[i] / n; return out;
  });
}
// PCA проекция + L2 нормиране (същото като pcaProject в private/medikit-harvester/embed-node.mjs).
function project(v) {
  const D = NN.raw, k = NN.dim, out = new Float32Array(k), m = NN.pca.mean, W = NN.pca.W;
  for (let j = 0; j < k; j++) { let s = 0; const off = j * D; for (let i = 0; i < D; i++) s += (v[i] - m[i]) * W[off + i]; out[j] = s; }
  let nn = 0; for (let j = 0; j < k; j++) nn += out[j] * out[j]; nn = Math.sqrt(nn) || 1; for (let j = 0; j < k; j++) out[j] /= nn;
  return out;
}
// Пуска модела за 4 завъртания (снимката може да е под ъгъл) и връща 4 проектирани вектора.
// Суровото 1024-мерно вграждане при 0° се пази (lastRawEmbedding) за „✓ Това беше X" (medikit.js learn).
let LAST_RAW = null;
export function lastRawEmbedding() { return LAST_RAW; }
async function queryVectors(file) {
  const img = await loadImg(file); const out = [];
  for (const rot of [0, 90, 180, 270]) { const raw = embedCanvas(square(img, rot)); if (rot === 0) LAST_RAW = raw; out.push(project(raw)); await new Promise((r) => setTimeout(r, 0)); }
  return out;
}

// ── Локална допълнителна библиотека (11.09.2026): вграждания от сървъра (/updates) и потвърдени от потребителя
// („това беше X") → отделна част в NN.parts + localStorage (doc.nn.extra.v1), таван 1500 записа (≈ 300 KB).
// Пази се с „built" на PCA-то от манифеста: при нов билд (друго PCA) старите проекции са невалидни → изчистват се.
const EXTRA_KEY = 'doc.nn.extra.v1', EXTRA_MAX = 1500;
let EXTRA = null;   // { n, labs: Uint16Array, flat: Int8Array } — част в NN.parts
let BUILT = '';
function extraSave(list) { try { localStorage.setItem(EXTRA_KEY, JSON.stringify({ built: BUILT, items: list })); } catch (_) {} }
function extraLoad() { try { const j = JSON.parse(localStorage.getItem(EXTRA_KEY) || 'null'); return j && j.built === BUILT && Array.isArray(j.items) ? j.items : []; } catch (_) { return []; } }
function extraRebuild(list) {
  const dim = NN.dim, n = list.length; const labs = new Uint16Array(n), flat = new Int8Array(n * dim);
  for (let i = 0; i < n; i++) {
    let li = NN.labels.indexOf(list[i].l); if (li < 0) { li = NN.labels.length; NN.labels.push(list[i].l); } labs[i] = li;
    const b = atob(list[i].v); for (let k = 0; k < dim && k < b.length; k++) { let c = b.charCodeAt(k); flat[i * dim + k] = c > 127 ? c - 256 : c; }
  }
  if (EXTRA) { const at = NN.parts.indexOf(EXTRA); if (at >= 0) NN.parts.splice(at, 1); NN.n -= EXTRA.n; }
  EXTRA = { n, labs, flat, extra: true }; NN.parts.push(EXTRA); NN.n += n; emit();
}
// items = [{ raw: Float32Array(1024), label }] → проекция → int8 → локална част + запис. Връща броя добавени.
export function addLocalVectors(items) {
  if (NN.status !== 'ready' || !NN.pca || !items || !items.length) return 0;
  const list = extraLoad(); let added = 0;
  for (const it of items) {
    if (!it || !it.raw || it.raw.length < NN.raw || !it.label) continue;
    const z = project(it.raw); let s = ''; for (let k = 0; k < NN.dim; k++) { const q = Math.max(-127, Math.min(127, Math.round(z[k] * NN.scale))); s += String.fromCharCode(q < 0 ? q + 256 : q); }
    list.push({ l: String(it.label).toLowerCase().slice(0, 40), v: btoa(s) }); added++;
  }
  while (list.length > EXTRA_MAX) list.shift();
  extraSave(list); extraRebuild(list); return added;
}
export function localExtraCount() { return EXTRA ? EXTRA.n : 0; }
// Претеглено гласуване: най-близките K по косинус (макс. по завъртанията), тегло sim^3 → вероятности по състояние.
// condOf(label) → id на състояние в апа ('' = дерматологичен/друг етикет, брои се само в top).
export async function nnMatches(file, condOf, K) {
  K = K || 24;
  if (NN.status !== 'ready' || !NN.model) return { skipped: true, reason: NN.status === 'ready' ? 'nomodel' : NN.status };
  let qs; try { qs = await queryVectors(file); } catch (e) { return { skipped: true, reason: 'unreadable' }; }
  const dim = NN.dim, scale = NN.scale, R = qs.length;
  const bestS = new Float64Array(K).fill(-2), bestI = new Int32Array(K).fill(-1), bestP = new Array(K).fill(null);
  for (const P of NN.parts) {
    const n = P.n, flat = P.flat;
    for (let i = 0; i < n; i++) {
      const off = i * dim; let s = -2;
      for (let r = 0; r < R; r++) { const q = qs[r]; let d = 0; for (let k = 0; k < dim; k++) d += q[k] * flat[off + k]; if (d > s) s = d; }
      s /= scale;
      if (s > bestS[K - 1]) { let j = K - 1; while (j > 0 && bestS[j - 1] < s) { bestS[j] = bestS[j - 1]; bestI[j] = bestI[j - 1]; bestP[j] = bestP[j - 1]; j--; } bestS[j] = s; bestI[j] = i; bestP[j] = P; }
    }
  }
  const votes = new Map(), counts = new Map(); let tot = 0; const top = [];
  for (let t = 0; t < K; t++) {
    const i = bestI[t], P = bestP[t]; if (i < 0 || !P) continue;
    const lab = NN.labels[P.labs[i]] || ''; const w = Math.pow(Math.max(0, bestS[t]), 3);
    counts.set(lab, (counts.get(lab) || 0) + 1); top.push({ label: lab, sim: bestS[t] });
    const cid = condOf(lab); if (!cid) continue; votes.set(cid, (votes.get(cid) || 0) + w); tot += w;
  }
  const probs = [...votes.entries()].sort((a, b) => b[1] - a[1]).map(([id, w]) => ({ id, p: tot ? w / tot : 0 }));
  const topLabels = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, count]) => ({ label, count }));
  return { skipped: false, reason: '', probs, top: topLabels, best: bestS[0], neural: true };
}
