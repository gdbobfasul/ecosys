// languages.js — 15-те езика на KCY екосистемата.
// Този ЕДИН списък обслужва ДВЕ независими неща:
//   1) ГЛАСА на бележките (TTS) — полето `voice` (BCP-47 локал за синтез);
//   2) ЕЗИКА на потребителския интерфейс (i18n) — полето `native` (име на самия език).
//   code   — кодът от екосистемата
//   voice  — BCP-47 локал за ГЛАС (TTS синтез на бележките)
//   bg     — име на български (за падащото меню на бележките)
//   native — име на езика на самия него (за избора на език на интерфейса)
export const LANGUAGES = [
  { code: 'bg',      voice: 'bg-BG', bg: 'Български',            native: 'Български' },
  { code: 'ru',      voice: 'ru-RU', bg: 'Руски',               native: 'Русский' },
  { code: 'uk',      voice: 'uk-UA', bg: 'Украински',           native: 'Українська' },
  { code: 'en',      voice: 'en-US', bg: 'Английски',           native: 'English' },
  { code: 'de',      voice: 'de-DE', bg: 'Немски',              native: 'Deutsch' },
  { code: 'fr',      voice: 'fr-FR', bg: 'Френски',             native: 'Français' },
  { code: 'es',      voice: 'es-ES', bg: 'Испански',            native: 'Español' },
  { code: 'es-MX',   voice: 'es-MX', bg: 'Испански (Мексико)',  native: 'Español (MX)' },
  { code: 'it',      voice: 'it-IT', bg: 'Италиански',          native: 'Italiano' },
  { code: 'pt',      voice: 'pt-BR', bg: 'Португалски',         native: 'Português' },
  { code: 'ar',      voice: 'ar-SA', bg: 'Арабски',             native: 'العربية' },
  { code: 'hi',      voice: 'hi-IN', bg: 'Хинди',               native: 'हिन्दी' },
  { code: 'ja',      voice: 'ja-JP', bg: 'Японски',             native: '日本語' },
  { code: 'ky',      voice: 'ky-KG', bg: 'Киргизки',            native: 'Кыргызча' },
  { code: 'zh-Hant', voice: 'zh-TW', bg: 'Китайски (трад.)',    native: '繁體中文' }
];

// Кодове с дясно-на-ляво писменост (за dir="rtl" на интерфейса).
export const RTL_CODES = ['ar'];

// BCP-47 локалът за ГЛАСА (TTS) на дадена бележка — НЕ зависи от езика на интерфейса.
export function voiceByCode(code) {
  const l = LANGUAGES.find((x) => x.code === code);
  return l ? l.voice : 'bg-BG';
}

// Намира записа за език по код (резерв — английски).
export function languageByCode(code) {
  return LANGUAGES.find((l) => l.code === code) || LANGUAGES.find((l) => l.code === 'en');
}
