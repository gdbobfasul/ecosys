// sig-v2-experiment.mjs — ЕКСПЕРИМЕНТ: по-богат отпечатък (v2, 256 B) срещу сегашния (v1, 128 B) за Pupikes Doctor.
// v2 = v1 (сива структура 8×8 + RGB хистограма 4×4×4) + хистограма на оттенъка 16×2 (нюанс × наситеност, център)
//      + хистограма на ориентацията на градиента 16×2 (център/периферия) + локален контраст 8×8 (текстура).
// Строи v2 корпус от images-index (същият подбор: NOISE + CAP=500) + тестовите снимки (×4 завъртания), после
// LEAVE-ONE-OUT по тестовите снимки (0°, 15.56°, 95.3°) за v1 и v2. Ако v2 е по-добър → пренасяме го в апа.
//   node private/medikit-harvester/sig-v2-experiment.mjs [--build]   (--build изчислява корпуса v2 ~10 мин; иначе чете кеша)
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(process.cwd());
const REF = path.join(ROOT, 'rustore', 'pupikes-doctor', 'publish', 'reference');
const INDEX = path.join(REF, 'images-index.json');
const TEST = path.join(ROOT, 'private', 'medikit-harvester', 'testsets', 'cond');
const CACHE = path.join(ROOT, 'private', 'medikit-harvester', 'testsets', 'corpus-v2.json');
const CAP = 500, K = 24;
const NOISE = /(victim|casualt|\bwar\b|soldier|corpse|autops|\btattoo|fluoro|xylene|benzene|butyl|toluene|phenol|ethyl|methyl|propyl|\bacid\b|oxide|chloride|sulfate|nitrate|cannabidiol|cannabinol|amphetamine)/i;
const cleanLabel = (s) => String(s || '').trim().replace(/^dermatology:\s*/i, '').replace(/^condition:\s*/i, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 60) || 'unknown';
const ALIAS = { chickenpox: 'rash', acne: 'boil', 'cold sore': 'blister' };
function condFromLabel(lab) {
  const s = String(lab || '').toLowerCase();
  if (/sunburn/.test(s)) return 'sunburn'; if (/burn|scald/.test(s)) return 'burn'; if (/bruis|contusion|h(a)?ematoma|ecchymos/.test(s)) return 'bruise'; if (/abrasion|graze/.test(s)) return 'abrasion';
  if (/wound|laceration|\bcut\b|incision/.test(s)) return 'cut'; if (/urticaria|hives/.test(s)) return 'hives'; if (/psorias/.test(s)) return 'psoriasis'; if (/dermatitis|eczema/.test(s)) return 'eczema';
  if (/tinea|dermatophyt|fungal|candid|mycos/.test(s)) return 'fungal'; if (/furuncle|boil|abscess|carbuncle/.test(s)) return 'boil'; if (/cellulitis|impetigo|infect|pyoderma/.test(s)) return 'infection'; if (/blister|bulla|vesic/.test(s)) return 'blister';
  if (/frostbite|chilblain|pernio/.test(s)) return 'frostbite'; if (/fracture/.test(s)) return 'fracture'; if (/sprain/.test(s)) return 'sprain'; if (/dislocation/.test(s)) return 'dislocation';
  if (/bite|sting/.test(s)) return 'bite'; if (/edema|oedema|swelling/.test(s)) return 'swelling'; if (/ingrown/.test(s)) return 'ingrown_nail'; if (/rash|exanthem|erythema/.test(s)) return 'rash';
  if (/muscle strain|strain/.test(s)) return 'muscle_strain'; if (/nosebleed|epistaxis/.test(s)) return 'nosebleed'; return '';
}
// v2 отпечатък (256 B). Първите 128 = v1 (идентични), после 128 нови.
export async function sigV2(input) {
  const base = sharp(input, { failOn: 'none' }).rotate();
  const meta = await base.metadata(); const w = meta.width || 0, h = meta.height || 0;
  let img = base;
  if (w > 4 && h > 4) { const cw = Math.max(2, Math.floor(w * 0.6)), ch = Math.max(2, Math.floor(h * 0.6)); img = img.extract({ left: Math.floor((w - cw) / 2), top: Math.floor((h - ch) / 2), width: cw, height: ch }); }
  const out = new Uint8Array(256);
  const b8 = await img.clone().resize(8, 8, { fit: 'fill' }).removeAlpha().raw().toBuffer();
  const gray8 = new Array(64); for (let i = 0; i < 64; i++) gray8[i] = 0.299 * b8[i * 3] + 0.587 * b8[i * 3 + 1] + 0.114 * b8[i * 3 + 2];
  const mn = Math.min(...gray8), mx = Math.max(...gray8), rng = (mx - mn) || 1;
  for (let i = 0; i < 64; i++) out[i] = Math.max(0, Math.min(255, Math.round(((gray8[i] - mn) / rng) * 255)));
  const c32 = await img.clone().resize(32, 32, { fit: 'fill' }).removeAlpha().raw().toBuffer(); const px = 1024;
  const hist = new Array(64).fill(0), hue = new Array(32).fill(0);
  const g32 = new Float32Array(px);
  for (let i = 0; i < px; i++) {
    const r = c32[i * 3], g = c32[i * 3 + 1], b = c32[i * 3 + 2];
    hist[(r >> 6) * 16 + (g >> 6) * 4 + (b >> 6)]++;
    g32[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    const M = Math.max(r, g, b), m = Math.min(r, g, b), d = M - m; const sat = M ? d / M : 0;
    if (d > 8) { let hh = 0; if (M === r) hh = ((g - b) / d) % 6; else if (M === g) hh = (b - r) / d + 2; else hh = (r - g) / d + 4; hh = (hh < 0 ? hh + 6 : hh) / 6; hue[Math.min(15, Math.floor(hh * 16)) * 2 + (sat > 0.35 ? 1 : 0)]++; }
  }
  for (let i = 0; i < 64; i++) out[64 + i] = Math.min(255, Math.round((hist[i] / px) * 255 * 8));
  for (let i = 0; i < 32; i++) out[128 + i] = Math.min(255, Math.round((hue[i] / px) * 255 * 6));
  // градиентна ориентация: 16 посоки × {център 16×16, периферия}
  const ori = new Array(32).fill(0);
  for (let y = 1; y < 31; y++) for (let x = 1; x < 31; x++) {
    const gx = g32[y * 32 + x + 1] - g32[y * 32 + x - 1], gy = g32[(y + 1) * 32 + x] - g32[(y - 1) * 32 + x];
    const mag = Math.hypot(gx, gy); if (mag < 6) continue;
    const ang = (Math.atan2(gy, gx) + Math.PI) / (2 * Math.PI); const bin = Math.min(15, Math.floor(ang * 16));
    const center = (x >= 8 && x < 24 && y >= 8 && y < 24) ? 0 : 1; ori[bin * 2 + center] += mag;
  }
  const oriSum = ori.reduce((s, v) => s + v, 0) || 1;
  for (let i = 0; i < 32; i++) out[160 + i] = Math.min(255, Math.round((ori[i] / oriSum) * 255 * 4));
  // локален контраст 8×8 (std на всеки блок 4×4 от 32×32 сивото)
  for (let by = 0; by < 8; by++) for (let bx = 0; bx < 8; bx++) {
    let s = 0, s2 = 0; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const v = g32[(by * 4 + y) * 32 + bx * 4 + x]; s += v; s2 += v * v; }
    const mean = s / 16, sd = Math.sqrt(Math.max(0, s2 / 16 - mean * mean)); out[192 + by * 8 + bx] = Math.min(255, Math.round(sd * 3));
  }
  return out;
}
async function rotSame(buf, deg, flip) { const m0 = await sharp(buf).metadata(); const r = await sharp(buf).rotate(deg, { background: '#ffffff' }).toBuffer(); const m1 = await sharp(r).metadata(); let t = sharp(r).extract({ left: Math.max(0, Math.floor((m1.width - m0.width) / 2)), top: Math.max(0, Math.floor((m1.height - m0.height) / 2)), width: Math.min(m0.width, m1.width), height: Math.min(m0.height, m1.height) }); if (flip) t = t.flop(); return await t.toBuffer(); }
async function variants(file) { const norm = await sharp(file, { failOn: 'none' }).rotate().resize(512, 512, { fit: 'inside' }).toBuffer(); const out = []; for (let i = 0; i < 24; i++) out.push(await sigV2(await rotSame(norm, i * 15))); for (const [d, f] of [[0, true], [90, true], [45, true], [135, true]]) out.push(await sigV2(await rotSame(norm, d, f))); return out; }

