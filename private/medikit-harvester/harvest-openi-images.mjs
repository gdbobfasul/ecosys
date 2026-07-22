// harvest-openi-images.mjs — ИЗТОЧНИК: Open-i (NIH / U.S. National Library of Medicine).
// Биомедицинска търсачка за ИЗОБРАЖЕНИЯ от медицински статии/атласи. Поддържа РАЗДЕЛЯНЕ:
// работник SHARD_ID от общо SHARD_N взима само думите с индекс %SHARD_N==SHARD_ID → няколко
// работника паралелно без застъпване. Таван НА ДУМА (PER_TERM) → покрива цялата ШИРИНА (всички
// състояния), не изчерпва първите. Префикс `oi<ID>_`, собствен shard.
// Пуск: SHARD_ID=0 SHARD_N=3 node private/medikit-harvester/harvest-openi-images.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const OUT = path.join(ROOT, 'rustore', 'pupikes-doctor', 'publish', 'reference');
const IMGDIR = path.join(OUT, 'images');
const SHARD_ID = parseInt(process.env.SHARD_ID || '0', 10);
const SHARD_N = parseInt(process.env.SHARD_N || '1', 10);
const SHARD = path.join(OUT, `images-index.openi.${SHARD_ID}.json`);
const MASTER = path.join(OUT, 'images-index.json');
const PER_TERM = parseInt(process.env.PER_TERM || '350', 10);
const IMG_MS = parseInt(process.env.IMG_MS || '25', 10);
const PAGE_MS = parseInt(process.env.PAGE_MS || '300', 10);
const BASE = 'https://openi.nlm.nih.gov';
const UA = { 'User-Agent': 'PupikesMedikit/1.0 (educational; contact ltd.dai.grup@gmail.com)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ALL_TERMS = [
  'rash', 'eczema', 'psoriasis', 'dermatitis', 'cellulitis', 'abscess', 'wound', 'burn',
  'laceration', 'bruise', 'hematoma', 'fracture', 'sprain', 'insect bite', 'urticaria hives',
  'impetigo', 'herpes zoster shingles', 'chickenpox', 'measles', 'melanoma', 'basal cell carcinoma',
  'diabetic foot ulcer', 'pressure ulcer', 'conjunctivitis', 'stye', 'edema', 'lymphedema',
  'varicose veins', 'tinea ringworm', 'onychomycosis', 'acne', 'rosacea', 'jaundice', 'cyanosis',
  'skin lesion', 'ulcer skin', 'swelling', 'abrasion', 'contusion', 'nosebleed epistaxis',
  'cutaneous rash', 'vitiligo', 'scabies', 'cellulitis leg', 'wound infection', 'lipoma',
  'ganglion cyst', 'sebaceous cyst', 'keloid scar', 'gangrene', 'frostbite', 'skin ulcer leg'
];
const TERMS = ALL_TERMS.filter((_, i) => i % SHARD_N === SHARD_ID);

async function getJson(url) {
  for (let a = 0; a < 4; a++) {
    try { const r = await fetch(url, { headers: UA }); if (r.status === 429) { await sleep(20000); continue; } if (!r.ok) return null; return await r.json(); }
    catch (_) { await sleep(3000); }
  }
  return null;
}
async function download(url, dest) {
  try { const r = await fetch(url, { headers: UA }); if (!r.ok) return false;
    const b = Buffer.from(await r.arrayBuffer()); if (b.length < 4000) return false; fs.writeFileSync(dest, b); return true; } catch (_) { return false; }
}

async function main() {
  fs.mkdirSync(IMGDIR, { recursive: true });
  let items = [];
  try { items = (JSON.parse(fs.readFileSync(SHARD, 'utf8')).items) || []; } catch (_) {}
  const seen = new Set(items.map((x) => x.url));
  try { for (const x of (JSON.parse(fs.readFileSync(MASTER, 'utf8')).items || [])) seen.add(x.url); } catch (_) {}
  let got = items.length;
  console.log(`[openi#${SHARD_ID}/${SHARD_N}] думи: ${TERMS.length}; таван/дума ${PER_TERM}; старт ${got}`);
  for (const term of TERMS) {
    const slug = term.replace(/[^a-z0-9]+/gi, '_').slice(0, 24);
    let tget = 0;
    for (let start = 1; start <= 3000 && tget < PER_TERM; start += 100) {
      const j = await getJson(`${BASE}/api/search?query=${encodeURIComponent(term)}&it=ph,x,xg&m=${start}&n=${start + 99}`);
      await sleep(PAGE_MS);
      const list = j && (j.list || j.results); if (!list || !list.length) break;
      let k = 0;
      for (const it of list) {
        if (tget >= PER_TERM) break;
        let rel = it.imgLarge || it.imgThumb || it.img || (it.image && it.image.large);
        if (!rel) continue;
        const url = rel.startsWith('http') ? rel : BASE + rel;
        if (seen.has(url)) continue; seen.add(url);
        const ext = (url.split('?')[0].split('.').pop() || 'png').toLowerCase().slice(0, 4);
        const name = `oi${SHARD_ID}_${slug}_${start}_${k}.${/(jpg|jpeg|png)/.test(ext) ? ext : 'png'}`;
        if (await download(url, path.join(IMGDIR, name))) {
          items.push({ file: 'images/' + name, article: term, url, source: 'Open-i (NIH/NLM)' });
          got++; tget++; k++;
        }
        await sleep(IMG_MS);
      }
      const total = j.total || j.count || 0;
      if (total && start + 99 >= total) break;
    }
    fs.writeFileSync(SHARD, JSON.stringify({ count: items.length, items }, null, 2));
    console.log(`[openi#${SHARD_ID}] "${term}" +${tget} → общо ${got}`);
  }
  fs.writeFileSync(SHARD, JSON.stringify({ count: items.length, items, source: 'Open-i (NIH/NLM, open access)', updated: new Date().toISOString().slice(0, 10) }, null, 2));
  console.log(`[openi#${SHARD_ID}] DONE — ${items.length} снимки`);
}
main().catch((e) => { console.error(`[openi#${SHARD_ID}] FATAL`, e.message); process.exit(1); });
