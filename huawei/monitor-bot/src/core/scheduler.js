// Version: 1.0018
// Планировчик + оркестрация на една проверка.
//
// Формат на МОНИТОР:
// {
//   id, name,
//   sourceType: 'rss' | 'json',
//   url,
//   jsonPath?, idField?, titleField?,   // само за JSON
//   rule: 'new' | 'keyword' | 'new+keyword',
//   keywords,                            // CSV (за keyword правила)
//   freq: '15min' | '1h' | 'daily',
//   paused: boolean,
//   lastCheck: ts|null, lastMatch: ts|null, lastStatus: string,
//   seenIds?: string[]                   // seen-store (вж differ.js)
// }
//
// УЕБ vs УСТРОЙСТВО:
//  - В браузъра един общ таймер (WEB_TICK_MS) „тиктака" и проверява кои монитори
//    са „за проверка" по своя интервал (когато табът е отворен).
//  - На устройство същата tick() логика се вика; за ИСТИНСКИ фонов режим е нужен
//    background-runner плъгин (вж README/store/TESTING) — тук е документирано,
//    не симулирано фалшиво.

import { fetchItems } from './fetcher.js';
import { diffAndMatch, rememberSeen } from './differ.js';
import { notify } from './notifier.js';
import { saveState, pushLog } from './storage.js';
import { WEB_TICK_MS } from '../config.js';
import { t, tf } from './i18n.js';
import { translateTitle, phraseMatches } from './translate.js';

export const FREQ_MS = {
  '15min': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  'daily': 24 * 60 * 60 * 1000
};

// Готови пресети (БЕЗПЛАТНИ, без ключове) — за бърз тест.
// Забележка: дали ще минат директно зависи от CORS на източника по време на теста.
export const PRESETS = [
  {
    name: 'Hacker News (RSS)',
    labelKey: 'preset_hn_rss',
    sourceType: 'rss',
    url: 'https://hnrss.org/frontpage',
    rule: 'new',
    keywords: '',
    freq: '1h'
  },
  {
    name: 'Hacker News — ai (JSON API)',
    labelKey: 'preset_hn_ai',
    sourceType: 'json',
    url: 'https://hn.algolia.com/api/v1/search_by_date?query=ai&tags=story',
    jsonPath: 'hits',
    idField: 'objectID',
    titleField: 'title',
    rule: 'new+keyword',
    keywords: 'ai',
    freq: '1h'
  },
  {
    name: 'Reddit r/worldnews (JSON)',
    labelKey: 'preset_reddit',
    sourceType: 'json',
    url: 'https://www.reddit.com/r/worldnews/new.json?limit=25',
    jsonPath: 'data.children',
    idField: 'data.id',
    titleField: 'data.title',
    rule: 'new',
    keywords: '',
    freq: '1h'
  }
];

