// Version: 1.0029
// samples.js — ПРИМЕРНИ ДАННИ при първо пускане (Huawei 4.1, 11.09.2026: „чиста инсталация = 0 сайта →
// всичко празно"). При първия старт без никакви данни засяваме 5 примерни следени сайта с правдоподобна
// ГЕНЕРИРАНА история за 14 дни (достъпност + време за отговор, SSL валидност, цена, промени в текста),
// примерни ежедневни наблюдатели, примерни RSS монитори и дневник. Всеки примерен запис носи `sample:true`
// и се показва с етикет „пример"; бутонът „Махни примерите" ги трие наведнъж (и не ги засява пак).
// Историята е детерминирана (собствен псевдослучаен генератор с фиксирано семе) — еднаква при всеки старт.
// НИКАКЪВ трафик тук: само записи в локалното хранилище. Реалните проверки остават по досегашната
// политика (веднъж на пускане при отваряне на таба; ежедневните наблюдатели по график).
import { getLang, t, tf } from './i18n.js';
import { siteLabel } from '../screens/sites.js';

export const KEY_FLAG = 'monitor-bot.samples.v1';     // 'seeded' | 'removed'
export const LSK_TOOLS = 'monitor-bot.tools.v1';
export const LSK_SITES = 'monitor-bot.siteWatch.v1';
const DAY = 864e5, HOUR = 36e5;

// 15-езичен етикет „пример" (ползва се от всички екрани върху примерните записи).
const SAMPLE = { bg:'пример', ru:'пример', uk:'приклад', en:'sample', de:'Beispiel', fr:'exemple', es:'ejemplo', 'es-MX':'ejemplo', it:'esempio', pt:'exemplo', ar:'مثال', hi:'उदाहरण', ja:'サンプル', ky:'үлгү', 'zh-Hant':'範例' };
export function sampleLabel() { return SAMPLE[getLang()] || SAMPLE.en; }
export function sampleTag(it) { return it && it.sample ? '<span class="smp-tag">' + sampleLabel() + '</span>' : ''; }

// Псевдослучаен генератор (mulberry32) — за да е историята еднаква и правдоподобна.
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let x = a; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }

// Петте примерни сайта: базово време за отговор (ms), разсейване, брой прекъсвания за 14 дни, дни до края на SSL.
const SITES = [
  { host: 'www.wikipedia.org', url: 'https://www.wikipedia.org', base: 180, jit: 90, inc: 1, ssl: 52, seed: 11 },
  { host: 'www.bbc.com',       url: 'https://www.bbc.com',       base: 240, jit: 120, inc: 2, ssl: 143, seed: 22 },
  { host: 'github.com',        url: 'https://github.com',        base: 150, jit: 60, inc: 0, ssl: 96, seed: 33 },
  { host: 'weather.com',       url: 'https://weather.com',       base: 320, jit: 160, inc: 1, ssl: 211, seed: 44 },
  { host: 'example.org',       url: 'https://example.org',       base: 410, jit: 100, inc: 3, ssl: 19, seed: 55 }
];

// Достъпност: 14 дни × 4 проверки на ден (на 6 часа), последната преди ~1 час; прекъсванията са 1–2 поредни точки.
function upHistory(s, now) {
  const r = rng(s.seed); const n = 56; const hist = [];
  const incAt = new Set(); while (incAt.size < s.inc) incAt.add(4 + Math.floor(r() * (n - 8)));
  for (let i = 0; i < n; i++) {
    const ts = now - HOUR - (n - 1 - i) * 6 * HOUR;
    const down = incAt.has(i) || (incAt.has(i - 1) && r() < 0.5);
    hist.push(down ? { ts, ok: false, ms: 15000, status: r() < 0.5 ? 0 : 503 }
                   : { ts, ok: true, ms: Math.round(s.base + (r() - 0.35) * s.jit), status: 200 });
  }
  return hist;
}

// Цени: 7 точки през 2 дни (14 дни).
function priceHistory(vals, cur, now) {
  return vals.map((v, i) => ({ ts: now - (vals.length - 1 - i) * 2 * DAY - 2 * HOUR, value: v, raw: v.toFixed(2).replace(/\.00$/, '') + ' ' + cur }));
}

