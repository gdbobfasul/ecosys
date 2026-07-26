// harvest-bodypain.mjs — събирач за режима „Къде боли" на Pupikes Doctor.
// За всяка ЗОНА от тялото взима авторитетно описание (възможни болки/причини) от Wikipedia,
// на 14 езика (заглавие + extract). Само ТЕКСТ (без снимки). Резултат → в папката на апа:
//   rustore/pupikes-doctor/publish/reference/bodypain/<zone>.json  + bodypain/index.json
// После се копира в public/reference/bodypain/ (бъндъл) и апът го чете. Пуск от repo ROOT:
//   node private/medikit-harvester/harvest-bodypain.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const OUT = path.join(ROOT, 'rustore', 'pupikes-doctor', 'publish', 'reference', 'bodypain');
const LANGS = ['bg', 'ru', 'uk', 'en', 'de', 'fr', 'es', 'it', 'pt', 'ar', 'hi', 'ja', 'ky', 'zh'];

// Зона → статия в Wikipedia (за „болка в …"). Подбрани да СЪЩЕСТВУВАТ; langlinks дава другите езици.
const ZONES = [
  { id: 'head', title: 'Headache' },
  { id: 'face', title: 'Facial pain' },
  { id: 'ear', title: 'Ear pain' },
  { id: 'throat', title: 'Sore throat' },
  { id: 'chest', title: 'Chest pain' },
  { id: 'stomach', title: 'Abdominal pain' },
  { id: 'lower_abdomen', title: 'Abdominal pain' },
  { id: 'pelvis', title: 'Pelvic pain' },
  { id: 'shoulder', title: 'Shoulder problem' },
  { id: 'upper_arm', title: 'Myalgia' },
  { id: 'forearm', title: 'Repetitive strain injury' },
  { id: 'hand', title: 'Carpal tunnel syndrome' },
  { id: 'hip', title: 'Hip pain' },
  { id: 'thigh', title: 'Sciatica' },
  { id: 'knee', title: 'Knee pain' },
  { id: 'shin', title: 'Shin splints' },
  { id: 'foot', title: 'Plantar fasciitis' },
  { id: 'upper_back', title: 'Back pain' },
  { id: 'lower_back', title: 'Low back pain' },
  { id: 'tooth', title: 'Toothache' }
];

const UA = { 'User-Agent': 'PupikesMedikit/1.0 (educational; contact ltd.dai.grup@gmail.com)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJson(url) { const r = await fetch(url, { headers: UA }); if (!r.ok) throw new Error('http ' + r.status); return r.json(); }
async function summary(lang, title) {
  try { return await getJson(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`); }
  catch (_) { return null; }
}
async function langlinks(title) {
  try {
    const j = await getJson(`https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllimit=500&redirects=1&format=json&titles=${encodeURIComponent(title)}`);
    const pages = j.query.pages; const p = pages[Object.keys(pages)[0]];
    const map = {}; for (const ll of (p.langlinks || [])) map[ll.lang] = ll['*']; return map;
  } catch (_) { return {}; }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const index = [];
  for (const z of ZONES) {
    const links = await langlinks(z.title); await sleep(200);
    const titleByLang = Object.assign({ en: z.title }, links);
    const rec = { id: z.id, langs: {} };
    for (const lang of LANGS) {
      const title = titleByLang[lang]; if (!title) continue;
      const s = await summary(lang, title); await sleep(200);
      if (!s || !s.extract) continue;
      rec.langs[lang] = { title, extract: s.extract };
    }
    fs.writeFileSync(path.join(OUT, z.id + '.json'), JSON.stringify(rec, null, 2));
    index.push({ id: z.id, langs: Object.keys(rec.langs) });
    console.log(`✓ ${z.id}: ${Object.keys(rec.langs).length} езика (${z.title})`);
  }
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ items: index, source: 'Wikipedia (CC BY-SA)', updated: new Date().toISOString().slice(0, 10) }, null, 2));
  console.log('DONE →', OUT);
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
