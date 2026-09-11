#!/usr/bin/env node
// gen-doctor-embeddings.mjs — НЕВРОННА СНИМКОВА БИБЛИОТЕКА за Pupikes Doctor (v1.0023, 11.09.2026).
//
// 1) Модел: MobileNetV3-Small (feature vector, 224×224 → 1024) от TF Hub, теглата се свалят ВЕДНЪЖ и се
//    записват като float16 (~3 MB) в huawei/pupikes-doctor/public/models/mnv3s/ (+ огледало rustore). Вграден в APK-то,
//    без CDN — работи и без интернет (Китай).
// 2) Библиотека: вграждане на всяка снимка от снимковия корпус (rustore/pupikes-doctor/publish/reference/images-index.json,
//    същият подбор като старите отпечатъци: NOISE + CAP=500 на етикет) + testsets/cond2 (100+ на състояние, без suspect)
//    + testsets/cond (тестовият набор; --no-test го изключва — за честния стенд). Кеш: private/medikit-harvester/emb-cache/.
// 3) PCA 1024 → 128 (блоково степенно итериране), L2-нормиране, int8 → public/reference/emb/part-N.bin + manifest.json
//    + pca.bin (mean 1024 f32 + W 128×1024 f32). Част 0 = етикети на „първа помощ" (състоянията в апа) — зарежда се първа.
//
//   node deploy-scripts/gen-doctor-embeddings.mjs [--model-only] [--dims=128] [--no-test] [--no-corpus] [--cache-only]
import fs from 'node:fs';
import path from 'node:path';
import { loadModel, openCache, embedCached, pcaFit, pcaProject, tf, DIM_RAW } from '../private/medikit-harvester/embed-node.mjs';

const ROOT = path.resolve(process.cwd());
const TREES = ['huawei', 'rustore'].map((t) => path.join(ROOT, t, 'pupikes-doctor'));
const MODEL_DIR = path.join(TREES[0], 'public', 'models', 'mnv3s');
const HUB = 'https://tfhub.dev/google/tfjs-model/imagenet/mobilenet_v3_small_100_224/feature_vector/5/default/1/';
const REF = path.join(ROOT, 'rustore', 'pupikes-doctor', 'publish', 'reference');
const TS = path.join(ROOT, 'private', 'medikit-harvester', 'testsets');
const arg = (k, d) => { const m = process.argv.find((a) => a.startsWith('--' + k + '=')); return m ? m.split('=')[1] : d; };
const DIMS = parseInt(arg('dims', '128'), 10);
const CAP = 500, NOISE = /(victim|casualt|\bwar\b|soldier|corpse|autops|\btattoo|fluoro|xylene|benzene|butyl|toluene|phenol|ethyl|methyl|propyl|\bacid\b|oxide|chloride|sulfate|nitrate|cannabidiol|cannabinol|amphetamine)/i;
const cleanLabel = (s) => String(s || '').trim().replace(/^dermatology:\s*/i, '').replace(/^condition:\s*/i, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 60) || 'unknown';
// Същият списък като vite.config.js/analyze.js: етикети, съответстващи на състояние в апа → част 0.
const condRelevant = (lab) => /sunburn|burn|scald|bruis|contusion|h(a)?ematoma|ecchymos|abrasion|graze|wound|laceration|\bcut\b|incision|urticaria|hives|psorias|dermatitis|eczema|tinea|dermatophyt|fungal|candid|mycos|furuncle|boil|abscess|carbuncle|cellulitis|impetigo|infect|pyoderma|blister|bulla|vesic|frostbite|chilblain|pernio|fracture|sprain|dislocation|bite|sting|edema|oedema|swelling|ingrown|rash|exanthem|erythema|muscle.?strain|nosebleed|epistaxis|chickenpox|varicella|acne|cold sore|herpes labialis/.test(String(lab || '').toLowerCase());

