// Version: 1.0021
// hawk-store.js — настройки и местни данни на MotionSecurityHawk (носещ ↔ наблюдаващ).
//
//   • cfg   — роля ('wearer' = носещ, 'guardian' = наблюдаващ, 'camera' = само камера, '' = още неизбрана),
//             код за сдвояване, сървър (релей), съгласие на носещия, име на носещия, интервал на теглене.
//   • trail — следата (GPS точки) — при носещия неговата собствена, при наблюдаващия получената.
//   • alerts — сигнали при наблюдаващия (помощ/падане/зона/глас) с място и запис.
//   • task  — текущата задача („рецепта") и състоянието ѝ; fence — разрешената зона.
//
// Всичко е в localStorage (както pairing.js) — без акаунти, без мрежа извън шифрования канал.

const K_CFG = 'hawk.cfg.v1';
const K_TRAIL = 'hawk.trail.v1';
const K_ALERTS = 'hawk.alerts.v1';
const K_TASK = 'hawk.task.v1';
const K_FENCE = 'hawk.fence.v1';
const K_SINCE = 'hawk.since.v1';

export const DEFAULT_RELAY = 'https://selflearning.bot.nu';
export const MAX_TRAIL = 3000;        // точки в следата (плъзгащ се прозорец)
export const MAX_ALERTS = 40;         // сигнали в списъка
const MAX_ALERTS_WITH_AUDIO = 8;      // по-старите губят звуковия запис (пести място)

function rd(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (_) { return d; } }
function wr(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }
function rm(k) { try { localStorage.removeItem(k); } catch (_) {} }

// --- Конфигурация ---------------------------------------------------------
export function getHawkCfg() {
  const c = rd(K_CFG, {});
  return {
    role: (c.role === 'wearer' || c.role === 'guardian' || c.role === 'camera') ? c.role : '',
    code: String(c.code || '').trim(),
    relayBase: String(c.relayBase || DEFAULT_RELAY).trim().replace(/\/+$/, ''),
    consent: c.consent === true,
    name: String(c.name || '').slice(0, 40),
    pollSeconds: Math.max(3, parseInt(c.pollSeconds, 10) || 6),
    voiceGuard: c.voiceGuard !== false,      // микрофонът-пазач е включен по подразбиране (носещ)
    fallGuard: c.fallGuard !== false         // датчик за падане/удар
  };
}
export function setHawkCfg(patch) { wr(K_CFG, { ...rd(K_CFG, {}), ...patch }); return getHawkCfg(); }
export function hawkRole() { return getHawkCfg().role; }
export function hawkPaired() { const c = getHawkCfg(); return !!(c.code && c.relayBase && (c.role === 'wearer' || c.role === 'guardian')); }

// --- Следа (GPS точки {lat, lng, acc, spd, ts}) -----------------------------
export function loadTrail() { const a = rd(K_TRAIL, []); return Array.isArray(a) ? a : []; }
export function saveTrail(points) {
  const arr = Array.isArray(points) ? points : [];
  wr(K_TRAIL, arr.length > MAX_TRAIL ? arr.slice(arr.length - MAX_TRAIL) : arr);
}
export function appendTrail(points) {
  const cur = loadTrail();
  const add = Array.isArray(points) ? points : [points];
  for (const p of add) if (p && Number.isFinite(p.lat) && Number.isFinite(p.lng)) cur.push(p);
  cur.sort((a, b) => (a.ts || 0) - (b.ts || 0));
  saveTrail(cur);
  return loadTrail();
}
export function clearTrail() { rm(K_TRAIL); }

// --- Сигнали (при наблюдаващия) --------------------------------------------
// { id, kind: 'help'|'fall'|'fence'|'voice'|'arrived'|'home'|'stopped', ts, lat, lng, words, audio, text }
export function loadAlerts() { const a = rd(K_ALERTS, []); return Array.isArray(a) ? a : []; }
export function addAlert(alert) {
  const list = loadAlerts();
  const item = { id: 'a' + Date.now() + Math.random().toString(36).slice(2, 6), ...alert };
  list.unshift(item);
  const trimmed = list.slice(0, MAX_ALERTS).map((a, i) => (i >= MAX_ALERTS_WITH_AUDIO && a.audio) ? { ...a, audio: null, audioDropped: true } : a);
  wr(K_ALERTS, trimmed);
  return item;
}
export function clearAlerts() { rm(K_ALERTS); }

// --- Задача („рецепта") -----------------------------------------------------
// { id, name, instruction, dest:{lat,lng}, home:{lat,lng}|null, radius, state: 'going'|'arrived'|'returning'|'home'|'cancelled', ts }
export function loadTask() { return rd(K_TASK, null); }
export function saveTask(task) { if (task) wr(K_TASK, task); else rm(K_TASK); }

// --- Разрешена зона -----------------------------------------------------------
// { lat, lng, radius, ts }
export function loadFence() { return rd(K_FENCE, null); }
export function saveFence(f) { if (f) wr(K_FENCE, f); else rm(K_FENCE); }

// --- Курсор на канала (последният получен id от сървъра) ------------------------
export function getSince() { return parseInt(rd(K_SINCE, 0), 10) || 0; }
export function setSince(v) { wr(K_SINCE, parseInt(v, 10) || 0); }

// Пълно нулиране (смяна на роля/код).
export function resetHawkData() { rm(K_TRAIL); rm(K_ALERTS); rm(K_TASK); rm(K_FENCE); rm(K_SINCE); }
