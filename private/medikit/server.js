// Version: 1.0000
// Pupikes Medikit — обща сървърна база за Pupikes Medicines / Pupikes Doctor (11.09.2026).
//
// ЗАЩО: апът носи основни данни (580 лекарства / 25 състояния), тегли повече онлайн и — при СЪГЛАСИЕ на
// потребителя (opt-in) — ИЗПРАЩА наученото тук, така че базата на сървъра РАСТЕ и всички апове я ползват.
//
// Маршрути (nginx: location ^~ /api/medikit/ → 127.0.0.1:3015):
//   GET  /api/medikit/health                            → {ok, service, ...}
//   GET  /api/medikit/drug?q=<име>|gtin=<код>&lang=xx   → {found, inn, brand, ingredients, form, indications?, links, source}
//        ред: учена база (gtin/име) → статичните шардове (public/medikit/meds) → кеш → openFDA (label/ndc) + Wikidata;
//        резултатът се кешира на диск (data/cache-drug.jsonl) → базата расте.
//   GET  /api/medikit/condition?name=<en>&lang=xx       → {found, title, summary?, links, source} (Wikipedia REST summary, кеширано)
//   POST /api/medikit/learn  (JSON ≤ maxItemBytes)      → {ok, kind, key, n}  — {kind:'gtin'|'name'|'image', gtin?, name?, inn?, lang?,
//        sig? (base64 ≤ 8 KB), label?, app:'medicines'|'doctor'} — валидира, дедуплицира, брои потвърждения; image само от Doctor.
//   GET  /api/medikit/updates?since=<ms>&kind=&min=     → {ts, items:[...], more} — делта на наученото; апите я сливат локално.
//   GET  /api/medikit/stats                             → броячи + размер на склада + лимити.
//
// ДИСК: data/learned-<kind>.jsonl (append-only; последният ред за ключ печели; периодично се компактира до 1 ред/ключ),
//       data/cache-drug.jsonl, data/cache-condition.jsonl (кеш на външните справки). ВСИЧКО анонимно — IP се ползва САМО
//       в паметта за лимити и НИКОГА не се записва. Няма БД, няма зависимости (Node 18+ stdlib: http/fs/crypto + fetch).
//
// ЛИМИТИ (config.json до server.js; сменят се с 27-setup-medikit-server.sh --limit …): maxStoreBytes (общо data/, по
// подразбиране 2 GB), maxItemBytes (64 KB), maxPerIpPerDay (500 записа), maxImageSigs (200 000), pruneWhenFull (LRU по
// потвърждения — само ако е включено). При пълен склад: POST /learn → 507 + честно съобщение, четенето остава. При ≥ 90%:
// предупреждение в лога + в /stats.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const APP_DIR = __dirname;
const DATA_DIR = process.env.MEDIKIT_DATA || path.join(APP_DIR, 'data');
const CONFIG_FILE = process.env.MEDIKIT_CONFIG || path.join(APP_DIR, 'config.json');
// Статичните шардове (public/medikit/meds/<буква>.json) — същите, които nginx сервира като /medikit/.
const SHARDS_DIR = process.env.MEDIKIT_SHARDS || path.join(APP_DIR, '..', '..', 'public', 'medikit', 'meds');
const PORT = parseInt(process.env.MEDIKIT_PORT || process.env.PORT || '3015', 10);

const DEFAULTS = {
  maxStoreBytes: 2 * 1024 * 1024 * 1024,   // 2 GB общо за data/
  maxItemBytes: 64 * 1024,                 // тяло на POST /learn
  maxSigBytes: 8 * 1024,                   // base64 отпечатък
  maxPerIpPerDay: 500,                     // записа /learn на IP за ден (в паметта)
  maxImageSigs: 200000,                    // таван на научените отпечатъци
  pruneWhenFull: false,                    // при пълен склад: режи най-слабо потвърдените (LRU по n)
  warnAtPercent: 90,
  rlDrugPerMin: 60, rlLearnPerMin: 20,
  upstreamTimeoutMs: 8000,
  negativeCacheDays: 7                      // „не е намерено" се преопитва след толкова дни
};
let CFG = Object.assign({}, DEFAULTS);
function loadConfig() {
  try { const j = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); CFG = Object.assign({}, DEFAULTS, j || {}); }
  catch (_) { CFG = Object.assign({}, DEFAULTS); }
  for (const k of Object.keys(DEFAULTS)) if (typeof DEFAULTS[k] === 'number' && !(Number(CFG[k]) > 0)) CFG[k] = DEFAULTS[k];
  return CFG;
}
loadConfig();
process.on('SIGHUP', () => { loadConfig(); log('config reloaded', JSON.stringify(CFG)); });

