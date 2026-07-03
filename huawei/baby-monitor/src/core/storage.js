// Version: 1.0001
// storage.js — локално, on-device съхранение.
// Опитва Capacitor Preferences (нативно, ако сме в APK); ако липсва — localStorage.
// НЯМА мрежа за съхранение, НЯМА акаунти, НЯМА контакти. Всичко живее само на устройството.
//
// Зареждаме веднъж при старт в _state (синхронен достъп), записът е синхронен към
// localStorage (за да преживее презареждане в браузър) + async към Preferences (нативно).

const KEY = 'babymon.state.v1';

// Опит за достъп до Capacitor Preferences plugin (наличен само в нативния build).
let _prefs = null;
try {
  if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Preferences) {
    _prefs = window.Capacitor.Plugins.Preferences;
  }
} catch (_) {
  _prefs = null;
}

// Начално състояние на приложението.
function defaultState() {
  return {
    version: 1,
    // Активиране (безплатно) — наемателят „активира“ робота веднъж.
    activated: false,
    activatedAt: null,
    // Завършен ли е onboarding-ът.
    onboarded: false,
    // Настройки на наблюдението.
    settings: {
      // Коя камера: 'front' | 'back' | 'other' (URL поток).
      cameraSource: 'front',
      otherCameraUrl: '',          // по избор: browser-playable поток (виж camera.js, честно за RTSP)
      // Чувствителност на движението (0..100; по-високо = по-чувствително).
      motionSensitivity: 55,
      // Колко секунди ниско движение = „спи спокойно“.
      sleepSeconds: 20,
      // Известия.
      sound: true,                 // звуков сигнал при аларма
      vibrate: true,               // вибрация (web fallback: navigator.vibrate)
      // Кои събития да алармират.
      alertWake: true,             // „събуди се“
      alertStranger: true,         // „непознат в стаята“ (втори човек)
      alertLeftFrame: true,        // детето излезе от кадър
      // ГРУБА евристика за „пожар“ — ИЗКЛЮЧЕНА по подразбиране. НЕ заменя датчик за дим.
      alertFireHeuristic: false,
      // По избор: relay URL за известие към ДРУГ телефон (виж notifier.js — честно: нужен е сървър).
      relayUrl: ''
    },
    // Дневник на събитията (само локално). [{ id, type, label, at, snapshot? (dataURL) }]
    events: []
  };
}

let _state = loadSync();

function loadSync() {
  try {
    const raw = (typeof localStorage !== 'undefined') ? localStorage.getItem(KEY) : null;
    if (!raw) return defaultState();
    return mergeDefaults(JSON.parse(raw));
  } catch (e) {
    console.warn('storage: повреден запис, ползвам по подразбиране', e);
    return defaultState();
  }
}

// Async hydrate от Capacitor Preferences (ако е наличен). Извиква се веднъж при boot.
export async function hydrate() {
  if (!_prefs) return _state;
  try {
    const { value } = await _prefs.get({ key: KEY });
    if (value) {
      _state = mergeDefaults(JSON.parse(value));
      if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(_state));
    } else {
      await _prefs.set({ key: KEY, value: JSON.stringify(_state) });
    }
  } catch (e) {
    console.warn('storage: hydrate неуспешен, продължавам с локалния кеш', e);
  }
  return _state;
}

// Дълбоко сливане с подразбиращите се стойности (за съвместимост при ъпгрейд).
function mergeDefaults(parsed) {
  const base = defaultState();
  return {
    ...base,
    ...parsed,
    settings: { ...base.settings, ...(parsed.settings || {}) },
    events: Array.isArray(parsed.events) ? parsed.events : []
  };
}

export function getState() {
  return _state;
}

// Сливане на частична промяна на най-горно ниво + запис.
export function setState(patch) {
  _state = { ..._state, ...patch };
  persist();
  return _state;
}

// Сливане само на settings.
export function setSettings(patch) {
  _state = { ..._state, settings: { ..._state.settings, ...patch } };
  persist();
  return _state;
}

// Запис: синхронно към localStorage + async към Preferences (best-effort).
export function persist() {
  const json = JSON.stringify(_state);
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, json);
  } catch (e) {
    console.warn('storage: localStorage запис неуспешен', e);
  }
  if (_prefs) {
    _prefs.set({ key: KEY, value: json }).catch((e) =>
      console.warn('storage: Preferences запис неуспешен', e));
  }
}

// Добавя събитие в дневника (ограничаваме до последните 200, за да не расте безкрай).
export function addEvent(ev) {
  const item = { id: uid(), at: Date.now(), ...ev };
  _state.events.unshift(item);
  if (_state.events.length > 200) _state.events.length = 200;
  persist();
  return item;
}

export function clearEvents() {
  _state.events = [];
  persist();
}

export function resetAll() {
  _state = defaultState();
  persist();
  return _state;
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
