// embed-node.mjs — невронно вграждане на снимка в Node (MobileNetV3-Small, TensorFlow.js без native binding).
// Същото предварително обработване като в апа (src/doc/embed.js): централно квадратно изрязване → 224×224 → [0,1].
// Ползва се от deploy-scripts/gen-doctor-embeddings.mjs и от стенда test-doctor.mjs --emb.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import sharp from 'sharp';
const require = createRequire(import.meta.url);
let tf; for (const c of ['G:/wrk/2026-06-02-toks/huawei/pupikes-doctor/node_modules/@tensorflow/tfjs', '@tensorflow/tfjs']) { try { tf = require(c); break; } catch (e) {} }
export { tf };
export const SIZE = 224;

// Зарежда graph-model от папка (model.json + shard-ове) през IOHandler в паметта (без tfjs-node/file://).
export async function loadModel(dir) {
  const mj = JSON.parse(fs.readFileSync(path.join(dir, 'model.json'), 'utf8'));
  const handler = {
    load: async () => {
      const specs = [], bufs = [];
      for (const g of mj.weightsManifest) { for (const p of g.paths) bufs.push(fs.readFileSync(path.join(dir, p))); specs.push(...g.weights); }
      const total = bufs.reduce((s, b) => s + b.length, 0); const wd = new Uint8Array(total); let off = 0;
      for (const b of bufs) { wd.set(b, off); off += b.length; }
      return { modelTopology: mj.modelTopology, weightSpecs: specs, weightData: wd.buffer, format: mj.format, generatedBy: mj.generatedBy, convertedBy: mj.convertedBy, signature: mj.signature };
    }
  };
  await tf.ready();
  return tf.loadGraphModel(handler);
}
// Пикселите за модела: центрирано квадратно изрязване с дял `crop` от по-малката страна (1 = цялото), 224×224 RGB.
export async function pixels(input, crop, rotDeg) {
  let s = sharp(input, { failOn: 'none' }).rotate();
  if (rotDeg) s = s.rotate(rotDeg, { background: '#ffffff' });
  const buf = await s.toBuffer(); const meta = await sharp(buf).metadata();
  const w = meta.width || 0, h = meta.height || 0; const side = Math.max(2, Math.floor(Math.min(w, h) * (crop || 1)));
  const raw = await sharp(buf).extract({ left: Math.floor((w - side) / 2), top: Math.floor((h - side) / 2), width: side, height: side }).resize(SIZE, SIZE, { fit: 'fill' }).removeAlpha().raw().toBuffer();
  return raw;   // SIZE*SIZE*3 uint8
}
// Вграждане (Float32Array 1024, L2-нормирано) от суров RGB буфер.
export function embedRaw(model, raw) {
  return tf.tidy(() => {
    const x = tf.tensor4d(new Float32Array(raw), [1, SIZE, SIZE, 3]).div(255);
    const y = model.predict(x); const v = y.dataSync();
    let n = 0; for (let i = 0; i < v.length; i++) n += v[i] * v[i]; n = Math.sqrt(n) || 1;
    const out = new Float32Array(v.length); for (let i = 0; i < v.length; i++) out[i] = v[i] / n; return out;
  });
}
export async function embed(model, input, crop, rotDeg) { return embedRaw(model, await pixels(input, crop, rotDeg)); }

// ── Кеш на вгражданията (append-only): emb-cache/index.json {ключ: №} + vectors.f32 (1024 float32 на запис) ──
// Ключ = относителен път на файла (+ '@rot' за завъртян вариант). Преизчислява се само липсващото.
const CACHE_DIR = path.resolve('private/medikit-harvester/emb-cache');
export const DIM_RAW = 1024;
export function openCache() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const ip = path.join(CACHE_DIR, 'index.json'), vp = path.join(CACHE_DIR, 'vectors.f32');
  let index = {}; try { index = JSON.parse(fs.readFileSync(ip, 'utf8')); } catch (_) {}
  let vec = new Float32Array(0);
  if (fs.existsSync(vp)) { const b = fs.readFileSync(vp); vec = new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); }
  let n = Math.floor(vec.length / DIM_RAW); const pending = [];
  const cache = {
    has: (k) => index[k] !== undefined,
    get: (k) => { const i = index[k]; return i === undefined ? null : vec.subarray(i * DIM_RAW, (i + 1) * DIM_RAW); },
    put: (k, v) => { if (index[k] !== undefined) return; index[k] = n++; pending.push(v); },
    flush: () => {
      if (!pending.length) return;
      const add = new Float32Array(pending.length * DIM_RAW); pending.forEach((v, i) => add.set(v, i * DIM_RAW));
      fs.appendFileSync(vp, Buffer.from(add.buffer)); const nv = new Float32Array(vec.length + add.length); nv.set(vec); nv.set(add, vec.length); vec = nv; pending.length = 0;
      fs.writeFileSync(ip, JSON.stringify(index));
    },
    size: () => n
  };
  return cache;
}
// Вграждане с кеш: key → вектор (изчислява при липса).
export async function embedCached(cache, model, key, file, crop, rotDeg) {
  const c = cache.get(key); if (c) return c;
  const v = await embed(model, file, crop, rotDeg); cache.put(key, v); return v;
}

