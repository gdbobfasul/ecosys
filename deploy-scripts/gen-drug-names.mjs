// Version: 1.0024
// gen-drug-names.mjs — ГОЛЯМ РЕЧНИК НА ИМЕНА НА ЛЕКАРСТВА за Pupikes Medicines (11.09.2026): ~50 000 имена
// (генерични/INN + търговски + изписвания) → компактен индекс public/reference/drug-names.json (латиница ≤1 MB,
// + не-латиница за bg/ru/uk/ar/hi/ja/zh до 1,5 MB общо — искане 11.09 за компактност),
// свързан с вградената база med-db.json по INN (когато лекарството е сред ~580-те → пълна карта; иначе кратка).
// Източници (публични, без ключ):
//   • Wikidata: всички вещества с INN (P2275), ATC код (P267) или DrugBank ID (P715) — ~16 000 позиции; етикети +
//     синоними на 20 езика (bg ru uk en de fr es it pt ar hi ja ky zh… la) + кратко английско описание;
//   • openFDA NDC Directory (кешът на gen-gtin-db.mjs): търговски имена → генерично име.
// Кеш: private/medikit-harvester/wd-cache/names-*.json (повторно пускане = без мрежа).
//   node deploy-scripts/gen-drug-names.mjs            — речникът
//   node deploy-scripts/gen-drug-names.mjs --max=1000 --maxall=1500 — тавани в KB: латиница / общо с не-латиница
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const APP = 'pupikes-medicines';
const TREES = ['huawei', 'rustore'].map((s) => path.join(ROOT, s, APP)).filter((p) => fs.existsSync(p));
const CACHE = path.join(ROOT, 'private', 'medikit-harvester', 'wd-cache');
fs.mkdirSync(CACHE, { recursive: true });
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([a-z]+)=(.*)$/); return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true]; }));
// Тавани (искане 11.09 за компактност): латинските имена (INN + търговски + латински изписвания) ≤ 1 MB; чуждоезичните
// (не-латиница) само за интерфейсните езици с не-латиница — bg ru uk ar hi ja zh, ако всичко е ≤ 1,5 MB, иначе само bg ru zh.
const MAX_LAT_KB = parseInt(args.max || '1000', 10), MAX_ALL_KB = parseInt(args.maxall || '1500', 10);
const NONLAT_A = ['bg', 'ru', 'uk', 'ar', 'hi', 'ja', 'zh', 'zh-hans', 'zh-hant', 'zh-tw', 'zh-cn', 'zh-hk'], NONLAT_B = ['bg', 'ru', 'zh', 'zh-hans', 'zh-hant', 'zh-tw', 'zh-cn', 'zh-hk'];
const isLatin = (v) => /^[ -~À-ɏḀ-ỿ]+$/.test(String(v || ''));
const UA = 'pupikes-med-db/1.0 (ltd.dai.grup@gmail.com)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- помощни ----------
function cached(name, fn) {
  const f = path.join(CACHE, name);
  if (fs.existsSync(f)) return Promise.resolve(JSON.parse(fs.readFileSync(f, 'utf8')));
  return fn().then((v) => { fs.writeFileSync(f, JSON.stringify(v), 'utf8'); return v; });
}
async function sparql(q) {
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch('https://query.wikidata.org/sparql', { method: 'POST', headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'query=' + encodeURIComponent(q) });
      if (r.status === 429 || r.status >= 500) { await sleep(4000 * (i + 1)); continue; }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return (await r.json()).results.bindings;
    } catch (e) { if (i === 4) throw e; await sleep(2500 * (i + 1)); }
  }
  return [];
}
const CJK = /[぀-ヿ㐀-鿿]/;
const CYR2LAT = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sht', ъ: 'a', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya', ё: 'e', і: 'i', ї: 'i', ј: 'y', љ: 'l', њ: 'n', ђ: 'd', ћ: 'c', џ: 'dz' };
// Ключ за дедупликация (същата нормализация като в апа: латиница/кирилица → латиница без знаци; CJK — без интервали).
function key(s) {
  s = String(s || '').toLowerCase();
  if (CJK.test(s)) return s.replace(/\s+/g, '');
  return s.replace(/[а-яёіїјљњђћџ]/g, (c) => CYR2LAT[c] !== undefined ? CYR2LAT[c] : c).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9؀-ۿऀ-ॿ]+/g, '');
}
// Филтър за имена: без IUPAC/кодове/формули (скоби, ≥2 цифри, E300, дълги), 3..40 знака.
function okName(v) { v = String(v || '').trim(); return !!v && v.length >= 3 && v.length <= 40 && !/^Q\d+$/.test(v) && !/[()\[\],;:=\/]/.test(v) && (v.match(/\d/g) || []).length < 2 && !/^E\d{3}/.test(v) && !/^[A-Z]{1,3}[- ]?\d{2,}/.test(v) && !/^\d/.test(v); }
const title = (s) => String(s || '').replace(/[®™©]/g, '').replace(/\s+/g, ' ').replace(/[\s.,;:!?-]+$/, '').trim();