function log() { console.log('[medikit]', new Date().toISOString(), ...arguments); }
function warn() { console.error('[medikit] !', new Date().toISOString(), ...arguments); }

// ─── Склад на диска ────────────────────────────────────────────────────────────────────────────
fs.mkdirSync(DATA_DIR, { recursive: true });
const FILES = {
  gtin: path.join(DATA_DIR, 'learned-gtin.jsonl'),
  name: path.join(DATA_DIR, 'learned-name.jsonl'),
  image: path.join(DATA_DIR, 'learned-image.jsonl'),
  drug: path.join(DATA_DIR, 'cache-drug.jsonl'),
  condition: path.join(DATA_DIR, 'cache-condition.jsonl')
};
const STORE = { gtin: new Map(), name: new Map(), image: new Map(), drug: new Map(), condition: new Map() };
const LINES = { gtin: 0, name: 0, image: 0, drug: 0, condition: 0 };   // редове във файла (за компактиране)
let storeBytes = 0, storeFull = false, storeWarned = 0;

function loadFile(kind) {
  const f = FILES[kind]; if (!fs.existsSync(f)) return;
  const txt = fs.readFileSync(f, 'utf8'); let n = 0;
  for (const line of txt.split('\n')) {
    if (!line.trim()) continue; n++;
    try { const o = JSON.parse(line); if (o && o.key) { if (o.del) STORE[kind].delete(o.key); else STORE[kind].set(o.key, o); } } catch (_) {}
  }
  LINES[kind] = n;
}
function measureStore() {
  let total = 0;
  try { for (const fn of fs.readdirSync(DATA_DIR)) { try { total += fs.statSync(path.join(DATA_DIR, fn)).size; } catch (_) {} } } catch (_) {}
  storeBytes = total; checkStore(); return total;
}
function checkStore() {
  const pct = CFG.maxStoreBytes ? (storeBytes / CFG.maxStoreBytes) * 100 : 0;
  const wasFull = storeFull;
  storeFull = storeBytes >= CFG.maxStoreBytes;
  if (storeFull && !wasFull) warn('STORE FULL: ' + fmtBytes(storeBytes) + ' >= ' + fmtBytes(CFG.maxStoreBytes) + ' → POST /learn спрян (507); четенето работи' + (CFG.pruneWhenFull ? '; pruneWhenFull=true → режа' : ''));
  if (pct >= CFG.warnAtPercent && Date.now() - storeWarned > 3600000) { storeWarned = Date.now(); warn('склад ' + pct.toFixed(1) + '% (' + fmtBytes(storeBytes) + ' / ' + fmtBytes(CFG.maxStoreBytes) + ')'); }
  if (storeFull && CFG.pruneWhenFull) pruneStore();
  return pct;
}
function fmtBytes(b) { b = Number(b) || 0; if (b >= 1073741824) return (b / 1073741824).toFixed(2) + ' GB'; if (b >= 1048576) return (b / 1048576).toFixed(1) + ' MB'; if (b >= 1024) return (b / 1024).toFixed(1) + ' KB'; return b + ' B'; }
function appendLine(kind, obj) {
  const line = JSON.stringify(obj) + '\n';
  fs.appendFileSync(FILES[kind], line);
  storeBytes += Buffer.byteLength(line); LINES[kind]++;
  checkStore();
  if (LINES[kind] > 5000 && LINES[kind] > STORE[kind].size * 2) compact(kind);   // логът е 2× по-дълъг от индекса → компактирай
}
function compact(kind) {   // пренаписва файла като 1 ред/ключ (компактен индекс) — append-only логът вече не расте излишно
  const tmp = FILES[kind] + '.tmp';
  const out = []; for (const o of STORE[kind].values()) out.push(JSON.stringify(o));
  fs.writeFileSync(tmp, out.length ? out.join('\n') + '\n' : '');
  fs.renameSync(tmp, FILES[kind]); LINES[kind] = out.length;
  measureStore(); log('compact', kind, out.length, 'записа', fmtBytes(storeBytes));
}
// LRU по потвърждения: режи най-слабо потвърдените/най-стари записи, докато складът падне под 80% (само pruneWhenFull).
let pruning = false;
function pruneStore() {
  if (pruning) return; pruning = true;
  try {
    const target = CFG.maxStoreBytes * 0.8;
    // 1) кешовете на външни справки са възстановими → първо тях (най-старите)
    for (const kind of ['drug', 'condition', 'image', 'name', 'gtin']) {
      if (storeBytes <= target) break;
      const arr = Array.from(STORE[kind].values()).sort((a, b) => ((a.n | 0) - (b.n | 0)) || ((a.upd || a.ts || 0) - (b.upd || b.ts || 0)));
      const est = STORE[kind].size ? (fs.existsSync(FILES[kind]) ? fs.statSync(FILES[kind]).size : 0) / Math.max(1, LINES[kind]) : 0;
      let removed = 0;
      for (const o of arr) { if (storeBytes - removed * est <= target) break; STORE[kind].delete(o.key); removed++; }
      if (removed) { compact(kind); warn('prune', kind, removed, 'записа орязани'); }
    }
  } finally { pruning = false; }
}
for (const k of Object.keys(FILES)) loadFile(k);
measureStore();
setInterval(measureStore, 60000).unref();
log('склад:', Object.keys(STORE).map((k) => k + '=' + STORE[k].size).join(' '), fmtBytes(storeBytes) + ' / ' + fmtBytes(CFG.maxStoreBytes));

