// Version: 1.0020
// storage.js — устойчиво съхранение на устройството (настройки + журнал на събитията + таймлапс).
//
// ПРИНЦИП: on-device, без акаунти/мрежа. Ползва @capacitor/preferences ако е наличен
// (нативен build), иначе грациозно пада към localStorage (browser dev). Един и същ API.
//
// Без проследяване: нищо не напуска устройството.

let _prefs = null;
let _prefsTried = false;

// Lazy-load на Capacitor Preferences. В browser dev модулът липсва/няма нативна
// имплементация → връщаме null и ползваме localStorage.
function getPrefs() {
  if (_prefsTried) return _prefs;
  _prefsTried = true;
  // САМО на НАТИВНА платформа ползваме Preferences. ВАЖНО (поправка на „син екран при старт"):
  // НЕ ползваме динамичен `import('@capacitor/preferences')` — той създава отделен chunk,
  // който в Capacitor WebView (https://localhost) понякога НИТО се зарежда, НИТО reject-ва,
  // и boot-ът увисва завинаги след инжектирането на стиловете (тъмносиния фон). Вместо това
  // взимаме плъгина СИНХРОННО от глобалния обект window.Capacitor.Plugins (както в другите апове).
  try {
    const cap = (typeof window !== 'undefined') ? window.Capacitor : null;
    const isNative = !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
    if (isNative && cap.Plugins && cap.Plugins.Preferences && typeof cap.Plugins.Preferences.get === 'function') {
      _prefs = cap.Plugins.Preferences;
    }
  } catch (_) {
    _prefs = null;
  }
  return _prefs;
}

async function rawGet(key) {
  const p = await getPrefs();
  if (p) {
    try {
      const { value } = await p.get({ key });
      return value ?? null;
    } catch (_) { /* пада към localStorage */ }
  }
  try { return localStorage.getItem(key); } catch (_) { return null; }
}

async function rawSet(key, value) {
  const p = await getPrefs();
  if (p) {
    try { await p.set({ key, value }); return; } catch (_) {}
  }
  try { localStorage.setItem(key, value); } catch (_) {}
}

async function rawRemove(key) {
  const p = await getPrefs();
  if (p) {
    try { await p.remove({ key }); return; } catch (_) {}
  }
  try { localStorage.removeItem(key); } catch (_) {}
}

// --- Настройки -------------------------------------------------------------

const SETTINGS_KEY = 'cw.settings.v1';

export const DEFAULT_SETTINGS = {
  activated: false,          // onboarding завършен (безплатно)
  source: 'phone',           // 'phone' | 'other'
  otherUrl: '',              // URL на browser-playable поток (по избор)
  sensitivity: 0.04,         // дял променени пиксели за „движение“ (0.005..0.2)
  classify: true,            // да пуска ли COCO-SSD при движение
  cooldownSec: 15,           // секунди между две аларми
  notify: true,              // локални нотификации при детекция
  watchPerson: true,         // кои класове да алармират
  watchAnimal: true,
  watchOther: false,
  zoneMask: '',              // зони за следене: низ '0'/'1' по клетка ('1' = изключена), '' = целият кадър
  schedule: [],              // график по часове: 24 стойности 0=нормален, 1=тих (без аларми), 2=чувствителен; [] = всички нормални
  lapseSec: 0,               // таймлапс: кадър на всеки N секунди (0 = изключено)
  alarmSound: 'beep',        // звук на алармата на телефона: 'none' | 'beep' | 'siren' | 'chime'
  alarmFlash: true           // светлинен сигнал (екранът премигва) при детекция
};

// Режим за даден час от графика (0/1/2). Липсващ график = нормален.
export function scheduleMode(settings, hour) {
  const sc = settings && Array.isArray(settings.schedule) ? settings.schedule : [];
  const v = sc[hour] | 0;
  return (v === 1 || v === 2) ? v : 0;
}

export async function loadSettings() {
  const raw = await rawGet(SETTINGS_KEY);
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch (_) {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings) {
  const clean = { ...DEFAULT_SETTINGS, ...settings };
  await rawSet(SETTINGS_KEY, JSON.stringify(clean));
  return clean;
}

// --- Журнал на събитията ---------------------------------------------------
// Всяко събитие: { id, ts, kind, category, label, score, ratio, silent, thumb } — thumb е data URL
// (малък), ratio = сила на движението (дял променени пиксели), silent = записано без аларма
// (тих час/отложено). Пазим последните MAX_EVENTS, за да не расте безкрайно.

const EVENTS_KEY = 'cw.events.v1';
const MAX_EVENTS = 100;

export async function loadEvents() {
  const raw = await rawGet(EVENTS_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (_) {
    return [];
  }
}

export async function addEvent(event) {
  const events = await loadEvents();
  const withId = {
    id: 'e' + Date.now() + Math.random().toString(36).slice(2, 7),
    ts: Date.now(),
    ...event
  };
  events.unshift(withId);
  const trimmed = events.slice(0, MAX_EVENTS);
  await rawSet(EVENTS_KEY, JSON.stringify(trimmed));
  return withId;
}

export async function clearEvents() {
  await rawRemove(EVENTS_KEY);
}

// --- Таймлапс ----------------------------------------------------------------
// Кадри { ts, img } (img = малък JPEG data URL). Пазим последните MAX_LAPSE — лентата е
// „плъзгащ се прозорец", за да не пълни хранилището.

const LAPSE_KEY = 'cw.lapse.v1';
export const MAX_LAPSE = 150;

export async function loadLapse() {
  const raw = await rawGet(LAPSE_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (_) {
    return [];
  }
}

export async function addLapseFrame(img) {
  const frames = await loadLapse();
  const f = { ts: Date.now(), img };
  frames.push(f);
  const trimmed = frames.length > MAX_LAPSE ? frames.slice(frames.length - MAX_LAPSE) : frames;
  await rawSet(LAPSE_KEY, JSON.stringify(trimmed));
  return f;
}

export async function clearLapse() {
  await rawRemove(LAPSE_KEY);
}