export function newMonitorId() {
  return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// Проверява един монитор сега. Връща обобщение и обновява монитора + лог.
export async function checkMonitor(state, monitor, { force = false } = {}) {
  monitor.lastCheck = Date.now();
  monitor.lastError = false;
  try {
    const items = await fetchItems(monitor, state.proxyBase);
    const { newItems, matched, firstRun } = diffAndMatch(monitor, items);
    rememberSeen(monitor, items);

    // ГЛОБАЛНОТО ТЪРСЕНЕ (полето най-отгоре на таблото): дума/словосъчетание/цял израз,
    // който се търси в новините от ВСИЧКИ монитори — независимо от правилото на монитора.
    // Хваща само НОВИ записи (не повтаря аларми за едно и също), помни алармираните id-та.
    await checkGlobalSearch(state, monitor, firstRun ? [] : newItems);

    if (firstRun) {
      monitor.lastStatus = tf('status_learned', items.length);
      pushLog(state, tf('log_first_check', monitor.name, items.length), 'info');
      return { ok: true, matchedCount: 0, firstRun: true };
    }

    if (matched.length > 0) {
      monitor.lastMatch = Date.now();
      monitor.lastStatus = tf('status_n_matches', matched.length);
      const top = matched.slice(0, 3).map((m) => '• ' + m.title).join('\n');
      pushLog(state, tf('log_n_matches', monitor.name, matched.length), 'match');
      if (state.permissions.notifications && !monitor.paused) {
        await notify(
          tf('notif_title', monitor.name),
          tf('notif_body', matched.length, top)
        );
      }
      return { ok: true, matchedCount: matched.length, items: matched };
    }

    monitor.lastStatus = t('status_unchanged');
    return { ok: true, matchedCount: 0 };
  } catch (e) {
    monitor.lastError = true;
    monitor.lastStatus = tf('status_error', e.kind === 'cors' ? t('err_cors_short') : e.message);
    pushLog(state, '„' + monitor.name + '“: ' + e.message, 'error');
    return { ok: false, error: e };
  } finally {
    await saveState(state);
  }
}

// ── Глобално търсене: съвпадение на фразата в заглавие/линк на НОВИТЕ записи ──
function globalPhrase(state) { return String(state.globalSearch || '').trim().toLowerCase(); }
async function checkGlobalSearch(state, monitor, newItems) {
  const q = globalPhrase(state);
  if (!q || !newItems.length) return;
  if (!state.globalSeen) state.globalSeen = [];
  const seen = new Set(state.globalSeen);
  // ПРЕВОДЪТ Е ЗАДЪЛЖИТЕЛЕН ЕТАП: фразата се търси и в ОРИГИНАЛА, и в ПРЕВЕДЕНОТО
  // заглавие (към езика на приложението) — иначе „президента на България" никога
  // няма да съвпадне в арабски/японски сайт. Преводите се кешират (translate.js).
  const hits = [];
  for (const it of newItems) {
    if (seen.has(it.id)) continue;
    const raw = (it.title || '') + ' ' + (it.link || '');
    if (phraseMatches(q, raw)) { hits.push(it); continue; }
    const tr = await translateTitle(it.title);
    if (tr !== it.title && phraseMatches(q, tr)) { it.titleShown = tr; hits.push(it); }
  }
  if (!hits.length) return;
  for (const h of hits) seen.add(h.id);
  state.globalSeen = [...seen].slice(-800);
  const top = hits.slice(0, 3).map((h) => '• ' + (h.titleShown || h.title)).join('\n');
  pushLog(state, tf('log_gs_match', hits.length, monitor.name) + ' — „' + state.globalSearch + '"', 'match');
  if (state.permissions.notifications) {
    notify(tf('gs_notif_title', state.globalSearch), top).catch(() => {});
  }
}

// „Търси сега" от таблото: минава през ВСИЧКИ монитори и връща съвпаденията на фразата
// (по ВСИЧКИ текущи записи, не само новите). Връща { hits:[{title,link,source}], errors }.
export async function searchAllNow(state, phrase) {
  const q = String(phrase || '').trim().toLowerCase();
  const hits = [];
  let errors = 0;
  if (!q) return { hits, errors };
  for (const m of state.monitors) {
    try {
      const items = await fetchItems(m, state.proxyBase);
      for (const it of items) {
        const raw = (it.title || '') + ' ' + (it.link || '');
        if (phraseMatches(q, raw)) { hits.push({ title: it.title, link: it.link, source: m.name }); continue; }
        // фразата се търси и в ПРЕВЕДЕНОТО заглавие (виж checkGlobalSearch по-горе)
        const tr = await translateTitle(it.title);
        if (tr !== it.title && phraseMatches(q, tr)) {
          hits.push({ title: tr, original: it.title, link: it.link, source: m.name, translated: true });
        }
      }
    } catch (e) { errors++; }
  }
  return { hits, errors };
}

// Кои монитори трябва да се проверят сега (по интервал)?
function isDue(monitor, now) {
  if (monitor.paused) return false;
  const interval = FREQ_MS[monitor.freq] || FREQ_MS['1h'];
  if (!monitor.lastCheck) return true;
  return now - monitor.lastCheck >= interval;
}

// Един „тик": проверява всички падежни монитори (ако главният ключ е ON).
export async function tick(state, { onUpdate } = {}) {
  if (!state.masterOn) return;
  const now = Date.now();
  const due = state.monitors.filter((m) => isDue(m, now));
  for (const m of due) {
    await checkMonitor(state, m);
    if (onUpdate) onUpdate();
  }
}

let timer = null;

// Стартира уеб таймера (idempotent). На устройство пак работи, но за истински
// фон е нужен background-runner — вж документацията.
export function startScheduler(state, { onUpdate } = {}) {
  stopScheduler();
  timer = setInterval(() => {
    tick(state, { onUpdate }).catch((e) => console.warn('[scheduler] tick error', e));
  }, WEB_TICK_MS);
}

export function stopScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