// ─── Помощни ───────────────────────────────────────────────────────────────────────────────────
const STATS = { started: Date.now(), req: 0, drug: 0, drugHit: 0, drugUpstream: 0, condition: 0, conditionHit: 0, learn: 0, learnNew: 0, learnConfirm: 0, learnRejected: 0, learnFull: 0, updates: 0, limited: 0 };
const rl = new Map();       // ip → { at, n }   (само в паметта)
const rlLearn = new Map();
const rlDay = new Map();    // ip → { day, n }
const seenIpItem = new Map(); // sha1(ip|key) → ts  (същият телефон потвърждава 1 път/ден)
function limited(map, ip, max) {
  const now = Date.now(); let e = map.get(ip);
  if (!e || now - e.at > 60000) { e = { at: now, n: 0 }; map.set(ip, e); }
  e.n++; if (e.n > max) { STATS.limited++; return true; } return false;
}
function dayLimited(ip) {
  const day = Math.floor(Date.now() / 86400000); let e = rlDay.get(ip);
  if (!e || e.day !== day) { e = { day, n: 0 }; rlDay.set(ip, e); }
  e.n++; return e.n > CFG.maxPerIpPerDay;
}
setInterval(() => {
  const now = Date.now();
  for (const m of [rl, rlLearn]) for (const [k, v] of m) if (now - v.at > 120000) m.delete(k);
  for (const [k, v] of seenIpItem) if (now - v > 86400000) seenIpItem.delete(k);
  if (rlDay.size > 100000) rlDay.clear();
}, 60000).unref();

function send(res, status, type, body, extra) {
  res.writeHead(status, Object.assign({ 'Content-Type': type, 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }, extra || {}));
  res.end(body);
}
function json(res, status, obj) { send(res, status, 'application/json; charset=utf-8', JSON.stringify(obj)); }
function clientIp(req) { return (req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim(); }
function norm(s) { return String(s || '').toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); }
function langOf(s) { const m = /^([a-z]{2})(?:-[a-z]{2})?$/i.exec(String(s || '').trim()); return m ? m[1].toLowerCase() : 'en'; }
function cleanText(s, max) { return String(s || '').replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max); }
// „Лични данни" пазач: имена/етикети с имейл, телефон или дълги числа не са лекарства → отказ.
function looksPersonal(s) { return /@|https?:\/\/|\+?\d[\d\s\-()]{6,}\d/.test(String(s || '')); }
function readBody(req, max) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > max) { reject(new Error('too large')); req.destroy(); return; } chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
async function getJson(url, accept) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), CFG.upstreamTimeoutMs);
  try {
    const r = await fetch(url, { signal: ctl.signal, redirect: 'follow', headers: { 'User-Agent': 'PupikesMedikit/1.0 (https://pupikes.app; contact via site)', 'Accept': accept || 'application/json', 'Accept-Language': 'en' } });
    if (!r.ok) return null;
    return await r.json();
  } catch (_) { return null; } finally { clearTimeout(t); }
}
function wikiUrl(lang, title) { return 'https://' + lang + '.wikipedia.org/wiki/' + encodeURIComponent(String(title).replace(/ /g, '_')); }
function first(a) { return Array.isArray(a) ? (a.length ? String(a[0]) : '') : (a ? String(a) : ''); }
function uniq(arr) { const s = new Set(); const out = []; for (const x of arr) { const k = norm(x); if (k && !s.has(k)) { s.add(k); out.push(String(x).trim()); } } return out; }

