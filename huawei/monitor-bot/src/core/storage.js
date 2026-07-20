// Version: 1.0013
// Локално съхранение — БЕЗ акаунти, БЕЗ облак, БЕЗ контакти, БЕЗ проследяване.
// На устройство (Capacitor) ползва @capacitor/preferences; в браузъра — localStorage.
// Зарежда се динамично, за да работи и в чист уеб без Capacitor.

import { scheduleAutoBackup } from './backup.js';

const KEY = 'mob.state.v1';

let prefs = null;
// ВАЖНО (поправка на „черен екран без меню при старт"): НЕ ползваме динамичен
// `import('@capacitor/preferences')` — той прави отделен chunk, който в Capacitor WebView
// понякога НИТО се зарежда, НИТО reject-ва, и boot-ът увисва преди първото рисуване.
// Взимаме плъгина СИНХРОННО от глобалния window.Capacitor.Plugins.
function getPrefs() {
  if (prefs !== null) return prefs;
  prefs = false;
  try {
    const cap = (typeof window !== 'undefined') ? window.Capacitor : null;
    const isNative = !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
    if (isNative && cap.Plugins && cap.Plugins.Preferences && typeof cap.Plugins.Preferences.get === 'function') {
      prefs = cap.Plugins.Preferences;
    }
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
  // Авто-пренасяне: конфигурацията отива и във файл в Downloads/Pupikes (оцелява
  // преинсталация; отложено с няколко секунди, fire-and-forget — виж core/backup.js).
  // Статичен import (НЕ динамичен — виж предупреждението за chunk-ове по-горе).
  try { scheduleAutoBackup(state); } catch { /* браузър/без плъгин — нищо */ }
}

export function pushLog(state, text, kind = 'info') {
  state.log.unshift({ ts: Date.now(), text, kind });
  if (state.log.length > 150) state.log.length = 150;
}