// ---------- 1) списък вещества от Wikidata ----------
async function drugItems() {
  const rows = [];
  const Q = [
    ['names-list-inn.json', 'SELECT ?item ?l ?inn ?n WHERE { ?item wdt:P2275 ?inn . OPTIONAL { ?item wikibase:sitelinks ?n } OPTIONAL { ?item rdfs:label ?l FILTER(lang(?l)="en") } }'],
    ['names-list-atc.json', 'SELECT ?item ?l ?n WHERE { ?item wdt:P267 ?a . OPTIONAL { ?item wikibase:sitelinks ?n } ?item rdfs:label ?l FILTER(lang(?l)="en") }'],
    ['names-list-drugbank.json', 'SELECT ?item ?l ?n WHERE { ?item wdt:P715 ?d . OPTIONAL { ?item wikibase:sitelinks ?n } ?item rdfs:label ?l FILTER(lang(?l)="en") }']
  ];
  for (const [f, q] of Q) { const r = await cached(f, () => sparql(q)); rows.push(...r); await sleep(500); }
  const map = new Map();
  for (const b of rows) {
    const q = b.item.value.split('/').pop();
    const cur = map.get(q) || { q, inn: '', label: '', n: 0 };
    // INN: предпочитай английския запис (P2275 има и латински „ibuprofenum")
    if (b.inn && b.inn.value && (!cur.inn || (b.inn['xml:lang'] === 'en' && !cur.innEn))) { cur.inn = b.inn.value.toLowerCase().trim(); cur.innEn = b.inn['xml:lang'] === 'en'; }
    if (b.l && b.l.value && !cur.label) cur.label = b.l.value.trim();
    if (b.n && b.n.value) cur.n = Math.max(cur.n, parseInt(b.n.value, 10) || 0);
    map.set(q, cur);
  }
  const list = Array.from(map.values()).filter((x) => x.inn || x.label);
  for (const x of list) if (!x.inn) x.inn = x.label.toLowerCase();
  list.sort((a, b) => b.n - a.n);
  return list;
}

// ---------- 2) етикети + синоними на 20 езика ----------
const WD_LANGS = ['bg', 'ru', 'uk', 'en', 'de', 'fr', 'es', 'it', 'pt', 'ar', 'hi', 'ja', 'ky', 'zh', 'zh-hans', 'zh-hant', 'zh-tw', 'zh-cn', 'zh-hk', 'la'];
async function labels(items) {
  const out = {}; const B = 150;
  for (let i = 0; i < items.length; i += B) {
    const batch = items.slice(i, i + B);
    const vals = batch.map((x) => 'wd:' + x.q).join(' ');
    const langs = WD_LANGS.map((l) => '"' + l + '"').join(',');
    const rows = await cached('names-' + i + '-' + batch[batch.length - 1].q + '.json', async () => {
      const L = await sparql(`SELECT ?item ?l WHERE { VALUES ?item { ${vals} } ?item rdfs:label ?l . FILTER(lang(?l) IN (${langs})) }`);
      await sleep(300);
      const A = await sparql(`SELECT ?item ?a WHERE { VALUES ?item { ${vals} } ?item skos:altLabel ?a . FILTER(lang(?a) IN (${langs})) }`);
      await sleep(300);
      const D = await sparql(`SELECT ?item ?d WHERE { VALUES ?item { ${vals} } ?item schema:description ?d . FILTER(lang(?d)="en") }`);
      await sleep(300);
      return { L, A, D };
    });
    for (const b of rows.L) { const q = b.item.value.split('/').pop(); const o = out[q] = out[q] || { labels: [], aliases: [], desc: '' }; o.labels.push({ v: b.l.value, lg: b.l['xml:lang'] || '' }); }
    for (const b of rows.A) { const q = b.item.value.split('/').pop(); const o = out[q] = out[q] || { labels: [], aliases: [], desc: '' }; o.aliases.push({ v: b.a.value, lg: b.a['xml:lang'] || '' }); }
    for (const b of rows.D) { const q = b.item.value.split('/').pop(); const o = out[q] = out[q] || { labels: [], aliases: [], desc: '' }; if (!o.desc) o.desc = b.d.value; }
    process.stdout.write(`  етикети ${Math.min(i + B, items.length)}/${items.length}\r`);
  }
  console.log('');
  return out;
}