function knn(flat, labs, labels, n, dim, qs, skip) {
  const bestD = new Array(K).fill(Infinity), bestI = new Array(K).fill(-1);
  for (let i = 0; i < n; i++) { if (skip && skip.has(i)) continue; let d = Infinity; const off = i * 256; for (const qv of qs) { let dv = 0; for (let k = 0; k < dim && dv < d; k++) { const diff = qv[k] - flat[off + k]; dv += diff < 0 ? -diff : diff; } if (dv < d) d = dv; } if (d < bestD[K - 1]) { let j = K - 1; while (j > 0 && bestD[j - 1] > d) { bestD[j] = bestD[j - 1]; bestI[j] = bestI[j - 1]; j--; } bestD[j] = d; bestI[j] = i; } }
  const cc = new Map(); for (let t = 0; t < K; t++) { const i = bestI[t]; if (i < 0) continue; const cid = condFromLabel(labels[labs[i]] || ''); if (cid) cc.set(cid, (cc.get(cid) || 0) + 1); }
  return [...cc.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}
const IS_MAIN = /sig-v2-experiment\.mjs$/.test(String(process.argv[1] || '').replace(/\\/g, '/'));
IS_MAIN && (async () => {
  let corpus;
  if (process.argv.includes('--build') || !fs.existsSync(CACHE)) {
    const idx = JSON.parse(fs.readFileSync(INDEX, 'utf8')).items; const per = new Map(); const labels = [], lid = new Map(); const items = [];
    let t0 = Date.now(), done = 0;
    for (const it of idx) {
      if (NOISE.test(it.article)) continue; const lab = cleanLabel(it.article); if ((per.get(lab) || 0) >= CAP) continue;
      const p = path.join(REF, it.file); if (!fs.existsSync(p)) continue;
      let sig; try { sig = await sigV2(p); } catch (e) { continue; }
      if (!lid.has(lab)) { lid.set(lab, labels.length); labels.push(lab); }
      items.push({ l: lid.get(lab), v: Buffer.from(sig).toString('base64') }); per.set(lab, (per.get(lab) || 0) + 1);
      if (++done % 2000 === 0) console.log('  v2 корпус', done, ((Date.now() - t0) / 1000 | 0) + 's');
    }
    corpus = { dim: 256, labels, items }; fs.writeFileSync(CACHE, JSON.stringify(corpus)); console.log('v2 корпус:', items.length, 'отпечатъка,', labels.length, 'етикета');
  } else corpus = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
  // + тестовите снимки ×4 завъртания (етикетирани), както в корпуса на апа
  const tidx = JSON.parse(fs.readFileSync(path.join(TEST, 'index.json'), 'utf8'));
  const own = new Map(); const lid = new Map(corpus.labels.map((l, i) => [l, i]));
  for (const it of tidx) { const f = path.join(TEST, it.file); if (!fs.existsSync(f)) continue; const lab = ALIAS[it.label] || it.label; if (!lid.has(lab)) { lid.set(lab, corpus.labels.length); corpus.labels.push(lab); } const ids = []; for (const deg of [0, 90, 180, 270]) { const sig = await sigV2(await sharp(f, { failOn: 'none' }).rotate().rotate(deg).toBuffer()); ids.push(corpus.items.length); corpus.items.push({ l: lid.get(lab), v: Buffer.from(sig).toString('base64') }); } own.set(it.file, ids); }
  const n = corpus.items.length, flat = new Uint8Array(n * 256), labs = new Int32Array(n);
  for (let i = 0; i < n; i++) { flat.set(Buffer.from(corpus.items[i].v, 'base64').subarray(0, 256), i * 256); labs[i] = corpus.items[i].l; }
  console.log('общо в корпуса:', n);
  const rotIn = (deg) => async (file) => rotSame(await sharp(file, { failOn: 'none' }).rotate().resize(640, 640, { fit: 'inside' }).toBuffer(), deg);
  for (const [tag, tf] of [['0°', null], ['15.56°', rotIn(15.56)], ['95.3°', rotIn(95.3)]]) {
    const res = { v1: [0, 0], v2: [0, 0] }; let cnt = 0;
    for (const it of tidx) { const f = path.join(TEST, it.file); if (!fs.existsSync(f)) continue; const want = ALIAS[it.label] || it.label; const qs = await variants(tf ? await tf(f) : f); const skip = new Set(own.get(it.file) || []); cnt++;
      for (const [name, dim] of [['v1', 128], ['v2', 256]]) { const ids = knn(flat, labs, corpus.labels, n, dim, qs, skip); if (ids[0] === want) res[name][0]++; if (ids.slice(0, 3).includes(want)) res[name][1]++; } }
    for (const name of ['v1', 'v2']) console.log(`[LOO ${tag} ${name}] n=${cnt} top-1 ${(100 * res[name][0] / cnt).toFixed(1)}%  top-3 ${(100 * res[name][1] / cnt).toFixed(1)}%`);
  }
})();
