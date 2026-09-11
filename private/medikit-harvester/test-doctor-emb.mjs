// test-doctor-emb.mjs — СТЕНД за невронните вграждания на Pupikes Doctor (11.09.2026). Вика се от
// test-doctor.mjs --emb (или --clean-cond2). Същият път като в апа (src/doc/embed.js): MobileNetV3-Small →
// PCA 128 → int8 библиотека → косинус, макс. по 4 завъртания на заявката → претеглено гласуване (K=24).
//
// Оценки:
//   • HOLDOUT „нови снимки": библиотека = корпус (images-index) + cond2; заявки = testsets/cond (96 снимки, НЕ са в
//     библиотеката; дедупликацията на cond2 ги изключва и по хеш) — на 0°, 15.56°, 95.3°, 200°, 37°+огледало.
//   • LOO върху cond2: всяка снимка срещу библиотеката без себе си (до 400 на случаен принцип, seed 7).
//   • --clean-cond2: груба проверка на етикетите — снимка, чиято близост до центроида на своя клас е под
//     (средно − 1.25·σ) на класа ИЛИ друг центроид е по-близък с ≥ 0.06 → suspect:true в cond2/index.json.
//   node private/medikit-harvester/test-doctor.mjs --emb [--k=24] [--no-rot] [--loo=400] [--with-test] [--no-corpus] [--all-cond2]
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { loadModel, openCache, embedCached, embedRaw, pixels, pcaFit, pcaProject, knnVotes } from './embed-node.mjs';
import { librarySources, embedAll } from '../../deploy-scripts/gen-doctor-embeddings.mjs';

const ROOT = path.resolve(process.cwd());
const MODEL_DIR = path.join(ROOT, 'huawei', 'pupikes-doctor', 'public', 'models', 'mnv3s');
const TS = path.join(ROOT, 'private', 'medikit-harvester', 'testsets');
const ALIAS = { chickenpox: 'rash', acne: 'boil', 'cold sore': 'blister' };
const arg = (k, d) => { const m = process.argv.find((a) => a.startsWith('--' + k + '=')); return m ? m.split('=')[1] : d; };
const K = parseInt(arg('k', '24'), 10), DIMS = parseInt(arg('dims', '128'), 10), LOO_N = parseInt(arg('loo', '400'), 10);
const NO_ROT = process.argv.includes('--no-rot');

