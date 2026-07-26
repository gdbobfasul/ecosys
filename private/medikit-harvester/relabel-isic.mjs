// relabel-isic.mjs — ПОПРАВЯ ЕТИКЕТИТЕ на вече свалените ISIC снимки, БЕЗ да тегли пак.
// Старият събирач четеше несъществуващо поле `diagnosis` → всичко падна на „skin lesion".
// Тук обхождам записите на архива и попълвам ИСТИНСКАТА диагноза по isic_id
// (най-доброто налично от diagnosis_3 → diagnosis_2 → diagnosis_1). Спирам щом покрия моите.
// Пуск от repo ROOT:  node private/medikit-harvester/relabel-isic.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const MASTER = path.join(ROOT, 'rustore', 'pupikes-doctor', 'publish', 'reference', 'images-index.json');
const UA = { headers: { 'User-Agent': 'PupikesMedikit/1.0 (educational; ltd.dai.grup@gmail.com)' } };
const V2 = 'https://api.isic-archive.com/api/v2/images/?limit=100';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// diagnosis_3 е клинично най-полезното ниво („Nevus", „Melanoma, NOS", „Basal cell carcinoma").
// diagnosis_2 е категория, diagnosis_1 е само Benign/Malignant. Взимам най-специфичното налично.
function pickDx(cl) {
  if (!cl) return null;
  const d = cl.diagnosis_3 || cl.diagnosis_2 || cl.diagnosis_1;
  if (!d) return null;
  let t = String(d).trim();
  // „Melanoma, NOS" → „melanoma"; „Nevus, Dysplastic" → „nevus"; махам квалификаторите след запетая
  t = t.replace(/,\s*(nos|not otherwise specified).*$/i, '');
  t = t.split(',')[0].trim().toLowerCase();
  t = t.replace(/\s*\(melanoma\)\s*/i, ' melanoma').replace(/\s+/g, ' ').trim();
  return t || null;
}

async function getJson(url) {
  for (let a = 0; a < 5; a++) {
    try {
      const r = await fetch(url, UA);
      if (r.status === 429) { await sleep(20000); continue; }
      if (!r.ok) return null;
      return await r.json();
    } catch (_) { await sleep(3000); }
  }
  return null;
}

async function main() {
  const idx = JSON.parse(fs.readFileSync(MASTER, 'utf8'));
  const items = idx.items || [];
  // isic_id → списък от записи, които го чакат
  const want = new Map();
  for (const it of items) {
    if (it.source !== 'ISIC Archive') continue;
    const m = /(ISIC_\d+)/.exec(it.file || '');
    if (!m) continue;
    if (!want.has(m[1])) want.set(m[1], []);
    want.get(m[1]).push(it);
  }
  console.log(`[relabel] чакащи isic_id: ${want.size}`);

  const dxOf = new Map();
  let url = V2, page = 0, resolved = 0, lastLog = 0;
  while (url && resolved < want.size && page < 6000) {
    const j = await getJson(url); await sleep(90);
    if (!j || !j.results || !j.results.length) break;
    for (const r of j.results) {
      const id = r.isic_id;
      if (!want.has(id) || dxOf.has(id)) continue;
      const dx = pickDx(r.metadata && r.metadata.clinical);
      dxOf.set(id, dx || 'skin lesion');
      resolved++;
    }
    page++;
    if (resolved - lastLog >= 500 || page % 100 === 0) {
      console.log(`[relabel] страница ${page} · покрити ${resolved}/${want.size}`);
      lastLog = resolved;
    }
    url = j.next || null;
  }
  console.log(`[relabel] край на обхождането — покрити ${resolved}/${want.size} (страници ${page})`);

  // Записвам новите етикети
  let changed = 0;
  const dist = new Map();
  for (const [id, list] of want) {
    const dx = dxOf.get(id) || 'skin lesion';
    for (const it of list) {
      const nl = 'dermatology: ' + dx;
      if (it.article !== nl) { it.article = nl; changed++; }
      dist.set(dx, (dist.get(dx) || 0) + 1);
    }
  }
  fs.writeFileSync(MASTER, JSON.stringify(idx, null, 2));
  console.log(`[relabel] ПРЕПИСАНИ ${changed} записа → ${MASTER}`);
  const top = [...dist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
  console.log('[relabel] нови диагнози (топ 30):');
  for (const [k, v] of top) console.log('   ', String(v).padStart(6), k);
}
main().catch((e) => { console.error('[relabel] FATAL', e.message); process.exit(1); });
