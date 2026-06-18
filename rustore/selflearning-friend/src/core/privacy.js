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
const PERSONAL_RE = [
  /\bказвам се\b/i, /\bимето ми е\b/i, /\bаз се казвам\b/i, /\bаз съм\b/i,
  /\bпо професия съм\b/i, /\bработя като\b/i,
  /\bмо(?:ят|ята|ите|и|е)\b/i, /\bна мен ми\b/i, /\bмен ме\b/i,
  /\bживея\b/i, /\bроден съм\b/i, /\bродена съм\b/i, /\bна\s+\d+\s+години\b/i,
  /\bобичам\b/i, /\bмразя\b/i, /\bпредпочитам\b/i, /\bлюбим(?:ият|ата|ото|ите)?\b/i,
  /\bтелефон(?:ът)?\s+ми\b/i, /\bимейл(?:ът)?\s+ми\b/i, /\bе-?поща(?:та)?\s+ми\b/i,
  /\bадрес(?:ът)?\s+ми\b/i, /\bсемейств/i, /\bжена ми\b/i, /\bмъжът ми\b/i, /\bгаджето ми\b/i,
  /\bдете(?:то)?\s+ми\b/i, /\bдецата ми\b/i, /\bрожден(?:ия)?\s+ден\b/i,
  /\bпаролата ми\b/i, /\bЕГН\b/i, /\bбулстат\b/i, /\bкартата ми\b/i, /\bбанката ми\b/i
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
