// storage.js — локално, on-device съхранение.
// Опитва Capacitor Preferences (нативно, ако сме в APK); ако липсва — localStorage.
// НЯМА мрежа за съхранение, НЯМА акаунти, НЯМА контакти. Всичко живее само на устройството.
//
// Зареждаме веднъж при старт в _state (синхронен достъп), а записът е async към
// Preferences + синхронен към localStorage (за да преживее презареждане дори в браузър).

const KEY = 'slf.state.v1';

// Опит за достъп до Capacitor Preferences plugin (наличен само в нативния build).
let _prefs = null;
try {
  // Динамичен достъп: ако пакетът е инсталиран и работим в WebView, ще е наличен.
  // В чист браузър Capacitor.Plugins може да липсва — тогава падаме към localStorage.
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
    // Идентичност на бота / ключ за заключване (виж identity.js).
    identity: {
      named: false,        // дали ботът вече е кръстен (раждане завършено)
      nameHash: null,      // SHA-256 хеш на името (малки букви, trim) — не пазим открито
      nameHint: null,      // първа буква + дължина, само за дружелюбна подсказка
      avatarSeed: null,    // seed за лицето на героя (стабилно между сесии)
      bornAt: null,        // timestamp на раждането
      // ГЛОБАЛЕН режим за лични данни (избира се при раждането, виж privacy.js):
      //   'personal'   — събира лични данни за собственика (личен асистент);
      //   'impersonal' — нула лични данни (за продажба/прехвърляне).
      dataMode: 'personal'
    },
    // Състояние на заключването.
    lock: {
      unlockedAt: null,    // timestamp на последното успешно отключване
      failCount: 0,        // последователни грешни опити
      cooldownUntil: null  // timestamp, до който достъпът е блокиран
    },
    // Дневник на разговора (само локално).
    chat: [],              // [{ role:'bot'|'owner', text, at }]
    // Памет за самообучение (виж memory-store.js).
    memory: [],            // [{ id, type, key, value, keywords:[], created, updated, uses }]
    // Научени теми (виж subjects.js) — материалът, който задачите/ученето пълнят.
    subjects: [],          // [{ id, name, notes:[{id,text,source,url,at}], created, updated }]
    // ПОСТОЯНЕН списък със ЗАДАЧИ от собственика (виж tasklist.js).
    tasks: [],             // [{ id, kind, arg, text, status, result, citation, source, created, updated }]
    // Интереси, добавени от собственика (за ротацията на автономното учене).
    interests: [],         // ['Астрономия', ...]
    // Лог на режим „Слушай“ (виж listen.js).
    listen: { log: [] },   // [{ status, note, at }]
    // Състояние на непрекъснатото учене (виж learning-loop.js).
    learning: {
      enabled: true,       // автономното учене включено ли е
      feed: [],            // [{ status, topic, note, citation?, at }]
      learnedCount: 0      // (информативно; реалният брой идва от subjects)
    },
    // Отпечатък на устройството + анти-кражба (виж device.js).
    device: {
      fingerprint: null,   // { installId, sig, sigHash, capturedAt }
      lockdown: { active: false, reason: null, since: null, deviceChangeFlagged: false },
      history: []          // [{ event, at }]
    },
    // Настройки.
    settings: {
      useAi: true,         // позволи ли безплатния keyless AI enhancer (Pollinations)
      // Роля на ТОВА копие при клонинги (телефон + компютър): само ЕДНО да е „учащ“.
      //   'learner' — самообучението е позволено (текущо поведение; цикълът може да тече);
      //   'reader'  — самообучението е ИЗКЛЮЧЕНО (цикълът не натрупва ново знание),
      //               но роботът пак чете/припомня, отговаря и разговаря нормално.
      learnRole: 'learner',
      askOnReopen: true,   // да пита ли „Как се казвам?“ при повторно отваряне
      inactivityMin: 10,   // минути неактивност, след които иска име наново
      maxAttempts: 5,      // грешни опити преди cooldown
      cooldownMin: 2,      // минути cooldown
      // Плъгваем „учител“ слот (виж teacher.js). tier1 (Claude) е ИЗКЛЮЧЕН по подразбиране.
      // Платеният Claude слой е РЕАЛЕН, но изисква: enabled + одобрение + ключ ИЛИ endpoint.
      teacher: {
        claudeEnabled: false,   // включва платения слой (по подразбиране изключен)
        approved: false,        // изрично „Одобри“ за харчене (нулира се при session, ако perCall)
        approvePerCall: false,  // ако true — всяко повикване иска ново одобрение (по-стриктно)
        apiKey: '',             // ключ на собственика (локално, Preferences; НЕ се вгражда)
        endpoint: '',           // алтернативно: прокси на собственика (ако е зададен → ползва него)
        model: 'claude-3-5-haiku-latest', // евтин по подразбиране
        anthropicVersion: '2023-06-01'
      },
      // „Източници на знание“ (виж knowledge.js).
      sources: {
        pullUrl: '',
        pullEnabled: false,
        serverEndpoint: '',
        autoExport: false
      },
      // Режим „Слушай“ (виж listen.js).
      listen: {
        enabled: false,
        relayUrl: '',
        ack: true
      },
      // ГЛАС (виж voice.js): вход (STT) и изход (TTS). Само on-device/безплатно.
      voice: {
        inputEnabled: true,        // показвай ли микрофон бутона в чата
        outputEnabled: false,      // „Гласов отговор“ — ботът изговаря репликите си
        lang: 'bg-BG',             // език за разпознаване и синтез
        conversationEnabled: true, // показвай ли бутона „Разговор“ (hands-free) в чата
        conversationAutoStart: false, // авто-старт на разговора при отключване (по подразбиране изкл.)
        // ГЛАСОВ ПРОФИЛ на собственика (виж voiceprint.js).
        // ВАЖНО: МЕК/удобен сигнал, НЕ е сигурна биометрия. НЕ отключва и НЕ
        // заобикаля кодовата дума — тя остава единственият истински ключ.
        profile: {
          enabled: true,           // мекото разпознаване по глас включено ли е
          target: 5,               // нужни реплики за enrollment (обучение)
          threshold: 0.82,         // праг на сходство (тунируем)
          count: 0,                // вписани реплики досега
          mean: null,              // усреднен feature вектор (попълва се при обучение)
          m2: null,
          updatedAt: null
        }
      }
    }
  };
}

