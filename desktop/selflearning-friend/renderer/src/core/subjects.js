// subjects.js — теми за учене + интереси на собственика + дневник на наученото.
//
// Държи списък „теми“ (subjects), всяка с натрупани наставки от източници. Това е
// материалът, който ученето пълни и от който „дай ми задача / питай ме / реши“ черпи.
// Пази се в state.subjects (виж storage.js). Всеки запис е заземен със source/citation
// (принцип на честността — не пазим нещо без произход).

import { getState, persist, uid } from './storage.js';

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
