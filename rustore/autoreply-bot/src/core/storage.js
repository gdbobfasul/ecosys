// Version: 1.0021
// storage.js — локално, on-device съхранение (localStorage).
// НЯМА мрежа, НЯМА акаунти. Всичко живее само на устройството.

import { t } from './i18n.js';

const KEY = 'arb.state.v1';

// Начално състояние на приложението.
function defaultState() {
  return {
    activated: false,        // дали роботът е активиран (онбординг завършен)
    robotOn: false,          // глобален ON/OFF превключвател на робота
    permissions: {
      notifications: false   // единственото реално разрешение, което искаме
    },
    schedule: {
      mode: '247',           // '247' = денонощно | 'office' = работно време
      from: '09:00',
      to: '18:00',
      days: [1, 2, 3, 4, 5], // 0=нед..6=съб; кои дни са „работни"
      awayReply: t('default_away_reply'),
      quiet: {               // тихи часове: роботът мълчи в този прозорец
        enabled: false,
        from: '22:00',
        to: '07:00'
      },
      vacation: {            // отпуска: специален отговор до дата „until" (YYYY-MM-DD)
        enabled: false,
        until: '',
        reply: t('default_vacation_reply')
      }
    },
    rules: [],               // правила (виж rule-engine.js за формата)
    lists: {
      whitelist: [],         // ако е непразен → отговаряме само на тези имена
      blacklist: []          // тези имена се игнорират изцяло
    },
    groups: [],              // групи контакти / VIP (виж rule-engine.js за формата)
    throttle: {
      hours: 0,              // най-много един отговор на N часа към един подател (0 = без)
      delaySeconds: 0        // отлагане на отговора (секунди), за да не изглежда машинно
    },
    inbox: [],               // съобщения в симулирания sandbox чат
    log: [],                 // дневник на изпратените авто-отговори

    // ПАЗИТЕЛ (проверка „Добре ли си?") — виж core/guardian.js.
    guardian: {
      enabled: false,        // включен ли е пазителят
      hours: 12,             // N часа без активност → пита „Добре ли си?"
      graceMinutes: 15,      // M минути за отговор, после сигнал към близките
      sleep: {               // часове за сън: в този прозорец не пита (проверката се отлага)
        enabled: true,
        from: '22:00',
        to: '07:00'
      },
      myName: '',            // име на потребителя в сигнала (по избор)
      shareLocation: false,  // да прилага ли местоположение (иска разрешение само при включване)
      contacts: [],          // близки: { id, name, phone, pupikesId }
      lastActivity: Date.now(), // последна активност (докосване/отваряне/писане в нашия чат)
      askedAt: 0,            // кога сме попитали (0 = не чакаме отговор)
      alertedAt: 0,          // кога последно изпратихме сигнал
      urgent: [],            // кой е писал спешно междувременно: { at, sender, channel, text }
      pending: [],           // сигнали без автоматичен канал (за ръчно SMS/споделяне): { id, at, name, phone, text }
      log: []                // дневник на проверките: { at, kind, note }
    },

    // ДЕЛЕГАТ: спешните съобщения се препращат на определен човек.
    delegate: {
      enabled: false,
      name: '',              // име на делегата (влиза в отговора „Ще ви отговори …")
      phone: '',             // телефон (SMS за ръчно препращане)
      pupikesId: '',         // идентификатор в нашия чат (автоматично препращане)
      keywords: t('dg_kw_default'), // ключови думи (със запетая)
      vip: true,             // да препраща и от VIP групи
      reply: t('dg_default_reply')  // шаблон на отговора към подателя ({delegate}, {name})
    },

    // ОТГОВОР НА ЕЗИКА НА ПОДАТЕЛЯ (core/lang-detect.js + core/translate.js).
    langReply: { enabled: true },

    // Канали, към които роботът се връзва. Всеки канал може да се включи/изключи
    // отделно. WhatsApp/Viber/Messenger работят само в native билд + „Notification
    // access". Pupikes е нашият собствен чат (връзка по HTTP към чат бекенда).
    channels: {
      local: { enabled: true },        // вграденият демо чат — винаги наличен
      whatsapp: { enabled: true },     // авто-отговор иска „Notification access"
      viber: { enabled: true },
      messenger: { enabled: true },
      pupikes: {
        enabled: false,                // изключен по подразбиране, докато не се настрои
        baseUrl: '',                   // напр. https://my.girl.place
        phone: '',                     // телефон за вход в чата
        password: '',                  // парола за вход в чата
        token: '',                     // готов Bearer токен (по избор, вместо телефон+парола)
        accountId: '',                 // нашият user_id (попълва се при вход)
        pollSeconds: 20                // на колко секунди да проверяваме за нови съобщения
      }
    },

    // Обработени съобщения по канал/разговор (за да не отговаряме два пъти на едно).
    seen: {
      pupikes: {}                          // { [friendId]: { lastTs, ids: [...] } }
    }
  };
}

let _state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const def = defaultState();
    // Вложените обекти се сливат отделно, за да получат старите записи новите полета.
    const schedule = { ...def.schedule, ...(parsed.schedule || {}) };
    schedule.quiet = { ...def.schedule.quiet, ...((parsed.schedule && parsed.schedule.quiet) || {}) };
    schedule.vacation = { ...def.schedule.vacation, ...((parsed.schedule && parsed.schedule.vacation) || {}) };
    const guardian = { ...def.guardian, ...(parsed.guardian || {}) };
    guardian.sleep = { ...def.guardian.sleep, ...((parsed.guardian && parsed.guardian.sleep) || {}) };
    for (const k of ['contacts', 'urgent', 'pending', 'log']) if (!Array.isArray(guardian[k])) guardian[k] = [];
    return {
      ...def,
      ...parsed,
      schedule,
      throttle: { ...def.throttle, ...(parsed.throttle || {}) },
      groups: Array.isArray(parsed.groups) ? parsed.groups : [],
      guardian,
      delegate: { ...def.delegate, ...(parsed.delegate || {}) },
      langReply: { ...def.langReply, ...(parsed.langReply || {}) }
    };
  } catch (e) {
    console.warn('storage: повреден запис, ползвам по подразбиране', e);
    return defaultState();
  }
}

export function getState() {
  return _state;
}

// Сливане на частична промяна + запис.
export function setState(patch) {
  _state = { ...(_state), ...patch };
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
