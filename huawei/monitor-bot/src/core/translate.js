// Version: 1.0018
// translate.js — превод на заглавия за ГЛОБАЛНОТО ТЪРСЕНЕ, БЕЗ ключ/акаунт (MyMemory —
// същият безплатен преводач като в NewsLator/selflearning). Защо: ако търсиш
// „президента на България", а сайтът е арабски, на арабски НИКОГА няма съвпадение —
// затова заглавието се превежда към езика на приложението и търсенето става в ПРЕВОДА.
// Кешира преводите (памет + localStorage), при грешка връща оригинала.

import { getLang } from './i18n.js';

// Малък fetch с краен срок (мониторният fetcher няма такъв износ).
async function fetchTimeout(url, opts, ms) {
  const ctrl = new AbortController();
  const tm = setTimeout(() => ctrl.abort(), ms || 12000);
  try { return await fetch(url, { ...(opts || {}), signal: ctrl.signal }); }
  finally { clearTimeout(tm); }
}

const MM = {
  bg: 'bg', ru: 'ru', uk: 'uk', en: 'en', de: 'de', fr: 'fr', es: 'es',
  'es-MX': 'es-MX', it: 'it', pt: 'pt', ar: 'ar', hi: 'hi', ja: 'ja',
  ky: 'ky', 'zh-Hant': 'zh-TW'
};
function mm(code) { return MM[code] || (code ? String(code).split('-')[0] : 'en'); }

// Имейл за MyMemory `de=` — вдига безплатния лимит от 5000 на 50000 знака/ден.
const MYMEMORY_EMAIL = 'ltd.dai.grup@gmail.com';

const memCache = new Map();
const LS_PREFIX = 'smon.tr.';

function cacheGet(key) {
  if (memCache.has(key)) return memCache.get(key);
  try { const v = localStorage.getItem(LS_PREFIX + key); if (v != null) { memCache.set(key, v); return v; } } catch (_) {}
  return null;
}
function cacheSet(key, val) {
  memCache.set(key, val);
  try { localStorage.setItem(LS_PREFIX + key, val); } catch (_) {}
}
function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

// Груба ПОЗНАВАЧКА на изходния език по писмеността (мониторите не знаят езика на
// емисията си). За латиница приемаме английски — най-честият случай; и при грешна
// догадка собствените имена обикновено оцеляват в превода.
export function detectLang(s) {
  const t = String(s || '');
  if (/[؀-ۿ]/.test(t)) return 'ar';
  if (/[぀-ヿ]/.test(t)) return 'ja';
  if (/[一-鿿]/.test(t)) return 'zh-Hant';
  if (/[ऀ-ॿ]/.test(t)) return 'hi';
  if (/[Ѐ-ӿ]/.test(t)) return 'ru';       // кирилица (bg/ru/uk — ru покрива най-широко)
  return 'en';
}

// Превежда едно заглавие към целевия език. При проблем връща оригинала.
export async function translateTitle(text, tgt) {
  const s = String(text || '').trim();
  if (!s) return text;
  const sCode = mm(detectLang(s)), tCode = mm(tgt || getLang());
  if (!tCode || sCode === tCode) return text;
  if (s.length > 480) return text;
  const key = sCode + '|' + tCode + '|' + hash(s);
  const hit = cacheGet(key);
  if (hit != null) return hit;
  try {
    const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(s) +
      '&langpair=' + encodeURIComponent(sCode + '|' + tCode) +
      '&de=' + encodeURIComponent(MYMEMORY_EMAIL);
    const res = await fetchTimeout(url, { headers: { Accept: 'application/json' } }, 12000);
    if (!res || !res.ok) return text;
    let data = null;
    try { data = await res.json(); } catch (_) { return text; }
    const tr = data && data.responseData && data.responseData.translatedText;
    if (!tr || /MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID/i.test(tr)) return text;
    const out = decode(tr);
    cacheSet(key, out);
    return out;
  } catch (e) { return text; }
}

function decode(s) {
  return String(s)
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCharCode(parseInt(n, 10)); } catch (e) { return ''; } });
}

// ── Гъвкаво съвпадение на фраза ─────────────────────────────────────────────
// Преводът мени окончанията („президента" ↔ „президентът") → съвпадаме ПО ДУМИ:
// всяка значеща дума от фразата (≥3 знака) трябва да се среща в текста, като
// на по-дългите думи се допуска отрязано окончание (последните 2 знака).
export function phraseMatches(phrase, text) {
  const hay = String(text || '').toLowerCase();
  if (!hay) return false;
  const words = String(phrase || '').toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
  if (!words.length) {
    const p = String(phrase || '').toLowerCase().trim();
    return !!p && hay.includes(p);
  }
  return words.every((w) => {
    if (hay.includes(w)) return true;
    if (w.length >= 6) return hay.includes(w.slice(0, w.length - 2));  // без окончанието
    return false;
  });
}
