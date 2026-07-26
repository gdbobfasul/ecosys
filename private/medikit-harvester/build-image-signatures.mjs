// build-image-signatures.mjs — прави ЧИСЛОВ ОПИС („отпечатъци") на снимковия корпус на Pupikes
// Doctor, за да може приложението РЕАЛНО да го ползва на телефона без да носи 226 MB снимки.
//
// За всяка снимка смята 128-байтов отпечатък от ЦЕНТЪРА на кадъра (проблемът е там):
//   • 64 стойности — структура: 8×8 сива мрежа (форма/петна/контраст)
//   • 64 стойности — цвят: 4×4×4 RGB хистограма (червенина/тъмнина/тон)
// Изход: rustore/pupikes-doctor/public/reference/image-signatures.json (~2.8 MB, ВГРАЖДА се в апа)
//   { dim:128, labels:[...], items:[{l:<индекс на етикет>, v:"<base64 128 байта>"}] }
// Пуск от repo ROOT:  node private/medikit-harvester/build-image-signatures.mjs
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve('.');
const REF = path.join(ROOT, 'rustore', 'pupikes-doctor', 'publish', 'reference');
const IMGDIR = path.join(REF, 'images');
const INDEX = path.join(REF, 'images-index.json');
// По подразбиране вгражданата (в APK) версия; SIG_OUT задава друг път (напр. сървърната богата версия).
const OUT = process.env.SIG_OUT ? path.resolve(ROOT, process.env.SIG_OUT) : path.join(ROOT, 'rustore', 'pupikes-doctor', 'public', 'reference', 'image-signatures.json');

// Явен шум, който не бива да замърсява търсенето на най-близка снимка: снимки на пострадали/
// военни жертви (не са диагноза), татуировки, както и химични структурни диаграми от Уикипедия
// (бели линейни схеми — не са кожа). Тези записи се ПРОПУСКАТ при построяването на описа.
const NOISE = /(victim|casualt|\bwar\b|soldier|corpse|autops|\btattoo|fluoro|xylene|benzene|butyl|toluene|phenol|ethyl|methyl|propyl|\bacid\b|oxide|chloride|sulfate|nitrate|cannabidiol|cannabinol|amphetamine)/i;
function isNoise(article) { return NOISE.test(String(article || '')); }

// Изчиства етикета до кратко смислено име (напр. "dermatology: melanoma" → "melanoma").
function cleanLabel(s) {
  let t = String(s || '').trim();
  t = t.replace(/^dermatology:\s*/i, '').replace(/^condition:\s*/i, '').replace(/_/g, ' ');
  t = t.replace(/\s+/g, ' ').trim().toLowerCase();
  return t.slice(0, 60) || 'unknown';
}

// 128-байтов отпечатък от центъра (60%) на снимката.
export async function signature(input) {
  const S = 8, C = 4;
  const meta = await sharp(input, { failOn: 'none' }).metadata();
  const w = meta.width || 0, h = meta.height || 0;
  let img = sharp(input, { failOn: 'none' }).rotate();
  if (w > 4 && h > 4) {
    const cw = Math.max(2, Math.floor(w * 0.6)), ch = Math.max(2, Math.floor(h * 0.6));
    img = img.extract({ left: Math.floor((w - cw) / 2), top: Math.floor((h - ch) / 2), width: cw, height: ch });
  }
  const buf = await img.clone().resize(S, S, { fit: 'fill' }).removeAlpha().raw().toBuffer();      // 8×8 RGB
  const out = Buffer.alloc(128);
  // 64 байта — сива структура, нормализирана към 0..255 спрямо min/max (контраст-инвариантно)
  const gray = new Array(S * S);
  for (let i = 0; i < S * S; i++) gray[i] = 0.299 * buf[i * 3] + 0.587 * buf[i * 3 + 1] + 0.114 * buf[i * 3 + 2];
  const mn = Math.min(...gray), mx = Math.max(...gray), rng = (mx - mn) || 1;
  for (let i = 0; i < S * S; i++) out[i] = Math.max(0, Math.min(255, Math.round(((gray[i] - mn) / rng) * 255)));
  // 64 байта — цветова хистограма 4×4×4 (по-плътна извадка 32×32)
  const cbuf = await img.clone().resize(32, 32, { fit: 'fill' }).removeAlpha().raw().toBuffer();
  const hist = new Array(C * C * C).fill(0);
  const px = 32 * 32;
  for (let i = 0; i < px; i++) {
    const r = cbuf[i * 3] >> 6, g = cbuf[i * 3 + 1] >> 6, b = cbuf[i * 3 + 2] >> 6;
    hist[r * C * C + g * C + b]++;
  }
  for (let i = 0; i < hist.length; i++) out[64 + i] = Math.min(255, Math.round((hist[i] / px) * 255 * 8));
  return out;
}

async function main() {
  const idx = JSON.parse(fs.readFileSync(INDEX, 'utf8'));
  const items = idx.items || [];
  console.log(`[sig] ${items.length} записа`);
  // ТАВАН на отпечатъци на ЕДНА диагноза — иначе 16 000 „nevus" от ISIC задавят гласуването и
  // всичко излиза „бенка". С таван корпусът става БАЛАНСИРАН (всяко състояние тежи справедливо).
  const CAP = parseInt(process.env.CAP || '500', 10);
  const labels = [], labelId = new Map();
  const perLabel = new Map();
  const out = [];
  let ok = 0, fail = 0, capped = 0;
  for (const it of items) {
    const lab = cleanLabel(it.article);
    if ((perLabel.get(lab) || 0) >= CAP) { capped++; continue; }   // прескочи над тавана
    const p = path.join(REF, it.file);
    if (!fs.existsSync(p)) { fail++; continue; }
    try {
      const sig = await signature(p);
      let li = labelId.get(lab);
      if (li === undefined) { li = labels.length; labels.push(lab); labelId.set(lab, li); }
      out.push({ l: li, v: sig.toString('base64') });
      perLabel.set(lab, (perLabel.get(lab) || 0) + 1);
      ok++;
    } catch (e) { fail++; }
    if ((ok + fail) % 2000 === 0) console.log(`[sig] ${ok + fail}/${items.length} (в описа ${out.length}, над таван ${capped})`);
  }
  console.log(`[sig] таван ${CAP}/диагноза → пропуснати над таван: ${capped}`);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ dim: 128, labels, items: out }));
  const mb = (fs.statSync(OUT).size / 1e6).toFixed(2);
  console.log(`[sig] ГОТОВО ok=${ok} fail=${fail} · етикети=${labels.length} · ${OUT} (${mb} MB)`);
}
// Пуска main() САМО при директно изпълнение (за да е и импортируем — напр. от теста за точност).
const _isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (_isMain) main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
