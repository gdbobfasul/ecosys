// languages.js — 15-те езика на екосистемата (същите като public/translations).
// Приложенията ползват само името за разпознаване (native) + български етикет (bg);
// voice-локалът се пази за съвместимост с останалите приложения (тук не се ползва).
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

// Езици с дясно-наляво писане.
export const RTL_CODES = ['ar'];

export function languageByCode(code) {
  return LANGUAGES.find((l) => l.code === code) || LANGUAGES.find((l) => l.code === 'en');
}
