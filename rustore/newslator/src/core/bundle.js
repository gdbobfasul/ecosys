// Version: 1.0024
// bundle.js — ВГРАДЕНОТО ОФЛАЙН ИЗДАНИЕ (Huawei 4.1, 11.09.2026). При билд скриптът
// deploy-scripts/gen-news-bundle.mjs записва public/reference/news-bundle.json: последните
// заглавия за 20 държави × рубрики (~2000 записа) + таблица валутни курсове. Апът го чете
// ЕДИН път (локален файл, без мрежа) и го ползва като резерв, когато емисиите/relay-ът паднат
// или върнат 0 записа — тогава екраните показват „офлайн издание от <дата>".
// Записите са компактни редове по cols: [title, source, dateSec, link, country, topic].
import { countryByCode } from '../data/feeds.js';

let loading = null;   // Promise → { ts, date, items:[…], fx } (веднъж за живота на процеса)

function expandLink(l) {
  if (!l) return '';
  return l.indexOf('g:') === 0 ? 'https://news.google.com/rss/articles/' + l.slice(2) + '?oc=5' : l;
}

// Чете и нормализира пакета. При липса/грешка → празен пакет (никога не хвърля).
export function loadBundle() {
  if (loading) return loading;
  loading = (async () => {
    try {
      const r = await fetch('reference/news-bundle.json');
      if (!r || !r.ok) throw new Error('HTTP ' + (r ? r.status : '—'));
      const raw = JSON.parse(await r.text());
      const items = (raw.items || []).map((row) => {
        const c = countryByCode(row[4]);
        return {
          title: row[0], source: row[1] || '', date: (row[2] || 0) * 1000, link: expandLink(row[3]),
          country: row[4], topic: row[5] || 'all',
          srcLang: ((c && c.hl) || 'en').split('-')[0],
          official: false, aggregator: false, offline: true
        };
      });
      return { ts: raw.ts || 0, date: raw.date || '', items, fx: raw.fx || null };
    } catch (_) { return { ts: 0, date: '', items: [], fx: null }; }
  })();
  return loading;
}

// Има ли пакетът записи за държавата (за подсказки в интерфейса)?
export async function bundleHas(code) {
  const b = await loadBundle();
  return b.items.some((it) => it.country === code);
}

// Новини от пакета за списък държави (по избор рубрика/търсене) — същата форма като core/news.js:
// { items, sources, count, offline: <ts> }. offline=0 → пакетът няма нищо за тези държави.
export async function bundleNews(codes, opts) {
  const b = await loadBundle();
  const o = opts || {};
  const want = (codes || []).filter(Boolean);
  const topic = (o.topic && o.topic !== 'all') ? o.topic : 'all';
  const q = String(o.query || '').trim().toLowerCase();
  let items = b.items.filter((it) => want.indexOf(it.country) >= 0);
  if (q) items = items.filter((it) => it.title.toLowerCase().indexOf(q) >= 0);
  else items = items.filter((it) => it.topic === topic);
  // без дубли (едно и също заглавие в две рубрики), най-новите отгоре
  const seen = new Set();
  items = items.filter((it) => { const k = it.title.toLowerCase().slice(0, 64); if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b2) => (b2.date || 0) - (a.date || 0)).slice(0, want.length > 1 ? 120 : 90);
  const sources = [];
  items.forEach((it) => { if (it.source && sources.indexOf(it.source) < 0) sources.push(it.source); });
  return {
    items: items.map((it) => Object.assign({}, it)),
    sources: sources.map((n) => ({ name: n, ok: true, count: 0, official: false, aggregator: false, type: 'bundle' })),
    count: items.length,
    offline: items.length ? (b.ts || 1) : 0
  };
}

// Валутни курсове от пакета спрямо дадена валута (офлайн резерв за „Пулс"): { rates:{USD:…}, ts } | null
export async function bundleRates(currency) {
  const b = await loadBundle();
  const fx = b.fx; if (!fx || !fx.rates || !fx.rates[currency]) return null;
  const base = fx.rates[currency];               // 1 USD = base <currency>
  const rates = {};
  Object.keys(fx.rates).forEach((c) => { rates[c] = fx.rates[c] / base; });   // 1 <currency> = rates[c] <c>
  return { rates, ts: fx.ts || b.ts || 0 };
}

// Дата на изданието за надписа „офлайн издание от …".
export function fmtBundleDate(ts) {
  try { return new Date(ts).toLocaleDateString(); } catch (_) { return ''; }
}
