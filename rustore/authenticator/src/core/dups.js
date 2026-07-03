// Version: 1.0001
// dups.js — откриване на дублирани/много подобни акаунти.
// Две групи: (1) ЕДНАКВА ТАЙНА (сигурен дубликат — същият код); (2) ПОДОБНИ ИМЕНА
// (issuer+account съвпадат приблизително). Връща групи за преглед и избор за триене.
import { session } from './storage.js';

function norm(s) { return String(s || '').trim().toLowerCase(); }
function fullName(e) { return (norm(e.issuer) + ' ' + norm(e.account)).trim(); }

// Разстояние на Левенщайн (за „приблизително еднакви" имена).
function lev(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  const prev = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    let prevDiag = prev[0]; prev[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, prevDiag + (a[i - 1] === b[j - 1] ? 0 : 1));
      prevDiag = tmp;
    }
  }
  return prev[n];
}

function similar(a, b) {
  if (!a || !b) return a === b;
  if (a === b) return true;
  if (a.indexOf(b) >= 0 || b.indexOf(a) >= 0) return true;     // едното съдържа другото
  const d = lev(a, b), m = Math.max(a.length, b.length);
  return m > 0 && (1 - d / m) >= 0.8;                          // ≥80% сходство
}

// Връща списък от групи: { reason:'secret'|'name', entries:[...] }.
export function findDuplicateGroups() {
  const entries = session.entries;
  const groups = [];
  const usedSecret = {};

  // 1) По еднаква тайна.
  const bySecret = {};
  entries.forEach((e) => {
    const k = String(e.secret || '').toUpperCase().replace(/\s/g, '');
    if (!k) return;
    (bySecret[k] = bySecret[k] || []).push(e);
  });
  Object.keys(bySecret).forEach((k) => {
    const arr = bySecret[k];
    if (arr.length > 1) { groups.push({ reason: 'secret', entries: arr }); arr.forEach((e) => { usedSecret[e.id] = 1; }); }
  });

  // 2) По подобни имена (само за още негрупираните).
  const rest = entries.filter((e) => !usedSecret[e.id]);
  const seen = {};
  for (let i = 0; i < rest.length; i++) {
    if (seen[rest[i].id]) continue;
    const grp = [rest[i]];
    for (let j = i + 1; j < rest.length; j++) {
      if (seen[rest[j].id]) continue;
      if (similar(fullName(rest[i]), fullName(rest[j]))) { grp.push(rest[j]); seen[rest[j].id] = 1; }
    }
    if (grp.length > 1) { grp.forEach((e) => { seen[e.id] = 1; }); groups.push({ reason: 'name', entries: grp }); }
  }

  return groups;
}