// ─── Статични шардове (същите като /medikit/meds/<буква>.json) — ленив кеш в паметта ───────────
const SHARD = new Map();
function shard(letter) {
  if (SHARD.has(letter)) return SHARD.get(letter);
  let items = [];
  try { const j = JSON.parse(fs.readFileSync(path.join(SHARDS_DIR, letter + '.json'), 'utf8')); items = (j && j.items) || []; } catch (_) {}
  const slim = items.map((it) => ({ names: (it.names || []).map((x) => norm(x)), title: it.title || '', active: it.active || [], usage: (it.usage || it.description || '').slice(0, 400) }));
  SHARD.set(letter, slim); return slim;
}
function shardLookup(q) {
  const nq = norm(q); if (!nq) return null;
  const letter = /^[a-z]/.test(nq) ? nq[0] : (/^\d/.test(nq) ? '0' : null); if (!letter) return null;
  let best = null, bestScore = 0;
  for (const it of shard(letter)) {
    let s = 0;
    for (const n of it.names) { if (n === nq) { s = 3; break; } if (n.startsWith(nq + ' ') || nq.startsWith(n + ' ')) s = Math.max(s, 2); else if (n.includes(nq)) s = Math.max(s, 1); }
    if (s > bestScore) { bestScore = s; best = it; if (s === 3) break; }
  }
  return bestScore >= 2 ? best : null;
}

