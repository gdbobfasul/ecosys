// Version: 1.0023
// schedule.js — ГРАФИК ЗА ПРИЕМ + напомняния (Huawei 4.1, 11.09.2026). Записите са в localStorage
// (med.schedule), приемите — в дневник по дата (med.schedule.log). Напомнянията са МЕСТНИ известия
// (Capacitor LocalNotifications, дневно повторение по час:минута, без сървър); в браузър — таймери
// докато апът е отворен (Notification API, ако е разрешен). Плъгинът се взима СИНХРОННО от
// window.Capacitor.Plugins (динамичен import увисва в WebView — урок от autoreply-bot/routine-bot).
const KEY = 'med.schedule', LOG = 'med.schedule.log';
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch (_) { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };

export function listSchedule() { return read(KEY, []); }
export function todayKey(d) { const x = d || new Date(); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }
export function isTaken(id, time, day) { const log = read(LOG, {}); return !!(log[day || todayKey()] || {})[id + '@' + time]; }
export function markTaken(id, time, on) { const log = read(LOG, {}); const day = todayKey(); log[day] = log[day] || {}; if (on === false) delete log[day][id + '@' + time]; else log[day][id + '@' + time] = Date.now(); write(LOG, log); }

function LN() { try { const c = window.Capacitor; if (c && typeof c.isNativePlatform === 'function' && c.isNativePlatform() && c.Plugins && c.Plugins.LocalNotifications) return c.Plugins.LocalNotifications; } catch (_) {} return null; }
// Стабилен числов id за известие от id на записа + час (Android иска int).
function notifId(id, time) { let h = 0; const s = id + '@' + time; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h) % 2000000000; }

// Добавя/обновява запис и задава напомнянията. entry = { id?, name, dose, times:['08:00'], days:0|n, note }
// Връща { entry, notif: 'native'|'web'|'denied'|'none' }.
export async function saveEntry(entry, texts) {
  const list = listSchedule();
  const e = Object.assign({ id: 'm' + Date.now().toString(36), created: Date.now() }, entry);
  e.times = (e.times || []).filter((t) => /^\d{1,2}:\d{2}$/.test(t)).map((t) => t.padStart(5, '0')).sort();
  e.days = Math.max(0, parseInt(e.days, 10) || 0);
  if (e.days) e.until = new Date(Date.now() + e.days * 86400000).toISOString().slice(0, 10);
  const idx = list.findIndex((x) => x.id === e.id); if (idx >= 0) list[idx] = e; else list.push(e);
  write(KEY, list);
  const notif = await scheduleNotifs(e, texts);
  return { entry: e, notif };
}
export async function deleteEntry(id) {
  const list = listSchedule(); const e = list.find((x) => x.id === id);
  write(KEY, list.filter((x) => x.id !== id));
  if (e) await cancelNotifs(e);
}
async function scheduleNotifs(e, texts) {
  const ln = LN();
  const title = (texts && texts.title) || 'Pupikes Medicines';
  const body = (texts && texts.body) || (e.name + ' — ' + (e.dose || ''));
  if (ln) {
    try {
      let perm = await ln.checkPermissions();
      if (perm.display !== 'granted') perm = await ln.requestPermissions();
      if (perm.display !== 'granted') return 'denied';
      await cancelNotifs(e);
      const notifications = e.times.map((t) => { const [h, m] = t.split(':').map((x) => parseInt(x, 10)); return { id: notifId(e.id, t), title, body, schedule: { on: { hour: h, minute: m }, allowWhileIdle: true }, extra: { entry: e.id, time: t } }; });
      await ln.schedule({ notifications });
      return 'native';
    } catch (_) { return 'none'; }
  }
  // Уеб: Notification API + таймери докато табът е отворен.
  try {
    if (typeof Notification !== 'undefined') {
      if (Notification.permission === 'default') await Notification.requestPermission();
      webTimers(e, title, body);
      return Notification.permission === 'granted' ? 'web' : 'denied';
    }
  } catch (_) {}
  return 'web';
}
const timers = {};
function webTimers(e, title, body) {
  for (const t of e.times) {
    const k = e.id + '@' + t; if (timers[k]) clearTimeout(timers[k]);
    const [h, m] = t.split(':').map((x) => parseInt(x, 10)); const now = new Date(); const at = new Date(); at.setHours(h, m, 0, 0); if (at <= now) at.setDate(at.getDate() + 1);
    timers[k] = setTimeout(() => { try { if (Notification.permission === 'granted') new Notification(title, { body }); } catch (_) {} webTimers(e, title, body); }, Math.min(at - now, 2147000000));
  }
}
async function cancelNotifs(e) {
  const ln = LN(); if (!ln) { for (const t of (e.times || [])) { const k = e.id + '@' + t; if (timers[k]) { clearTimeout(timers[k]); delete timers[k]; } } return; }
  try { await ln.cancel({ notifications: (e.times || []).map((t) => ({ id: notifId(e.id, t) })) }); } catch (_) {}
}
// При старт на апа: подновява уеб-таймерите (нативните известия са трайни) и чисти изтеклите записи.
export function restoreTimers(texts) {
  const list = listSchedule(); const today = todayKey(); let changed = false;
  for (const e of list.slice()) { if (e.until && e.until < today) { list.splice(list.indexOf(e), 1); changed = true; cancelNotifs(e); } }
  if (changed) write(KEY, list);
  if (!LN()) for (const e of list) webTimers(e, (texts && texts.title) || 'Pupikes Medicines', e.name + ' — ' + (e.dose || ''));
  return list;
}
// Следващият прием (за показване): { entry, time, at:Date } или null.
export function nextDose(list) {
  const now = new Date(); let best = null;
  for (const e of list) for (const t of e.times) {
    const [h, m] = t.split(':').map((x) => parseInt(x, 10)); const at = new Date(); at.setHours(h, m, 0, 0); if (at <= now) at.setDate(at.getDate() + 1);
    if (!best || at < best.at) best = { entry: e, time: t, at };
  }
  return best;
}
