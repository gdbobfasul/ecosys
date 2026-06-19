// privacy.js — ГЛОБАЛЕН режим за лични данни, избран при раждането на робота.
//
// Два режима (по желание на собственика, при раждането):
//   'personal'   — роботчето СЪБИРА и помни лични данни за собственика (име, навици,
//                  предпочитания, контактни детайли). Така е твой ЛИЧЕН асистент.
//   'impersonal' — НЕ събира никакви лични данни за човека, който го обучава. Учиш го
//                  само на общи знания → става умен → можеш да го ПРОДАДЕШ/ПРЕХВЪРЛИШ
//                  „чист“, а новият собственик (ако иска) пък ще му разказва за себе си.
//
// Режимът се избира при раждането; собственикът може да го смени в Настройки (той си
// го притежава). Гейтва записа на ЛИЧНИ спомени + гласовия профил (лична биометрия).

import { getState, persist } from './storage.js';

export function dataMode() {
  const id = getState().identity || {};
  return id.dataMode === 'impersonal' ? 'impersonal' : 'personal';
}
export function isPersonalMode() { return dataMode() === 'personal'; }
export function isImpersonalMode() { return dataMode() === 'impersonal'; }

export function dataModeLabel(mode) {
  const m = mode || dataMode();
  return m === 'impersonal'
    ? 'Безличен (за продажба/прехвърляне — нула лични данни)'
    : 'Личен (помни лични данни за теб)';
}

export function setDataMode(mode) {
  const st = getState();
  st.identity = st.identity || {};
  st.identity.dataMode = (mode === 'impersonal') ? 'impersonal' : 'personal';
  // В безличния режим изключваме и гласовия профил — той е ЛИЧНА биометрия.
  if (st.identity.dataMode === 'impersonal' &&
      st.settings && st.settings.voice && st.settings.voice.profile) {
    st.settings.voice.profile.enabled = false;
  }
  persist();
  return st.identity.dataMode;
}

// Евристика „това лични данни за собственика ли са?“ — съзнателно консервативна.
// Хваща саморазкриване от първо лице: име, местоживеене, контакти, предпочитания, близки.
// ВАЖНО: БЕЗ \b — ASCII word-boundary НЕ работи с кирилица (в JS regex без 'u' флаг
// „\bказвам\b" НЕ съвпада с кирилска дума), което преди тихо пропускаше ВСИЧКО и
// чупеше защитата на безличния режим. Ползваме чисто съвпадение на фразата (консервативно).
const PERSONAL_RE = [
  /казвам се/i, /името ми е/i, /аз се казвам/i, /аз съм/i,
  /по професия съм/i, /работя като/i,
  /мо(?:ят|ята|ите|и|е)\s/i, /на мен ми/i, /мен ме/i,
  /живея/i, /роден съм/i, /родена съм/i, /на\s+\d+\s+години/i,
  /обичам/i, /мразя/i, /предпочитам/i, /любим(?:ият|ата|ото|ите)?/i,
  /телефон(?:ът)?\s+ми/i, /имейл(?:ът)?\s+ми/i, /е-?поща(?:та)?\s+ми/i,
  /адрес(?:ът)?\s+ми/i, /семейств/i, /жена ми/i, /мъжът ми/i, /гаджето ми/i,
  /дете(?:то)?\s+ми/i, /децата ми/i, /рожден(?:ия)?\s+ден/i,
  /паролата ми/i, /ЕГН/i, /булстат/i, /картата ми/i, /банката ми/i
];

export function looksPersonal(text) {
  const s = String(text || '');
  return PERSONAL_RE.some((re) => re.test(s));
}

// Колко лични спомена има (за Настройки/изчистване).
export function personalMemoryCount() {
  const mem = getState().memory || [];
  return mem.filter((m) => looksPersonal(m.value) || looksPersonal(m.key)).length;
}

// Изтрива личните спомени + гласовия профил (за продажба/прехвърляне). Връща броя изтрити спомени.
export function forgetPersonalData() {
  const st = getState();
  const before = (st.memory || []).length;
  st.memory = (st.memory || []).filter((m) => !(looksPersonal(m.value) || looksPersonal(m.key)));
  if (st.settings && st.settings.voice && st.settings.voice.profile) {
    const p = st.settings.voice.profile;
    p.count = 0; p.mean = null; p.m2 = null; p.updatedAt = null;
  }
  persist();
  return before - st.memory.length;
}

// Дружелюбен отказ, когато в безличен режим се опитат да запишат лично.
export function refusePersonalText() {
  return 'Сега съм в БЕЗЛИЧЕН режим — не събирам лични данни за теб (за да мога после да ' +
    'бъда прехвърлен/продаден „чист“). Затова това не го записах. Общи знания уча с радост. ' +
    'Ако искаш да помня и лични неща — смени режима от Настройки → „Лични данни“.';
}