// ─── Външни справки ────────────────────────────────────────────────────────────────────────────
async function openFdaLabel(q) {
  if (!/^[\x20-\x7e]+$/.test(q)) return null;   // англоезична база; нелатинско → 400
  const e = encodeURIComponent(q);
  const j = await getJson('https://api.fda.gov/drug/label.json?search=(openfda.brand_name:"' + e + '"+OR+openfda.generic_name:"' + e + '"+OR+active_ingredient:"' + e + '")&limit=1');
  const r = j && j.results && j.results[0]; if (!r) return null;
  const o = r.openfda || {};
  const names = [].concat(o.brand_name || [], o.generic_name || [], o.substance_name || [], r.active_ingredient || []).map(norm);
  const nq = norm(q); if (!names.some((n) => n === nq || n.includes(nq) || nq.includes(n))) return null;   // пази от фалшиви съвпадения
  return {
    inn: first(o.generic_name), brand: first(o.brand_name),
    // съставки: openfda.substance_name (чисти INN); резерв — текстът active_ingredient („Active ingredient: Ibuprofen 200 mg") → само името
    ingredients: uniq((o.substance_name && o.substance_name.length) ? o.substance_name.map((x) => String(x).toLowerCase())
      : (r.active_ingredient || []).map((x) => String(x).replace(/^\s*active ingredients?\s*(\([^)]*\))?\s*:?\s*/i, '').replace(/\s*\(.*$/, '').replace(/\s+\d.*$/, '').toLowerCase())).slice(0, 8),
    form: first(o.route) ? first(o.route).toLowerCase() : '',
    indications: cleanText(first(r.purpose) || first(r.indications_and_usage), 600),
    setid: first(r.set_id)
  };
}
async function openFdaNdcByUpc(gtin) {
  const cands = uniq([gtin, gtin.replace(/^0+/, ''), gtin.length === 13 && gtin[0] === '0' ? gtin.slice(1) : '']).filter(Boolean);
  for (const c of cands) {
    const j = await getJson('https://api.fda.gov/drug/ndc.json?search=openfda.upc:"' + encodeURIComponent(c) + '"&limit=1');
    const r = j && j.results && j.results[0]; if (!r) continue;
    return { inn: r.generic_name || '', brand: r.brand_name || '', form: (r.dosage_form || '').toLowerCase(), ingredients: uniq((r.active_ingredients || []).map((a) => String(a.name || '').toLowerCase())).slice(0, 8), ndc: r.product_ndc || '' };
  }
  return null;
}
async function wikidataDrug(q, lang) {
  const s = await getJson('https://www.wikidata.org/w/api.php?action=wbsearchentities&search=' + encodeURIComponent(q) + '&language=en&type=item&limit=5&format=json');
  const hits = (s && s.search) || []; if (!hits.length) return null;
  const pick = hits.find((h) => /medic|drug|pharma|chemical compound|antibiotic|vaccine|analgesic/i.test(h.description || '')) || hits[0];
  const langs = uniq(['en', lang]).join('|'), sites = uniq(['enwiki', lang + 'wiki']).join('|');
  const e = await getJson('https://www.wikidata.org/w/api.php?action=wbgetentities&ids=' + pick.id + '&props=labels|descriptions|sitelinks&languages=' + langs + '&sitefilter=' + sites + '&format=json');
  const ent = e && e.entities && e.entities[pick.id]; if (!ent) return null;
  const lab = (ent.labels || {}); const sl = (ent.sitelinks || {});
  return {
    qid: pick.id, labelEn: (lab.en && lab.en.value) || pick.label || '', label: (lab[lang] && lab[lang].value) || '',
    description: (ent.descriptions && ent.descriptions[lang] && ent.descriptions[lang].value) || (ent.descriptions && ent.descriptions.en && ent.descriptions.en.value) || '',
    wikiEn: sl.enwiki && sl.enwiki.title, wikiLang: sl[lang + 'wiki'] && sl[lang + 'wiki'].title
  };
}
function drugLinks(r, lang, q) {
  const links = [];
  if (r.wikiLang && lang !== 'en') links.push({ title: 'Wikipedia (' + lang + '): ' + r.wikiLang, url: wikiUrl(lang, r.wikiLang) });
  if (r.wikiEn) links.push({ title: 'Wikipedia: ' + r.wikiEn, url: wikiUrl('en', r.wikiEn) });
  if (r.setid) links.push({ title: 'DailyMed (FDA label)', url: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=' + encodeURIComponent(r.setid) });
  else if (r.inn || r.brand) links.push({ title: 'DailyMed search', url: 'https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=' + encodeURIComponent(r.inn || r.brand) });
  if (r.qid) links.push({ title: 'Wikidata ' + r.qid, url: 'https://www.wikidata.org/wiki/' + r.qid });
  if (!links.length && q) links.push({ title: 'Wikipedia search', url: 'https://' + lang + '.wikipedia.org/w/index.php?search=' + encodeURIComponent(q) });
  return links;
}

// ─── Справка за лекарство ──────────────────────────────────────────────────────────────────────
async function drugLookup(q, gtin, lang) {
  const key = (gtin ? 'g:' + gtin : 'q:' + norm(q)) + '|' + lang;
  const c = STORE.drug.get(key);
  if (c && (c.found || Date.now() - (c.ts || 0) < CFG.negativeCacheDays * 86400000)) { STATS.drugHit++; return Object.assign({}, c.v, { source: c.v.source + '+cache' }); }
  const out = { found: false, inn: '', brand: '', ingredients: [], form: '', indications: '', name: '', links: [], source: '' };
  const src = [];
  // 1) учена база
  if (gtin) {
    const L = STORE.gtin.get(gtin);
    if (L) { out.found = true; out.inn = L.inn || ''; out.brand = L.name || ''; out.name = L.name || L.inn || ''; src.push('learned'); q = q || L.inn || L.name; }
  }
  if (q && !out.inn) {
    // учено име: първо на езика на заявката, после en, после на който и да е език (търговското име е същото)
    let L = STORE.name.get(norm(q) + '|' + lang) || STORE.name.get(norm(q) + '|en');
    if (!L) { const pre = norm(q) + '|'; for (const [k, v] of STORE.name) if (k.startsWith(pre)) { L = v; break; } }
    if (L) { out.found = true; out.inn = L.inn || ''; out.brand = out.brand || L.name || ''; src.push('learned'); }
  }
  // 2) статични шардове (локалната база)
  if (q) {
    const S = shardLookup(q);
    if (S) { out.found = true; out.name = out.name || S.title; out.ingredients = uniq(out.ingredients.concat(S.active)).slice(0, 8); out.inn = out.inn || (S.active[0] || ''); out.indications = out.indications || S.usage; src.push('shards'); }
  }
  // 3) външни (паралелно, ограничени по време): openFDA + Wikidata
  STATS.drugUpstream++;
  const jobs = [];
  if (gtin) jobs.push(openFdaNdcByUpc(gtin).then((r) => ['ndc', r]));
  if (q) jobs.push(openFdaLabel(q).then((r) => ['label', r]));
  let first2 = await Promise.allSettled(jobs);
  for (const p of first2) {
    if (p.status !== 'fulfilled' || !p.value[1]) continue;
    const r = p.value[1]; out.found = true; src.push(p.value[0] === 'ndc' ? 'openFDA-ndc' : 'openFDA');
    out.inn = out.inn || r.inn; out.brand = out.brand || r.brand; out.form = out.form || r.form;
    out.ingredients = uniq(out.ingredients.concat(r.ingredients || [])).slice(0, 8);
    out.indications = out.indications || r.indications || ''; if (r.setid) out.setid = r.setid;
    if (!q) q = r.inn || r.brand;
  }
  let wd = null;
  const wq = out.inn || q;
  if (wq) { wd = await wikidataDrug(wq.split(/[,;\/]/)[0].trim(), lang); if (wd) { src.push('wikidata'); out.found = true; if (wd.label) out.label = wd.label; if (!out.name) out.name = wd.labelEn; if (!out.indications && wd.description) out.description = wd.description; } }
  out.name = out.name || out.brand || out.inn || (wd && wd.labelEn) || '';
  out.links = drugLinks(Object.assign({}, out, wd || {}), lang, out.name || q);
  out.source = src.length ? uniq(src).join('+') : 'none';
  if (out.setid) delete out.setid;
  STORE.drug.set(key, { key, ts: Date.now(), found: out.found, v: out });
  appendLine('drug', STORE.drug.get(key));
  return out;
}

// ─── Справка за състояние (Wikipedia REST summary на езика) ────────────────────────────────────
async function conditionLookup(name, lang) {
  const key = norm(name) + '|' + lang;
  const c = STORE.condition.get(key);
  if (c && (c.found || Date.now() - (c.ts || 0) < CFG.negativeCacheDays * 86400000)) { STATS.conditionHit++; return Object.assign({}, c.v, { source: c.v.source + '+cache' }); }
  const out = { found: false, title: '', summary: '', lang: 'en', links: [], source: 'none' };
  let title = name, tlang = 'en';
  // английско име → заглавие на езика през langlinks (следва пренасочвания)
  const ll = await getJson('https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&titles=' + encodeURIComponent(name) + (lang !== 'en' ? '&lllang=' + lang : '') + '&redirects=1&format=json');
  const pages = ll && ll.query && ll.query.pages ? Object.values(ll.query.pages) : [];
  const pg = pages[0];
  if (pg && pg.title && !('missing' in pg)) {
    title = pg.title;
    if (lang !== 'en' && pg.langlinks && pg.langlinks[0] && pg.langlinks[0]['*']) { title = pg.langlinks[0]['*']; tlang = lang; }
  }
  const sum = await getJson('https://' + tlang + '.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(String(title).replace(/ /g, '_')));
  if (sum && sum.extract) {
    out.found = true; out.title = sum.title || title; out.summary = cleanText(sum.extract, 1200); out.lang = tlang; out.source = 'wikipedia';
    out.links.push({ title: 'Wikipedia (' + tlang + '): ' + out.title, url: (sum.content_urls && sum.content_urls.desktop && sum.content_urls.desktop.page) || wikiUrl(tlang, out.title) });
    if (tlang !== 'en' && pg && pg.title) out.links.push({ title: 'Wikipedia: ' + pg.title, url: wikiUrl('en', pg.title) });
  } else {
    out.links.push({ title: 'Wikipedia search', url: 'https://' + lang + '.wikipedia.org/w/index.php?search=' + encodeURIComponent(name) });
  }
  STORE.condition.set(key, { key, ts: Date.now(), found: out.found, v: out });
  appendLine('condition', STORE.condition.get(key));
  return out;
}

// ─── Учене (POST /learn) ───────────────────────────────────────────────────────────────────────
function validateLearn(b) {
  if (!b || typeof b !== 'object') return { err: 'bad json' };
  const kind = String(b.kind || ''); if (!['gtin', 'name', 'image'].includes(kind)) return { err: 'kind must be gtin|name|image' };
  const app = String(b.app || 'medicines').toLowerCase(); if (!['medicines', 'doctor'].includes(app)) return { err: 'app must be medicines|doctor' };
  const lang = langOf(b.lang);
  const name = cleanText(b.name, 120), inn = cleanText(b.inn, 120), label = cleanText(b.label, 80).toLowerCase();
  if (looksPersonal(name) || looksPersonal(inn) || looksPersonal(label)) return { err: 'rejected: looks like personal data' };
  if ((name && !norm(name)) || (inn && !norm(inn)) || (label && !norm(label))) return { err: 'rejected: name/inn/label has no letters (send UTF-8)' };
  if (kind === 'gtin') {
    const gtin = String(b.gtin || '').replace(/\D/g, ''); if (gtin.length < 8 || gtin.length > 14) return { err: 'gtin must be 8-14 digits' };
    if (!name && !inn) return { err: 'gtin needs name or inn' };
    return { kind, key: gtin, item: { key: gtin, kind, gtin, name, inn, lang } };
  }
  if (kind === 'name') {
    if (name.length < 2 || inn.length < 2) return { err: 'name needs name + inn' };
    return { kind, key: norm(name) + '|' + lang, item: { key: norm(name) + '|' + lang, kind, name, inn, lang } };
  }
  // image — САМО Pupikes Doctor (отпечатък + етикет на състояние); същият формат като reference/image-signatures.json {l,v}
  if (app !== 'doctor') return { err: 'image signatures accepted only from doctor' };
  const sig = String(b.sig || ''); if (!sig || sig.length > CFG.maxSigBytes || !/^[A-Za-z0-9+/=]+$/.test(sig)) return { err: 'sig must be base64 <= ' + CFG.maxSigBytes };
  const bytes = Buffer.from(sig, 'base64'); if (bytes.length < 64 || bytes.length > 4096) return { err: 'sig decoded size must be 64..4096 bytes' };
  if (label.length < 2) return { err: 'image needs label' };
  const h = crypto.createHash('sha1').update(bytes).update('|').update(label).digest('hex').slice(0, 24);
  return { kind, key: h, item: { key: h, kind, label, dim: bytes.length, v: bytes.toString('base64') } };
}
function learn(v, ip) {
  const now = Date.now();
  const map = STORE[v.kind];
  const ipKey = crypto.createHash('sha1').update(ip + '|' + v.kind + '|' + v.key).digest('hex');
  const dup = seenIpItem.has(ipKey); seenIpItem.set(ipKey, now);
  let it = map.get(v.key);
  if (it) {
    if (!dup) { it.n = (it.n | 0) + 1; it.upd = now; STATS.learnConfirm++; }
    for (const f of ['name', 'inn', 'label']) if (!it[f] && v.item[f]) it[f] = v.item[f];
    if (!dup) appendLine(v.kind, it);
    return { ok: true, kind: v.kind, key: v.key, n: it.n, isNew: false, dup };
  }
  if (v.kind === 'image' && map.size >= CFG.maxImageSigs) return { ok: false, status: 507, error: 'image store full (' + CFG.maxImageSigs + ')' };
  it = Object.assign({ n: 1, ts: now, upd: now }, v.item);
  map.set(v.key, it); appendLine(v.kind, it); STATS.learnNew++;
  return { ok: true, kind: v.kind, key: v.key, n: 1, isNew: true, dup: false };
}

// ─── Делта (GET /updates) ──────────────────────────────────────────────────────────────────────
function updates(since, kinds, min, limit) {
  const items = [];
  for (const kind of kinds) for (const it of STORE[kind].values()) if ((it.upd || it.ts || 0) > since && (it.n | 0) >= min) items.push(it);
  items.sort((a, b) => (a.upd || a.ts) - (b.upd || b.ts));
  const more = items.length > limit;
  const slice = items.slice(0, limit).map((it) => {
    const o = { kind: it.kind, key: it.key, n: it.n | 0, ts: it.upd || it.ts };
    if (it.kind === 'image') { o.l = it.label; o.v = it.v; o.dim = it.dim; } else { o.gtin = it.gtin; o.name = it.name; o.inn = it.inn; o.lang = it.lang; }
    return o;
  });
  return { ts: Date.now(), since, count: slice.length, more, next: more ? slice[slice.length - 1].ts : null, items: slice };
}

function stats() {
  const pct = CFG.maxStoreBytes ? Math.round((storeBytes / CFG.maxStoreBytes) * 1000) / 10 : 0;
  return {
    ok: true, service: 'pupikes-medikit', uptimeSec: Math.round((Date.now() - STATS.started) / 1000),
    learned: { gtin: STORE.gtin.size, name: STORE.name.size, image: STORE.image.size },
    cache: { drug: STORE.drug.size, condition: STORE.condition.size },
    store: { bytes: storeBytes, human: fmtBytes(storeBytes), limitBytes: CFG.maxStoreBytes, limitHuman: fmtBytes(CFG.maxStoreBytes), percent: pct, full: storeFull, warning: pct >= CFG.warnAtPercent, pruneWhenFull: !!CFG.pruneWhenFull, dataDir: DATA_DIR },
    limits: { maxItemBytes: CFG.maxItemBytes, maxSigBytes: CFG.maxSigBytes, maxPerIpPerDay: CFG.maxPerIpPerDay, maxImageSigs: CFG.maxImageSigs, rlDrugPerMin: CFG.rlDrugPerMin, rlLearnPerMin: CFG.rlLearnPerMin, upstreamTimeoutMs: CFG.upstreamTimeoutMs },
    counters: STATS, shardsDir: fs.existsSync(SHARDS_DIR) ? SHARDS_DIR : null
  };
}

// ─── HTTP ──────────────────────────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  STATS.req++;
  const u = new URL(req.url, 'http://x');
  const p = u.pathname.replace(/\/+$/, '').replace(/^\/api\/medikit/, '') || '/';
  if (req.method === 'OPTIONS') return send(res, 204, 'text/plain', '', { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Accept, Content-Type' });
  const ip = clientIp(req);
  try {
    if (p === '/health') return json(res, 200, { ok: true, service: 'pupikes-medikit', version: '1.0000', learned: STORE.gtin.size + STORE.name.size + STORE.image.size, store: fmtBytes(storeBytes) + ' / ' + fmtBytes(CFG.maxStoreBytes), full: storeFull });
    if (p === '/stats') return json(res, 200, stats());
    if (p === '/drug' || p === '/condition' || p === '/updates') {
      if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'GET only' });
      if (limited(rl, ip, CFG.rlDrugPerMin)) return json(res, 429, { ok: false, error: 'rate limited' });
      const lang = langOf(u.searchParams.get('lang'));
      if (p === '/drug') {
        STATS.drug++;
        const q = cleanText(u.searchParams.get('q'), 120), gtin = String(u.searchParams.get('gtin') || '').replace(/\D/g, '');
        if (!q && !gtin) return json(res, 400, { ok: false, error: 'q or gtin required' });
        if (gtin && (gtin.length < 8 || gtin.length > 14)) return json(res, 400, { ok: false, error: 'gtin must be 8-14 digits' });
        const r = await drugLookup(q, gtin, lang);
        return json(res, 200, Object.assign({ ok: true, q: q || undefined, gtin: gtin || undefined, lang }, r));
      }
      if (p === '/condition') {
        STATS.condition++;
        const name = cleanText(u.searchParams.get('name'), 120); if (name.length < 2) return json(res, 400, { ok: false, error: 'name required' });
        const r = await conditionLookup(name, lang);
        return json(res, 200, Object.assign({ ok: true, name, lang }, r));
      }
      STATS.updates++;
      const since = Math.max(0, parseInt(u.searchParams.get('since') || '0', 10) || 0);
      const kq = String(u.searchParams.get('kind') || '').split(',').map((s) => s.trim()).filter((s) => ['gtin', 'name', 'image'].includes(s));
      const kinds = kq.length ? kq : ['gtin', 'name', 'image'];
      const min = Math.max(1, parseInt(u.searchParams.get('min') || '1', 10) || 1);
      const limit = Math.min(2000, Math.max(1, parseInt(u.searchParams.get('limit') || '500', 10) || 500));
      return json(res, 200, Object.assign({ ok: true, kinds }, updates(since, kinds, min, limit)));
    }
    if (p === '/learn') {
      if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'POST only' });
      STATS.learn++;
      if (limited(rlLearn, ip, CFG.rlLearnPerMin)) return json(res, 429, { ok: false, error: 'rate limited' });
      if (storeFull && !CFG.pruneWhenFull) { STATS.learnFull++; return json(res, 507, { ok: false, error: 'store full', message: 'Сървърната база е достигнала лимита си (' + fmtBytes(CFG.maxStoreBytes) + '). Ученето временно не се приема; справките работят.', store: fmtBytes(storeBytes) }); }
      if (dayLimited(ip)) { STATS.learnRejected++; return json(res, 429, { ok: false, error: 'daily limit ' + CFG.maxPerIpPerDay }); }
      let body;
      try { body = JSON.parse(await readBody(req, CFG.maxItemBytes)); } catch (e) { STATS.learnRejected++; return json(res, (e && e.message === 'too large') ? 413 : 400, { ok: false, error: (e && e.message === 'too large') ? 'body > ' + CFG.maxItemBytes : 'bad json' }); }
      const v = validateLearn(body);
      if (v.err) { STATS.learnRejected++; return json(res, 400, { ok: false, error: v.err }); }
      const r = learn(v, ip);
      if (!r.ok) { STATS.learnFull++; return json(res, r.status || 507, r); }
      return json(res, 200, r);
    }
    return json(res, 404, { ok: false, error: 'not found' });
  } catch (e) {
    warn('handler', p, e && e.message || e);
    return json(res, 500, { ok: false, error: 'internal' });
  }
});
server.listen(PORT, '127.0.0.1', () => log('listening on 127.0.0.1:' + PORT, 'data=' + DATA_DIR, 'shards=' + (fs.existsSync(SHARDS_DIR) ? 'ok' : 'missing')));
function shutdown() { try { for (const k of ['gtin', 'name', 'image']) if (LINES[k] > STORE[k].size) compact(k); } catch (_) {} process.exit(0); }
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
process.on('unhandledRejection', (r) => warn('unhandledRejection', r));
process.on('uncaughtException', (e) => warn('uncaughtException', e));
