// Version: 1.0001
// translate.js — превод на заглавията към избрания език БЕЗ ключ/акаунт, през MyMemory
// (същият безплатен преводач като в selflearning). Кешира резултатите, за да не праща
// една и съща заявка два пъти и да пести от лимита. При всяка грешка връща ОРИГИНАЛА —
// по-добре да видиш заглавието на изходния език, отколкото нищо.

// Нашите 15 кода → кодове, които MyMemory разбира (ISO-639-1, с малки изключения).
const MM = {
  bg: 'bg', ru: 'ru', uk: 'uk', en: 'en', de: 'de', fr: 'fr', es: 'es',
  'es-MX': 'es-MX', it: 'it', pt: 'pt', ar: 'ar', hi: 'hi', ja: 'ja',
  ky: 'ky', 'zh-Hant': 'zh-TW'
};

function mm(code) { return MM[code] || (code ? String(code).split('-')[0] : 'en'); }

// Имейл за MyMemory `de=` — вдига БЕЗПЛАТНИЯ анонимен лимит от 5000 на 50000 знака/ден
// (без ключ/акаунт). БЕЗ него преводът спираше след n-тата статия („MYMEMORY WARNING:
// YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY“) и оставаше оригиналът.
const MYMEMORY_EMAIL = 'ltd.dai.grup@gmail.com';

// Кеш в паметта за сесията + лек траен кеш в localStorage (за повтарящи се заглавия).
const memCache = new Map();
const LS_PREFIX = 'si.tr.';

function cacheGet(key) {
  if (memCache.has(key)) return memCache.get(key);
  try {
    const v = localStorage.getItem(LS_PREFIX + key);
    if (v != null) { memCache.set(key, v); return v; }
  } catch (_) {}
  return null;
}

function cacheSet(key, val) {
  memCache.set(key, val);
  try { localStorage.setItem(LS_PREFIX + key, val); } catch (_) {}
}

// Малък стабилен хеш за ключ на кеша (за да не пазим целия текст като ключ).
function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

import { fetchTimeout } from './net.js';

// Превежда едно заглавие. src/tgt са НАШИ кодове (bg, ru, … zh-Hant).
// Връща преведения текст, а при всякакъв проблем — оригинала.
export async function translateText(text, src, tgt) {
  const s = String(text || '').trim();
  if (!s) return text;
  const sCode = mm(src), tCode = mm(tgt);
  if (!tCode || sCode === tCode) return text;       // същият език → няма какво да превеждаме
  if (s.length > 480) return text;                  // MyMemory реже дългите — оставяме оригинала

  const key = mm(src) + '|' + tCode + '|' + hash(s);
  const hit = cacheGet(key);
  if (hit != null) return hit;

  try {
    const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(s) +
      '&langpair=' + encodeURIComponent(sCode + '|' + tCode) +
      '&de=' + encodeURIComponent(MYMEMORY_EMAIL);
    const res = await fetchTimeout(url, { headers: { Accept: 'application/json' } }, 12000);
    if (!res || !res.ok) return text;
    let data = null;
    try { data = await res.json(); } catch (_) { try { data = JSON.parse(await res.text()); } catch (__) { return text; } }
    const tr = data && data.responseData && data.responseData.translatedText;
    if (!tr || /MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID/i.test(tr)) return text;
    const out = decode(tr);
    cacheSet(key, out);
    return out;
  } catch (e) {
    return text;
  }
}

// MyMemory понякога връща HTML същности (&#39; и т.н.) — декодираме основните.
function decode(s) {
  return String(s)
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCharCode(parseInt(n, 10)); } catch (e) { return ''; } });
}

// Превежда списък от новини „на място“ (item.titleShown), едно по едно (леко натоварване
// на безплатния лимит), като подава готовите наживо през onProgress(index). Спира, ако
// stop() върне true (напр. потребителят е сменил държава/език).
export async function translateList(items, src, tgt, onProgress, stop) {
  for (let i = 0; i < items.length; i++) {
    if (typeof stop === 'function' && stop()) return;
    const it = items[i];
    if (!it || it.titleShown) continue;
    const tr = await translateText(it.title, it.srcLang || src, tgt);
    it.titleShown = tr;
    it.translated = (tr !== it.title);
    if (typeof onProgress === 'function') { try { onProgress(i); } catch (_) {} }
  }
}
