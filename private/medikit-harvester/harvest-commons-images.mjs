// harvest-commons-images.mjs — ИЗТОЧНИК: Wikimedia Commons (медийната база, по категории).
// Поддържа РАЗДЕЛЯНЕ: работник SHARD_ID от SHARD_N взима категориите с индекс %SHARD_N==SHARD_ID
// (всеки разгъва СВОИТЕ подкатегории) → няколко работника без застъпване. Таван НА КАТЕГОРИЯ
// (PER_CAT) → покрива цялата ШИРИНА. Префикс `cx<ID>_`, собствен shard (НЕ пипа общия индекс).
// Пуск: SHARD_ID=0 SHARD_N=2 node private/medikit-harvester/harvest-commons-images.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const OUT = path.join(ROOT, 'rustore', 'pupikes-doctor', 'publish', 'reference');
const IMGDIR = path.join(OUT, 'images');
const SHARD_ID = parseInt(process.env.SHARD_ID || '0', 10);
const SHARD_N = parseInt(process.env.SHARD_N || '1', 10);
const SHARD = path.join(OUT, `images-index.commons.${SHARD_ID}.json`);
const MASTER = path.join(OUT, 'images-index.json');
const PER_CAT = parseInt(process.env.PER_CAT || '150', 10);
const IMG_MS = parseInt(process.env.IMG_MS || '25', 10);

const ALL_CATS = [
  'Category:Bruises', 'Category:Hematomas', 'Category:Bone fractures', 'Category:Sprains',
  'Category:Wounds', 'Category:Burns', 'Category:Insect bites', 'Category:Bites and stings',
  'Category:Skin diseases', 'Category:Dermatology', 'Category:Rashes', 'Category:Cutaneous conditions',
  'Category:Nosebleed', 'Category:Edema', 'Category:Injuries', 'Category:Symptoms and signs',
  'Category:Medical photographs', 'Category:Dermatological images', 'Category:Human diseases',
  'Category:Abrasions', 'Category:Lacerations', 'Category:Cellulitis', 'Category:Abscesses',
  'Category:Allergic reactions', 'Category:Swelling', 'Category:Eczema', 'Category:Psoriasis',
  'Category:Acne', 'Category:Warts', 'Category:Ulcers', 'Category:Skin cancer', 'Category:Melanoma',
  'Category:Conjunctivitis', 'Category:Varicose veins', 'Category:Frostbite', 'Category:Gangrene'
];
const CATS = ALL_CATS.filter((_, i) => i % SHARD_N === SHARD_ID);
const UA = { 'User-Agent': 'PupikesMedikit/1.0 (educational; contact ltd.dai.grup@gmail.com)' };
const API = 'https://commons.wikimedia.org/w/api.php';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJson(url) { for (let a = 0; a < 3; a++) { try { const r = await fetch(url, { headers: UA }); if (!r.ok) { await sleep(2000); continue; } return await r.json(); } catch (_) { await sleep(2000); } } return null; }
async function download(url, dest) {
  try { const r = await fetch(url, { headers: UA }); if (!r.ok) return false;
    const b = Buffer.from(await r.arrayBuffer()); if (b.length < 4000) return false; fs.writeFileSync(dest, b); return true; } catch (_) { return false; }
}
async function catFiles(cat, limit) {
  const out = []; let cont = '';
  for (let g = 0; g < 12 && out.length < limit * 2; g++) {
    const j = await getJson(`${API}?action=query&generator=categorymembers&gcmtitle=${encodeURIComponent(cat)}&gcmtype=file&gcmlimit=200&prop=imageinfo&iiprop=url&format=json${cont}`);
    await sleep(120);
    if (!j || !j.query || !j.query.pages) break;
    for (const p of Object.values(j.query.pages)) { const ii = p.imageinfo && p.imageinfo[0]; if (!ii || !ii.url) continue; if (!/\.(jpg|jpeg|png)$/i.test(ii.url.split('?')[0])) continue; out.push(ii.url); }
    if (j.continue && j.continue.gcmcontinue) cont = '&gcmcontinue=' + encodeURIComponent(j.continue.gcmcontinue); else break;
  }
  return out;
}
async function subcats(cat) { const j = await getJson(`${API}?action=query&list=categorymembers&cmtitle=${encodeURIComponent(cat)}&cmtype=subcat&cmlimit=200&format=json`); await sleep(120); return (j && j.query ? j.query.categorymembers.map((m) => m.title) : []); }

async function main() {
  fs.mkdirSync(IMGDIR, { recursive: true });
  let items = [];
  try { items = (JSON.parse(fs.readFileSync(SHARD, 'utf8')).items) || []; } catch (_) {}
  const seen = new Set(items.map((x) => x.url));
  try { for (const x of (JSON.parse(fs.readFileSync(MASTER, 'utf8')).items || [])) seen.add(x.url); } catch (_) {}
  let n = items.length;
  const allCats = [...CATS];
  for (const c of CATS) { for (const s of await subcats(c)) allCats.push(s); if (allCats.length > 200) break; }
  console.log(`[commons#${SHARD_ID}/${SHARD_N}] категории: ${allCats.length}; таван/кат ${PER_CAT}; старт ${n}`);
  let ci = 0;
  for (const cat of allCats) {
    const files = await catFiles(cat, PER_CAT);
    const slug = cat.replace(/^Category:/, '').replace(/[^a-z0-9]+/gi, '_').slice(0, 28);
    let k = 0;
    for (const url of files) {
      if (k >= PER_CAT) break;
      if (seen.has(url)) continue; seen.add(url);
      const ext = (url.split('?')[0].split('.').pop() || 'jpg').toLowerCase();
      const name = `cx${SHARD_ID}_${slug}_${k}.${ext}`;
      if (await download(url, path.join(IMGDIR, name))) { items.push({ file: 'images/' + name, article: cat.replace(/^Category:/, ''), url, source: 'Wikimedia Commons' }); n++; k++; }
      await sleep(IMG_MS);
    }
    ci++;
    fs.writeFileSync(SHARD, JSON.stringify({ count: items.length, items }, null, 2));
    console.log(`[commons#${SHARD_ID}] "${slug}" +${k} → общо ${n} (${ci}/${allCats.length})`);
  }
  fs.writeFileSync(SHARD, JSON.stringify({ count: items.length, items, source: 'Wikimedia Commons (CC/PD)', updated: new Date().toISOString().slice(0, 10) }, null, 2));
  console.log(`[commons#${SHARD_ID}] DONE — ${items.length} снимки`);
}
main().catch((e) => { console.error(`[commons#${SHARD_ID}] FATAL`, e.message); process.exit(1); });