// ---------- 3) openFDA търговски имена ----------
function fdaBrands() {
  const dir = path.join(CACHE, 'gtin');
  const f = fs.existsSync(dir) && fs.readdirSync(dir).find((x) => /^drug-ndc.*\.json$/.test(x));
  if (!f) { console.log('   (няма кеширан NDC каталог — пусни първо gen-gtin-db.mjs; търговските имена от openFDA се пропускат)'); return []; }
  const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const out = new Map();
  for (const p of j.results || []) {
    if (!/^(HUMAN PRESCRIPTION DRUG|HUMAN OTC DRUG)$/.test(p.product_type || '') || /BULK|FURTHER PROCESSING|HOMEOPATHIC|MEDICAL GAS|ALLERGENIC/i.test(p.marketing_category || '')) continue;
    const br = title(p.brand_name), gen = title(p.generic_name).toLowerCase();
    if (!br || !gen || !okName(br) || key(br) === key(gen)) continue;
    if (!out.has(br)) out.set(br, gen);
  }
  return Array.from(out.entries());
}
// Генерично име от openFDA („Metoprolol Tartrate", „Amoxicillin And Clavulanate Potassium") → INN от списъка:
// цялото → без солта (последна дума) → първата дума (≥6 букви).
function linkGeneric(gen, innIdx) {
  const g = gen.toLowerCase().replace(/\s+/g, ' ').trim();
  const tries = [g];
  const w = g.split(' '); if (w.length > 1) tries.push(w.slice(0, -1).join(' '));
  if (w[0] && w[0].length >= 6) tries.push(w[0]);
  for (const t of tries) { const i = innIdx.get(key(t)); if (i !== undefined) return i; }
  return -1;
}

