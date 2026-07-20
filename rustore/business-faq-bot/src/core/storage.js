// Version: 1.0001
// storage.js — локално, on-device съхранение (localStorage).
// НЯМА мрежа, НЯМА акаунти, НЯМА контакти. Всичко живее само на устройството.

const KEY = 'bfb.state.v1';

// Демонстрационна база знания (Q&A), за да има какво да се тества веднага.
function seedKb() {
  return [
    {
      id: 'seed-hours',
      label: 'Работно време',
      keywords: ['работно време', 'отворено', 'кога', 'часове', 'затворено'],
      answer: 'Работим понеделник–петък от 09:00 до 18:00 ч. В събота и неделя сме затворени.',
      enabled: true,
      hits: 0
    },
    {
      id: 'seed-price',
      label: 'Цени',
      keywords: ['цена', 'колко', 'струва', 'ценоразпис', 'тарифа'],
      answer: 'Цените зависят от услугата. Изпратете „меню", за да получите ценоразписа.',
      enabled: true,
      hits: 0
    },
    {
      id: 'seed-address',
      label: 'Адрес',
      keywords: ['адрес', 'къде', 'локация', 'намирате', 'карта'],
      answer: 'Намираме се на ул. Примерна 1, гр. София. Линк към картата ще ви изпрати наш служител.',
      enabled: true,
      hits: 0
    }
  ];
}

// Начално състояние на приложението.
function defaultState() {
  return {
    activated: false,       // дали роботът е активиран (онбординг завършен)
    robotOn: false,         // глобален ON/OFF превключвател на робота
    permissions: {
      notifications: false  // ЕДИНСТВЕНОТО разрешение, което искаме
    },
    config: {
      greeting: 'Здравейте! Аз съм авто-асистентът. С какво мога да помогна?',
      fallback: 'Не съм сигурен как да отговоря. Ще ви свържа с човек. ',
      escalation: 'Свързвам ви със служител — моля, изчакайте малко.',
      quickReplies: ['Работно време', 'Цени', 'Адрес'],
      hours: {
        mode: '247',          // '247' = денонощно | 'office' = работно време
        from: '09:00',
        to: '18:00',
        days: [1, 2, 3, 4, 5],// 0=нед..6=съб; кои дни са „работни"
        awayMessage: 'В момента сме извън работно време. Ще ви отговорим в работните часове.'
      }
    },
    kb: seedKb(),           // база знания: масив от Q&A записи (виж rule-engine.js)
    channels: {             // канали за съобщения (виж channel-adapter.js / pump.js)
      local: true,          // вграденият демо чат — работи СЕГА
      whatsapp: false,      // изисква native plugin + Notification access
      viber: false,
      messenger: false,
      // НАШИЯТ чат (Pupikes) — реална HTTP връзка (виж kcy-chat.js). Настройките се
      // пазят само на устройството. enabled=false докато не е настроен и включен.
      kcy: {
        enabled: false,
        baseUrl: 'https://my.girl.place',
        phone: '',
        password: '',
        token: '',
        pollSeconds: 20
      }
    },
    // Проследяване на вече обработени входящи съобщения по канал (за да не дублираме).
    seen: { kcy: {} },
    log: [],                // дневник на отговорените въпроси (без лични данни)
    stats: { answered: 0, fallback: 0, away: 0 } // само броячи
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
    return {
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
        kcy: { ...base.channels.kcy, ...((parsed.channels || {}).kcy || {}) }
      },
      seen: { ...base.seen, ...(parsed.seen || {}) },
      stats: { ...base.stats, ...(parsed.stats || {}) }
    };
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
