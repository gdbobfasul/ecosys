// Локално съхранение — БЕЗ акаунти, БЕЗ облак.
// На устройство (Capacitor) ползва @capacitor/preferences; в браузъра — localStorage.
// Зарежда се динамично, за да работи и в чист уеб без Capacitor.

const KEY = 'pwb.state.v1';

let prefs = null;
async function getPrefs() {
  if (prefs !== null) return prefs;
  try {
    const mod = await import('@capacitor/preferences');
    // Capacitor е наличен само в build; проверяваме дали native слоят отговаря.
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
    permissions: {          // декларирани/поискани разрешения
      notifications: false,
      internet: true        // винаги нужно за цените; показваме го прозрачно
    },
    watches: [],            // [{id, kind:'crypto'|'fx', symbol, base?, condition:'below'|'above', target, freq, lastValue, lastCheck, status, paused}]
    log: []                 // [{ts, text}]
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
  } catch (e) {
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
  } catch (e) {
    // тих fallback — не чупим UI заради storage
    try { localStorage.setItem(KEY, json); } catch {}
  }
}

export function pushLog(state, text) {
  state.log.unshift({ ts: Date.now(), text });
  if (state.log.length > 100) state.log.length = 100;
}
