// subjects.js — теми за учене + интереси на собственика + дневник на наученото.
//
// Държи списък „теми“ (subjects), всяка с натрупани наставки от източници. Това е
// материалът, който ученето пълни и от който „дай ми задача / питай ме / реши“ черпи.
// Пази се в state.subjects (виж storage.js). Всеки запис е заземен със source/citation
// (принцип на честността — не пазим нещо без произход).

import { getState, persist, uid } from './storage.js';
import { tokenize } from './memory-store.js';

// Списък по подразбиране за автономното учене (ротира се). Собственикът добавя още.
export const DEFAULT_INTERESTS = [
  'Математика', 'Биология', 'Химия', 'Физика', 'История',
  'Космос', 'Крипто пазари', 'Финанси', 'Изкуствен интелект', 'География'
];

export function listSubjects() {
  return (getState().subjects || []).slice();
}

export function listInterests() {
  const st = getState();
  const custom = (st.interests || []);
  // обединяваме подразбиращите се с потребителските, без дубликати
  const seen = new Set();
  const out = [];
  for (const s of DEFAULT_INTERESTS.concat(custom)) {
    const k = s.trim().toLowerCase();
    if (k && !seen.has(k)) { seen.add(k); out.push(s.trim()); }
  }
  return out;
}

export function addInterest(name) {
  const st = getState();
  const n = String(name || '').trim();
  if (!n) return false;
  st.interests = st.interests || [];
  if (st.interests.some((x) => x.toLowerCase() === n.toLowerCase())) return false;
  if (DEFAULT_INTERESTS.some((x) => x.toLowerCase() === n.toLowerCase())) return false;
  st.interests.push(n);
  persist();
  return true;
}

export function removeInterest(name) {
  const st = getState();
  if (!st.interests) return false;
  const i = st.interests.findIndex((x) => x.toLowerCase() === String(name).toLowerCase());
  if (i === -1) return false;
  st.interests.splice(i, 1);
  persist();
  return true;
}

// Намира или създава тема по име.
export function ensureSubject(name) {
  const st = getState();
  st.subjects = st.subjects || [];
  const key = String(name || '').trim();
  let s = st.subjects.find((x) => x.name.toLowerCase() === key.toLowerCase());
  if (!s) {
    s = { id: uid(), name: key, notes: [], created: Date.now(), updated: Date.now() };
    st.subjects.push(s);
    persist();
  }
  return s;
}

// Добавя заземена наставка (note) към тема. Изисква source/citation (честност).
// Връща { subject, note } или null при дубликат/празно.
export function addNote(subjectName, { text, source, url }) {
  const body = String(text || '').trim();
  if (!body) return null;
  const s = ensureSubject(subjectName);
  // не дублираме идентична наставка
  if (s.notes.some((n) => n.text === body)) return null;
  const note = { id: uid(), text: body, source: source || 'неизвестен', url: url || '', at: Date.now() };
  s.notes.unshift(note);          // най-новото отгоре
  if (s.notes.length > 50) s.notes.length = 50;
  s.updated = Date.now();
  persist();
  return { subject: s, note };
}

export function getSubject(name) {
  return listSubjects().find((x) => x.name.toLowerCase() === String(name).toLowerCase()) || null;
}

export function deleteSubject(id) {
  const st = getState();
  if (!st.subjects) return false;
  const i = st.subjects.findIndex((x) => x.id === id);
  if (i === -1) return false;
  st.subjects.splice(i, 1);
  persist();
  return true;
}

// Общ брой научени наставки (за брояча „научени неща“).
export function notesCount() {
  return (getState().subjects || []).reduce((acc, s) => acc + s.notes.length, 0);
}

// Търси из НАУЧЕНОТО (subjects) най-подходящата наставка за въпрос. Връща
// { subject, note, score } или null. Така роботът ОТГОВАРЯ от наученото (заземено + цитат).
export function findInSubjects(query, { threshold = 0.34 } = {}) {
  const q = tokenize(query);
  if (!q.length) return null;
  const qset = new Set(q);
  let best = null;
  for (const s of listSubjects()) {
    const nameTokens = new Set(tokenize(s.name));
    let nameHit = 0;
    for (const t of qset) if (nameTokens.has(t)) nameHit = 0.6; // въпросът споменава темата
    for (const n of s.notes) {
      const nt = new Set(tokenize(n.text));
      if (!nt.size) continue;
      let overlap = 0;
      for (const t of qset) if (nt.has(t)) overlap++;
      const score = nameHit + overlap / Math.max(qset.size, 1);
      if (!best || score > best.score) best = { subject: s.name, note: n, score };
    }
  }
  return (best && best.score >= threshold) ? best : null;
}

// --- Следене на ИЗТОЧНИЦИТЕ на тема (за „изчерпах ли всичко") -----------------
// Всяка тема пази кои източници са пробвани (s.sources) и флаг „изчерпана" (s.covered).
export function markSourceTried(subjectName, sourceKey) {
  const s = ensureSubject(subjectName);
  s.sources = s.sources || [];
  const k = String(sourceKey || '').trim();
  if (k && !s.sources.includes(k)) { s.sources.push(k); persist(); }
}
export function subjectSourcesTried(name) {
  const s = getSubject(name);
  return (s && s.sources) ? s.sources.slice() : [];
}
export function markCovered(name, covered = true) {
  const s = ensureSubject(name);
  s.covered = !!covered; s.coveredAt = covered ? Date.now() : null;
  persist();
  return s.covered;
}
export function isCovered(name) {
  const s = getSubject(name);
  return !!(s && s.covered);
}

// Връща случайна наставка от дадена/произволна тема (за „питай ме“ и припомняне).
export function randomNote(subjectName) {
  const subs = subjectName
    ? [getSubject(subjectName)].filter(Boolean)
    : listSubjects().filter((s) => s.notes.length);
  if (!subs.length) return null;
  const s = subs[Math.floor(Math.random() * subs.length)];
  if (!s.notes.length) return null;
  const n = s.notes[Math.floor(Math.random() * s.notes.length)];
  return { subject: s.name, note: n };
}
