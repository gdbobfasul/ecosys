// Version: 1.0001
// languages.js — 15-те езика, които ползваме на сайта (същите като public/translations).
//
// За всеки език пазим:
//   code   — кодът от сайта (за съвместимост с преводите/съдържанието)
//   voice  — BCP-47 локал за ГЛАС (STT разпознаване + TTS синтез); избран е вариантът
//            с най-добро покритие за реч (напр. pt-BR, zh-TW), без да мени езика на сайта
//   bg     — име на български (за менюто)
//   native — родно име (за разпознаваемост)
//
// Роботчето СЛУША (STT) и ГОВОРИ (TTS) на тези езици; отговаря/превежда на избрания.
// ЧЕСТНО: реалното STT/TTS покритие зависи от устройството/браузъра — някои езици
// (напр. киргизки) може да липсват на конкретен телефон; тогава апът тихо деградира
// (пише вместо да слуша) и казва честно, че гласът за този език не е наличен тук.

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

// Бърз достъп по voice-локал (за избора в Настройки).
export function languageByVoice(voice) {
  return LANGUAGES.find((l) => l.voice === voice) || LANGUAGES[0];
}
// По код от сайта.
export function languageByCode(code) {
  return LANGUAGES.find((l) => l.code === code) || LANGUAGES[0];
}
// Само двубуквената основа на voice-локала (за Web Speech съвпадение по префикс).
export function voiceBase(voice) {
  return String(voice || 'bg-BG').split('-')[0];
}
