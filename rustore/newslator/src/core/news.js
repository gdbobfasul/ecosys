// Version: 1.0024
// news.js — събира новините от източниците, слива ги, маха дублите и ги подрежда по време.
// Поддържа: (1) държава (агрегатор + поименни), (2) рубрика/категория, (3) търсене по дума,
// (4) „Моята емисия" — слети новини от няколко следвани държави.
// 11.09.2026 (Huawei 4.1, Китай): ако емисиите + relay-ът върнат 0 записа → ВГРАДЕНОТО ОФЛАЙН
// ИЗДАНИЕ (core/bundle.js) с надпис „офлайн издание от <дата>" — екраните никога не са празни.

import { feedsForCountry, feedsForTopic, feedsForSearch, countryByCode } from '../data/feeds.js';
import { loadFeed } from './rss.js';
import { bundleNews } from './bundle.js';
import { once } from './once.js';

// Google News слага „ - Име на източника" в края на заглавието — махаме го за по-чист изглед.
function stripGoogleSuffix(title) {
  return String(title || '').replace(/\s+-\s+[^-]{2,40}$/, '').trim() || title;
}

// Ключ за дубли: първите ~64 знака от заглавието, нормализирани.
function dedupeKey(title) {
  // Unicode букви/цифри (ВСИЧКИ писмености: деванагари, кана, хангъл, тай…) — старият диапазон изпускаше
  // хинди/японски заглавия → празен ключ → новината се губеше (поправка 09.09.2026).
  return String(title || '').toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim().slice(0, 64);
}

// Зарежда списък feeds за дадена държава и връща сплескан масив новини с мета-данни.
// Записва прогрес по източник в sources[].
async function loadFeedList(country, feeds, sources) {
  const lists = await Promise.all(feeds.map(async (f) => {
    const items = await loadFeed(f.url, f.name, 12000);
    sources.push({ name: f.name, ok: items.length > 0, count: items.length, official: !!f.official, aggregator: !!f.aggregator, type: f.type });
    const srcLang = (f.lang || country.hl || 'en').split('-')[0];
    return items.map((it) => ({
      title: f.aggregator ? stripGoogleSuffix(it.title) : it.title,
      link: it.link,
      date: it.date || 0,
      summary: it.summary,
      source: f.name,
      country: country.code,
      official: !!f.official,
      aggregator: !!f.aggregator,
      type: f.type,
      srcLang
    }));
  }));
  return lists.flat();
}

// Слива, маха дублите (по заглавие) и подрежда по време (най-новите отгоре).
function mergeItems(all, limit = 90) {
  const seen = new Map();
  all.forEach((it) => {
    if (!it.title) return;
    const k = dedupeKey(it.title);
    if (!k) return;
    const prev = seen.get(k);
    if (!prev) { seen.set(k, it); return; }
    // Запази по-добрия: поименен официален > поименен > агрегатор; при равни — по-новия.
    const score = (x) => (x.aggregator ? 0 : (x.official ? 2 : 1));
    if (score(it) > score(prev) || (score(it) === score(prev) && it.date > prev.date)) seen.set(k, it);
  });
  return Array.from(seen.values()).sort((a, b) => (b.date || 0) - (a.date || 0)).slice(0, limit);
}

// Избира кои feeds за държавата спрямо режима (търсене / рубрика / държава).
function pickFeeds(code, opts) {
  if (opts.query) return feedsForSearch(code, opts.query);
  if (opts.topic && opts.topic !== 'all') return feedsForTopic(code, opts.topic);
  let feeds = feedsForCountry(code);
  if (opts.officialOnly) {
    const off = feeds.filter((f) => f.official);
    if (off.length) feeds = off;
  }
  return feeds;
}

// Зарежда новините за ЕДНА държава (по избор: рубрика opts.topic / търсене opts.query).
// Връща { items, sources, count }.
export async function loadCountryNews(code, opts = {}) {
  const country = countryByCode(code);
  if (!country) return { items: [], sources: [], count: 0 };
  const sources = [];
  const all = await loadFeedList(country, pickFeeds(code, opts), sources);
  const items = mergeItems(all);
  if (!items.length) { const off = await bundleNews([code], opts); if (off.count) return off; }
  return { items, sources, count: items.length };
}

// Ключ на кеша „веднъж на пускане" за новините — ЕДИН формат за таб „Новини", таблото и „Сравни",
// за да не се тегли една държава два пъти в едно пускане.
export function newsKey(mode, codes, topic, officialOnly) {
  return 'news:' + mode + ':' + (Array.isArray(codes) ? codes.join(',') : codes) + ':' + (topic || 'all') + ':' + (officialOnly ? 1 : 0);
}
// Новините на една държава през once (рубрика „всички", без филтър) → споделен кеш.
export function countryNewsOnce(code) {
  return once(newsKey('country', code, 'all', false), () => loadCountryNews(code, {}));
}

// „Моята емисия" — слети новини от няколко следвани държави (по избор рубрика/търсене).
export async function loadMyFeed(codes, opts = {}) {
  const list = (codes || []).map(countryByCode).filter(Boolean);
  if (!list.length) return { items: [], sources: [], count: 0 };
  const sources = [];
  const chunks = await Promise.all(list.map((country) => loadFeedList(country, pickFeeds(country.code, opts), sources)));
  const items = mergeItems(chunks.flat(), 120);
  if (!items.length) { const off = await bundleNews(list.map((c) => c.code), opts); if (off.count) return off; }
  return { items, sources, count: items.length };
}
