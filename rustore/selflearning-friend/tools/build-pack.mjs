// build-pack.mjs — ПОМОЩЕН скрипт (author-time, Node 18+): сглобява ТЕМАТИЧЕН пакет знание от
// СПИСЪК ОТ ИЗТОЧНИЦИ (tools/sources-registry.json). Клиентът избира тема → този скрипт обхожда
// изброените за нея източници (Уикипедия, други уикита/речници, RSS, готови JSON речници, и
// best-effort HTML) → събира речник от термини + записи → пише пакет за core/packs.js (importPack).
//
// Архитектура (по искане на собственика):
//   списък източници (registry) → предварителен добив в „речници"/пакети → зареждане в апа/базата
//   по желание на клиента (вградено или „зареди речник от <URL>").
//
// Употреба:
//   node tools/build-pack.mjs готварство                       # ползва темата от регистъра
//   node tools/build-pack.mjs право --max 400 --out src/packs/pravo.json
//   node tools/build-pack.mjs "cooking" --lang en              # тема извън регистъра → само Уикипедия
//
// Типове източници: wikipedia | mediawiki | rss | json | html (виж sources-registry.json).
// Само keyless публични API/страници. Уважава лимитите (ограничен паралелизъм + описателен UA).

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const theme = (args.find((a) => !a.startsWith('--')) || '').trim();
const getOpt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const cliLang = getOpt('lang', '');
const cliMax = parseInt(getOpt('max', '0'), 10) || 0;
const UA = 'SelflearningFriend-PackBuilder/1.0 (https://selflearning.bot.nu; ltd.dai.grup@gmail.com)';
const slug = theme.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'thema';
const OUT = getOpt('out', path.join('src', 'packs', `pack-${slug}.json`));

