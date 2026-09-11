// test-doctor.mjs — ТЕСТОВ СТЕНД за разпознаването на снимки в Pupikes Doctor (09.09.2026; --emb от 11.09.2026).
// Същият алгоритъм като в апа (signature 128 B + kNN K=24 с min-разстояние по завъртени варианти + condFromLabel),
// но в Node (sharp). Тества testsets/cond (100 снимки), после същите завъртени на произволни ъгли
// (15.56°, 95.3°, 200°, огледало) и печата точност top-1 / top-3 по състояние.
//   node private/medikit-harvester/test-doctor.mjs            → само тест
//   node private/medikit-harvester/test-doctor.mjs --learn    → добавя тестовите снимки (етикетирани) в корпуса на
//                                                                двете дървета (huawei+rustore) и тества пак
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { sigV2 } from './sig-v2-experiment.mjs';

// ── Режим за НЕВРОННИ ВГРАЖДАНИЯ (1.0023, 11.09.2026): --emb (holdout „нови снимки" + LOO cond2) и
//    --clean-cond2 (проверка на етикетите по центроиди). Кодът е в test-doctor-emb.mjs; тук само превключваме.
//   node private/medikit-harvester/test-doctor.mjs --emb [--k=24] [--no-rot] [--loo=400] [--with-test]
//   node private/medikit-harvester/test-doctor.mjs --clean-cond2
if (process.argv.includes('--emb') || process.argv.includes('--clean-cond2')) {
  const m = await import('./test-doctor-emb.mjs');
  if (process.argv.includes('--clean-cond2')) await m.cleanCond2();
  if (process.argv.includes('--emb')) await m.runEmbBench();
  process.exit(0);
}

const ROOT = path.resolve(process.cwd());
const TEST = path.join(ROOT, 'private', 'medikit-harvester', 'testsets', 'cond');
const SIG_FILES = ['huawei', 'rustore'].map((t) => path.join(ROOT, t, 'pupikes-doctor', 'public', 'reference', 'image-signatures.json'));
const LEARN = process.argv.includes('--learn');
const EVAL_ONLY = process.argv.includes('--eval-only');   // само „след“ (корпусът вече съдържа тестовите снимки)
const K = 24;
// Тестови етикети извън списъка на апа → най-близкото състояние в апа.
const ALIAS = { chickenpox: 'rash', acne: 'boil', 'cold sore': 'blister' };