// ── float32 → float16 (закръгляне към най-близкото) ──
function f16(v) {
  const f32 = new Float32Array(1), u32 = new Uint32Array(f32.buffer); f32[0] = v; const x = u32[0];
  const sign = (x >>> 16) & 0x8000; let exp = ((x >>> 23) & 0xff) - 127 + 15; let mant = x & 0x7fffff;
  if (((x >>> 23) & 0xff) === 0xff) return sign | 0x7c00 | (mant ? 0x200 : 0);
  if (exp >= 31) return sign | 0x7c00;
  if (exp <= 0) { if (exp < -10) return sign; mant |= 0x800000; const shift = 14 - exp; let h = mant >> shift; const rem = mant & ((1 << shift) - 1), half = 1 << (shift - 1); if (rem > half || (rem === half && (h & 1))) h++; return sign | h; }
  let h = sign | (exp << 10) | (mant >> 13); const rem = mant & 0x1fff; if (rem > 0x1000 || (rem === 0x1000 && (h & 1))) h++; return h;
}
async function fetchBuf(u) { const r = await fetch(u, { redirect: 'follow' }); if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + u); return Buffer.from(await r.arrayBuffer()); }
async function ensureModel() {
  const mj = path.join(MODEL_DIR, 'model.json');
  if (!fs.existsSync(mj)) {
    console.log('  … свалям MobileNetV3-Small от TF Hub и записвам float16 →', MODEL_DIR);
    fs.mkdirSync(MODEL_DIR, { recursive: true });
    const model = JSON.parse((await fetchBuf(HUB + 'model.json?tfjs-format=file')).toString('utf8'));
    const groups = model.weightsManifest; const out = []; const specs = [];
    for (const g of groups) {
      const bufs = []; for (const p of g.paths) bufs.push(await fetchBuf(HUB + p + '?tfjs-format=file'));
      const data = Buffer.concat(bufs); let off = 0;
      for (const w of g.weights) {
        const n = w.shape.reduce((a, b) => a * b, 1);
        if (w.dtype === 'float32' && !w.quantization) {
          const src = new Float32Array(data.buffer.slice(data.byteOffset + off, data.byteOffset + off + n * 4)); const dst = new Uint16Array(n);
          for (let i = 0; i < n; i++) dst[i] = f16(src[i]);
          out.push(Buffer.from(dst.buffer)); specs.push(Object.assign({}, w, { quantization: { dtype: 'float16' } })); off += n * 4;
        } else { const bytes = n * (w.dtype === 'int32' ? 4 : w.dtype === 'bool' ? 1 : 4); out.push(data.subarray(off, off + bytes)); specs.push(w); off += bytes; }
      }
    }
    const bin = Buffer.concat(out);
    fs.writeFileSync(path.join(MODEL_DIR, 'group1-shard1of1.bin'), bin);
    model.weightsManifest = [{ paths: ['group1-shard1of1.bin'], weights: specs }];
    model.pupikes = { source: HUB, quantized: 'float16', input: '224x224x3 [0,1]', output: '1024 feature vector', license: 'Apache-2.0 (TF Hub, Google)' };
    fs.writeFileSync(mj, JSON.stringify(model));
    console.log('  ✓ модел: ' + (bin.length / 1048576).toFixed(2) + ' MB тегла + model.json ' + (fs.statSync(mj).size / 1024 | 0) + ' KB');
  }
  // огледало rustore
  const m2 = path.join(TREES[1], 'public', 'models', 'mnv3s');
  if (fs.existsSync(TREES[1])) { fs.mkdirSync(m2, { recursive: true }); for (const f of fs.readdirSync(MODEL_DIR)) fs.copyFileSync(path.join(MODEL_DIR, f), path.join(m2, f)); }
}

// Списък на снимките за библиотеката: [{key, file, label, group}] group: corpus | cond2 | test
export function librarySources(opts) {
  opts = opts || {}; const items = [];
  if (!opts.noCorpus && fs.existsSync(path.join(REF, 'images-index.json'))) {
    const idx = JSON.parse(fs.readFileSync(path.join(REF, 'images-index.json'), 'utf8')).items; const per = new Map();
    for (const it of idx) {
      if (NOISE.test(it.article)) continue; const lab = cleanLabel(it.article); if ((per.get(lab) || 0) >= CAP) continue;
      const p = path.join(REF, it.file); if (!fs.existsSync(p)) continue;
      per.set(lab, (per.get(lab) || 0) + 1); items.push({ key: 'ref/' + it.file, file: p, label: lab, group: 'corpus' });
    }
  }
  const c2 = path.join(TS, 'cond2', 'index.json');
  if (fs.existsSync(c2)) for (const it of JSON.parse(fs.readFileSync(c2, 'utf8'))) { if (it.suspect && !opts.allCond2) continue; const p = path.join(TS, 'cond2', it.file); if (fs.existsSync(p)) items.push({ key: 'cond2/' + it.file, file: p, label: it.label, group: 'cond2' }); }
  if (!opts.noTest) { const c1 = path.join(TS, 'cond', 'index.json'); if (fs.existsSync(c1)) for (const it of JSON.parse(fs.readFileSync(c1, 'utf8'))) { const p = path.join(TS, 'cond', it.file); if (fs.existsSync(p)) items.push({ key: 'cond/' + it.file, file: p, label: it.label, group: 'test' }); } }
  return items;
}
// Вграждане на списък (с кеш) → масив от Float32Array (или null при грешка).
export async function embedAll(model, cache, items, tag) {
  const out = new Array(items.length); let t0 = Date.now(), done = 0, fresh = 0;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    try { const had = cache.has(it.key); out[i] = await embedCached(cache, model, it.key, it.file, 1, 0); if (!had) fresh++; } catch (e) { out[i] = null; }
    if (++done % 500 === 0) { cache.flush(); console.log(`  ${tag || 'вграждане'} ${done}/${items.length} (нови ${fresh}) ${((Date.now() - t0) / 1000) | 0}s`); }
  }
  cache.flush(); return out;
}

