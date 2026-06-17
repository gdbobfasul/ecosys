// storage.js — локално, on-device съхранение (localStorage).
// НЯМА мрежа, НЯМА акаунти. Всичко живее само на устройството.

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
      awayReply: 'Извън работно време сме. Ще отговорим скоро.'
    },
    rules: [],               // правила (виж rule-engine.js за формата)
    lists: {
      whitelist: [],         // ако е непразен → отговаряме само на тези имена
      blacklist: []          // тези имена се игнорират изцяло
    },
    inbox: [],               // съобщения в симулирания sandbox чат
    log: []                  // дневник на изпратените авто-отговори
  };
}

let _state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed };
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