// Промени: пазен текст на страницата + изречения, добавени/премахнати при „последното посещение".
const DIFF = [
  { url: 'https://www.bbc.com',
    text: 'BBC News — Home. Storms bring flood warnings to the north of England as rivers rise overnight. Central bank holds interest rates steady for a third month in a row. New rail timetable promises faster journeys between London and Manchester. Scientists report a record low in Arctic sea ice for the season. Contact us for more information.',
    added: ['Storms bring flood warnings to the north of England as rivers rise overnight.', 'Scientists report a record low in Arctic sea ice for the season.'],
    removed: ['Ministers announce a review of the school funding formula.'] },
  { url: 'https://www.wikipedia.org',
    text: 'Wikipedia — The Free Encyclopedia. English 6,900,000+ articles. Deutsch 2,900,000+ Artikel. Français 2,600,000+ articles. Español 2,000,000+ artículos. 日本語 1,450,000+ 記事. Русский 2,000,000+ статей.',
    added: ['English 6,900,000+ articles.'],
    removed: ['English 6,890,000+ articles.'] }
];

// Всички примерни записи (tools + siteWatch + монитори + дневник) за момента `now`.
export function buildSamples(now) {
  now = now || Date.now();
  const tools = { up: [], ssl: [], price: [], diff: [] };
  SITES.forEach((s, i) => {
    tools.up.push({ id: 'smp-u' + i, url: s.url, sample: true, history: upHistory(s, now) });
    tools.ssl.push({ id: 'smp-s' + i, host: s.host, sample: true, notAfter: now + s.ssl * DAY, ts: now - 3 * HOUR });
  });
  tools.price.push({ id: 'smp-p0', url: 'https://example.org/product/wireless-headphones', hint: 'Price', sample: true, ts: now - 2 * HOUR, history: priceHistory([129.99, 129.99, 124.9, 119, 119, 114.5, 109.99], '$', now) });
  tools.price.push({ id: 'smp-p1', url: 'https://github.com/pricing', hint: 'Team', sample: true, ts: now - 2 * HOUR, history: priceHistory([4, 4, 4, 4, 4, 4, 4], '$', now) });
  DIFF.forEach((d, i) => tools.diff.push({ id: 'smp-d' + i, url: d.url, sample: true, ts: now - 4 * HOUR, first: false, text: d.text, added: d.added.slice(), removed: d.removed.slice() }));

  const sites = [
    { id: 'smp-w1', tab: 'text', url: 'https://www.wikipedia.org', phrase: 'The Free Encyclopedia', sample: true, lastCheck: now - 5 * HOUR, lastResult: siteLabel('found'), triggered: true },
    { id: 'smp-w2', tab: 'text', url: 'https://www.bbc.com', phrase: 'Breaking news', sample: true, lastCheck: now - 5 * HOUR, lastResult: siteLabel('notfound'), triggered: false },
    { id: 'smp-w3', tab: 'up', url: 'https://weather.com', sample: true, lastCheck: now - 5 * HOUR, lastResult: siteLabel('online'), triggered: false, lastOnline: true, online: true },
    { id: 'smp-w4', tab: 'up', url: 'https://github.com', sample: true, lastCheck: now - 5 * HOUR, lastResult: siteLabel('online'), triggered: false, lastOnline: true, online: true }
  ];

  const monitors = [
    { id: 'smp-m1', name: 'BBC News (RSS)', sourceType: 'rss', url: 'https://feeds.bbci.co.uk/news/rss.xml', rule: 'new', keywords: '', freq: '1h', paused: false, sample: true, lastCheck: now - 40 * 60e3, lastMatch: now - 40 * 60e3, lastStatus: tf('status_n_matches', 3), seenIds: [] },
    { id: 'smp-m2', name: 'Hacker News (RSS)', sourceType: 'rss', url: 'https://hnrss.org/frontpage', rule: 'keyword', keywords: 'AI, security', freq: '1h', paused: false, sample: true, lastCheck: now - 2 * HOUR, lastMatch: now - 2 * HOUR, lastStatus: tf('status_n_matches', 1), seenIds: [] },
    { id: 'smp-m3', name: 'GitHub — git releases (Atom)', sourceType: 'rss', url: 'https://github.com/git/git/releases.atom', rule: 'new', keywords: '', freq: 'daily', paused: false, sample: true, lastCheck: now - 3 * HOUR, lastMatch: null, lastStatus: t('status_unchanged'), seenIds: [] }
  ];
  const log = [
    { ts: now - 40 * 60e3, text: tf('log_n_matches', 'BBC News (RSS)', 3), kind: 'match', sample: true },
    { ts: now - 2 * HOUR, text: tf('log_n_matches', 'Hacker News (RSS)', 1), kind: 'match', sample: true },
    { ts: now - 3 * HOUR, text: tf('log_first_check', 'GitHub — git releases (Atom)', 10), kind: 'info', sample: true },
    { ts: now - 26 * HOUR, text: tf('log_first_check', 'BBC News (RSS)', 42), kind: 'info', sample: true }
  ];
  return { tools, sites, monitors, log };
}

