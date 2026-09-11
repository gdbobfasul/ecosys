// Version: 1.0024
// gen-news-bundle.mjs — ВГРАДЕН ОФЛАЙН ПАКЕТ НОВИНИ за NewsLator (Huawei 4.1, 11.09.2026).
// Тестерите на Huawei са в Китай: Google News/Bing/много RSS там не зареждат → празни екрани.
// Този скрипт се пуска ПРЕДИ билд: тегли (през node) последните заглавия за 20 държави × главните
// рубрики от СЪЩИТЕ емисии, които апът ползва (src/data/feeds.js), и ги записва компактно в
//   huawei/newslator/public/reference/news-bundle.json  (+ огледало в rustore/newslator, ако има)
// Апът го зарежда като резерв, когато мрежата/relay-ът паднат или върнат 0 записа, с надпис
// „офлайн издание от <дата>". Освен новините пакетът носи и таблица валутни курсове (USD база)
// за офлайн резерв на „Пулс".
//   node deploy-scripts/gen-news-bundle.mjs            (~2 мин; 180 емисии, 8 успоредно)
//   node deploy-scripts/gen-news-bundle.mjs --quick    (само рубрика „всички" за 20-те държави)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const feedsMod = await import(path.join(ROOT, 'huawei/newslator/src/data/feeds.js').replace(/\\/g, '/').replace(/^([A-Za-z]):/, 'file:///$1:'));
const { countryByCode, feedsForCountry, feedsForTopic, TOPICS } = feedsMod;

// 20-те държави: по една за всеки от 15-те езика на интерфейса + най-големите пазари.
const CODES = ['US', 'GB', 'DE', 'FR', 'ES', 'MX', 'IT', 'BR', 'RU', 'UA', 'BG', 'KG', 'SA', 'IN', 'JP', 'TW', 'CN', 'TR', 'AU', 'KR'];
const QUICK = process.argv.includes('--quick');
const TOPIC_KEYS = QUICK ? [] : TOPICS.map((t) => t.key);
const PER_ALL = 20;      // записа за рубрика „всички" на държава
const PER_TOPIC = 10;    // записа за всяка друга рубрика
const PARALLEL = 8;
const TIMEOUT = 20000;
const RELAY = 'https://pupikes.app/api/relay/get?url=';

// ── мрежа (node fetch + AbortController; тук НЕ е CapacitorHttp) ──
async function getText(url, ms) {
  const ac = new AbortController(); const tm = setTimeout(() => ac.abort(), ms || TIMEOUT);
  try {
    const r = await fetch(url, { signal: ac.signal, headers: { 'User-Agent': 'Mozilla/5.0 (NewsLator bundle)', Accept: 'application/rss+xml, application/xml, text/xml, */*' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.text();
  } finally { clearTimeout(tm); }
}
async function getFeed(url) {
  try { return await getText(url); }
  catch (e) { try { return await getText(RELAY + encodeURIComponent(url)); } catch (e2) { return ''; } }
}

// ── разбор на RSS/Atom с регулярни изрази (в node няма DOMParser) ──
function unCdata(s) { return String(s || '').replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1'); }
function tag(block, name) {
  const m = new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + name + '>', 'i').exec(block);
  return m ? unCdata(m[1]).trim() : '';
}
function decode(s) {
  return String(s || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/&hellip;/g, '…').replace(/&laquo;/g, '«').replace(/&raquo;/g, '»')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch (_) { return ''; } })
    .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCodePoint(parseInt(n, 10)); } catch (_) { return ''; } })
    .replace(/\s+/g, ' ').trim();
}
function parseFeed(xml) {
  const out = [];
  if (!xml) return out;
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  if (items.length) {
    for (const it of items) {
      const title = decode(tag(it, 'title')); if (!title) continue;
      let link = tag(it, 'link'); if (!link) { const g = tag(it, 'guid'); if (/^https?:/i.test(g)) link = g; }
      const src = decode(tag(it, 'source'));                     // Google News: <source url=…>Име</source>
      const date = Date.parse(tag(it, 'pubDate') || tag(it, 'dc:date') || tag(it, 'date')) || 0;
      out.push({ title, link: link.trim(), date, src });
    }
    return out;
  }
  for (const en of (xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [])) {
    const title = decode(tag(en, 'title')); if (!title) continue;
    const lm = /<link[^>]*rel="alternate"[^>]*href="([^"]+)"/i.exec(en) || /<link[^>]*href="([^"]+)"/i.exec(en);
    out.push({ title, link: lm ? lm[1] : '', date: Date.parse(tag(en, 'updated') || tag(en, 'published')) || 0, src: '' });
  }
  return out;
}
// Google News слага „ - Източник" в края на заглавието (както в core/news.js).
function stripGoogleSuffix(t) { return String(t || '').replace(/\s+-\s+[^-]{2,40}$/, '').trim() || t; }
// Дългите Google-връзки се пазят като „g:<id>" (апът ги разгъва) — пести ~40 знака на запис.
function packLink(link) {
  const m = /^https:\/\/news\.google\.com\/rss\/articles\/([^?]+)/.exec(link || '');
  return m ? 'g:' + m[1] : (link || '');
}
function dedupeKey(t) { return String(t || '').toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim().slice(0, 64); }