if (!theme) { console.error('Употреба: node tools/build-pack.mjs "<тема>" [--lang bg] [--max 400] [--out файл.json]'); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function mapPool(items, fn, c = 2) {   // по-нисък паралелизъм → по-малко лимитиране от Уикипедия
  const out = new Array(items.length); let i = 0;
  async function w() { while (i < items.length) { const idx = i++; try { out[idx] = await fn(items[idx], idx); } catch { out[idx] = null; } } }
  await Promise.all(Array.from({ length: Math.min(c, items.length) }, w));
  return out;
}
// fetch с ПОВТОРНИ ОПИТИ и изчакване при лимит (429/503): уважава Retry-After, иначе експоненциално.
async function fetchRetry(url, headers, tries = 4) {
  for (let a = 0; a < tries; a++) {
    let res;
    try { res = await fetch(url, { headers }); } catch (e) { if (a === tries - 1) throw e; await sleep(500 * (a + 1)); continue; }
    if (res.status === 429 || res.status === 503) {
      const ra = parseInt(res.headers.get('retry-after') || '', 10);
      await sleep(ra > 0 ? ra * 1000 : Math.min(8000, 700 * Math.pow(2, a)));
      continue;
    }
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res;
  }
  throw new Error('HTTP 429 (изчерпани опити)');
}
async function getJson(url) {
  return (await fetchRetry(url, { Accept: 'application/json', 'Api-User-Agent': UA, 'User-Agent': UA })).json();
}
async function getText(url) {
  return (await fetchRetry(url, { 'Api-User-Agent': UA, 'User-Agent': UA })).text();
}
const stripHtml = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

// ── Handler: MediaWiki (Уикипедия / Уикикниги / Уикиверситет / всяко уики с /w/api.php) ──
// БОТ-СЪБИРАЧ: с `recurse` обхожда КАТЕГОРИЙНОТО ДЪРВО в ШИРОЧИНА (подкатегории на подкатегории) →
// от няколко seed-категории открива ХИЛЯДИ страници автоматично (собственикът НЕ подава линкове).
async function fromMediaWiki(src) {
  const api = src.api || `https://${src.lang || 'bg'}.wikipedia.org/w/api.php`;
  const restBase = api.replace(/\/w\/api\.php.*$/, '');
  const max = cliMax || src.max || 400;
  const titles = new Set();
  const add = (t) => { const s = String(t || '').trim(); if (s && !/:/.test(s)) titles.add(s); };
  const q = (p) => api + '?' + new URLSearchParams({ format: 'json', origin: '*', ...p });

  for (const seed of (src.seeds || [theme])) {
    try { (await getJson(q({ action: 'query', list: 'search', srsearch: seed, srlimit: '50', srnamespace: '0' })))?.query?.search?.forEach((h) => add(h.title)); } catch {}
    await sleep(100);
  }
  // Рекурсивно обхождане на категорийното дърво (BFS) — тук се откриват хилядите линкове.
  const depth = Math.max(0, src.recurse || 0);
  const catQueue = (src.categories || []).map((c) => ({ cat: c, d: 0 }));
  const catSeen = new Set(catQueue.map((x) => x.cat));
  while (catQueue.length && titles.size < max * 2) {
    const { cat, d } = catQueue.shift();
    try {
      const data = await getJson(q({ action: 'query', list: 'categorymembers', cmtitle: cat, cmlimit: '500', cmtype: 'page|subcat' }));
      for (const m of (data?.query?.categorymembers || [])) {
        if (m.ns === 14) { // подкатегория
          if (d < depth && !catSeen.has(m.title)) { catSeen.add(m.title); catQueue.push({ cat: m.title, d: d + 1 }); }
        } else { add(m.title); }
      }
    } catch {}
    await sleep(120);
  }
  const list = [...titles].slice(0, max);
  const terms = (await mapPool(list, async (title) => {
    try {
      const d = await getJson(`${restBase}/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/\s+/g, '_'))}`);
      const def = (d.extract || d.description || '').trim();
      if (!def || d.type === 'disambiguation') return null;
      return { term: d.title || title, definition: def.length > 700 ? def.slice(0, 699) + '…' : def, source: `${restBase.replace(/^https?:\/\//, '')}: ${d.title || title}`, url: d?.content_urls?.desktop?.page || '' };
    } catch { return null; }
  }, 2)).filter(Boolean);
  return { terms, entries: [] };
}

// ── Handler: RSS/Atom → записи (entries, type 'fact') ──────────────────────
async function fromRss(src) {
  try {
    const xml = await getText(src.url);
    const items = [...xml.matchAll(/<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/gi)].map((m) => m[0]);
    const entries = [];
    for (const it of items.slice(0, src.max || 60)) {
      const title = stripHtml((it.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '');
      const desc = stripHtml((it.match(/<(?:description|summary|content)\b[^>]*>([\s\S]*?)<\/(?:description|summary|content)>/i) || [])[1] || '');
      if (title) entries.push({ type: 'fact', key: title, value: (title + (desc ? ' — ' + desc : '')).slice(0, 500), keywords: [src.topic || theme] });
    }
    return { terms: [], entries };
  } catch (e) { console.warn('  rss пропуснат:', e.message); return { terms: [], entries: [] }; }
}

// ── Handler: готов JSON речник на URL ──────────────────────────────────────
async function fromJson(src) {
  try {
    const d = await getJson(src.url);
    if (Array.isArray(d?.terms)) return { terms: d.terms, entries: [] };
    if (Array.isArray(d?.entries)) return { terms: [], entries: d.entries };
    if (Array.isArray(d)) return { terms: [], entries: d };
    return { terms: [], entries: [] };
  } catch (e) { console.warn('  json пропуснат:', e.message); return { terms: [], entries: [] }; }
}

// ── Handler: HTML (best-effort по CSS-подобни селектори) ───────────────────
// Без пълен DOM: за прости страници вадим текстове по груб регекс според termSelector.
// За сайтове като lex.bg това е СКЕЛЕТ — трябват конкретни селектори/страници (виж note).
async function fromHtml(src) {
  if (src.enabled === false) { console.warn('  html източник изключен (enabled:false):', src.url); return { terms: [], entries: [] }; }
  try {
    const html = await getText(src.url);
    const terms = [];
    // много грубо: линковете като кандидат-термини (собственикът задава по-точни селектори при нужда)
    const links = [...html.matchAll(/<a\b[^>]*>([^<]{2,80})<\/a>/gi)].map((m) => stripHtml(m[1]));
    const seen = new Set();
    for (const t of links) {
      const k = t.toLowerCase();
      if (t.length >= 3 && !seen.has(k)) { seen.add(k); terms.push({ term: t, definition: `Термин от ${src.url}`, source: src.url }); }
      if (terms.length >= (src.max || 200)) break;
    }
    return { terms, entries: [] };
  } catch (e) { console.warn('  html пропуснат:', e.message); return { terms: [], entries: [] }; }
}

// ── Handler: Project Gutenberg (Gutendex API, keyless) → книги по тема като записи ─────
// БОТ-СЪБИРАЧ на литература: по тема връща хиляди свободни книги (заглавие/автор/линк).
async function fromGutendex(src) {
  const topic = src.topic || theme;
  const entries = []; const max = src.max || 200;
  let url = `https://gutendex.com/books/?search=${encodeURIComponent(topic)}&languages=${src.langs || 'en'}`;
  try {
    for (let page = 0; page < 20 && url && entries.length < max; page++) {
      const d = await getJson(url);
      for (const b of (d.results || [])) {
        const authors = (b.authors || []).map((a) => a.name).join(', ');
        const txt = (b.formats && (b.formats['text/plain; charset=utf-8'] || b.formats['text/plain'])) || (b.formats && b.formats['text/html']) || '';
        entries.push({ type: 'fact', key: b.title, value: `Книга: „${b.title}"${authors ? ' от ' + authors : ''} (Project Gutenberg).`, keywords: [topic], url: txt });
        if (entries.length >= max) break;
      }
      url = d.next; await sleep(200);
    }
  } catch (e) { console.warn('  gutendex пропуснат:', e.message); }
  return { terms: [], entries };
}

const HANDLERS = { wikipedia: fromMediaWiki, mediawiki: fromMediaWiki, rss: fromRss, json: fromJson, html: fromHtml, gutendex: fromGutendex };

(async () => {
  // Регистър (по избор): темата може да е дефинирана там; иначе фолбек само Уикипедия по темата.
  let registry = { themes: {} };
  try { registry = JSON.parse(await fs.readFile(path.join(__dirname, 'sources-registry.json'), 'utf8')); } catch {}
  const key = Object.keys(registry.themes || {}).find((k) => k.toLowerCase() === theme.toLowerCase());
  const def = key ? registry.themes[key] : { name: theme, sources: [{ type: 'wikipedia', lang: cliLang || 'bg', seeds: [theme], max: cliMax || 400 }] };

  console.log(`▶ Тема „${theme}" — ${def.sources.length} източник(а)…`);
  const allTerms = []; const allEntries = [];
  for (const src of def.sources) {
    const h = HANDLERS[src.type];
    if (!h) { console.warn('  непознат тип източник:', src.type); continue; }
    if (cliLang) src.lang = cliLang;
    console.log(`  • ${src.type} ${src.url || src.api || (src.seeds || []).join('/')}…`);
    const { terms, entries } = await h(src);
    allTerms.push(...terms); allEntries.push(...entries);
    console.log(`    +${terms.length} термина, +${entries.length} записа`);
  }

  // дедуп термини по име, записи по key+value
  const tSeen = new Set(); const terms = [];
  for (const t of allTerms) { const n = String(t.term || '').trim(); const k = n.toLowerCase(); if (n && (t.definition || t.value || t.text) && !tSeen.has(k)) { tSeen.add(k); terms.push(t); } }
  const eSeen = new Set(); const entries = [];
  for (const e of allEntries) { const k = ((e.key || '') + '|' + (e.value || '')).toLowerCase(); if (!eSeen.has(k)) { eSeen.add(k); entries.push(e); } }

  const pack = { name: `${def.name || theme} — пакет знание`, topic: slug, seedInterests: false, terms, entries };
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify(pack, null, 2), 'utf8');
  const kb = Math.round(Buffer.byteLength(JSON.stringify(pack)) / 1024);
  console.log(`✓ ${terms.length} термина + ${entries.length} записа → ${OUT} (${kb} KB)`);
  console.log('  Зареди: регистрирай в core/packs.js (BUNDLED_PACKS) ИЛИ хостни JSON-а и в апа „зареди речник от <URL>".');
})();
