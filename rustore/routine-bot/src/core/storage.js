// Version: 1.0001
// Локално съхранение. На устройство използва @capacitor/preferences,
// в браузър пада обратно към localStorage. Всичко е JSON-сериализирано.
// НЯМА мрежа, НЯМА акаунти — всичко стои само на устройството.
// Мързелив (lazy) импорт на плъгина — без top-level await, за да не чупи
// es2019 build-а. Зарежда се при първа нужда само на нативна платформа.
let Preferences = null;
let prefsTried = false;
// ВАЖНО (поправка на „черен екран при старт"): НЕ ползваме динамичен
// `import('@capacitor/preferences')` — chunk-ът в Capacitor WebView понякога НИТО се
// зарежда, НИТО reject-ва, и boot увисва. Взимаме плъгина СИНХРОННО от глобалния обект.
function ensurePreferences() {
  if (prefsTried) return Preferences;
  prefsTried = true;
  try {
    const cap = (typeof window !== 'undefined') ? window.Capacitor : null;
    if (cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform() &&
        cap.Plugins && cap.Plugins.Preferences && typeof cap.Plugins.Preferences.get === 'function') {
      Preferences = cap.Plugins.Preferences;
    }
  } catch (_) {
    Preferences = null;
  }
  return Preferences;
}

const PREFIX = 'routinebot:';

function isNative() {
  return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

export const storage = {
  async set(key, value) {
    const raw = JSON.stringify(value);
    const P = await ensurePreferences();
    if (P) {
      await P.set({ key: PREFIX + key, value: raw });
    } else {
      localStorage.setItem(PREFIX + key, raw);
    }
  },

  async get(key, fallback = null) {
    let raw = null;
    const P = await ensurePreferences();
    if (P) {
      const r = await P.get({ key: PREFIX + key });
      raw = r && r.value;
    } else {
      raw = localStorage.getItem(PREFIX + key);
    }
    if (raw == null) return fallback;
    try {
      return JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  },

  async remove(key) {
    const P = await ensurePreferences();
    if (P) {
      await P.remove({ key: PREFIX + key });
    } else {
      localStorage.removeItem(PREFIX + key);
    }
  }
};

// Удобни четци/писатели за основните обекти на приложението.
const KEYS = {
  state: 'state',
  routine: 'routine',
  reminders: 'reminders',
  events: 'events',
  perms: 'perms',
  log: 'activity_log',
  location: 'location',
  notes: 'notes',          // бележки, които роботът помни и изговаря
  ttsLang: 'tts_lang'      // избран език за изговаряне (код от 15-те)
};

export { KEYS };