// ── работна опашка ──
async function runAll(tasks, n) {
  let i = 0; const res = [];
  await Promise.all(Array.from({ length: n }, async () => { while (i < tasks.length) { const k = i++; res[k] = await tasks[k](); } }));
  return res;
}

const jobs = [];
for (const code of CODES) {
  const c = countryByCode(code); if (!c) continue;
  jobs.push({ code, topic: 'all', feeds: feedsForCountry(code), limit: PER_ALL });
  for (const tk of TOPIC_KEYS) jobs.push({ code, topic: tk, feeds: feedsForTopic(code, tk), limit: PER_TOPIC });
}
console.log('Пакет новини: ' + CODES.length + ' държави × ' + (1 + TOPIC_KEYS.length) + ' рубрики = ' + jobs.length + ' групи емисии…');

let done = 0;
const results = await runAll(jobs.map((j) => async () => {
  const lists = await Promise.all(j.feeds.map(async (f) => {
    const items = parseFeed(await getFeed(f.url));
    return items.map((it) => ({
      title: f.aggregator ? stripGoogleSuffix(it.title) : it.title,
      source: f.aggregator ? (it.src || f.name) : f.name,
      date: it.date, link: it.link, official: !!f.official, aggregator: !!f.aggregator
    }));
  }));
  const seen = new Map();
  for (const it of lists.flat()) {
    const k = dedupeKey(it.title); if (!k) continue;
    const prev = seen.get(k);
    const score = (x) => (x.aggregator ? 0 : (x.official ? 2 : 1));
    if (!prev || score(it) > score(prev) || (score(it) === score(prev) && it.date > prev.date)) seen.set(k, it);
  }
  const items = Array.from(seen.values()).sort((a, b) => b.date - a.date).slice(0, j.limit);
  done++; process.stdout.write('  ' + String(done).padStart(3) + '/' + jobs.length + ' ' + j.code + ' ' + j.topic.padEnd(14) + items.length + '\n');
  return { code: j.code, topic: j.topic, items };
}), PARALLEL);

// Валутни курсове (USD база) — офлайн резерв за „Пулс".
let fx = null;
try {
  const j = JSON.parse(await getText('https://open.er-api.com/v6/latest/USD', 15000));
  if (j && j.rates) fx = { base: 'USD', ts: Date.now(), rates: j.rates };
} catch (e) { try { const j = JSON.parse(await getText(RELAY + encodeURIComponent('https://open.er-api.com/v6/latest/USD'), 20000)); if (j && j.rates) fx = { base: 'USD', ts: Date.now(), rates: j.rates }; } catch (_) {} }

const rows = [];
for (const r of results) for (const it of r.items) rows.push([it.title, it.source, it.date ? Math.round(it.date / 1000) : 0, packLink(it.link), r.code, r.topic]);
const bundle = {
  ts: Date.now(), date: new Date().toISOString().slice(0, 10),
  countries: CODES, topics: ['all'].concat(TOPIC_KEYS),
  cols: ['title', 'source', 'dateSec', 'link', 'country', 'topic'],
  items: rows, fx
};
const json = JSON.stringify(bundle);
const perCountry = {}; for (const r of rows) perCountry[r[4]] = (perCountry[r[4]] || 0) + 1;
const empty = CODES.filter((c) => !perCountry[c]);
for (const store of ['huawei', 'rustore']) {
  const dir = path.join(ROOT, store, 'newslator');
  if (!fs.existsSync(dir)) continue;
  const out = path.join(dir, 'public', 'reference', 'news-bundle.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, json, 'utf8');
  console.log('✓ ' + path.relative(ROOT, out) + '  ' + (json.length / 1024).toFixed(0) + ' KB');
}
console.log('Записи: ' + rows.length + ' · по държави: ' + CODES.map((c) => c + ':' + (perCountry[c] || 0)).join(' ') + ' · курсове: ' + (fx ? Object.keys(fx.rates).length : 'НЯМА'));
if (empty.length) console.log('⚠ без записи: ' + empty.join(', '));
if (rows.length < 500) { console.error('✗ Твърде малко записи (' + rows.length + ') — пакетът е беден; провери мрежата.'); process.exit(2); }