// Същото като condFromLabel в апа (analyze.js 1.0023).
export function condFromLabel(lab) {
  const s = String(lab || '').toLowerCase();
  if (/sunburn/.test(s)) return 'sunburn'; if (/burn|scald/.test(s)) return 'burn';
  if (/bruis|contusion|h(a)?ematoma|ecchymos/.test(s)) return 'bruise'; if (/abrasion|graze/.test(s)) return 'abrasion';
  if (/wound|laceration|\bcut\b|incision/.test(s)) return 'cut'; if (/urticaria|hives/.test(s)) return 'hives';
  if (/psorias/.test(s)) return 'psoriasis'; if (/dermatitis|eczema/.test(s)) return 'eczema';
  if (/tinea|dermatophyt|fungal|candid|mycos/.test(s)) return 'fungal'; if (/furuncle|boil|abscess|carbuncle/.test(s)) return 'boil';
  if (/cellulitis|impetigo|infect|pyoderma/.test(s)) return 'infection'; if (/blister|bulla|vesic/.test(s)) return 'blister';
  if (/frostbite|chilblain|pernio/.test(s)) return 'frostbite'; if (/fracture/.test(s)) return 'fracture';
  if (/sprain/.test(s)) return 'sprain'; if (/dislocation/.test(s)) return 'dislocation';
  if (/bite|sting/.test(s)) return 'bite'; if (/edema|oedema|swelling/.test(s)) return 'swelling';
  if (/ingrown/.test(s)) return 'ingrown_nail'; if (/chickenpox|varicella|rash|exanthem|erythema/.test(s)) return 'rash';
  if (/muscle.?strain|\bstrain\b/.test(s)) return 'muscle_strain'; if (/nosebleed|epistaxis/.test(s)) return 'nosebleed';
  if (/acne/.test(s)) return 'boil'; if (/cold sore|herpes labialis/.test(s)) return 'blister';
  return '';
}
// Реалистично завъртане на входа (както в стария стенд): кадърът остава пълен, без бели полета.
async function rotSame(file, deg, flip) {
  const base = await sharp(file, { failOn: 'none' }).rotate().resize(640, 640, { fit: 'inside' }).toBuffer(); const m0 = await sharp(base).metadata();
  const r = await sharp(base).rotate(deg, { background: '#ffffff' }).toBuffer(); const m1 = await sharp(r).metadata();
  let t = sharp(r).extract({ left: Math.max(0, Math.floor((m1.width - m0.width) / 2)), top: Math.max(0, Math.floor((m1.height - m0.height) / 2)), width: Math.min(m0.width, m1.width), height: Math.min(m0.height, m1.height) });
  if (flip) t = t.flop(); return await t.toBuffer();
}
// Вектори на заявката: 4 завъртания (0/90/180/270) → проектирани. Кешират се по ключ (файл + трансформация).
async function queryVecs(model, cache, P, key, input) {
  const rots = NO_ROT ? [0] : [0, 90, 180, 270]; const out = [];
  for (const r of rots) { const v = await embedCached(cache, model, key + '@' + r, input, 1, r); out.push(pcaProject(P, v)); }
  return out;
}
function buildLib(P, vecs, labelsOf) {
  const Z = vecs.map((v) => pcaProject(P, v)); const abs = []; for (const z of Z) for (const v of z) abs.push(Math.abs(v)); abs.sort((a, b) => a - b);
  const scale = 127 / (abs[Math.floor(abs.length * 0.999)] || 1); const dim = P.k, n = Z.length;
  const flat = new Int8Array(n * dim); for (let i = 0; i < n; i++) for (let k = 0; k < dim; k++) flat[i * dim + k] = Math.max(-127, Math.min(127, Math.round(Z[i][k] * scale)));
  const labels = [], lid = new Map(); const labs = new Int32Array(n);
  for (let i = 0; i < n; i++) { const l = labelsOf[i]; if (!lid.has(l)) { lid.set(l, labels.length); labels.push(l); } labs[i] = lid.get(l); }
  return { n, dim, flat, labs, labels, scale };
}
// kNN с макс. по завъртанията и пропускане на индекси (LOO).
function votes(lib, qs, skip) {
  const { n, dim, flat, labs, labels, scale } = lib;
  const bestS = new Float64Array(K).fill(-2), bestI = new Int32Array(K).fill(-1);
  for (let i = 0; i < n; i++) {
    if (skip !== undefined && i === skip) continue; const off = i * dim; let s = -2;
    for (const q of qs) { let d = 0; for (let k = 0; k < dim; k++) d += q[k] * flat[off + k]; if (d > s) s = d; } s /= scale;
    if (s > bestS[K - 1]) { let j = K - 1; while (j > 0 && bestS[j - 1] < s) { bestS[j] = bestS[j - 1]; bestI[j] = bestI[j - 1]; j--; } bestS[j] = s; bestI[j] = i; }
  }
  const v = new Map(); let tot = 0;
  for (let t = 0; t < K; t++) { const i = bestI[t]; if (i < 0) continue; const cid = condFromLabel(labels[labs[i]]); if (!cid) continue; const w = Math.pow(Math.max(0, bestS[t]), 3); v.set(cid, (v.get(cid) || 0) + w); tot += w; }
  return { probs: [...v.entries()].sort((a, b) => b[1] - a[1]).map(([id, w]) => ({ id, p: tot ? w / tot : 0 })), best: bestS[0] };
}
function report(tag, rows) {
  const n = rows.length, t1 = rows.filter((r) => r.ok1).length, t3 = rows.filter((r) => r.ok3).length;
  const pTop = rows.reduce((s, r) => s + r.p0, 0) / Math.max(1, n);
  console.log(`[${tag}] n=${n} top-1 ${(100 * t1 / Math.max(1, n)).toFixed(1)}%  top-3 ${(100 * t3 / Math.max(1, n)).toFixed(1)}%  (ср. вероятност на водещото ${(pTop * 100).toFixed(0)}%)`);
  return { n, top1: t1, top3: t3 };
}