let _state = loadSync();

// Синхронно зареждане от localStorage (работи и в браузър, и в WebView като кеш).
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
// Ако нативната стойност съществува, тя печели над localStorage кеша.
export async function hydrate() {
  if (!_prefs) return _state;
  try {
    const { value } = await _prefs.get({ key: KEY });
    if (value) {
      _state = mergeDefaults(JSON.parse(value));
      // синхронизираме и localStorage кеша
      if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(_state));
    } else {
      // нищо нативно: запишем текущото (евентуално от localStorage), за да мигрираме
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
    identity: { ...base.identity, ...(parsed.identity || {}) },
    lock: { ...base.lock, ...(parsed.lock || {}) },
    settings: {
      ...base.settings,
      ...(parsed.settings || {}),
      teacher: { ...base.settings.teacher, ...((parsed.settings && parsed.settings.teacher) || {}) },
      sources: { ...base.settings.sources, ...((parsed.settings && parsed.settings.sources) || {}) },
      listen: { ...base.settings.listen, ...((parsed.settings && parsed.settings.listen) || {}) },
      voice: {
        ...base.settings.voice,
        ...((parsed.settings && parsed.settings.voice) || {}),
        // дълбоко сливане на гласовия профил (за съвместимост при ъпгрейд)
        profile: {
          ...base.settings.voice.profile,
          ...((parsed.settings && parsed.settings.voice && parsed.settings.voice.profile) || {})
        }
      }
    },
    learning: { ...base.learning, ...(parsed.learning || {}),
      feed: Array.isArray(parsed.learning && parsed.learning.feed) ? parsed.learning.feed : [] },
    device: { ...base.device, ...(parsed.device || {}),
      lockdown: { ...base.device.lockdown, ...((parsed.device && parsed.device.lockdown) || {}) },
      history: Array.isArray(parsed.device && parsed.device.history) ? parsed.device.history : [] },
    chat: Array.isArray(parsed.chat) ? parsed.chat : [],
    memory: Array.isArray(parsed.memory) ? parsed.memory : [],
    subjects: Array.isArray(parsed.subjects) ? parsed.subjects : [],
    tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
    interests: Array.isArray(parsed.interests) ? parsed.interests : [],
    listen: { log: Array.isArray(parsed.listen && parsed.listen.log) ? parsed.listen.log : [] }
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

export function resetAll() {
  _state = defaultState();
  persist();
  return _state;
}

// Малък помощник за уникални id-та.
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
