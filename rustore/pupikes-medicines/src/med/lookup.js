// Version: 1.0001
// lookup.js — търсене на лекарство: 1) онлайн openFDA (+ уеб), 2) резерв офлайн база;
// после превод на описанието (MyMemory, keyless). На телефон ползва CapacitorHttp (заобикаля
// CORS); в браузър — fetch. БЕЗ AbortController (чупи CapacitorHttp) — таймаут през Promise.race.
import { offlineLookup, findRisky, norm, matchScore } from './data.js';

function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)); }

// GET на JSON, с CapacitorHttp когато е налично, иначе fetch. Връща обект или хвърля.
async function getJson(url) {
  const CH = (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp) || window.CapacitorHttp;
  if (CH && CH.get) {
    const r = await Promise.race([CH.get({ url, headers: { accept: 'application/json' } }), timeout(12000)]);
    const data = r && r.data;
    return typeof data === 'string' ? JSON.parse(data) : data;
  }
  const r = await Promise.race([fetch(url, { headers: { accept: 'application/json' } }), timeout(12000)]);
  if (!r.ok) throw new Error('http ' + r.status);
  return r.json();
}

// Превод на текст en→lang през MyMemory (безплатно, без ключ). Празен/eng target → връща текста.
export async function translate(text, lang) {
  const t = String(text || '').trim();
  if (!t) return '';
  const target = String(lang || 'en').split('-')[0];
  if (target === 'en') return t;
  try {
    // MyMemory има лимит ~500 знака на заявка → режем на части.
    const parts = t.match(/[\s\S]{1,450}(\s|$)/g) || [t];
    const out = [];
    for (const p of parts) {
      const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(p.trim()) + '&langpair=en|' + encodeURIComponent(target);
      const j = await getJson(url);
      out.push((j && j.responseData && j.responseData.translatedText) || p);
    }
    return out.join(' ');
  } catch (_) { return t; }
}

// openFDA: търси етикет на лекарство по име/съставка. Връща нормализиран резултат или null.
async function openFdaLookup(query) {
  const q = encodeURIComponent(String(query).trim());
  const url = 'https://api.fda.gov/drug/label.json?search=' +
    '(openfda.brand_name:"' + q + '"+openfda.generic_name:"' + q + '"+active_ingredient:"' + q + '")&limit=1';
  const j = await getJson(url);
  const r = j && j.results && j.results[0];
  if (!r) return null;
  const ofda = r.openfda || {};
  const first = (a) => Array.isArray(a) && a.length ? a[0] : (a || '');
  const title = first(ofda.brand_name) || first(ofda.generic_name) || String(query);
  const active = [].concat(ofda.substance_name || [], r.active_ingredient || []).map((x) => String(x));
  // ПОТВЪРДИ, че върнатото наистина съответства на заявката (openFDA връща свързани продукти и за
  // общи думи като „oral suspension" → без потвърждение това са фалшиви положителни).
  const names = [first(ofda.brand_name), first(ofda.generic_name)].concat(ofda.substance_name || [], r.active_ingredient || []);
  let best = 0; for (const nm of names) { const s = matchScore(nm, query); if (s > best) best = s; }
  if (!best) return null;
  const description = [first(r.purpose), first(r.indications_and_usage)].filter(Boolean).join(' ').slice(0, 1200)
    || first(r.description) || '';
  const warnings = (first(r.warnings) || '').slice(0, 800);
  return { source: 'openFDA', title, active, description, warnings, exact: best === 2 };
}

