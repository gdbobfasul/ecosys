// Локално съхранение — БЕЗ акаунти, БЕЗ облак, БЕЗ проследяване.
// На устройство (Capacitor) ползва @capacitor/preferences; в браузъра — localStorage.
// Езикът на интерфейса се пази отделно (в i18n.js). Тук пазим избраната държава и
// настройките (авто-превод / четене на глас / филтър).

const KEY = 'si.state.v1';

let prefs = null;
// Взимаме плъгина СИНХРОННО от window.Capacitor.Plugins (динамичният import понякога
// увисва в WebView и оставя черен екран преди първото рисуване — научен урок от екосистемата).
function getPrefs() {
  if (prefs !== null) return prefs;
  prefs = false;
  try {
    const cap = (typeof window !== 'undefined') ? window.Capacitor : null;
    const isNative = !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
    if (isNative && cap.Plugins && cap.Plugins.Preferences && typeof cap.Plugins.Preferences.get === 'function') {
      prefs = cap.Plugins.Preferences;
    }
  } catch { prefs = false; }
  return prefs;
}

export function defaultState() {
  return {
    onboarded: false,        // мина ли потребителят през началния екран
    country: '',             // избран код на държава (напр. 'BG'); празно = още няма избор
    settings: {
      autoTranslate: true,   // авто-превод на заглавията към езика на интерфейса
      tts: true,             // позволено четене на глас
      officialOnly: false    // показвай само официални източници
    }
  };
}

let cache = null;

export async function loadState() {
  if (cache) return cache;
  let raw = null;
  const p = getPrefs();
  try {
    if (p) { const r = await p.get({ key: KEY }); raw = r && r.value; }
    else raw = localStorage.getItem(KEY);
  } catch (e) { raw = null; }
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      cache = Object.assign(defaultState(), parsed);
      cache.settings = Object.assign(defaultState().settings, parsed.settings || {});
    } catch { cache = defaultState(); }
  } else {
    cache = defaultState();
  }
  return cache;
}

export async function saveState(state) {
  cache = state;
  const json = JSON.stringify(state);
  const p = getPrefs();
  try {
    if (p) await p.set({ key: KEY, value: json });
    else localStorage.setItem(KEY, json);
  } catch (e) {
    try { localStorage.setItem(KEY, json); } catch {}
  }
}

// Удобен достъп до кеша (синхронно) — за екрани, които вече са заредили състоянието.
export function getState() { return cache || defaultState(); }