export async function runEmbBench() {
  const model = await loadModel(MODEL_DIR); const cache = openCache();
  const withTest = process.argv.includes('--with-test');
  const items = librarySources({ noTest: !withTest, noCorpus: process.argv.includes('--no-corpus'), allCond2: process.argv.includes('--all-cond2') });
  console.log(`библиотека: ${items.length} снимки (корпус ${items.filter((x) => x.group === 'corpus').length}, cond2 ${items.filter((x) => x.group === 'cond2').length}${withTest ? ', + тестовите' : ''}); K=${K}, PCA ${DIMS}, завъртания ${NO_ROT ? 'не' : '4'}`);
  const vecs = await embedAll(model, cache, items, 'библиотека');
  const ok = []; for (let i = 0; i < items.length; i++) if (vecs[i]) ok.push(i);
  let t0 = Date.now(); const P = pcaFit(ok.map((i) => vecs[i]), DIMS, 60); console.log(`PCA: ${((Date.now() - t0) / 1000) | 0}s, обяснена дисперсия ${(P.explained * 100).toFixed(1)}%`);
  const lib = buildLib(P, ok.map((i) => vecs[i]), ok.map((i) => items[i].label));
  const libItems = ok.map((i) => items[i]);

  // ── HOLDOUT: testsets/cond (нови, невидени снимки) ──
  const cidx = JSON.parse(fs.readFileSync(path.join(TS, 'cond', 'index.json'), 'utf8'));
  const tests = [['0°', null], ['15.56°', [15.56, false]], ['95.3°', [95.3, false]], ['200°', [200, false]], ['37°+огледало', [37, true]]];
  const out = {};
  for (const [tag, tf] of tests) {
    const rows = [];
    for (const it of cidx) {
      const f = path.join(TS, 'cond', it.file); if (!fs.existsSync(f)) continue; const want = ALIAS[it.label] || it.label;
      let input = f, key = 'cond/' + it.file; if (tf) { input = await rotSame(f, tf[0], tf[1]); key += '#' + tf[0] + (tf[1] ? 'f' : ''); }
      let qs; try { qs = await queryVecs(model, cache, P, key, input); } catch (e) { continue; }
      const r = votes(lib, qs); const ids = r.probs.map((x) => x.id);
      rows.push({ file: it.file, want, ids: ids.slice(0, 3), ok1: ids[0] === want, ok3: ids.slice(0, 3).includes(want), p0: r.probs.length ? r.probs[0].p : 0, best: r.best });
    }
    out[tag] = report('нови снимки ' + tag, rows);
    if (tag === '0°') { const miss = rows.filter((r) => !r.ok3).map((r) => r.file + '→' + r.ids.join(',')); console.log('   пропуски (top-3):', miss.slice(0, 20).join(' | ')); const perClass = {}; for (const r of rows) { perClass[r.want] = perClass[r.want] || [0, 0]; perClass[r.want][1]++; if (r.ok3) perClass[r.want][0]++; } console.log('   по състояние (top-3):', Object.entries(perClass).map(([k, v]) => k + ' ' + v[0] + '/' + v[1]).join(', ')); }
    cache.flush();
  }
  // ── LOO върху cond2 ──
  const c2 = []; libItems.forEach((it, i) => { if (it.group === 'cond2') c2.push(i); });
  if (c2.length) {
    let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const pick = c2.slice().sort(() => rnd() - 0.5).slice(0, LOO_N); const rows = [];
    for (const i of pick) {
      const it = libItems[i]; const want = ALIAS[it.label] || it.label;
      let qs; try { qs = await queryVecs(model, cache, P, it.key, it.file); } catch (e) { continue; }
      const r = votes(lib, qs, i); const ids = r.probs.map((x) => x.id);
      rows.push({ file: it.file, want, ids: ids.slice(0, 3), ok1: ids[0] === want, ok3: ids.slice(0, 3).includes(want), p0: r.probs.length ? r.probs[0].p : 0 });
    }
    out.loo = report('LOO cond2 (библиотеката без самата снимка)', rows); cache.flush();
  }
  fs.writeFileSync(path.join(TS, 'emb-report.json'), JSON.stringify({ date: new Date().toISOString(), K, DIMS, rot: !NO_ROT, lib: lib.n, explained: P.explained, out }, null, 1));
  return out;
}