// ПЪЛНА ЛИСТОВКА от официалния FDA етикет: структурирани секции (показания, дозировка,
// противопоказания, странични, взаимодействия, съхранение, предупреждения). Английски текст —
// превежда се към избрания език при показване. Работи ОНЛАЙН; офлайн остава краткото описание.
export async function openFdaSections(query) {
  const q = encodeURIComponent(String(query).trim());
  const url = 'https://api.fda.gov/drug/label.json?search=' +
    '(openfda.brand_name:"' + q + '"+openfda.generic_name:"' + q + '"+active_ingredient:"' + q + '")&limit=1';
  const j = await getJson(url);
  const r = j && j.results && j.results[0]; if (!r) return null;
  const ofda = r.openfda || {};
  const first = (a) => Array.isArray(a) && a.length ? String(a[0]) : (a ? String(a) : '');
  // потвърди, че записът наистина е за търсеното (openFDA връща свързани продукти за общи думи)
  const names = [].concat(ofda.brand_name || [], ofda.generic_name || [], ofda.substance_name || [], r.active_ingredient || []);
  let best = 0; for (const nm of names) { const s = matchScore(nm, query); if (s > best) best = s; }
  if (!best) return null;
  const SEC = [
    ['indications', r.indications_and_usage],
    ['dosage', r.dosage_and_administration],
    ['contraindications', r.contraindications],
    ['sideeffects', r.adverse_reactions],
    ['interactions', r.drug_interactions],
    ['storage', r.how_supplied_storage_and_handling || r.storage_and_handling || r.how_supplied],
    ['warnings', r.warnings_and_cautions || r.warnings]
  ];
  const out = [];
  for (const [key, val] of SEC) {
    const t = first(val).replace(/\s+/g, ' ').trim();
    if (t) out.push({ key, text: t.slice(0, 900) });   // таван на секция → четимо + разумен превод
  }
  return out.length ? out : null;
}

// Локален (вграден) многоезичен пакет — събран чрез скрапване (Wikipedia, per език). Чете се
// през обикновен fetch (бъндъл-асет), НЕ CapacitorHttp (той е за абсолютни URL-и).
async function fetchLocal(p) { try { const r = await fetch(p); return r.ok ? await r.json() : null; } catch (_) { return null; } }
async function refLookup(query, lang) {
  const idx = await fetchLocal('reference/index.json'); if (!idx || !idx.items) return null;
  const target = String(lang || 'en').split('-')[0];
  // Първо мини-обхождане на индекса (само id-та) за най-добра оценка; предпочитаме ТОЧНО име.
  let exact = null, partial = null;
  for (const it of idx.items) {
    let best = matchScore(it.id, query);
    if (best === 2) { exact = it; break; }
    if (best === 1 && !partial) partial = it;
  }
  const chosen = exact || partial; if (!chosen) return null;
  const rec = await fetchLocal('reference/' + chosen.id + '.json'); if (!rec || !rec.langs) return null;
  // потвърди по заглавията (ако id е частично, заглавието може да е точно)
  const L = rec.langs[lang] || rec.langs[target] || rec.langs.en || Object.values(rec.langs)[0];
  if (L && L.extract) return { source: 'Wikipedia', title: L.title, active: [], description: L.extract, warnings: '', translated: true, exact: !!exact };
  return null;
}

// Голяма ВГРАДЕНА база (хиляди лекарства, събрани от openFDA) — работи БЕЗ интернет.
// Зарежда се веднъж и се търси по всяко от имената/съставките (двупосочно съвпадение).
let BIG_DB = null;
async function loadBigDb() {
  if (BIG_DB !== null) return BIG_DB;
  const j = await fetchLocal('reference/meds-db.json');
  BIG_DB = (j && j.items) || [];
  return BIG_DB;
}
// Сглобява едно по-плътно описание от наличните полета (за какво е + дозировка).
function bigDbDesc(m) {
  const parts = [];
  if (m.description) parts.push(m.description);
  if (m.usage && (!m.description || !m.description.startsWith(m.usage.slice(0, 40)))) parts.push('Показания: ' + m.usage);
  if (m.dosage) parts.push('Прием: ' + m.dosage);
  return parts.join('\n\n');
}
function bigDbHit(m, exact) {
  return { source: 'offline-db', title: m.title, active: m.active || [], description: bigDbDesc(m), warnings: m.warnings || '', exact: !!exact };
}
// Обхожда ГОЛЯМАТА база (8005 записа, вкл. обскурни/хомеопатични имена) — приема САМО ТОЧНО/почти-точно
// съвпадение (score 2). Свободно частично тук е опасно: къс OCR-шум („hoton") улучва случайни записи
// („Hottonia") = фалшив резултат. Честите лекарства с непълно четене минават през курираните/ref (там е ок).
function scanDb(items, query, hit) {
  if (!norm(query)) return null;
  for (const m of items) {
    for (const nm of (m.names || [])) { if (matchScore(nm, query) === 2) return hit(m, true); }
  }
  return null;
}
async function bigDbLookup(query) {
  const items = await loadBigDb(); if (!items.length) return null;
  return scanDb(items, query, bigDbHit);
}

