// Version: 1.0027
// ВГРАДЕН СНИМКОВ ПАКЕТ (Huawei 3.1, 11.09.2026 — „Forex, World, Macro report no connection", тестват от Китай).
// Апът носи в себе си public/reference/pw-snapshot.json (всичко, което пазарните табове показват) и
// public/reference/pw-history/<файл>.json (дневна история до 5 г. за графиките). Генерира ги
// deploy-scripts/gen-pricewatch-snapshot.mjs при билд. Четат се с обикновен fetch от собствения произход
// на апа (файл в APK-то) — НЕ минават през мрежата/CapacitorHttp, затова работят и в самолетен режим.
// Редът навсякъде: (1) вграденият пакет — винаги; (2) последно свалените живи данни (localStorage), ако са
// по-нови; (3) живите данни (пряко → relay) само ОБНОВЯВАТ показаното.

const DAY = 86400000;
const BASE = 'reference/';
function local(rel) { try { return new URL(BASE + rel, location.href).href; } catch (_) { return BASE + rel; } }

// Име на файла с историята — същото правило като в генератора.
export function histFile(sym) { return String(sym).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, ''); }

let _snapP = null;
export function loadSnapshot() {
  if (!_snapP) {
    _snapP = (async () => {
      try { const r = await fetch(local('pw-snapshot.json')); return r && r.ok ? await r.json() : null; } catch (_) { return null; }
    })();
  }
  return _snapP;
}
// Дата на пакета (за надписа „данни към …"), форматирана по езика на апа.
export function fmtDate(ts, locale) {
  try { return new Date(ts).toLocaleDateString(locale || undefined, { year: 'numeric', month: 'short', day: 'numeric' }); } catch (_) { return new Date(ts).toISOString().slice(0, 10); }
}

// Дневна история: [{ t, close }] или null. Кеш в паметта.
const _hist = {};
export async function loadHistory(sym) {
  const f = histFile(sym);
  if (f in _hist) return _hist[f];
  let out = null;
  try {
    const r = await fetch(local('pw-history/' + encodeURIComponent(f) + '.json'));
    const o = r && r.ok ? await r.json() : null;
    if (o && Array.isArray(o.c) && isFinite(o.t0)) {
      out = [];
      for (let i = 0; i < o.c.length; i++) { const d = o.d ? o.d[i] : i; if (isFinite(o.c[i])) out.push({ t: o.t0 + d * DAY, close: o.c[i] }); }
    }
  } catch (_) { out = null; }
  _hist[f] = out;
  return out;
}

// Последно свалените живи данни по таб (за да не се връщаме към по-стария вграден пакет след успешна връзка).
const LS = 'pwb.mkt.';
export function saveLive(tab, model) {
  try { const s = JSON.stringify({ ts: Date.now(), model }); if (s.length < 400000) localStorage.setItem(LS + tab, s); } catch (_) {}
}
export function loadLive(tab) {
  try { const r = localStorage.getItem(LS + tab); if (r) { const o = JSON.parse(r); if (o && o.model && isFinite(o.ts)) return o; } } catch (_) {}
  return null;
}