// ── Проверка на етикетите в cond2 по центроиди ──
export async function cleanCond2() {
  const model = await loadModel(MODEL_DIR); const cache = openCache();
  const idxPath = path.join(TS, 'cond2', 'index.json'); const idx = JSON.parse(fs.readFileSync(idxPath, 'utf8'));
  const items = idx.map((it) => ({ key: 'cond2/' + it.file, file: path.join(TS, 'cond2', it.file), label: it.label })).filter((x) => fs.existsSync(x.file));
  const vecs = await embedAll(model, cache, items, 'cond2');
  const byLab = new Map(); items.forEach((it, i) => { if (!vecs[i]) return; if (!byLab.has(it.label)) byLab.set(it.label, []); byLab.get(it.label).push(i); });
  const cent = new Map();
  for (const [lab, ids] of byLab) { const c = new Float64Array(1024); for (const i of ids) for (let k = 0; k < 1024; k++) c[k] += vecs[i][k]; let n = 0; for (let k = 0; k < 1024; k++) n += c[k] * c[k]; n = Math.sqrt(n) || 1; for (let k = 0; k < 1024; k++) c[k] /= n; cent.set(lab, c); }
  const dot = (a, b) => { let s = 0; for (let k = 0; k < 1024; k++) s += a[k] * b[k]; return s; };
  let marked = 0, cleared = 0; const per = {};
  for (const [lab, ids] of byLab) {
    const own = ids.map((i) => dot(vecs[i], cent.get(lab))); const mean = own.reduce((s, v) => s + v, 0) / own.length; const sd = Math.sqrt(own.reduce((s, v) => s + (v - mean) * (v - mean), 0) / own.length);
    ids.forEach((i, j) => {
      let other = -1, otherLab = ''; for (const [l2, c2] of cent) { if (l2 === lab) continue; const d = dot(vecs[i], c2); if (d > other) { other = d; otherLab = l2; } }
      const suspect = own[j] < mean - 1.25 * sd || other - own[j] >= 0.06;
      const rec = idx.find((x) => x.file === items[i].file.split(/[\\/]/).pop());
      if (rec) { if (suspect) { rec.suspect = true; rec.suspectWhy = (own[j] < mean - 1.25 * sd ? 'далеч от центроида' : 'по-близо до ' + otherLab); marked++; } else if (rec.suspect) { delete rec.suspect; delete rec.suspectWhy; cleared++; } }
      per[lab] = per[lab] || [0, 0]; per[lab][1]++; if (suspect) per[lab][0]++;
    });
  }
  fs.writeFileSync(idxPath, JSON.stringify(idx, null, 1));
  console.log(`cond2: ${items.length} снимки; съмнителни (изключени от библиотеката): ${marked}; върнати: ${cleared}`);
  console.log('   по състояние (съмнителни/всички):', Object.entries(per).map(([k, v]) => k + ' ' + v[0] + '/' + v[1]).join(', '));
}