// ---------- главно ----------
(async () => {
  console.log('1) Wikidata вещества (INN / ATC / DrugBank)…');
  const list = await drugItems();
  console.log('   ' + list.length + ' позиции');
  console.log('2) етикети и синоними (' + WD_LANGS.length + ' езика)…');
  const lab = await labels(list);
  console.log('3) сглобяване…');
  // записи: [inn, n, desc_en] ; имена: [raw, ref]
  const inns = []; const innIdx = new Map(); const names = []; const seen = new Set(); const innEnSet = new Set();
  // names: [raw, ref, src, lg] — src 'inn'|'fda'|'wd'; lg = език на етикета (за не-латиницата)
  const addName = (raw, ref, src, lg) => { raw = title(raw); if (!okName(raw)) return; const k = key(raw); if (!k || k.length < 3 || seen.has(k)) return; seen.add(k); names.push([raw, ref, src || 'wd', lg || '']); };
  for (const x of list) {
    const L = lab[x.q] || { labels: [], aliases: [], desc: '' };
    const desc = /^(chemical compound|medication|drug|pharmaceutical drug|organic compound|chemical substance)$/i.test(L.desc || '') ? '' : String(L.desc || '').replace(/\s+/g, ' ').slice(0, 60);
    const ref = inns.length; inns.push([x.inn, x.n, desc]); if (x.innEn) innEnSet.add(ref);
    innIdx.set(key(x.inn), ref); if (x.label) innIdx.set(key(x.label), ref);
    addName(x.inn, ref, 'inn'); if (x.label) addName(x.label, ref, 'inn');
    // капове по популярност (брой статии): честите лекарства пазят всички изписвания, редките — само основните
    const capL = x.n >= 20 ? 20 : x.n >= 5 ? 10 : 3, capA = x.n >= 20 ? 40 : x.n >= 5 ? 6 : 1;
    let cnt = 0;
    for (const e of L.labels) { if (cnt >= capL) break; const before = names.length; addName(e.v, ref, 'wd', e.lg); if (names.length > before) cnt++; }
    cnt = 0;
    for (const e of L.aliases) { if (cnt >= capA) break; const before = names.length; addName(e.v, ref, 'wd', e.lg); if (names.length > before) cnt++; }
  }
  const wdNames = names.length;
  console.log('   Wikidata: ' + inns.length + ' вещества, ' + wdNames + ' имена');
  console.log('4) openFDA търговски имена…');
  const brands = fdaBrands(); let linked = 0, fresh = 0;
  for (const [br, gen] of brands) {
    const ref = linkGeneric(gen, innIdx);
    // само марки, чието генерично име е познато вещество (без „нови" генерични — там са грешки/билки/храни)
    if (ref < 0) { fresh++; continue; }
    linked++; addName(br, ref, 'fda');
  }
  console.log('   ' + brands.length + ' марки: ' + linked + ' свързани към Wikidata, ' + fresh + ' пропуснати (непознато генерично)');
  // подредба по ключ (за детерминизъм); изходът е компактен: names = масив от низове, refs = паралелен масив
  const build = (nm) => ({ updated: new Date().toISOString().slice(0, 10), source: 'Wikidata (INN P2275 / ATC P267 / DrugBank P715; labels+aliases in 20 languages) + openFDA NDC brand names', count: nm.length, inns, names: nm.map((x) => x[0]), refs: nm.map((x) => x[1]) });
  // Компактност: махаме „неизвестните" вещества (0 статии, без официален INN, без търговско име от openFDA) —
  // те са предимно DrugBank експериментални молекули, които не се срещат на опаковки. Преномерираме записите.
  {
    const hasFda = new Set(names.filter((x) => x[2] === 'fda').map((x) => x[1]));
    const keep = inns.map((r, i) => (r[1] >= 1) || hasFda.has(i) || innEnSet.has(i));
    const map = new Map(); const inns2 = []; inns.forEach((r, i) => { if (keep[i]) { map.set(i, inns2.length); inns2.push(r[1] >= 5 ? r : [r[0], r[1], '']); } });
    const names2 = names.filter((x) => keep[x[1]]).map((x) => [x[0], map.get(x[1]), x[2], x[3]]);
    console.log('   компактност: ' + inns.length + ' → ' + inns2.length + ' вещества, ' + names.length + ' → ' + names2.length + ' имена');
    inns.length = 0; inns.push(...inns2); names.length = 0; names.push(...names2);
  }
  const kb = (j) => Math.round(Buffer.byteLength(j, 'utf8') / 1024);   // таванът е в БАЙТОВЕ (кирилица/CJK са 2–3 байта)
  const tiers = [[60, 8, 2], [40, 6, 2], [30, 4, 1], [20, 3, 1], [12, 2, 1], [8, 1, 1], [4, 1, 0]];
  const trim = (list, [c20, c5, c0]) => { const perRef = new Map(); const out = []; for (const x of list) { if (x[2] !== 'wd') { out.push(x); continue; } const c = perRef.get(x[1]) || 0; const n = inns[x[1]][1]; const cap = n >= 20 ? c20 : n >= 5 ? c5 : c0; if (c < cap) { out.push(x); perRef.set(x[1], c + 1); } } return out; };
  const latin = names.filter((x) => isLatin(x[0])); const nonlat = names.filter((x) => !isLatin(x[0]));
  let lat = latin, json = JSON.stringify(build(lat));
  console.log('5) ' + inns.length + ' записа · латински имена ' + latin.length + ' → ' + kb(json) + ' KB; не-латиница общо ' + nonlat.length);
  for (const t of tiers) { if (kb(json) <= MAX_LAT_KB) break; lat = trim(latin, t); json = JSON.stringify(build(lat)); console.log('   латиница орязана (' + t.join('/') + '): ' + lat.length + ' имена, ' + kb(json) + ' KB'); }
  let chosen = 'A'; let all = lat;
  for (const [tag, langs] of [['A', NONLAT_A], ['B', NONLAT_B]]) {
    const pick = nonlat.filter((x) => langs.includes(x[3]) || (!x[3] && x[2] === 'inn'));
    let cand = lat.concat(pick); let j2 = JSON.stringify(build(cand));
    for (const t of tiers) { if (kb(j2) <= MAX_ALL_KB) break; cand = lat.concat(trim(pick, t)); j2 = JSON.stringify(build(cand)); }
    console.log('   не-латиница набор ' + tag + ' (' + langs.slice(0, 7).join(',') + '): ' + (cand.length - lat.length) + ' имена → общо ' + kb(j2) + ' KB');
    if (kb(j2) <= MAX_ALL_KB) { chosen = tag; all = cand; json = j2; break; }
    chosen = ''; 
  }
  if (!chosen) { console.log('   не-латиницата не се побира → само латински имена'); json = JSON.stringify(build(lat)); }
  else console.log('   избран набор ' + chosen + ': ' + all.length + ' имена, ' + kb(json) + ' KB');
  const fin = JSON.parse(json); const order = fin.names.map((_, i) => i).sort((a, b) => key(fin.names[a]) < key(fin.names[b]) ? -1 : 1);
  fin.names = order.map((i) => fin.names[i]); fin.refs = order.map((i) => fin.refs[i]); json = JSON.stringify(fin);
  for (const t of TREES) { const f = path.join(t, 'public', 'reference', 'drug-names.json'); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, json, 'utf8'); console.log('✓ ' + path.relative(ROOT, f)); }
})().catch((e) => { console.error('✗ ' + (e && e.stack || e)); process.exit(1); });
