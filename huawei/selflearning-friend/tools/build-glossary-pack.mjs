// build-glossary-pack.mjs — ПОМОЩЕН скрипт (author-time, Node 18+): сглобява ТЕМАТИЧЕН речник-пакет
// от Уикипедия за подаване в Selflearning Friend (core/packs.js → importPack).
//
// Идея (по искане на собственика): потребителят избира ТЕМА (напр. „готварство") → този скрипт
// скрапва Уикипедия — водещата статия, свързаните статии и членовете на съответните категории —
// и записва пакет { name, topic, terms:[{term, definition, source, url}] }. Пакетът се зарежда в
// апа (готово базово знание, ~МБ-ове), а последващото учене НАДГРАЖДА същите теми.
//
// Употреба:
//   node tools/build-glossary-pack.mjs "готварство" [--lang bg] [--max 400] [--out src/packs/gotvarstvo.json]
//   node tools/build-glossary-pack.mjs "cooking" --lang en --max 800
//
// Забележки:
//   • Само keyless Уикипедия API (без ключ/акаунт). Уважава лимитите (ограничен паралелизъм + UA).
//   • Термин = заглавие на статия (така е валидиран — Уикипедия е арбитърът). Определение = summary.
//   • Голям --max → по-голям пакет (10+ МБ). Апът го зарежда по желание на клиента.

import fs from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const theme = (args.find((a) => !a.startsWith('--')) || '').trim();
const getOpt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 && args[i + 1] ? args[i + 1] : def; };
const lang = (getOpt('lang', 'bg')).split('-')[0];
const MAX = Math.max(20, parseInt(getOpt('max', '400'), 10) || 400);
const slug = theme.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'thema';
const OUT = getOpt('out', path.join('src', 'packs', `glossary-${slug}.json`));
const UA = 'SelflearningFriend-PackBuilder/1.0 (https://selflearning.bot.nu; ltd.dai.grup@gmail.com)';

if (!theme) {
  console.error('Употреба: node tools/build-glossary-pack.mjs "<тема>" [--lang bg] [--max 400] [--out файл.json]');
  process.exit(1);
}

const API = `https://${lang}.wikipedia.org/w/api.php`;
async function api(params) {
  const url = API + '?' + new URLSearchParams({ format: 'json', origin: '*', ...params }).toString();
  const res = await fetch(url, { headers: { 'Api-User-Agent': UA, 'User-Agent': UA } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Ограничен паралелизъм — да не ни лимитира Уикипедия.
async function mapPool(items, fn, concurrency = 4) {
  const out = new Array(items.length); let i = 0;
  async function worker() { while (i < items.length) { const idx = i++; try { out[idx] = await fn(items[idx], idx); } catch { out[idx] = null; } } }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return out;
}

// 1) Събираме КАНДИДАТ-ЗАГЛАВИЯ около темата: търсене + свързани (morelike) + членове на категории.
async function collectTitles(theme) {
  const titles = new Set();
  const add = (t) => { const s = String(t || '').trim(); if (s && !/:/.test(s)) titles.add(s); };

  // основно търсене
  try {
    const d = await api({ action: 'query', list: 'search', srsearch: theme, srlimit: '30', srnamespace: '0' });
    (d?.query?.search || []).forEach((h) => add(h.title));
  } catch {}
  // семантично близки на водещата статия
  const lead = [...titles][0] || theme;
  try {
    const d = await api({ action: 'query', list: 'search', srsearch: 'morelike:' + lead, srlimit: '40', srnamespace: '0' });
    (d?.query?.search || []).forEach((h) => add(h.title));
  } catch {}
  // категории: „Категория:<тема>" + свързаните категории на водещата статия → членовете им
  const cats = new Set([`Категория:${theme}`, `Category:${theme}`]);
  try {
    const d = await api({ action: 'query', prop: 'categories', titles: lead, cllimit: '20' });
    const pages = d?.query?.pages || {};
    Object.values(pages).forEach((p) => (p.categories || []).forEach((c) => cats.add(c.title)));
  } catch {}
  for (const cat of cats) {
    if (titles.size >= MAX * 2) break;
    try {
      const d = await api({ action: 'query', list: 'categorymembers', cmtitle: cat, cmlimit: '200', cmnamespace: '0' });
      (d?.query?.categorymembers || []).forEach((m) => add(m.title));
    } catch {}
    await sleep(120);
  }
  return [...titles].slice(0, MAX);
}

// 2) За всяко заглавие → кратко определение (REST summary).
async function summaryOf(title) {
  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/\s+/g, '_'))}`;
  const res = await fetch(url, { headers: { 'Api-User-Agent': UA, 'User-Agent': UA } });
  if (!res.ok) return null;
  const d = await res.json();
  const def = (d.extract || d.description || '').trim();
  if (!def || d.type === 'disambiguation') return null;
  return {
    term: d.title || title,
    definition: def.length > 700 ? def.slice(0, 699).trim() + '…' : def,
    source: `Wikipedia (${lang}): ${d.title || title}`,
    url: d?.content_urls?.desktop?.page || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`
  };
}

(async () => {
  console.log(`▶ Тема „${theme}" (${lang}), таван ${MAX} термина…`);
  const titles = await collectTitles(theme);
  console.log(`  намерих ${titles.length} кандидат-заглавия; тегля определения…`);
  const terms = (await mapPool(titles, summaryOf, 4)).filter(Boolean);
  // дедуп по име
  const seen = new Set(); const uniq = [];
  for (const t of terms) { const k = t.term.toLowerCase(); if (!seen.has(k)) { seen.add(k); uniq.push(t); } }

  const pack = { name: `${theme} — речник термини`, topic: slug, seedInterests: false, terms: uniq };
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify(pack, null, 2), 'utf8');
  const kb = Math.round(Buffer.byteLength(JSON.stringify(pack)) / 1024);
  console.log(`✓ ${uniq.length} термина → ${OUT} (${kb} KB)`);
  console.log(`  Зареди го: сложи го в src/packs/ и го регистрирай в core/packs.js (BUNDLED_PACKS),`);
  console.log(`  или го хостни като JSON и в апа кажи „зареди речник от <URL>".`);
})();
