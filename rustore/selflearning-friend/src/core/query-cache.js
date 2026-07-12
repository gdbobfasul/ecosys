// Version: 1.0016
// query-cache.js — ВРЕМЕНЕН офлайн кеш на СКОРОШНИ въпроси/отговори. Цел: ако НЯМА интернет,
// ботът пак да може да отговори по ПОСЛЕДНИТЕ теми на питащия. Строго частичен, дублира сървърната/
// уеб информация, локален, LRU (най-старите падат). Лимитът е РАЗЛИЧЕН по устройство:
//   • телефон — малък (по подразбиране 6 MB), ограничен и от реалната свободна квота;
//   • компютър — по-голям (по подразбиране 40 MB).
import { platformKind, diskCapacity } from './learn-budget.js';

const KEY = 'slf.qcache.v1';
const MAX_ENTRIES = 300;

function load() { try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : []; } catch (_) { return []; } }
function save(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (_) {} }

let _capMB = null;
// Опреснява лимита по устройство (вика се веднъж при старт; безопасно и без него).
export async function refreshCacheCap() {
  const base = platformKind() === 'desktop' ? 40 : 6;
  try { const d = await diskCapacity(); if (d && d.freeMB > 0) { _capMB = Math.max(2, Math.min(base, Math.floor(d.freeMB * 0.1))); return _capMB; } } catch (_) {}
  _capMB = base; return _capMB;
}
function capBytes() { return (_capMB || (platformKind() === 'desktop' ? 40 : 6)) * 1024 * 1024; }

function toks(s) {
  try { return String(s || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 2); }
  catch (_) { return String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2); }
}

// Запис на отговор (когато е получен ОНЛАЙН) → за офлайн ползване по-късно.
export function cacheAnswer(query, answer) {
  const q = String(query || '').trim(), a = String(answer || '').trim();
  if (!q || !a) return;
  let list = load().filter((e) => e.q.toLowerCase() !== q.toLowerCase());
  list.unshift({ q, a, at: Date.now(), t: toks(q).slice(0, 20) });
  if (list.length > MAX_ENTRIES) list = list.slice(0, MAX_ENTRIES);
  // ограничи по РАЗМЕР (LRU: най-старите отпадат)
  let guard = 0;
  while (list.length > 1 && JSON.stringify(list).length > capBytes() && guard++ < MAX_ENTRIES) list.pop();
  save(list);
}

// Търси кеширан отговор по въпрос (точен ИЛИ по припокриване на ключови думи ≥50%).
export function findCachedAnswer(query) {
  const q = String(query || '').trim(); if (!q) return null;
  const list = load(); if (!list.length) return null;
  const exact = list.find((e) => e.q.toLowerCase() === q.toLowerCase());
  if (exact) return exact.a;
  const qt = toks(q); if (!qt.length) return null;
  const qs = new Set(qt);
  let best = null, bestScore = 0;
  for (const e of list) {
    const et = new Set(e.t || []); let ov = 0;
    for (const w of qs) if (et.has(w)) ov++;
    const score = ov / qs.size;
    if (score > bestScore) { bestScore = score; best = e; }
  }
  return (best && bestScore >= 0.5) ? best.a : null;
}

export function cacheStats() { const l = load(); return { count: l.length, kb: Math.round(JSON.stringify(l).length / 1024), capMB: _capMB || (platformKind() === 'desktop' ? 40 : 6) }; }
export function clearQueryCache() { save([]); }
