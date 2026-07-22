// harvest-medicines.mjs — събирач за Pupikes Medicines.
// Източник: Wikipedia/Wikimedia (keyless, 15-езичен). За всяко състояние взима:
//   • per език — заглавие + extract (описание/симптоми/лечение накратко) от статията;
//   • снимка(и), РЕАЛНО вградени в статията (Wikimedia Commons — CC/PD, изисква attribution).
// Резултат → в папката на АПА: <repo>/rustore/pupikes-medicines/publish/reference/ (по правилото за
// резултати на ботове). Снимките се СВАЛЯТ (пакетът се хоства/сваля от апа; НЕ се вгражда в APK).
// Пуск: node private/medikit-harvester/harvest-medicines.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const OUT = path.join(ROOT, 'rustore', 'pupikes-medicines', 'publish', 'reference');
const IMGDIR = path.join(OUT, 'img');

// Нашите 15 езика → Wikipedia езикови кодове (es-MX→es, zh-Hant→zh).
const LANGS = ['bg', 'ru', 'uk', 'en', 'de', 'fr', 'es', 'it', 'pt', 'ar', 'hi', 'ja', 'ky', 'zh'];

const CONDITIONS = [
  { id: "paracetamol", title: "Paracetamol" },
  { id: "ibuprofen", title: "Ibuprofen" },
  { id: "aspirin", title: "Aspirin" },
  { id: "metamizole", title: "Metamizole" },
  { id: "amoxicillin", title: "Amoxicillin" },
  { id: "diclofenac", title: "Diclofenac" },
  { id: "omeprazole", title: "Omeprazole" },
  { id: "loratadine", title: "Loratadine" },
  { id: "cetirizine", title: "Cetirizine" },
  { id: "naproxen", title: "Naproxen" },
  { id: "codeine", title: "Codeine" },
  { id: "tramadol", title: "Tramadol" },
  { id: "azithromycin", title: "Azithromycin" },
  { id: "dexamethasone", title: "Dexamethasone" },
  { id: "diphenhydramine", title: "Diphenhydramine" }
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
    const j = await getJson(`https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllimit=500&format=json&titles=${encodeURIComponent(title)}`);
    const pages = j.query.pages; const p = pages[Object.keys(pages)[0]];
    const map = {};
    for (const ll of (p.langlinks || [])) map[ll.lang] = ll['*'];
    return map;
  } catch (_) { return {}; }
}
async function download(url, dest) {
  try { const r = await fetch(url, { headers: UA }); if (!r.ok) return false;
    const buf = Buffer.from(await r.arrayBuffer()); fs.writeFileSync(dest, buf); return true; } catch (_) { return false; }
}

async function main() {
  fs.mkdirSync(IMGDIR, { recursive: true });
  const index = [];
  for (const c of CONDITIONS) {
    const links = await langlinks(c.title); await sleep(250);
    const titleByLang = Object.assign({ en: c.title }, links);
    const rec = { id: c.id, langs: {}, images: [] };
    const imgSet = new Set();
    for (const lang of LANGS) {
      const title = titleByLang[lang]; if (!title) continue;
      const s = await summary(lang, title); await sleep(250);
      if (!s || !s.extract) continue;
      // Лекарствата НЕ носят снимки (не ни трябват за „лекарствена информация") — само текст.
      rec.langs[lang] = { title, extract: s.extract };
    }
    fs.writeFileSync(path.join(OUT, c.id + '.json'), JSON.stringify(rec, null, 2));
    index.push({ id: c.id, langs: Object.keys(rec.langs), images: rec.images.length });
    console.log(`✓ ${c.id}: ${Object.keys(rec.langs).length} езика, ${rec.images.length} снимки`);
  }
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ items: index, source: 'Wikipedia/Wikimedia Commons (CC/PD)', updated: new Date().toISOString().slice(0, 10) }, null, 2));
  console.log('DONE →', OUT);
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
