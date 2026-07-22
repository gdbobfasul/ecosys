// harvest-doctor-images.mjs — МАЩАБЕН събирач на снимки за Pupikes Doctor (цел ~10 000).
// Обхожда медицински категории в Wikipedia → статии → сваля снимките (jpg/png), реално вградени
// в статиите (Wikimedia Commons, CC/PD → attribution). Всяка снимка носи ЕТИКЕТ = заглавието на
// статията (състоянието) → после MobileNet embedding + косинус за сравнение. Резултат:
//   rustore/pupikes-doctor/publish/reference/images/  +  images-index.json
// Пуск: node private/medikit-harvester/harvest-doctor-images.mjs   (дълъг — на заден план)
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const OUT = path.join(ROOT, 'rustore', 'pupikes-doctor', 'publish', 'reference');
const IMGDIR = path.join(OUT, 'images');
const TARGET = parseInt(process.env.TARGET || '10000', 10);

const SEED_CATS = [
  'Category:Injuries', 'Category:Cutaneous conditions', 'Category:Skin conditions',
  'Category:Symptoms and signs', 'Category:Medical signs', 'Category:Dermatologic terminology',
  'Category:Bone fractures', 'Category:Burns', 'Category:Wounds', 'Category:Bites and stings'
];
const UA = { 'User-Agent': 'PupikesMedikit/1.0 (educational; contact ltd.dai.grup@gmail.com)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJson(url) { try { const r = await fetch(url, { headers: UA }); if (!r.ok) return null; return await r.json(); } catch (_) { return null; } }

async function catMembers(cat, type) {
  const out = [];
  let cont = '';
  for (let g = 0; g < 6; g++) {
    const j = await getJson(`https://en.wikipedia.org/w/api.php?action=query&list=categorymembers&cmtitle=${encodeURIComponent(cat)}&cmlimit=500&cmtype=${type}&format=json${cont}`);
    await sleep(120);
    if (!j || !j.query) break;
    for (const m of j.query.categorymembers) out.push(m.title);
    if (j.continue && j.continue.cmcontinue) cont = '&cmcontinue=' + encodeURIComponent(j.continue.cmcontinue); else break;
  }
  return out;
}
async function mediaList(title) {
  const j = await getJson(`https://en.wikipedia.org/api/rest_v1/page/media-list/${encodeURIComponent(title)}`);
  if (!j || !j.items) return [];
  const urls = [];
  for (const it of j.items) {
    if (it.type !== 'image') continue;
    let src = '';
    if (it.srcset && it.srcset.length) src = it.srcset[it.srcset.length - 1].src;
    else if (it.original && it.original.source) src = it.original.source;
    if (!src) continue;
    if (src.startsWith('//')) src = 'https:' + src;
    if (!/\.(jpg|jpeg|png)$/i.test(src.split('?')[0])) continue;   // само снимки, не svg/икони
    urls.push(src);
  }
  return urls;
}
async function download(url, dest) {
  try { const r = await fetch(url, { headers: UA }); if (!r.ok) return false;
    const b = Buffer.from(await r.arrayBuffer()); if (b.length < 4000) return false;   // прескочи мънички икони
    fs.writeFileSync(dest, b); return true; } catch (_) { return false; }
}

async function main() {
  fs.mkdirSync(IMGDIR, { recursive: true });
  // 1) Събери заглавия на статии от категориите (+ едно ниво подкатегории).
  const titles = new Set();
  for (const cat of SEED_CATS) {
    for (const t of await catMembers(cat, 'page')) titles.add(t);
    for (const sub of await catMembers(cat, 'subcat')) {
      for (const t of await catMembers(sub, 'page')) titles.add(t);
      if (titles.size > 4000) break;
    }
    if (titles.size > 4000) break;
  }
  const list = [...titles];
  console.log(`статии за обхождане: ${list.length}`);
  // 2) За всяка статия → снимки → сваляне, докато стигнем TARGET.
  const seenUrl = new Set();
  const index = [];
  let n = 0;
  for (const title of list) {
    if (n >= TARGET) break;
    const urls = await mediaList(title); await sleep(120);
    const slug = title.replace(/[^a-z0-9]+/gi, '_').slice(0, 40);
    let k = 0;
    for (const url of urls) {
      if (n >= TARGET) break;
      if (seenUrl.has(url)) continue; seenUrl.add(url);
      const ext = (url.split('?')[0].split('.').pop() || 'jpg').toLowerCase();
      const name = `${slug}_${k}.${ext}`;
      if (await download(url, path.join(IMGDIR, name))) { index.push({ file: 'images/' + name, article: title, url }); n++; k++; }
      await sleep(80);
    }
    if (index.length && index.length % 200 < 2) console.log(`  ...${n} снимки (${title})`);
  }
  fs.writeFileSync(path.join(OUT, 'images-index.json'), JSON.stringify({ count: index.length, items: index, source: 'Wikipedia/Wikimedia Commons (CC/PD)', updated: new Date().toISOString().slice(0, 10) }, null, 2));
  console.log(`DONE — ${index.length} снимки → ${IMGDIR}`);
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
