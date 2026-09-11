// Version: 1.0021
// storage.js — локално, on-device съхранение (localStorage).
// НЯМА мрежа, НЯМА акаунти, НЯМА контакти. Всичко живее само на устройството.
// 1.0021: примерна база знания (15 теми) на езика на интерфейса при първо пускане —
// маркирана „пример", маха се с един бутон; текстовете на робота също следват езика,
// докато потребителят не ги промени.
import { getLang } from './i18n.js';
import { demoEntries, demoConfig, isDemoEntry } from './demo-kb.js';

const KEY = 'bfb.state.v1';

// Начално състояние на приложението.
function defaultState() {
  const lang = getLang();
  const dc = demoConfig(lang);
  return {
    activated: false,       // дали роботът е активиран (онбординг завършен)
    robotOn: false,         // глобален ON/OFF превключвател на робота
    permissions: {
      notifications: false  // ЕДИНСТВЕНОТО разрешение, което искаме
    },
    config: {
      greeting: dc.greeting,
      fallback: dc.fallback,       // резервен текст (предаване на човек) — НЕ е грешка
      escalation: dc.escalation,
      quickReplies: dc.quickReplies,
      hours: {
        mode: '247',          // '247' = денонощно | 'office' = работно време
        from: '09:00',
        to: '18:00',
        days: [1, 2, 3, 4, 5],// 0=нед..6=съб; кои дни са „работни"
        awayMessage: dc.awayMessage
      }
    },
    kb: demoEntries(lang),  // база знания: масив от Q&A записи (виж rule-engine.js); отначало примерна
    demo: { lang, removed: false }, // на кой език е примерът и дали е махнат от потребителя
    channels: {             // канали за съобщения (виж channel-adapter.js / pump.js)
      local: true,          // вграденият демо чат — работи СЕГА
      whatsapp: false,      // изисква native plugin + Notification access
      viber: false,
      messenger: false,
      // НАШИЯТ чат (Pupikes) — реална HTTP връзка (виж pupikes-chat.js). Настройките се
      // пазят само на устройството. enabled=false докато не е настроен и включен.
      pupikes: {
        enabled: false,
        baseUrl: 'https://my.girl.place',
        phone: '',
        password: '',
        token: '',
        pollSeconds: 20
      },
      // ОБЛАЧЕН ШЛЮЗ (private/faq-gateway) — реални отговори по WhatsApp/Messenger/Viber
      // през официалните им БЕЗПЛАТНИ API-та. Приложението публикува базата натам.
      gateway: {
        baseUrl: '',
        adminToken: ''
      }
    },
    // Проследяване на вече обработени входящи съобщения по канал (за да не дублираме).
    seen: { pupikes: {} },
    log: [],                // дневник на отговорените въпроси (без лични данни)
    stats: { answered: 0, handoff: 0, away: 0 } // само броячи
  };
}

let _state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    // Дълбоко сливане на вложените обекти, за да не губим нови ключове при ъпгрейд.
    const base = defaultState();
    const s = {
      ...base,
      ...parsed,
      permissions: { ...base.permissions, ...(parsed.permissions || {}) },
      config: {
        ...base.config,
        ...(parsed.config || {}),
        hours: { ...base.config.hours, ...((parsed.config || {}).hours || {}) }
      },
      channels: {
        ...base.channels,
        ...(parsed.channels || {}),
        pupikes: { ...base.channels.pupikes, ...((parsed.channels || {}).pupikes || {}) },
        gateway: { ...base.channels.gateway, ...((parsed.channels || {}).gateway || {}) }
      },
      seen: { ...base.seen, ...(parsed.seen || {}) },
      stats: { ...base.stats, ...(parsed.stats || {}) }
    };
    // Преход от 1.0020: броячът „fallback" става „handoff" (предадено на човек), същото в дневника.
    if (s.stats.fallback != null) { s.stats.handoff = (s.stats.handoff || 0) + (s.stats.fallback || 0); delete s.stats.fallback; }
    s.log = (s.log || []).map((e) => (e && e.kind === 'fallback') ? { ...e, kind: 'handoff' } : e);
    // Старите 3 български „seed-" записа (до 1.0020) са пример на български.
    if (!parsed.demo) s.demo = { lang: 'bg', removed: false };
    return s;
  } catch (e) {
    console.warn('storage: повреден запис, ползвам по подразбиране', e);
    return defaultState();
  }
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

export function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(_state));
  } catch (e) {
    console.warn('storage: неуспешен запис', e);
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

// --- Примерна база знания -----------------------------------------------------

// Дали базата се състои САМО от примерни записи (потребителят не е добавял свои).
export function kbIsDemoOnly() {
  const kb = _state.kb || [];
  return kb.length > 0 && kb.every(isDemoEntry);
}

// Синхронизира примера с езика на интерфейса. Вика се при всяко рисуване на екран:
// докато всички записи са примерни и езикът е сменен → пресъздава примера на новия език.
// Текстовете на робота (поздрав/резервен/ескалация/извън време/бързи бутони) се сменят
// само ако са НЕПРОМЕНЕНИ спрямо примера на стария език. Ако примерът е махнат — не пипа.
export function ensureDemo() {
  const lang = getLang();
  const d = _state.demo || { lang: 'bg', removed: false };
  if (d.removed) return false;
  if (d.lang === lang && kbIsDemoOnly()) return false;
  if (!kbIsDemoOnly()) return false; // потребителят има свои записи → не пипаме
  const oldCfg = demoConfig(d.lang);
  const newCfg = demoConfig(lang);
  const cfg = { ..._state.config, hours: { ..._state.config.hours } };
  const same = (a, b) => String(a || '').trim() === String(b || '').trim();
  if (same(cfg.greeting, oldCfg.greeting)) cfg.greeting = newCfg.greeting;
  if (same(cfg.fallback, oldCfg.fallback)) cfg.fallback = newCfg.fallback;
  if (same(cfg.escalation, oldCfg.escalation)) cfg.escalation = newCfg.escalation;
  if (same(cfg.hours.awayMessage, oldCfg.awayMessage)) cfg.hours.awayMessage = newCfg.awayMessage;
  const oldQuick = (oldCfg.quickReplies || []).join('|');
  const legacyQuick = 'Работно време|Цени|Адрес'; // бързите бутони до 1.0020
  const curQuick = (cfg.quickReplies || []).join('|');
  if (curQuick === oldQuick || curQuick === legacyQuick) cfg.quickReplies = newCfg.quickReplies;
  _state = { ..._state, kb: demoEntries(lang), config: cfg, demo: { lang, removed: false } };
  persist();
  return true;
}

// Маха примерните записи (и връща текстовете на робота към неутрални, ако са примерни).
export function removeDemo() {
  const kb = (_state.kb || []).filter((e) => !isDemoEntry(e));
  _state = { ..._state, kb, demo: { lang: (_state.demo || {}).lang || getLang(), removed: true } };
  persist();
  return _state;
}

// Зарежда (отново) примера на текущия език, като запазва потребителските записи.
export function restoreDemo() {
  const lang = getLang();
  const own = (_state.kb || []).filter((e) => !isDemoEntry(e));
  _state = { ..._state, kb: [...demoEntries(lang), ...own], demo: { lang, removed: false } };
  persist();
  return _state;
}