// ── PCA (блоково степенно итериране) върху L2-нормирани 1024-мерни вектори → k главни посоки ──
// Връща { mean: Float32Array(1024), W: Float32Array(1024*k) } (W по редове: компонент j = W[j*1024 .. ]).
export function pcaFit(vectors, k, iters) {
  const n = vectors.length, D = DIM_RAW; k = k || 128; iters = iters || 60;
  const mean = new Float64Array(D); for (const v of vectors) for (let i = 0; i < D; i++) mean[i] += v[i]; for (let i = 0; i < D; i++) mean[i] /= n;
  // ковариация през tf (по-бързо от чист JS цикъл)
  const X = new Float32Array(n * D); for (let r = 0; r < n; r++) { const v = vectors[r]; for (let i = 0; i < D; i++) X[r * D + i] = v[i] - mean[i]; }
  const C = tf.tidy(() => { const x = tf.tensor2d(X, [n, D]); return tf.matMul(x, x, true, false).div(n); });
  // блоково степенно итериране с ортонормиране (Грам–Шмит)
  let W = tf.randomNormal([D, k], 0, 1, 'float32', 7);
  const orth = (M) => { const a = M.dataSync(); const out = new Float32Array(D * k);   // колони
    for (let j = 0; j < k; j++) {
      const col = new Float64Array(D); for (let i = 0; i < D; i++) col[i] = a[i * k + j];
      for (let p = 0; p < j; p++) { let d = 0; for (let i = 0; i < D; i++) d += col[i] * out[i * k + p]; for (let i = 0; i < D; i++) col[i] -= d * out[i * k + p]; }
      let nn = 0; for (let i = 0; i < D; i++) nn += col[i] * col[i]; nn = Math.sqrt(nn) || 1; for (let i = 0; i < D; i++) out[i * k + j] = col[i] / nn;
    }
    return tf.tensor2d(out, [D, k]); };
  W = orth(W);
  for (let it = 0; it < iters; it++) { const Wn = tf.tidy(() => tf.matMul(C, W)); W.dispose(); W = orth(Wn); Wn.dispose(); }
  // обяснена дисперсия (за отчет)
  const CW = tf.matMul(C, W); const ev = tf.sum(tf.mul(W, CW), 0).dataSync(); const tot = tf.sum(tf.diag ? C.mul(tf.eye(D)) : C).dataSync()[0];
  const wd = W.dataSync(); const Wrows = new Float32Array(k * D); for (let j = 0; j < k; j++) for (let i = 0; i < D; i++) Wrows[j * D + i] = wd[i * k + j];
  C.dispose(); W.dispose(); CW.dispose();
  return { mean: Float32Array.from(mean), W: Wrows, k, explained: Array.from(ev).reduce((s, v) => s + v, 0) / (tot || 1) };
}
// Проекция + L2 нормиране → Float32Array(k). Същото в апа (src/doc/embed.js).
export function pcaProject(P, v) {
  const D = DIM_RAW, k = P.k, out = new Float32Array(k);
  for (let j = 0; j < k; j++) { let s = 0; const off = j * D; for (let i = 0; i < D; i++) s += (v[i] - P.mean[i]) * P.W[off + i]; out[j] = s; }
  let nn = 0; for (let j = 0; j < k; j++) nn += out[j] * out[j]; nn = Math.sqrt(nn) || 1; for (let j = 0; j < k; j++) out[j] /= nn;
  return out;
}
// Претеглено гласуване по най-близките K (косинус; тегло = sim^3, само положителни) → [{id, p}] (вероятности по състояние).
export function knnVotes(q, lib, K, condOf) {
  const { n, dim, flat, labs, labels, scale } = lib; K = K || 24;
  const bestS = new Float64Array(K).fill(-2), bestI = new Int32Array(K).fill(-1);
  for (let i = 0; i < n; i++) {
    let s = 0; const off = i * dim; for (let k = 0; k < dim; k++) s += q[k] * flat[off + k]; s /= scale;
    if (s > bestS[K - 1]) { let j = K - 1; while (j > 0 && bestS[j - 1] < s) { bestS[j] = bestS[j - 1]; bestI[j] = bestI[j - 1]; j--; } bestS[j] = s; bestI[j] = i; }
  }
  const votes = new Map(); let tot = 0; const top = [];
  for (let t = 0; t < K; t++) { const i = bestI[t]; if (i < 0) continue; const lab = labels[labs[i]] || ''; const w = Math.pow(Math.max(0, bestS[t]), 3); top.push({ label: lab, sim: bestS[t] }); const cid = condOf(lab); if (!cid) continue; votes.set(cid, (votes.get(cid) || 0) + w); tot += w; }
  const out = [...votes.entries()].sort((a, b) => b[1] - a[1]).map(([id, w]) => ({ id, p: tot ? w / tot : 0 }));
  return { conds: out, top, best: bestS[0] };
}