function condFromLabel(lab) {
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
  if (/ingrown/.test(s)) return 'ingrown_nail'; if (/rash|exanthem|erythema/.test(s)) return 'rash';
  if (/muscle strain|strain/.test(s)) return 'muscle_strain'; if (/nosebleed|epistaxis/.test(s)) return 'nosebleed';
  return '';
}
// Отпечатък (както build-image-signatures.mjs / photoSignature в апа) от буфер/файл.
async function signature(input) { return sigV2(input); }
async function signatureV1(input) {
  const S = 8, C = 4;
  const base = sharp(input, { failOn: 'none' }).rotate();
  const meta = await base.metadata(); const w = meta.width || 0, h = meta.height || 0;
  let img = base;
  if (w > 4 && h > 4) { const cw = Math.max(2, Math.floor(w * 0.6)), ch = Math.max(2, Math.floor(h * 0.6)); img = img.extract({ left: Math.floor((w - cw) / 2), top: Math.floor((h - ch) / 2), width: cw, height: ch }); }
  const buf = await img.clone().resize(S, S, { fit: 'fill' }).removeAlpha().raw().toBuffer();
  const out = new Uint8Array(128);
  const gray = new Array(S * S); for (let i = 0; i < S * S; i++) gray[i] = 0.299 * buf[i * 3] + 0.587 * buf[i * 3 + 1] + 0.114 * buf[i * 3 + 2];
  const mn = Math.min(...gray), mx = Math.max(...gray), rng = (mx - mn) || 1;
  for (let i = 0; i < S * S; i++) out[i] = Math.max(0, Math.min(255, Math.round(((gray[i] - mn) / rng) * 255)));
  const cbuf = await img.clone().resize(32, 32, { fit: 'fill' }).removeAlpha().raw().toBuffer();
  const hist = new Array(64).fill(0), px = 1024;
  for (let i = 0; i < px; i++) { const r = cbuf[i * 3] >> 6, g = cbuf[i * 3 + 1] >> 6, b = cbuf[i * 3 + 2] >> 6; hist[r * 16 + g * 4 + b]++; }
  for (let i = 0; i < 64; i++) out[64 + i] = Math.min(255, Math.round((hist[i] / px) * 255 * 8));
  return out;
}
// Варианти на заявката както в апа: 0..330 на 30° + огледало (върху нормализирана 512px версия за скорост).
async function queryVariants(file) {
  const norm = await sharp(file, { failOn: 'none' }).rotate().resize(512, 512, { fit: 'inside' }).toBuffer();
  const meta = await sharp(norm).metadata(); const W = meta.width, H = meta.height;
  // завъртане със ЗАПАЗЕН размер (централно изрязване на обхващащия правоъгълник) — както в апа
  const rotSame = async (buf, deg, flip) => { let s = sharp(buf).rotate(deg, { background: '#ffffff' }); const m = await s.toBuffer(); const mm = await sharp(m).metadata(); let t = sharp(m).extract({ left: Math.max(0, Math.floor((mm.width - W) / 2)), top: Math.max(0, Math.floor((mm.height - H) / 2)), width: Math.min(W, mm.width), height: Math.min(H, mm.height) }); if (flip) t = t.flop(); return await t.toBuffer(); };
  const out = [];
  for (let i = 0; i < 24; i++) out.push(await signature(await rotSame(norm, i * 15)));
  for (const [d, f] of [[0, true], [90, true], [45, true], [135, true]]) out.push(await signature(await rotSame(norm, d, f)));
  return out;
}
function loadCorpus(p) {
  const j = JSON.parse(fs.readFileSync(p, 'utf8')); const dim = j.dim || 256, n = j.items.length;
  const flat = new Uint8Array(n * dim), labs = new Int32Array(n);
  for (let i = 0; i < n; i++) { const b = Buffer.from(j.items[i].v, 'base64'); flat.set(b.subarray(0, dim), i * dim); labs[i] = j.items[i].l | 0; }
  return { j, dim, n, flat, labs, labels: j.labels };
}
function match(S, qs) {
  const { dim, n, flat } = S; const bestD = new Array(K).fill(Infinity), bestI = new Array(K).fill(-1);
  for (let i = 0; i < n; i++) {
    let d = Infinity; const off = i * dim;
    for (const qv of qs) { let dv = 0; for (let k = 0; k < dim && dv < d; k++) { const diff = qv[k] - flat[off + k]; dv += diff < 0 ? -diff : diff; } if (dv < d) d = dv; }
    if (d < bestD[K - 1]) { let j = K - 1; while (j > 0 && bestD[j - 1] > d) { bestD[j] = bestD[j - 1]; bestI[j] = bestI[j - 1]; j--; } bestD[j] = d; bestI[j] = i; }
  }
  const cc = new Map();
  for (let t = 0; t < K; t++) { const i = bestI[t]; if (i < 0) continue; const cid = condFromLabel(S.labels[S.labs[i]] || ''); if (cid) cc.set(cid, (cc.get(cid) || 0) + 1); }
  return [...cc.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}
async function evaluate(S, idx, transform, name) {
  let top1 = 0, top3 = 0, n = 0; const miss = [];
  for (const it of idx) {
    const file = path.join(TEST, it.file); if (!fs.existsSync(file)) continue;
    const want = ALIAS[it.label] || it.label;
    let input = file; if (transform) input = await transform(file);
    let ids = []; try { ids = match(S, await queryVariants(input)); } catch (e) { continue; }
    n++; if (ids[0] === want) top1++; if (ids.slice(0, 3).includes(want)) top3++; else miss.push(it.file + ' → ' + ids.slice(0, 3).join(','));
  }
  console.log(`[${name}] n=${n} top-1 ${(100 * top1 / Math.max(1, n)).toFixed(1)}%  top-3 ${(100 * top3 / Math.max(1, n)).toFixed(1)}%`);
  if (miss.length) console.log('   пропуски (top-3):', miss.slice(0, 12).join(' | '));
  return { n, top1, top3 };
}
// Реалистично завъртане на входа: обектът е завъртян в кадъра, кадърът е пълен (централно изрязване до изходния размер), без бели полета.
const rot = (deg, flip) => async (file) => { const base = await sharp(file, { failOn: 'none' }).rotate().resize(640, 640, { fit: 'inside' }).toBuffer(); const m0 = await sharp(base).metadata(); const r = await sharp(base).rotate(deg, { background: '#ffffff' }).toBuffer(); const m1 = await sharp(r).metadata(); let t = sharp(r).extract({ left: Math.max(0, Math.floor((m1.width - m0.width) / 2)), top: Math.max(0, Math.floor((m1.height - m0.height) / 2)), width: Math.min(m0.width, m1.width), height: Math.min(m0.height, m1.height) }); if (flip) t = t.flop(); return await t.toBuffer(); };

(async () => {
  const idx = JSON.parse(fs.readFileSync(path.join(TEST, 'index.json'), 'utf8'));
  console.log(`тестови снимки: ${idx.length}`);
  const S = loadCorpus(SIG_FILES[0]);
  console.log(`корпус: ${S.n} отпечатъка, ${S.labels.length} етикета`);
  const runAll = async (tag) => {
    await evaluate(S, idx, null, tag + ' 0°');
    await evaluate(S, idx, rot(15.56), tag + ' 15.56°');
    await evaluate(S, idx, rot(95.3), tag + ' 95.3°');
    await evaluate(S, idx, rot(200), tag + ' 200°');
    await evaluate(S, idx, rot(37, true), tag + ' 37°+огледало');
  };
  if (EVAL_ONLY) { await runAll('след'); return; }
  await runAll('преди');
  if (LEARN) {
    // Учене: етикетираните тестови снимки влизат в корпуса (etикет = името на състоянието; ALIAS за чуждите).
    const j = S.j; const labelId = new Map(j.labels.map((l, i) => [l, i]));
    let added = 0;
    for (const it of idx) {
      const file = path.join(TEST, it.file); if (!fs.existsSync(file)) continue;
      const lab = ALIAS[it.label] || it.label; if (!labelId.has(lab)) { labelId.set(lab, j.labels.length); j.labels.push(lab); }
      // отпечатък + 3 завъртени варианта (снимката в корпуса не се върти при заявка → покриваме и там)
      for (const deg of [0, 90, 180, 270]) { const sig = await signature(await sharp(file, { failOn: 'none' }).rotate().rotate(deg).toBuffer()); j.items.push({ l: labelId.get(lab), v: Buffer.from(sig).toString('base64') }); added++; }
    }
    for (const f of SIG_FILES) { fs.writeFileSync(f, JSON.stringify(j)); console.log('корпус записан:', f, 'items', j.items.length); }
    const S2 = loadCorpus(SIG_FILES[0]);
    console.log(`научени: +${added} отпечатъка → корпус ${S2.n}`);
    // LEAVE-ONE-OUT (честна мярка за „подобни снимки"): всяка тестова снимка се търси в корпуса БЕЗ собствените си
    // 4 отпечатъка, но С другите снимки от същия клас → показва дали се разпознава по подобие, не по копие.
    const ownIdx = new Map(); // file → [индекси]
    { let i = S2.n - added; for (const it of idx) { const file = path.join(TEST, it.file); if (!fs.existsSync(file)) continue; ownIdx.set(it.file, [i, i + 1, i + 2, i + 3]); i += 4; } }
    const matchLOO = (S, qs, skip) => { const { dim, n, flat } = S; const bestD = new Array(K).fill(Infinity), bestI = new Array(K).fill(-1); for (let i = 0; i < n; i++) { if (skip.has(i)) continue; let d = Infinity; const off = i * dim; for (const qv of qs) { let dv = 0; for (let k = 0; k < dim && dv < d; k++) { const diff = qv[k] - flat[off + k]; dv += diff < 0 ? -diff : diff; } if (dv < d) d = dv; } if (d < bestD[K - 1]) { let j = K - 1; while (j > 0 && bestD[j - 1] > d) { bestD[j] = bestD[j - 1]; bestI[j] = bestI[j - 1]; j--; } bestD[j] = d; bestI[j] = i; } } const cc = new Map(); for (let t = 0; t < K; t++) { const i = bestI[t]; if (i < 0) continue; const cid = condFromLabel(S.labels[S.labs[i]] || ''); if (cid) cc.set(cid, (cc.get(cid) || 0) + 1); } return [...cc.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id); };
    for (const [tag, tf] of [['LOO 0°', null], ['LOO 15.56°', rot(15.56)], ['LOO 95.3°', rot(95.3)]]) {
      let n = 0, t1 = 0, t3 = 0;
      for (const it of idx) { const file = path.join(TEST, it.file); if (!fs.existsSync(file)) continue; const want = ALIAS[it.label] || it.label; const skip = new Set(ownIdx.get(it.file) || []); let ids = []; try { ids = matchLOO(S2, await queryVariants(tf ? await tf(file) : file), skip); } catch (e) { continue; } n++; if (ids[0] === want) t1++; if (ids.slice(0, 3).includes(want)) t3++; }
      console.log(`[${tag}] n=${n} top-1 ${(100 * t1 / Math.max(1, n)).toFixed(1)}%  top-3 ${(100 * t3 / Math.max(1, n)).toFixed(1)}%`);
    }
    // Честен тест след учене: снимките са в корпуса → очаквано ~100% на същите; истинската проверка е на ЗАВЪРТЕНИТЕ.
    await evaluate(S2, idx, null, 'след 0°');
    await evaluate(S2, idx, rot(15.56), 'след 15.56°');
    await evaluate(S2, idx, rot(95.3), 'след 95.3°');
    await evaluate(S2, idx, rot(200), 'след 200°');
    await evaluate(S2, idx, rot(37, true), 'след 37°+огледало');
  }
})();
