// Version: 1.0021
// translate.js — отговор НА ЕЗИКА НА ПОДАТЕЛЯ.
//
// 1) Ако шаблонът на отговора е един от вградените (библиотеката, отговор при отсъствие,
//    отпуска, група, делегат) — вземаме СЪЩИЯ шаблон на другия език от i18n. Офлайн, мигновено.
// 2) Ако е произволен текст на потребителя — превод през безплатния преводач MyMemory,
//    пряко и при неуспех през нашия relay (https://pupikes.app/api/relay/get?url=), както в
//    другите ни приложения (Huawei 3.1 — Китай). ВЕДНЪЖ на пускане за даден текст+език:
//    резултатът се кешира (памет + localStorage); неуспехът се помни за сесията и не се
//    повтаря. При проблем се връща оригиналът — роботът никога не мълчи заради превода.
//
// Променливите {name}, {time}, {date}, {text}, {until}, {delegate} се пазят от преводача
// чрез временни маркери VAR0…VARn и се връщат след превода.
import { getLang, tIn, templateKeyFor } from './i18n.js';

const RELAY_BASE = 'https://pupikes.app/api/relay/get?url=';
const MYMEMORY_EMAIL = 'ltd.dai.grup@gmail.com'; // вдига безплатния лимит на MyMemory
const LS_PREFIX = 'arb.tr.';
const MM = { bg: 'bg', ru: 'ru', uk: 'uk', en: 'en', de: 'de', fr: 'fr', es: 'es', 'es-MX': 'es-MX', it: 'it', pt: 'pt', ar: 'ar', hi: 'hi', ja: 'ja', ky: 'ky', 'zh-Hant': 'zh-TW' };

const memCache = new Map();
const failedThisRun = new Set();

// Таймаут без AbortController (CapacitorHttp не го поддържа — научен урок в екосистемата).
function fetchTimeout(url, ms) {
  return Promise.race([
    fetch(url, { headers: { Accept: 'application/json, */*' } }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms || 12000))
  ]);
}

function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
function cacheGet(key) {
  if (memCache.has(key)) return memCache.get(key);
  try { const v = localStorage.getItem(LS_PREFIX + key); if (v != null) { memCache.set(key, v); return v; } } catch (_) {}
  return null;
}
function cacheSet(key, val) {
  memCache.set(key, val);
  try { localStorage.setItem(LS_PREFIX + key, val); } catch (_) {}
}
function decode(s) {
  return String(s)
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCharCode(parseInt(n, 10)); } catch (e) { return ''; } });
}

// Един опит за превод (пряко или през relay). Хвърля при неуспех.
async function mymemory(url, ms) {
  const res = await fetchTimeout(url, ms);
  if (!res || !res.ok) throw new Error('HTTP ' + (res ? res.status : '—'));
  const raw = await res.text();
  let data = null;
  try { data = JSON.parse(raw); } catch (_) { throw new Error('bad-json'); }
  const tr = data && data.responseData && data.responseData.translatedText;
  if (!tr || /MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID/i.test(tr)) throw new Error('empty');
  return decode(tr);
}

// Превежда произволен текст от езика на приложението към tgt. Връща текста (оригинала при проблем).
export async function translateText(text, tgt, src) {
  const s = String(text || '').trim();
  const from = MM[src || getLang()] || 'en';
  const to = MM[tgt] || 'en';
  if (!s || from === to || s.length > 480) return text;
  const key = from + '|' + to + '|' + hash(s);
  const hit = cacheGet(key);
  if (hit != null) return hit;
  if (failedThisRun.has(key)) return text; // веднъж на пускане — не повтаряме неуспеха
  const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(s) +
    '&langpair=' + encodeURIComponent(from + '|' + to) + '&de=' + encodeURIComponent(MYMEMORY_EMAIL);
  try {
    let out;
    try { out = await mymemory(url, 12000); }
    catch (_) { out = await mymemory(RELAY_BASE + encodeURIComponent(url), 15000); }
    cacheSet(key, out);
    return out;
  } catch (e) {
    failedThisRun.add(key);
    return text;
  }
}

// Шаблон на отговор на друг език: вграден ключ → i18n; иначе превод с пазене на променливите.
export async function localizeTemplate(tpl, lang) {
  const raw = String(tpl || '');
  if (!raw.trim() || !lang || lang === getLang()) return raw;

  const key = templateKeyFor(raw);
  if (key) return tIn(key, lang);

  const vars = [];
  const masked = raw.replace(/\{(\w+)\}/g, (m) => { vars.push(m); return ' VAR' + (vars.length - 1) + ' '; });
  const out = await translateText(masked, lang);
  if (out === masked) return raw;
  return String(out)
    .replace(/\s*VAR\s?(\d+)\s*/gi, (m, i) => ' ' + (vars[parseInt(i, 10)] || '') + ' ')
    .replace(/\s{2,}/g, ' ').trim();
}

// Крайният отговор за дадено решение на rule-engine, на езика на подателя (ако е включено).
// decision носи tpl + ctx; входящият текст служи за разпознаване на езика.
import { getState } from './storage.js';
import { renderTemplate } from './rule-engine.js';
import { replyLangFor } from './lang-detect.js';
export async function replyForSender(decision, incomingText) {
  if (!decision) return '';
  const lr = getState().langReply;
  if (!lr || lr.enabled === false || !decision.tpl) return decision.reply;
  const lang = replyLangFor(incomingText, getLang());
  if (lang === getLang()) return decision.reply;
  try {
    const tplL = await localizeTemplate(decision.tpl, lang);
    return renderTemplate(tplL, { ...(decision.ctx || {}), lang });
  } catch (_) { return decision.reply; }
}
