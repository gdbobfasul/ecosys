// Version: 1.0023
// family.js — модел на „Денят на семейството" (нова сърцевина 1.0023, отговор на Huawei 4.3).
// Общ ден за няколко души на ЕДНО устройство: членове (дете/родител/баба-дядо), задачи с точки,
// одобрение от родител, седмична класация, награди (размяна на точки), общ календар, фрази с гласа
// на родителя и обмен между телефони като код/файл (без сървър, без акаунт).
// Всичко е в хранилището на устройството (storage.js, ключ family_v1). Мрежа НЕ се ползва.
import { storage } from './storage.js';
import { t, tf, getLang } from './i18n.js';
import { speak } from './tts.js';
import { voiceByCode } from './languages.js';
import { playPhrase } from './family-voice.js';

export const FAM_KEY = 'family_v1';
const COLORS = ['#f472b6', '#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#fb923c', '#22d3ee', '#f87171'];

const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => { const x = new Date(d); return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate()); };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export function uid(p = 'f') { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
export function colorFor(i) { return COLORS[Math.abs(i) % COLORS.length]; }

export function emptyFamily() {
  return { v: 1, sample: false, pin: '', members: [], tasks: [], log: {}, rewards: [], redemptions: [], calendar: [], phrases: [] };
}
function normalize(f) {
  const o = Object.assign(emptyFamily(), f || {});
  ['members', 'tasks', 'rewards', 'redemptions', 'calendar', 'phrases'].forEach((k) => { if (!Array.isArray(o[k])) o[k] = []; });
  if (!o.log || typeof o.log !== 'object') o.log = {};
  return o;
}

// Зарежда семейството; при ПЪРВО пускане засява ясно маркирани примерни данни (sample:true).
export async function loadFamily() {
  let f = await storage.get(FAM_KEY, null);
  if (!f) { f = buildSample(new Date()); await storage.set(FAM_KEY, f); }
  return normalize(f);
}
// Само чете (без засяване) — за планировчика и брифинга.
export async function peekFamily() {
  const f = await storage.get(FAM_KEY, null);
  return f ? normalize(f) : null;
}
export async function saveFamily(f) {
  const cut = ymd(addDays(new Date(), -70));          // дневникът се пази 70 дни
  Object.keys(f.log).forEach((d) => { if (d < cut) delete f.log[d]; });
  await storage.set(FAM_KEY, f);
}

export function memberById(f, id) { return f.members.find((m) => m.id === id) || null; }

// Задачата важи ли за датата: еднократна (date) или по дни от седмицата (празно = всеки ден).
export function taskOn(task, dateStr) {
  if (task.date) return task.date === dateStr;
  const wd = new Date(dateStr + 'T12:00:00').getDay();
  return !task.days || !task.days.length || task.days.indexOf(wd) >= 0;
}
export function tasksForDate(f, dateStr, memberId = null) {
  return f.tasks.filter((x) => taskOn(x, dateStr) && (!memberId || x.memberId === memberId))
    .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
}
export function entryOf(f, dateStr, taskId) { return (f.log[dateStr] || {})[taskId] || null; }

// „Готово": дете + задача с одобрение → „чака одобрение"; иначе направо одобрено (точките влизат).
export function markDone(f, task, dateStr) {
  const m = memberById(f, task.memberId);
  const needs = !!task.needsApproval && !!m && m.role === 'child';
  f.log[dateStr] = f.log[dateStr] || {};
  f.log[dateStr][task.id] = { st: needs ? 'p' : 'a', pts: Number(task.points) || 0, m: task.memberId, at: Date.now() };
}
export function approve(f, dateStr, taskId) { const e = entryOf(f, dateStr, taskId); if (e) { e.st = 'a'; e.ok = Date.now(); } }
export function undo(f, dateStr, taskId) { if (f.log[dateStr]) delete f.log[dateStr][taskId]; }

export function pendingList(f) {
  const out = [];
  Object.keys(f.log).sort().forEach((d) => Object.keys(f.log[d]).forEach((tid) => {
    const e = f.log[d][tid];
    if (!e || e.st !== 'p') return;
    out.push({ date: d, taskId: tid, entry: e, task: f.tasks.find((x) => x.id === tid) || null, member: memberById(f, e.m) });
  }));
  return out;
}

// Точки = одобрени записи в [from, to] (включително). Точките се пазят в записа → не се губят при изтрита задача.
export function pointsBetween(f, memberId, from = '', to = '') {
  let s = 0;
  Object.keys(f.log).forEach((d) => {
    if ((from && d < from) || (to && d > to)) return;
    Object.values(f.log[d]).forEach((e) => { if (e && e.st === 'a' && e.m === memberId) s += (Number(e.pts) || 0); });
  });
  return s;
}
export function balanceOf(f, memberId) {
  const spent = f.redemptions.filter((r) => r.m === memberId).reduce((a, r) => a + (Number(r.cost) || 0), 0);
  return pointsBetween(f, memberId) - spent;
}
export function weekStart(d = new Date()) { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; } // понеделник
export function ranking(f, today = new Date()) {
  const from = ymd(weekStart(today)), to = ymd(today);
  return f.members.map((m) => ({ member: m, pts: pointsBetween(f, m.id, from, to) }))
    .filter((r) => r.pts > 0 || r.member.role === 'child')
    .sort((a, b) => b.pts - a.pts);
}
export function redeem(f, memberId, reward) {
  if (balanceOf(f, memberId) < (Number(reward.cost) || 0)) return false;
  f.redemptions.unshift({ id: uid('x'), m: memberId, r: reward.id, title: reward.title, emoji: reward.emoji || '🎁', cost: Number(reward.cost) || 0, at: Date.now(), st: 'asked' });
  f.redemptions = f.redemptions.slice(0, 200);
  return true;
}

// Общ календар: семейни събития + еднократните задачи в следващите N дни.
export function upcoming(f, today = new Date(), days = 14) {
  const from = ymd(today), to = ymd(addDays(today, days - 1));
  const items = f.calendar.filter((c) => c.date >= from && c.date <= to).map((c) => ({ ...c, kind: 'event' }));
  f.tasks.filter((x) => x.date && x.date >= from && x.date <= to)
    .forEach((x) => items.push({ id: x.id, date: x.date, time: x.time, title: x.title, memberIds: [x.memberId], kind: 'task' }));
  return items.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
}

// Изговаря задачата: записаната фраза на родителя (ако има), иначе гласът на робота на езика на интерфейса.
export async function announceTask(f, task) {
  const m = memberById(f, task.memberId);
  const ph = task.phraseId ? f.phrases.find((p) => p.id === task.phraseId) : null;
  if (ph && ph.dataUrl) { const ok = await playPhrase(ph); if (ok) return 'voice'; }
  try { await speak(tf('fam_say', m ? m.name : '', task.title), voiceByCode(getLang())); } catch (_) {}
  return 'robot';
}

// Докато приложението е отворено: в часа на задачата пуска гласа (веднъж на ден за задача).
// Когато е затворено — идва нативното известие (виж scheduler.js → familyItems).
let _watch = null;
const _said = new Set();
export function startFamilyWatcher(onAnnounce) {
  if (_watch) return;
  const tick = async () => {
    try {
      if (typeof document !== 'undefined' && document.hidden) return;
      const f = await peekFamily();
      if (!f) return;
      const now = new Date(); const ds = ymd(now); const hm = pad(now.getHours()) + ':' + pad(now.getMinutes());
      for (const task of tasksForDate(f, ds)) {
        if (!task.time || task.time !== hm) continue;
        const key = ds + '|' + task.id;
        if (_said.has(key)) continue;
        _said.add(key);
        if (entryOf(f, ds, task.id)) continue;            // вече е свършена
        if (typeof onAnnounce === 'function') { try { onAnnounce(f, task); } catch (_) {} }
        await announceTask(f, task);
      }
    } catch (_) {}
  };
  _watch = setInterval(tick, 20000);
  tick();
}

// --- Обмен между телефони: код / файл (без сървър) ---
const MAGIC = 'PFD1:';
function b64enc(s) { return btoa(unescape(encodeURIComponent(s))); }
function b64dec(s) { return decodeURIComponent(escape(atob(s))); }
export function exportCode(f, withVoices = false) {
  const since = ymd(addDays(new Date(), -14));
  const log = {};
  Object.keys(f.log).forEach((d) => { if (d >= since) log[d] = f.log[d]; });
  const data = { k: 'pupikes-family-day', v: 1, at: Date.now(), members: f.members, tasks: f.tasks, rewards: f.rewards,
    calendar: f.calendar, redemptions: f.redemptions.slice(0, 50), log };
  if (withVoices) data.phrases = f.phrases;
  return MAGIC + b64enc(JSON.stringify(data));
}
// Сливане по id (нови се добавят, същите се обновяват). Връща { members, tasks } или null.
export function importCode(f, code) {
  const s = String(code || '').trim();
  const i = s.indexOf(MAGIC);
  if (i < 0) return null;
  let data;
  try { data = JSON.parse(b64dec(s.slice(i + MAGIC.length).replace(/\s+/g, ''))); } catch (_) { return null; }
  if (!data || data.k !== 'pupikes-family-day') return null;
  const merge = (key, ok = () => true) => {
    const map = new Map(f[key].map((x) => [x.id, x]));
    (Array.isArray(data[key]) ? data[key] : []).forEach((x) => { if (x && x.id && ok(x)) map.set(x.id, x); });
    f[key] = [...map.values()];
  };
  ['members', 'tasks', 'rewards', 'calendar', 'redemptions'].forEach((k) => merge(k));
  merge('phrases', (p) => !!p.dataUrl);
  Object.keys(data.log || {}).forEach((d) => { f.log[d] = Object.assign({}, f.log[d] || {}, data.log[d]); });
  return { members: (data.members || []).length, tasks: (data.tasks || []).length };
}

// --- Примерни данни при първо пускане (на езика на интерфейса; ясно маркирани, с бутон за изтриване) ---
export function buildSample(today = new Date()) {
  const f = emptyFamily();
  f.sample = true;
  const kid1 = { id: 'm_kid1', name: t('fam_s_kid1'), emoji: '👧', role: 'child', color: COLORS[0] };
  const kid2 = { id: 'm_kid2', name: t('fam_s_kid2'), emoji: '👦', role: 'child', color: COLORS[1] };
  const mom = { id: 'm_mom', name: t('fam_s_mom'), emoji: '👩', role: 'parent', color: COLORS[2] };
  const gma = { id: 'm_gma', name: t('fam_s_grandma'), emoji: '👵', role: 'grand', color: COLORS[3] };
  f.members = [kid1, kid2, mom, gma];
  const T = (id, m, key, time, points, days = [], appr = true) =>
    ({ id, memberId: m.id, title: t(key), time, points, days, date: '', phraseId: '', needsApproval: appr });
  f.tasks = [
    T('t1', kid1, 'fam_s_t1', '07:30', 2), T('t9', kid2, 'fam_s_t1', '07:30', 2),
    T('t2', kid2, 'fam_s_t2', '07:45', 3), T('t3', kid1, 'fam_s_t3', '16:00', 10, [1, 2, 3, 4, 5]),
    T('t4', kid2, 'fam_s_t4', '18:00', 5), T('t5', kid2, 'fam_s_t5', '19:30', 3),
    T('t6', kid1, 'fam_s_t6', '20:00', 5),
    T('t7', gma, 'fam_s_t7', '09:00', 0, [], false), T('t8', mom, 'fam_s_t8', '17:30', 0, [], false)
  ];
  // Последните 6 дни: повечето задачи на децата са одобрени (детерминирано, за реалистична класация).
  for (let off = -6; off <= -1; off++) {
    const ds = ymd(addDays(today, off));
    f.log[ds] = {};
    f.tasks.forEach((task, k) => {
      if (!taskOn(task, ds)) return;
      if (((off + 7) * 7 + k * 3) % 5 === 0) return;     // пропусната задача
      f.log[ds][task.id] = { st: 'a', pts: task.points, m: task.memberId, at: addDays(today, off).getTime() };
    });
  }
  const ds0 = ymd(today);
  f.log[ds0] = {
    t1: { st: 'a', pts: 2, m: kid1.id, at: Date.now() }, t9: { st: 'a', pts: 2, m: kid2.id, at: Date.now() },
    t2: { st: 'p', pts: 3, m: kid2.id, at: Date.now() }, t7: { st: 'a', pts: 0, m: gma.id, at: Date.now() }
  };
  f.rewards = [
    { id: 'r1', title: t('fam_s_r1'), cost: 20, emoji: '🎮' }, { id: 'r3', title: t('fam_s_r3'), cost: 25, emoji: '🍦' },
    { id: 'r2', title: t('fam_s_r2'), cost: 35, emoji: '🎬' }, { id: 'r4', title: t('fam_s_r4'), cost: 120, emoji: '🦁' }
  ];
  f.redemptions = [{ id: 'x1', m: kid2.id, r: 'r3', title: t('fam_s_r3'), emoji: '🍦', cost: 25, at: addDays(today, -2).getTime(), st: 'given' }];
  f.calendar = [
    { id: 'c4', date: ds0, time: '19:00', title: t('fam_s_c4'), memberIds: [] },
    { id: 'c2', date: ymd(addDays(today, 1)), time: '17:30', title: t('fam_s_c2'), memberIds: [mom.id] },
    { id: 'c3', date: ymd(addDays(today, 2)), time: '16:30', title: t('fam_s_c3'), memberIds: [kid2.id] },
    { id: 'c1', date: ymd(addDays(today, 3)), time: '18:00', title: t('fam_s_c1'), memberIds: [] }
  ];
  return f;
}
