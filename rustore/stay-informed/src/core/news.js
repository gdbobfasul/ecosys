// news.js — събира новините за избрана държава от ВСИЧКИ ѝ източници (агрегатор + поименни),
// слива ги, маха дублите и ги подрежда по време (най-новите отгоре). Всяка новина носи
// мета-данни за източника (официален/неофициален/агрегатор, тип, изходен език за превода).

import { feedsForCountry, countryByCode } from '../data/feeds.js';
import { loadFeed } from './rss.js';

// Google News слага „ - Име на източника" в края на заглавието — махаме го за по-чист изглед.
function stripGoogleSuffix(title) {
  return String(title || '').replace(/\s+-\s+[^-]{2,40}$/, '').trim() || title;
}

// Ключ за дубли: първите ~64 знака от заглавието, нормализирани.
function dedupeKey(title) {
  return String(title || '').toLowerCase().replace(/[^a-zа-я0-9؀-ۿ一-鿿]+/gi, ' ').trim().slice(0, 64);
}

// Зарежда новините за държава. opts.officialOnly → само официални източници (с резерв към
// всички, ако официални няма, за да не остане празно). onSource(info) уведомява за прогрес.
// Връща { items, sources, count }.
export async function loadCountryNews(code, opts = {}) {
  const country = countryByCode(code);
  if (!country) return { items: [], sources: [], count: 0 };

  let feeds = feedsForCountry(code);
  if (opts.officialOnly) {
    const off = feeds.filter((f) => f.official);
    if (off.length) feeds = off;   // ако има официални — само те; иначе оставяме всички
  }

  const sources = [];
  const lists = await Promise.all(feeds.map(async (f) => {
    const items = await loadFeed(f.url, f.name, 12000);
    sources.push({ name: f.name, ok: items.length > 0, count: items.length, official: !!f.official, aggregator: !!f.aggregator, type: f.type });
    // Закачаме мета на всяка новина (за значки и за изходния език при превода).
    const srcLang = (f.lang || country.hl || 'en').split('-')[0];
    return items.map((it) => ({
      title: f.aggregator ? stripGoogleSuffix(it.title) : it.title,
      link: it.link,
      date: it.date || 0,
      summary: it.summary,
      source: f.name,
      official: !!f.official,
      aggregator: !!f.aggregator,
      type: f.type,
      srcLang
    }));
  }));

  // Сливане + махане на дубли (по заглавие). При дубъл предпочитаме поименен пред агрегатор.
  const seen = new Map();
  lists.flat().forEach((it) => {
    if (!it.title) return;
    const k = dedupeKey(it.title);
    if (!k) return;
    const prev = seen.get(k);
    if (!prev) { seen.set(k, it); return; }
    // Запази по-добрия: поименен официален > поименен > агрегатор; при равни — по-новия.
    const score = (x) => (x.aggregator ? 0 : (x.official ? 2 : 1));
    if (score(it) > score(prev) || (score(it) === score(prev) && it.date > prev.date)) seen.set(k, it);
  });

  const items = Array.from(seen.values()).sort((a, b) => (b.date || 0) - (a.date || 0)).slice(0, 90);
  return { items, sources, count: items.length };
}
