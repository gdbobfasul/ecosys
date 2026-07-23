// harvest-isic-images.mjs — ИЗТОЧНИК: ISIC Archive (дерматологичен архив 552k снимки, CC).
// РАЗДЕЛЯНЕ ПО СТРАНИЦИ: всички работници обхождат ЕДНИЯ курсор еднакво (стабилен ред), но
// работник SHARD_ID сваля само страниците, където pageIndex%SHARD_N==SHARD_ID → наистина
// разделени дялове, N× по-бързо, без застъпване. (query= не филтрира → не се ползва.)
// Таван за този работник MAXDL. Префикс `isic<ID>_`. Пуск: SHARD_ID=0 SHARD_N=2 node ...isic...mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const OUT = path.join(ROOT, 'rustore', 'pupikes-doctor', 'publish', 'reference');
const IMGDIR = path.join(OUT, 'images');
const SHARD_ID = parseInt(process.env.SHARD_ID || '0', 10);
const SHARD_N = parseInt(process.env.SHARD_N || '1', 10);
const SHARD = path.join(OUT, `images-index.isic.${SHARD_ID}.json`);
const MASTER = path.join(OUT, 'images-index.json');
const MAXDL = parseInt(process.env.MAXDL || '2500', 10);
const IMG_MS = parseInt(process.env.IMG_MS || '15', 10);
const PAGE_MS = parseInt(process.env.PAGE_MS || '120', 10);
const V2 = 'https://api.isic-archive.com/api/v2/images/?limit=100';
const UA = { 'User-Agent': 'PupikesMedikit/1.0 (educational; contact ltd.dai.grup@gmail.com)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) { for (let a = 0; a < 4; a++) { try { const r = await fetch(url, { headers: UA }); if (r.status === 429) { await sleep(20000); continue; } if (!r.ok) return null; return await r.json(); } catch (_) { await sleep(3000); } } return null; }
async function download(url, dest) { try { const r = await fetch(url, { headers: UA }); if (!r.ok) return false; const b = Buffer.from(await r.arrayBuffer()); if (b.length < 4000) return false; fs.writeFileSync(dest, b); return true; } catch (_) { return false; } }

async function main() {
  fs.mkdirSync(IMGDIR, { recursive: true });
  let items = [];
  try { items = (JSON.parse(fs.readFileSync(SHARD, 'utf8')).items) || []; } catch (_) {}
  const seen = new Set(items.map((x) => x.url));
  try { for (const x of (JSON.parse(fs.readFileSync(MASTER, 'utf8')).items || [])) seen.add(x.url); } catch (_) {}
  let got = items.length;
  console.log(`[isic#${SHARD_ID}/${SHARD_N}] дял по страници; таван ${MAXDL}; старт ${got}`);
  let url = V2, page = 0;
  while (url && got < MAXDL && page < 6000) {
    const j = await getJson(url); await sleep(PAGE_MS);
    if (!j || !j.results || !j.results.length) break;
    if (page % SHARD_N === SHARD_ID) {            // само МОИТЕ страници
      let k = 0;
      for (const it of j.results) {
        if (got >= MAXDL) break;
        const f = it.files && (it.files.thumbnail_256 || it.files.full);   // thumbnail = малък → без препълване на диска
        const iurl = f && f.url; if (!iurl) continue;
        const key = iurl.split('?')[0];
        if (seen.has(key)) continue; seen.add(key);
        const dx = (it.metadata && it.metadata.clinical && (it.metadata.clinical.diagnosis || it.metadata.clinical.benign_malignant)) || 'skin lesion';
        const name = `isic${SHARD_ID}_${it.isic_id || (page + '_' + k)}.jpg`;
        // Пропусни, ако вече е свален този isic_id (thumbnail URL се различава от стария full → иначе
        // презаписваме същия файл и НЕ растем; така обхождаме НАДЪЛБОЧ към нови снимки).
        if (fs.existsSync(path.join(IMGDIR, name))) continue;
        if (await download(iurl, path.join(IMGDIR, name))) { items.push({ file: 'images/' + name, article: 'dermatology: ' + dx, url: key, source: 'ISIC Archive' }); got++; k++; }
        await sleep(IMG_MS);
      }
      fs.writeFileSync(SHARD, JSON.stringify({ count: items.length, items }, null, 2));
      if (page % (SHARD_N * 5) === SHARD_ID) console.log(`[isic#${SHARD_ID}] ...${got} (страница ${page})`);
    }
    url = j.next || null; page++;
  }
  fs.writeFileSync(SHARD, JSON.stringify({ count: items.length, items, source: 'ISIC Archive (CC)', updated: new Date().toISOString().slice(0, 10) }, null, 2));
  console.log(`[isic#${SHARD_ID}] DONE — ${items.length} снимки`);
}
main().catch((e) => { console.error(`[isic#${SHARD_ID}] FATAL`, e.message); process.exit(1); });
