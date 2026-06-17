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
    sourceType: 'rss',
    url: 'https://hnrss.org/frontpage',
    rule: 'new',
    keywords: '',
    freq: '1h'
  },
  {
    name: 'Hacker News — търси „ai" (JSON API)',
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
  try {
    const items = await fetchItems(monitor, state.proxyBase);
    const { matched, firstRun } = diffAndMatch(monitor, items);
    rememberSeen(monitor, items);

    if (firstRun) {
      monitor.lastStatus = 'заучен (' + items.length + ' записа)';
      pushLog(state, '„' + monitor.name + '“: първа проверка, заучих ' + items.length + ' записа.', 'info');
      return { ok: true, matchedCount: 0, firstRun: true };
    }

    if (matched.length > 0) {
      monitor.lastMatch = Date.now();
      monitor.lastStatus = matched.length + ' ново съвпадение';
      const top = matched.slice(0, 3).map((m) => '• ' + m.title).join('\n');
      pushLog(state, '„' + monitor.name + '“: ' + matched.length + ' съвпадение(я).', 'match');
      if (state.permissions.notifications && !monitor.paused) {
        await notify(
          'Монитор-робот: ' + monitor.name,
          matched.length + ' ново съвпадение:\n' + top
        );
      }
      return { ok: true, matchedCount: matched.length, items: matched };
    }

    monitor.lastStatus = 'без промяна';
    return { ok: true, matchedCount: 0 };
  } catch (e) {
    monitor.lastStatus = 'грешка: ' + (e.kind === 'cors' ? 'CORS/мрежа' : e.message);
    pushLog(state, '„' + monitor.name + '“: ' + e.message, 'error');
    return { ok: false, error: e };
  } finally {
    await saveState(state);
  }
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
