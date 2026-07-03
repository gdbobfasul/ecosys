// Version: 1.0001
// languages.js — 15-те езика на екосистемата (същите като public/translations).
export const LANGUAGES = [
  { code: 'bg',      bg: 'Български',            native: 'Български' },
  { code: 'ru',      bg: 'Руски',               native: 'Русский' },
  { code: 'uk',      bg: 'Украински',           native: 'Українська' },
  { code: 'en',      bg: 'Английски',           native: 'English' },
  { code: 'de',      bg: 'Немски',              native: 'Deutsch' },
  { code: 'fr',      bg: 'Френски',             native: 'Français' },
  { code: 'es',      bg: 'Испански',            native: 'Español' },
  { code: 'es-MX',   bg: 'Испански (Мексико)',  native: 'Español (MX)' },
  { code: 'it',      bg: 'Италиански',          native: 'Italiano' },
  { code: 'pt',      bg: 'Португалски',         native: 'Português' },
  { code: 'ar',      bg: 'Арабски',             native: 'العربية' },
  { code: 'hi',      bg: 'Хинди',               native: 'हिन्दी' },
  { code: 'ja',      bg: 'Японски',             native: '日本語' },
  { code: 'ky',      bg: 'Киргизки',            native: 'Кыргызча' },
  { code: 'zh-Hant', bg: 'Китайски (трад.)',    native: '繁體中文' }
];

export const RTL_CODES = ['ar'];

export function languageByCode(code) {
  return LANGUAGES.find((l) => l.code === code) || LANGUAGES.find((l) => l.code === 'en');
}