function readJson(key, dflt) { try { return JSON.parse(localStorage.getItem(key) || 'null') || dflt; } catch (_) { return dflt; } }
function writeJson(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (_) {} }
function flag() { try { return localStorage.getItem(KEY_FLAG) || ''; } catch (_) { return ''; } }

// Има ли изобщо потребителски данни (за да не засяваме върху нечия реална конфигурация)?
function isEmpty(state) {
  const tl = readJson(LSK_TOOLS, {}); const sites = readJson(LSK_SITES, []);
  return !(state.monitors || []).length && !sites.length && !['up', 'ssl', 'price', 'diff'].some((k) => (tl[k] || []).length);
}

// Засява примерите при ПЪРВО пускане (само ако няма нищо и никога не са махани). Връща true ако е засяло.
export function seedSamplesIfFirstRun(state) {
  if (flag() || !isEmpty(state)) return false;
  addSamples(state); return true;
}

// Добавя примерите (и при „Върни примерите"). Не дублира вече съществуващи id-та.
export function addSamples(state) {
  const s = buildSamples(Date.now());
  const tl = Object.assign({ up: [], ssl: [], price: [], diff: [] }, readJson(LSK_TOOLS, {}));
  ['up', 'ssl', 'price', 'diff'].forEach((k) => { const have = new Set(tl[k].map((x) => x.id)); s.tools[k].forEach((x) => { if (!have.has(x.id)) tl[k].push(x); }); });
  writeJson(LSK_TOOLS, tl);
  const sites = readJson(LSK_SITES, []); const haveS = new Set(sites.map((x) => x.id));
  s.sites.forEach((w) => { if (!haveS.has(w.id)) sites.push(w); }); writeJson(LSK_SITES, sites);
  state.monitors = state.monitors || []; const haveM = new Set(state.monitors.map((m) => m.id));
  s.monitors.forEach((m) => { if (!haveM.has(m.id)) state.monitors.push(m); });
  state.log = (state.log || []).filter((l) => !l.sample); state.log = s.log.concat(state.log).slice(0, 150);
  try { localStorage.setItem(KEY_FLAG, 'seeded'); } catch (_) {}
}

// Маха ВСИЧКИ примерни записи отвсякъде и запомня, че са махнати (не се засяват пак сами).
export function removeSamples(state) {
  const tl = Object.assign({ up: [], ssl: [], price: [], diff: [] }, readJson(LSK_TOOLS, {}));
  ['up', 'ssl', 'price', 'diff'].forEach((k) => { tl[k] = tl[k].filter((x) => !x.sample); }); writeJson(LSK_TOOLS, tl);
  writeJson(LSK_SITES, readJson(LSK_SITES, []).filter((w) => !w.sample));
  state.monitors = (state.monitors || []).filter((m) => !m.sample);
  state.log = (state.log || []).filter((l) => !l.sample);
  try { localStorage.setItem(KEY_FLAG, 'removed'); } catch (_) {}
}

// Има ли в момента примерни записи (за банера на таблото)?
export function hasSamples(state) {
  const tl = readJson(LSK_TOOLS, {});
  return (state.monitors || []).some((m) => m.sample) || readJson(LSK_SITES, []).some((w) => w.sample) ||
    ['up', 'ssl', 'price', 'diff'].some((k) => (tl[k] || []).some((x) => x.sample));
}
