// tasklist.js — ПОСТОЯНЕН списък със ЗАДАЧИ (всяка дадена задача се записва тук).
//
// Проблем, който решава: досега задачите се изпълняваха веднага и НЕ оставаха никъде —
// собственикът даваше „научи за X“, а нищо не влизаше в „задачите“. Сега всяка дадена
// задача се записва (pending), изпълнява се (running) и се отбелязва (done/failed) с
// кратък резултат. В екран „Задачи“ се вижда какво е поискано, свършено и останало.
//
// Само ЗАДАЧИ ОТ СОБСТВЕНИКА влизат тук (source:'owner'). Автономното самообучение НЕ
// пълни списъка (то си има отделен поток „Какво уча сега“).

import { getState, persist, uid } from './storage.js';

export function listTasks() {
  const st = getState();
  return Array.isArray(st.tasks) ? st.tasks.slice() : [];
}

export function pendingTasks() {
  return listTasks().filter((t) => t.status === 'pending' || t.status === 'running');
}

export function tasksCount() {
  return listTasks().length;
}

// Добавя задача. Ако вече има НЕЗАВЪРШЕНА със същия текст — връща нея (без дубли).
export function addTask({ kind, arg, text, source = 'owner' }) {
  const st = getState();
  if (!Array.isArray(st.tasks)) st.tasks = [];
  const norm = String(text || '').trim().toLowerCase();
  const dup = st.tasks.find((t) => (t.status === 'pending' || t.status === 'running') &&
    String(t.text || '').trim().toLowerCase() === norm);
  if (dup) return dup;
  const task = {
    id: uid(),
    kind: kind || 'none',
    arg: arg != null ? arg : null,
    text: String(text || '').trim(),
    status: 'pending',
    result: '',
    citation: '',
    source,
    created: Date.now(),
    updated: Date.now()
  };
  st.tasks.unshift(task);
  // ограничаваме историята (последни 100), за да не расте без край
  if (st.tasks.length > 100) st.tasks.length = 100;
  persist();
  return task;
}

export function updateTask(id, patch) {
  const st = getState();
  if (!Array.isArray(st.tasks)) return null;
  const t = st.tasks.find((x) => x.id === id);
  if (!t) return null;
  Object.assign(t, patch || {}, { updated: Date.now() });
  persist();
  return t;
}

export function removeTask(id) {
  const st = getState();
  if (!Array.isArray(st.tasks)) return false;
  const i = st.tasks.findIndex((x) => x.id === id);
  if (i === -1) return false;
  st.tasks.splice(i, 1);
  persist();
  return true;
}

// Изчиства завършените (done/failed), оставя само чакащите/текущите. Връща броя изтрити.
export function clearFinished() {
  const st = getState();
  if (!Array.isArray(st.tasks)) return 0;
  const before = st.tasks.length;
  st.tasks = st.tasks.filter((t) => t.status === 'pending' || t.status === 'running');
  persist();
  return before - st.tasks.length;
}

// Етикет за статуса (за UI).
export function statusLabel(status) {
  switch (status) {
    case 'pending': return 'чака';
    case 'running': return 'изпълнявам';
    case 'done': return 'готово';
    case 'failed': return 'неуспех';
    default: return status || '';
  }
}
