// Version: 1.0024
// sync.js — СВЪРЗВАНЕ СЪС СЪРВЪРА НА PUPIKES (искане 11.09.2026, ПО ИЗБОР, изключено по подразбиране):
//   • GET  /api/medikit/drug?q=<име>|gtin=<код>&lang=xx → { found, inn, brand, ingredients, form, indications?, links[], source }
//     — когато баркод/име НЕ е във вградените данни (преди openFDA);
//   • POST /api/medikit/learn { kind:'gtin'|'name', gtin?, name?, inn?, lang? } — когато потребителят потвърди
//     разпознато лекарство или избере кандидат (анонимно: само име/код/INN, никога снимки или лични данни);
//   • GET  /api/medikit/updates?since=<ms>&kind=gtin|name → { items, ts } — ВЕДНЪЖ на пускане; делтата се слива в
//     малък локален допълнителен индекс (localStorage, ≤ 2000 записа на вид), който gtin.js/names.js проверяват първи.
// Пряко → при грешка през relay. Изцяло тихо: всяка грешка се преглъща.
import { getJson, postJson } from './lookup.js';

export const MEDIKIT_API = 'https://pupikes.app/api/medikit';
const KEY_ON = 'med.sync', KEY_TS = 'med.sync.ts', KEY_GTIN = 'med.sync.gtin', KEY_NAMES = 'med.sync.names';
const MAX = 2000;
const APP = 'medicines';
let G = null, N = null;
// Нормализация на ключа за име — names.js подава своята (същата като в речника: транслитерация + малки букви),
// за да съвпадат ключовете от сървъра със заявките. Резерв: малки букви без знаци.
let nameKey = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9а-яё぀-ヿ㐀-鿿]+/g, '');
export function setNameKey(fn) { if (typeof fn === 'function') { nameKey = fn; N = null; } }
export function syncEnabled() { try { return localStorage.getItem(KEY_ON) === '1'; } catch (_) { return false; } }
export function setSyncEnabled(on) { try { localStorage.setItem(KEY_ON, on ? '1' : '0'); } catch (_) {} if (on) pullUpdates(true).catch(() => {}); }
function readMap(k) { try { const j = JSON.parse(localStorage.getItem(k) || '{}'); return j && typeof j === 'object' ? j : {}; } catch (_) { return {}; } }
function writeMap(k, m) { const keys = Object.keys(m); if (keys.length > MAX) for (const x of keys.slice(0, keys.length - MAX)) delete m[x]; try { localStorage.setItem(k, JSON.stringify(m)); } catch (_) {} }
// При ИЗКЛЮЧЕНА настройка апът се държи като без сървър: и вече изтеглените научени записи не се ползват.
export function extraGtin(code) { if (!syncEnabled()) return null; if (!G) G = readMap(KEY_GTIN); const d = String(code || '').replace(/\D/g, '').replace(/^0+(?=\d{12})/, ''); const v = G[d] || G['0' + d]; return v ? { brand: v.b || '', generic: v.g || '', name: [v.b, v.g].filter(Boolean).join(' · '), gtin: d, via: 'server' } : null; }
export function extraName(key) { if (!syncEnabled()) return null; if (!N) N = readMap(KEY_NAMES); const v = N[String(key || '')]; return v ? { inn: v.i || '', name: v.n || key } : null; }
// за проверка: колко записа има локалният допълнителен индекс
export function extraCounts() { if (!G) G = readMap(KEY_GTIN); if (!N) N = readMap(KEY_NAMES); return { gtin: Object.keys(G).length, name: Object.keys(N).length }; }
function mergeItems(items, kind) {
  if (!Array.isArray(items) || !items.length) return 0;
  let n = 0;
  // сървърът (/updates) връща { kind, key, n, ts, gtin, name, inn, lang }: за баркод name = търговско/разпознато име;
  // за име key = „нормализирано|език" → ключът се прави от name (не от key)
  if (kind === 'gtin') { G = G || readMap(KEY_GTIN); for (const it of items) { const d = String(it.gtin || it.key || '').replace(/\D/g, '').replace(/^0+(?=\d{12})/, ''); if (d.length < 8 || !(it.inn || it.generic || it.name || it.brand)) continue; G[d] = { b: String(it.brand || it.name || ''), g: String(it.inn || it.generic || '') }; n++; } writeMap(KEY_GTIN, G); }
  else { N = N || readMap(KEY_NAMES); for (const it of items) { const k = nameKey(it.name || String(it.key || '').split('|')[0]); if (!k || !it.inn) continue; N[k] = { i: String(it.inn), n: String(it.name || '') }; n++; } writeMap(KEY_NAMES, N); }
  return n;
}
let pulled = false;
// Веднъж на пускане (или при включване): делта от последния момент.
export async function pullUpdates(force) {
  if (!syncEnabled() || (pulled && !force)) return 0; pulled = true;
  let since = 0; try { since = parseInt(localStorage.getItem(KEY_TS) || '0', 10) || 0; } catch (_) {}
  let total = 0, ts = 0;
  for (const kind of ['gtin', 'name']) {
    try { const j = await getJson(MEDIKIT_API + '/updates?since=' + since + '&kind=' + kind); if (j && Array.isArray(j.items)) { total += mergeItems(j.items, kind); ts = Math.max(ts, parseInt(j.ts || 0, 10) || 0); } } catch (_) {}
  }
  if (ts) { try { localStorage.setItem(KEY_TS, String(ts)); } catch (_) {} }
  return total;
}
// Търсене на сървъра по име или баркод. Връща нормализиран запис или null.
export async function medikitLookup(q, lang, opts) {
  if (!syncEnabled()) return null;
  const p = opts && opts.gtin ? 'gtin=' + encodeURIComponent(String(opts.gtin)) : 'q=' + encodeURIComponent(String(q || '').trim());
  if (!p.split('=')[1]) return null;
  const j = await getJson(MEDIKIT_API + '/drug?' + p + '&lang=' + encodeURIComponent(lang || 'en'));
  if (!j || !j.found) return null;
  const inn = String(j.inn || '').trim(); const brand = String(j.brand || '').trim();
  if (!inn && !brand) return null;
  return { source: 'pupikes-server', title: brand ? brand + (inn && inn.toLowerCase() !== brand.toLowerCase() ? ' (' + inn + ')' : '') : inn, inn: inn || brand, brand, generic: inn, name: [brand, inn].filter(Boolean).join(' · '), active: Array.isArray(j.ingredients) && j.ingredients.length ? j.ingredients.map(String) : [inn].filter(Boolean), form: String(j.form || ''), description: String(j.indications || ''), links: Array.isArray(j.links) ? j.links : [], exact: true, translated: true, via: 'server' };
}
// Анонимно учене: разпознато/потвърдено име или код → сървъра (без снимки, без лични данни). Тихо.
export async function learn(rec) {
  if (!syncEnabled() || !rec) return;
  const body = { kind: rec.gtin ? 'gtin' : 'name', app: APP, lang: rec.lang || 'en' };
  if (rec.gtin) body.gtin = String(rec.gtin).replace(/\D/g, '');
  if (rec.name) body.name = String(rec.name).slice(0, 120);
  if (rec.inn) body.inn = String(rec.inn).slice(0, 120);
  if (!body.gtin && !body.name) return;
  if (body.kind === 'name' && !body.inn) return;   // сървърът иска име + INN (иначе 400) — без INN няма какво да се научи
  try { await postJson(MEDIKIT_API + '/learn', body); } catch (_) {}
}
