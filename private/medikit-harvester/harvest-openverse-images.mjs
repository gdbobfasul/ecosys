// harvest-openverse-images.mjs — ТРЕТИ ИЗТОЧНИК (различен от Уикимедия).
// Openverse (api.openverse.org) агрегира свободни/CC изображения от много доставчици (Flickr,
// музеи, галерии, GLAM…). Търси по медицински/видими състояния и сваля кадрите в общата папка
// с префикс `ov_` (без сблъсък с другите ботове). Дедуплира по URL в собствен shard индекс.
// Пуск: node private/medikit-harvester/harvest-openverse-images.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const OUT = path.join(ROOT, 'rustore', 'pupikes-doctor', 'publish', 'reference');
const IMGDIR = path.join(OUT, 'images');
const SHARD = path.join(OUT, 'images-index.openverse.json');
const MASTER = path.join(OUT, 'images-index.json');
const MAXDL = parseInt(process.env.MAXDL || '4000', 10);   // таван нови файлове за този бот
const API = 'https://api.openverse.org/v1/images/';
const UA = { 'User-Agent': 'PupikesMedikit/1.0 (educational; contact ltd.dai.grup@gmail.com)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TERMS = [
  'skin rash', 'eczema', 'psoriasis', 'dermatitis', 'ringworm', 'hives urticaria', 'bruise',
  'hematoma', 'burn injury', 'wound', 'laceration', 'abrasion', 'bone fracture x-ray', 'sprain',
  'insect bite', 'bee sting', 'tick bite', 'cellulitis', 'skin abscess', 'boil furuncle',
  'conjunctivitis', 'stye eye', 'cold sore', 'skin wart', 'skin mole', 'sunburn', 'skin blister',
  'swelling limb', 'edema leg', 'nosebleed', 'allergic skin reaction', 'chickenpox rash',
  'measles rash', 'shingles rash', 'impetigo', 'acne', 'rosacea', 'melanoma skin', 'diabetic foot ulcer',
  'pressure ulcer', 'varicose veins', 'athlete foot', 'nail fungus', 'jaundice eye', 'rash child'
];

async function getJson(url) {
  for (let a = 0; a < 4; a++) {
    try {
      const r = await fetch(url, { headers: UA });
      if (r.status === 429) { await sleep(60000); continue; }   // rate-limit → чакай минута
      if (!r.ok) return null;
      return await r.json();
    } catch (_) { await sleep(3000); }
  }
  return null;
}
async function download(url, dest) {
  try {
    const r = await fetch(url, { headers: UA }); if (!r.ok) return false;
    const b = Buffer.from(await r.arrayBuffer());
    if (b.length < 4000) return false; fs.writeFileSync(dest, b); return true;
  } catch (_) { return false; }
}

async function main() {
  fs.mkdirSync(IMGDIR, { recursive: true });
  let items = [];
  try { items = (JSON.parse(fs.readFileSync(SHARD, 'utf8')).items) || []; } catch (_) {}
  const seen = new Set(items.map((x) => x.url));
  // Дедуп и спрямо вече събраното от другите източници (best-effort в началото).
  try { for (const x of (JSON.parse(fs.readFileSync(MASTER, 'utf8')).items || [])) seen.add(x.url); } catch (_) {}
  let got = items.length;
  console.log(`[openverse] старт от ${got} собствени; таван +${MAXDL}`);
  for (const term of TERMS) {
    if (got >= MAXDL) break;
    const slug = term.replace(/[^a-z0-9]+/gi, '_').slice(0, 24);
    for (let page = 1; page <= 20; page++) {
      if (got >= MAXDL) break;
      const j = await getJson(`${API}?q=${encodeURIComponent(term)}&page=${page}&page_size=100&mature=false`);
      await sleep(1200);
      if (!j || !j.results || !j.results.length) break;
      let k = 0;
      for (const it of j.results) {
        if (got >= MAXDL) break;
        const url = it.url; if (!url || seen.has(url)) continue;
        if (!/\.(jpg|jpeg|png)(\?|$)/i.test(url)) continue;
        seen.add(url);
        const ext = (url.split('?')[0].split('.').pop() || 'jpg').toLowerCase();
        const name = `ov_${slug}_${page}_${k}.${ext}`;
        if (await download(url, path.join(IMGDIR, name))) {
          items.push({ file: 'images/' + name, article: term, url, source: 'Openverse (' + (it.source || it.provider || 'cc') + ')' });
          got++; k++;
        }
        await sleep(120);
      }
      if (page % 3 === 0) { fs.writeFileSync(SHARD, JSON.stringify({ count: items.length, items }, null, 2)); console.log(`[openverse] ...${got} (term "${term}" p${page})`); }
      if (!j.page_count || page >= j.page_count) break;
    }
    fs.writeFileSync(SHARD, JSON.stringify({ count: items.length, items }, null, 2));
    console.log(`[openverse] term "${term}" готов → общо ${got}`);
  }
  fs.writeFileSync(SHARD, JSON.stringify({ count: items.length, items, source: 'Openverse (CC/PD)', updated: new Date().toISOString().slice(0, 10) }, null, 2));
  console.log(`[openverse] DONE — ${items.length} нови снимки`);
}
main().catch((e) => { console.error('[openverse] FATAL', e.message); process.exit(1); });
