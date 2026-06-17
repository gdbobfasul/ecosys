// Локално съхранение — БЕЗ акаунти, БЕЗ облак, БЕЗ контакти, БЕЗ проследяване.
// На устройство (Capacitor) ползва @capacitor/preferences; в браузъра — localStorage.
// Зарежда се динамично, за да работи и в чист уеб без Capacitor.

const KEY = 'mob.state.v1';

let prefs = null;
async function getPrefs() {
  if (prefs !== null) return prefs;
  try {
    const mod = await import('@capacitor/preferences');
    const { Capacitor } = await import('@capacitor/core');
    prefs = Capacitor.isNativePlatform() ? mod.Preferences : false;
  } catch {
    prefs = false;
  }
  return prefs;
}

// Структура на състоянието по подразбиране.
export function defaultState() {
  return {
    onboarded: false,       // мина ли потребителят през активирането
    masterOn: false,        // главен ON/OFF ключ на робота
    permissions: {
      notifications: false, // искано/дадено разрешение за известия
      internet: true        // винаги нужно за източниците; показваме го прозрачно
    },
    // Допълнителен (по желание) безплатен CORS/RSS прокси базов адрес.
    // По подразбиране ПРАЗЕН — нищо не е хардкоднато. Виж README за CORS обяснение.
    proxyBase: '',
    monitors: [],           // виж core/scheduler.js за формата на монитор
    log: []                 // [{ts, text, kind}]
  };
}

let cache = null;

export async function loadState() {
  if (cache) return cache;
  let raw = null;
  const p = await getPrefs();
  try {
    if (p) {
      const r = await p.get({ key: KEY });
      raw = r && r.value;
    } else {
      raw = localStorage.getItem(KEY);
    }
  } catch {
    raw = null;
  }
  if (raw) {
    try {
      cache = Object.assign(defaultState(), JSON.parse(raw));
    } catch {
      cache = defaultState();
    }
  } else {
    cache = defaultState();
  }
  return cache;
}

export async function saveState(state) {
  cache = state;
  const json = JSON.stringify(state);
  const p = await getPrefs();
  try {
    if (p) await p.set({ key: KEY, value: json });
    else localStorage.setItem(KEY, json);
  } catch {
    try { localStorage.setItem(KEY, json); } catch {}
  }
}

export function pushLog(state, text, kind = 'info') {
  state.log.unshift({ ts: Date.now(), text, kind });
  if (state.log.length > 150) state.log.length = 150;
}