// ГОЛЯМАТА база живее на СЪРВЕРА (production), разделена по първа буква — апът тегли само нужния
// шард ОНЛАЙН (лек товар), кешира го за сесията. Офлайн ползва компактното вградено ядро.
const MEDIKIT_BASE = 'https://selflearning.bot.nu/medikit';
const SHARD_CACHE = {};
function shardKey(query) { const c = String(query || '').trim()[0]; return c && /[a-zA-Z]/.test(c) ? c.toLowerCase() : '0'; }
async function loadShard(letter) {
  if (SHARD_CACHE[letter] !== undefined) return SHARD_CACHE[letter];
  try { const j = await getJson(`${MEDIKIT_BASE}/meds/${letter}.json`); SHARD_CACHE[letter] = (j && j.items) || []; }
  catch (_) { SHARD_CACHE[letter] = null; }   // няма интернет/шард → маркирай, не пробвай пак
  return SHARD_CACHE[letter];
}
async function remoteDbLookup(query) {
  const items = await loadShard(shardKey(query)); if (!items || !items.length) return null;
  return scanDb(items, query, bigDbHit);
}

// Основно търсене: 1) наш многоезичен пакет, 2) курирани, 3) вградено ядро (офлайн),
// 4) ПЪЛНАТА база от сървъра (онлайн, по буква), 5) openFDA (съвсем редки).
export async function lookupMedicine(query, lang) {
  let res = await refLookup(query, lang);
  // курираните 50+ (локализирани имена + добри описания) са с приоритет за често срещаните
  if (!res) { const off = offlineLookup(query); if (off) { const ex = (off.names || []).some((nm) => matchScore(nm, query) === 2); res = { source: 'offline', title: off.title, active: off.active || [], description: off.description, warnings: '', exact: ex }; } }
  // после компактното вградено ядро (хиляди, офлайн)
  if (!res) { try { res = await bigDbLookup(query); } catch (_) { res = null; } }
  // после ПЪЛНАТА база от production сървъра (онлайн — тегли само шарда за буквата)
  if (!res) { try { res = await remoteDbLookup(query); } catch (_) { res = null; } }
  // накрая онлайн openFDA (за съвсем редки, ако има интернет)
  if (!res) { try { res = await openFdaLookup(query); } catch (_) { res = null; } }
  if (!res) return null;
  const scanText = [res.title, res.description, ...(res.active || [])].join(' ');
  res.risky = findRisky(scanText);
  if (res.translated) { res.descriptionT = res.description; res.warningsT = res.warnings; }
  else { res.descriptionT = await translate(res.description, lang); res.warningsT = res.warnings ? await translate(res.warnings, lang) : ''; }
  // ПЪЛНА ЛИСТОВКА (ОНЛАЙН): независимо кой източник е уловил лекарството, издърпваме
  // структурираните секции от официалния FDA етикет и ги показваме ПРЕВЕДЕНИ на избрания език
  // (показания, дозировка, противопоказания, странични, взаимодействия, съхранение). Офлайн/при
  // липса на съвпадение — тихо се пропуска и остава краткото описание.
  try {
    const secs = await openFdaSections(res.title || query);
    if (secs && secs.length) {
      const outT = [];
      for (const s of secs) { try { outT.push({ key: s.key, text: await translate(s.text, lang) }); } catch (_) { outT.push(s); } }
      res.sections = outT;
    }
  } catch (_) { /* без интернет/съвпадение → само краткото */ }
  return res;
}
