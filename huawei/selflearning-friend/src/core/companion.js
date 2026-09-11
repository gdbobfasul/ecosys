// Version: 1.0036
// companion.js — „Спътник“: паметта за ВАЖНИТЕ неща в живота на собственика (не последния час,
// а моментите, които го правят него). Три вида записи:
//   'bio'  — автобиография: раждане, училище, сватба, деца, премествания, инциденти (времева линия);
//   'work' — работен опит: къде е работил, какво е научил, как, какви проблеми е решавал;
//   'life' — житейски опит: с кого и как е общувал, кой го е излъгал/измамил, грешни стъпки,
//            близки отношения и проблемите в тях.
// Всеки запис има дата, хора, поука и ОЦЕНКА (положително/отрицателно/неутрално) — оценката я
// дава собственикът, за да не гадаем ние. Всичко се ползва от Съветника (advisor.js).
// Данни: state.companion = { entries: [{ id, kind, title, date, people:[], text, lesson, mood, at, updated }] }
// (лениво създавани; спредът в storage.mergeDefaults запазва непознатите ключове). Само на устройството.

import { getState, persist, uid } from './storage.js';
import { tokenize } from './memory-store.js';

export const KINDS = ['bio', 'work', 'life'];
export const MOODS = ['good', 'bad', 'neutral'];

function box() {
  const st = getState();
  if (!st.companion || typeof st.companion !== 'object') st.companion = {};
  if (!Array.isArray(st.companion.entries)) st.companion.entries = [];
  return st.companion;
}

// „2001“, „2001-05“, „2001-05-17“ → сортируем ключ (число); празно → 0 (без дата).
export function dateKey(date) {
  const m = String(date || '').trim().match(/^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/);
  if (!m) return 0;
  return Number(m[1]) * 10000 + Number(m[2] || 0) * 100 + Number(m[3] || 0);
}

function normPeople(p) {
  const list = Array.isArray(p) ? p : String(p || '').split(/[,;]+/);
  const seen = new Set(); const out = [];
  for (const x of list) { const s = String(x || '').trim(); const k = s.toLowerCase(); if (s && !seen.has(k)) { seen.add(k); out.push(s); } }
  return out;
}

function clean(e, fields) {
  const out = {};
  if (fields.title != null) out.title = String(fields.title).replace(/\s+/g, ' ').trim();
  if (fields.date != null) out.date = String(fields.date).trim();
  if (fields.people != null) out.people = normPeople(fields.people);
  if (fields.text != null) out.text = String(fields.text).trim();
  if (fields.lesson != null) out.lesson = String(fields.lesson).trim();
  if (fields.mood != null) out.mood = MOODS.includes(fields.mood) ? fields.mood : 'neutral';
  return Object.assign(e, out);
}

export function listEntries(kind) {
  const all = box().entries.filter((e) => !kind || e.kind === kind);
  // най-новото по дата отгоре; без дата — най-отдолу, по време на запис
  return all.sort((a, b) => (dateKey(b.date) - dateKey(a.date)) || (b.at - a.at));
}

// Времева линия на автобиографията — най-ранното първо.
export function timeline() {
  return listEntries('bio').slice().sort((a, b) => (dateKey(a.date) - dateKey(b.date)) || (a.at - b.at));
}

export function getEntry(id) { return box().entries.find((e) => e.id === id) || null; }

export function addEntry(kind, fields) {
  if (!KINDS.includes(kind)) return null;
  const e = clean({ id: uid(), kind, title: '', date: '', people: [], text: '', lesson: '', mood: 'neutral', at: Date.now(), updated: Date.now() }, fields);
  if (!e.title && !e.text) return null;
  box().entries.unshift(e);
  if (box().entries.length > 3000) box().entries.length = 3000;
  persist();
  return e;
}

export function updateEntry(id, patch) {
  const e = getEntry(id);
  if (!e) return null;
  clean(e, patch);
  e.updated = Date.now();
  persist();
  return e;
}

export function deleteEntry(id) {
  const list = box().entries;
  const i = list.findIndex((e) => e.id === id);
  if (i === -1) return false;
  list.splice(i, 1);
  persist();
  return true;
}

// Пълният текст на запис (за търсене/съвети).
export function entryText(e) {
  return [e.title, e.date, (e.people || []).join(' '), e.text, e.lesson].filter(Boolean).join(' · ');
}

// Търсене по дума/човек/година: съвпадение по включване (без регистър) в целия текст.
export function searchEntries(query, kind) {
  const q = String(query || '').toLowerCase().trim();
  const list = listEntries(kind);
  if (!q) return list;
  const words = q.split(/\s+/).filter(Boolean);
  return list.filter((e) => { const t = entryText(e).toLowerCase(); return words.every((w) => t.includes(w)); });
}

// Хората в живота на собственика: колко пъти се срещат и с каква оценка.
export function people() {
  const map = new Map();
  for (const e of box().entries) {
    for (const p of (e.people || [])) {
      const k = p.toLowerCase();
      const cur = map.get(k) || { name: p, count: 0, good: 0, bad: 0, neutral: 0, kinds: new Set() };
      cur.count++; cur[e.mood || 'neutral']++; cur.kinds.add(e.kind);
      map.set(k, cur);
    }
  }
  return Array.from(map.values()).map((x) => ({ ...x, kinds: Array.from(x.kinds) })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function companionStats() {
  const s = { bio: 0, work: 0, life: 0, good: 0, bad: 0, neutral: 0, people: 0 };
  for (const e of box().entries) { s[e.kind] = (s[e.kind] || 0) + 1; s[e.mood || 'neutral']++; }
  s.people = people().length;
  s.total = s.bio + s.work + s.life;
  return s;
}

// ДОКАЗАТЕЛСТВА за Съветника: записите, които засягат въпроса (по припокриване на думи и по
// споменати хора). Връща [{ text, kind, mood, people, date, score, id }], най-силните първи.
export function evidenceFor(tokens, { max = 8 } = {}) {
  const qset = new Set(tokens || []);
  if (!qset.size) return [];
  const out = [];
  for (const e of box().entries) {
    const et = new Set(tokenize(entryText(e)));
    let overlap = 0;
    for (const w of qset) if (w.length >= 3 && et.has(w)) overlap++;
    let personHit = false;
    for (const p of (e.people || [])) { for (const w of tokenize(p)) if (qset.has(w)) { personHit = true; break; } if (personHit) break; }
    if (!overlap && !personHit) continue;
    const score = overlap / Math.sqrt(Math.max(1, qset.size)) + (personHit ? 1 : 0);
    out.push({ id: e.id, kind: e.kind, mood: e.mood || 'neutral', people: e.people || [], date: e.date || '', personHit,
      text: [e.title, e.text].filter(Boolean).join(': ') + (e.lesson ? ' — ' + e.lesson : ''), score });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, max);
}
