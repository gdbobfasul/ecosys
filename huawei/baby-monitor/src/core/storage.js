// Version: 1.0027
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
    events: [],
    // Грижа (таб „Грижа"): дневник хранене/сън, растеж и ваксини — само локално.
    care: {
      birthDate: '',            // ISO дата на раждане (за растеж и ваксини)
      sex: 'boy',               // 'boy' | 'girl' (за СЗО коридора)
      diary: [],                // [{ id, type: 'feed'|'sleep'|'wake'|'diaper', at }]
      growth: [],               // [{ id, at: 'YYYY-MM-DD', weight, height }]
      vaccines: {}              // { <id от baby-data>: 'YYYY-MM-DD' (кога е направена) }
    },
    // Детегледачка („BabySecuritySitter") — главната функция: телефон при детето ↔ телефон на родителя.
    sitter: {
      role: '',                 // '' (не е избрана) | 'child' (телефонът при детето) | 'parent' (телефонът на родителя)
      // Записани фрази с гласа на мама/тати (записи, не синтез). [{ id, slot, title, mime, dataUrl, ms, at }]
      // slot: 'sleep' („спи, миличко") | 'here' („мама е тук") | 'ok' („всичко е наред") | 'custom'
      phrases: [],
      // Сценарий „приспиване": песен → тихи фрази → шум, с намаляваща сила.
      scenario: {
        song: 'brahms',         // от SONG_KINDS | 'none'
        songMin: 5,             // минути песен
        phraseOrder: [],        // id-та на фразите по ред (празно = всички записани по ред на запис)
        phraseRounds: 2,        // колко пъти да се повторят фразите
        phraseGapSec: 25,       // пауза между фразите (секунди)
        noise: 'rain',          // от NOISE_KINDS | 'none'
        noiseMin: 20,           // минути шум
        volStart: 70,           // сила в началото (%)
        volEnd: 25              // сила в края (%)
      },
      // Реакции при наблюдението на съня.
      react: {
        onCry: 'phrase',        // 'phrase' | 'song' | 'none' — какво да пусне при плач
        cryLevel: 62,           // праг на шума (0..100)
        crySeconds: 4,          // колко секунди над прага = плач
        cooldownSec: 90,        // пауза между две реакции
        silenceAlertMin: 0,     // сигнал при толкова минути пълна тишина (0 = изключено)
        photoOnCry: true        // при плач да прати и снимка от камерата (ако има)
      }
    }
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
    events: Array.isArray(parsed.events) ? parsed.events : [],
    care: {
      ...base.care,
      ...(parsed.care || {}),
      diary: Array.isArray(parsed.care && parsed.care.diary) ? parsed.care.diary : [],
      growth: Array.isArray(parsed.care && parsed.care.growth) ? parsed.care.growth : [],
      vaccines: (parsed.care && parsed.care.vaccines && typeof parsed.care.vaccines === 'object') ? parsed.care.vaccines : {}
    },
    sitter: {
      ...base.sitter,
      ...(parsed.sitter || {}),
      phrases: Array.isArray(parsed.sitter && parsed.sitter.phrases) ? parsed.sitter.phrases : [],
      scenario: { ...base.sitter.scenario, ...((parsed.sitter && parsed.sitter.scenario) || {}) },
      react: { ...base.sitter.react, ...((parsed.sitter && parsed.sitter.react) || {}) }
    }
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

// --- Грижа: дневник / растеж / ваксини (само локално) ---
export function getCare() { return _state.care; }

export function setCare(patch) {
  _state = { ..._state, care: { ..._state.care, ...patch } };
  persist();
  return _state.care;
}

// Запис в дневника на грижата (хранене/заспа/събуди се/пелена). Пазим последните 500.
export function addDiary(type, at) {
  const item = { id: uid(), type, at: at || Date.now() };
  const diary = [item, ..._state.care.diary];
  if (diary.length > 500) diary.length = 500;
  setCare({ diary });
  return item;
}

export function removeDiary(id) {
  setCare({ diary: _state.care.diary.filter((d) => d.id !== id) });
}

// Измерване (тегло/ръст) — подредени по дата.
export function addGrowth(entry) {
  const item = { id: uid(), ...entry };
  const growth = [..._state.care.growth, item].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  setCare({ growth });
  return item;
}

export function removeGrowth(id) {
  setCare({ growth: _state.care.growth.filter((g) => g.id !== id) });
}

// Отметка „направена" за ваксина (date = 'YYYY-MM-DD'; null = отмени).
export function setVaccineDone(id, date) {
  const vaccines = { ..._state.care.vaccines };
  if (date) vaccines[id] = date; else delete vaccines[id];
  setCare({ vaccines });
}

// --- Детегледачка: роля / фрази / сценарий / реакции (само локално) ---
export function getSitter() { return _state.sitter; }

export function setSitter(patch) {
  _state = { ..._state, sitter: { ..._state.sitter, ...patch } };
  persist();
  return _state.sitter;
}
export function setScenario(patch) { return setSitter({ scenario: { ..._state.sitter.scenario, ...patch } }); }
export function setReact(patch) { return setSitter({ react: { ..._state.sitter.react, ...patch } }); }

// Най-много толкова записани фрази (пазят се като base64 в хранилището).
export const MAX_PHRASES = 10;

export function addPhrase(entry) {
  const item = { id: uid(), at: Date.now(), ...entry };
  const phrases = [..._state.sitter.phrases, item];
  if (phrases.length > MAX_PHRASES) return null;
  setSitter({ phrases });
  return item;
}

export function updatePhrase(id, patch) {
  setSitter({ phrases: _state.sitter.phrases.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
}

export function removePhrase(id) {
  setSitter({
    phrases: _state.sitter.phrases.filter((p) => p.id !== id),
    scenario: { ..._state.sitter.scenario, phraseOrder: (_state.sitter.scenario.phraseOrder || []).filter((x) => x !== id) }
  });
}

export function resetAll() {
  _state = defaultState();
  persist();
  return _state;
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