const IS_MAIN = /gen-doctor-embeddings\.mjs$/.test(String(process.argv[1] || '').replace(/\\/g, '/'));
IS_MAIN && (async () => {
  await ensureModel();
  if (process.argv.includes('--model-only')) return;
  const model = await loadModel(MODEL_DIR); const cache = openCache();
  const items = librarySources({ noTest: process.argv.includes('--no-test'), noCorpus: process.argv.includes('--no-corpus') });
  console.log('снимки за библиотеката:', items.length, '(кеш:', cache.size(), ')');
  const vecs = await embedAll(model, cache, items, 'библиотека');
  if (process.argv.includes('--cache-only')) return;
  const ok = []; for (let i = 0; i < items.length; i++) if (vecs[i]) ok.push(i);
  console.log('PCA 1024 →', DIMS, 'върху', ok.length, 'вектора…'); let t0 = Date.now();
  const P = pcaFit(ok.map((i) => vecs[i]), DIMS, 60);
  console.log('  ✓ PCA', ((Date.now() - t0) / 1000) | 0, 's, обяснена дисперсия', (P.explained * 100).toFixed(1) + '%');
  // проекция + int8 (мащаб от 99.9-ия перцентил на |z|)
  const Z = ok.map((i) => pcaProject(P, vecs[i])); const abs = []; for (const z of Z) for (const v of z) abs.push(Math.abs(v)); abs.sort((a, b) => a - b);
  const scale = 127 / (abs[Math.floor(abs.length * 0.999)] || 1);
  const labels = [], lid = new Map(); const first = [], rest = [];
  ok.forEach((i, r) => { const it = items[i]; if (!lid.has(it.label)) { lid.set(it.label, labels.length); labels.push(it.label); } const rec = { l: lid.get(it.label), z: Z[r] }; (it.group !== 'corpus' || condRelevant(it.label) ? first : rest).push(rec); });
  const PARTS = 3, per = Math.max(1, Math.ceil(rest.length / PARTS)); const groups = [first]; for (let i = 0; i < rest.length; i += per) groups.push(rest.slice(i, i + per));
  for (const tree of TREES) {
    if (!fs.existsSync(tree)) continue;
    const outDir = path.join(tree, 'public', 'reference', 'emb'); fs.rmSync(outDir, { recursive: true, force: true }); fs.mkdirSync(outDir, { recursive: true });
    const parts = [];
    groups.forEach((g, gi) => {
      const n = g.length, buf = Buffer.alloc(n * 2 + n * DIMS);
      for (let i = 0; i < n; i++) { buf.writeUInt16LE(g[i].l & 0xffff, i * 2); for (let k = 0; k < DIMS; k++) buf.writeInt8(Math.max(-127, Math.min(127, Math.round(g[i].z[k] * scale))), n * 2 + i * DIMS + k); }
      const file = 'part-' + gi + '.bin'; fs.writeFileSync(path.join(outDir, file), buf); parts.push({ file, n, firstAid: gi === 0, bytes: buf.length });
    });
    const pca = Buffer.alloc((DIM_RAW + DIMS * DIM_RAW) * 4); Buffer.from(P.mean.buffer).copy(pca, 0); Buffer.from(P.W.buffer).copy(pca, DIM_RAW * 4);
    fs.writeFileSync(path.join(outDir, 'pca.bin'), pca);
    fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify({ model: 'mnv3s', raw: DIM_RAW, dim: DIMS, n: ok.length, scale, labels, parts, built: new Date().toISOString().slice(0, 10), groups: { corpus: items.filter((x, i) => vecs[i] && x.group === 'corpus').length, cond2: items.filter((x, i) => vecs[i] && x.group === 'cond2').length, test: items.filter((x, i) => vecs[i] && x.group === 'test').length } }));
    console.log('  ✓ ' + path.relative(ROOT, outDir) + ': ' + ok.length + ' вграждания × ' + DIMS + ' int8 → ' + parts.length + ' части (част 0 = ' + first.length + '), pca.bin ' + (pca.length / 1024 | 0) + ' KB');
  }
})().catch((e) => { console.error('ГРЕШКА:', e && e.stack || e); process.exit(1); });
