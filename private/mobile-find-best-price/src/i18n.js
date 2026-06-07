// Version: 1.0193
// Find Best Price (мобилно) — i18n: тегли СЪЩИТЕ JSON преводи от сървъра
// (/find-best-price/i18n/<код>.json) → един източник за уеб и мобилно. 15 езика.
import { API_BASE } from './config';

export const SUPPORTED = [
  { code: 'en', name: 'English' }, { code: 'bg', name: 'Български' }, { code: 'ru', name: 'Русский' },
  { code: 'ky', name: 'Кыргызча' }, { code: 'uk', name: 'Українська' }, { code: 'zh-Hant', name: '中文' },
  { code: 'hi', name: 'हिन्दी' }, { code: 'fr', name: 'Français' }, { code: 'de', name: 'Deutsch' },
  { code: 'es', name: 'Español' }, { code: 'es-MX', name: 'Español (MX)' }, { code: 'ja', name: '日本語' },
  { code: 'it', name: 'Italiano' }, { code: 'pt', name: 'Português' }, { code: 'ar', name: 'العربية' },
];

let dict = {}, fallback = {};
export let lang = 'en';

export async function loadLang(code) {
  async function f(c) {
    try { const r = await fetch(API_BASE + '/find-best-price/i18n/' + c + '.json'); return r.ok ? await r.json() : {}; }
    catch (e) { return {}; }
  }
  dict = await f(code);
  fallback = (code !== 'en') ? await f('en') : dict;
  lang = code;
}

export function t(key, vars) {
  let s = (dict[key] != null) ? dict[key] : (fallback[key] != null) ? fallback[key] : key;
  if (vars) Object.keys(vars).forEach(function (k) { s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]); });
  return s;
}
