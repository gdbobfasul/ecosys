// languages.js — 15-те езика на KCY екосистемата (за изговаряне на бележките).
//   code  — кодът от екосистемата
//   voice — BCP-47 локал за ГЛАС (TTS синтез)
//   bg    — име на български (за менюто)
export const LANGUAGES = [
  { code: 'bg',      voice: 'bg-BG', bg: 'Български' },
  { code: 'ru',      voice: 'ru-RU', bg: 'Руски' },
  { code: 'uk',      voice: 'uk-UA', bg: 'Украински' },
  { code: 'en',      voice: 'en-US', bg: 'Английски' },
  { code: 'de',      voice: 'de-DE', bg: 'Немски' },
  { code: 'fr',      voice: 'fr-FR', bg: 'Френски' },
  { code: 'es',      voice: 'es-ES', bg: 'Испански' },
  { code: 'es-MX',   voice: 'es-MX', bg: 'Испански (Мексико)' },
  { code: 'it',      voice: 'it-IT', bg: 'Италиански' },
  { code: 'pt',      voice: 'pt-BR', bg: 'Португалски' },
  { code: 'ar',      voice: 'ar-SA', bg: 'Арабски' },
  { code: 'hi',      voice: 'hi-IN', bg: 'Хинди' },
  { code: 'ja',      voice: 'ja-JP', bg: 'Японски' },
  { code: 'ky',      voice: 'ky-KG', bg: 'Киргизки' },
  { code: 'zh-Hant', voice: 'zh-TW', bg: 'Китайски (трад.)' }
];

export function voiceByCode(code) {
  const l = LANGUAGES.find((x) => x.code === code);
  return l ? l.voice : 'bg-BG';
}
