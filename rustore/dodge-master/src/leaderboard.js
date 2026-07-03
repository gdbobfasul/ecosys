// Version: 1.0001
// Локална РАНГ ЛИСТА (leaderboard) — съхранява САМО {name, score}.
// ПОВЕРИТЕЛНОСТ: без id, без телефон, без контакти, без външни ключове —
// единствено свободно въведеното име и точките. Всичко е на устройството,
// БЕЗ сървър и БЕЗ мрежа.
//
// Съхранение: СИНХРОННО през localStorage (JSON). НЕ ползваме sql.js,
// НЕ ползваме динамичен import('@capacitor/...') — това чупи boot в WebView.
// localStorage е напълно достатъчен за топ-100 „име + точки".
//
// Per-store ключ (THEME.saveKey), за да не се бъркат записите между билдовете.

import { THEME } from './theme.js';

const MAX_ENTRIES = 100;                       // топ-100 — режем останалото
const SCORES_KEY = THEME.saveKey + '.scores';  // масивът с резултати
const NAME_KEY = THEME.saveKey + '.lastName';  // последно използваното име

// Зарежда суровия масив резултати от localStorage (защитено).
function loadAll() {
  try {
    const raw = localStorage.getItem(SCORES_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    // Подсигуряваме се, че всеки запис е само {name, score}.
    return data
      .map((r) => ({
        name: String(r && r.name != null ? r.name : 'Играч').slice(0, 24),
        score: Math.max(0, Math.round(Number(r && r.score) || 0))
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_ENTRIES);
  } catch (e) {
    return [];
  }
}

// Записва масива (вече сортиран и отрязан до 100) в localStorage.
function saveAll(list) {
  try {
    localStorage.setItem(SCORES_KEY, JSON.stringify(list));
  } catch (e) { /* частен режим / quota — пренебрегваме */ }
}

// Връща топ-N подреден по точки (намаляващо). По подразбиране целия топ-100.
export function getTop(n = MAX_ENTRIES) {
  return loadAll().slice(0, Math.max(0, Math.min(n, MAX_ENTRIES)));
}

// Добавя резултат, сортира намаляващо, реже до 100 и връща {rank, total}.
// rank е 1-базиран; total е броят записи в листата след добавянето.
export function addScore(name, score) {
  const clean = String(name || 'Играч').slice(0, 24).trim() || 'Играч';
  const pts = Math.max(0, Math.round(Number(score) || 0));

  const list = loadAll();
  list.push({ name: clean, score: pts });
  list.sort((a, b) => b.score - a.score);
  const trimmed = list.slice(0, MAX_ENTRIES);
  saveAll(trimmed);

  // Намираме мястото на ИМЕННО този запис (първото съвпадение по референция-стойност).
  // При равни точки новият застава след вече съществуващите (стабилен резултат от push).
  let rank = trimmed.findIndex((r) => r.name === clean && r.score === pts) + 1;
  if (rank <= 0) {
    // Резултатът е изпаднал извън топ-100 — изчисляваме мястото логически.
    rank = list.filter((r) => r.score > pts).length + 1;
  }
  return { rank, total: trimmed.length };
}

// Последно използваното име (дефолт за полето в game over).
export function lastName() {
  try {
    return localStorage.getItem(NAME_KEY) || '';
  } catch (e) {
    return '';
  }
}

export function setLastName(name) {
  try {
    localStorage.setItem(NAME_KEY, String(name || '').slice(0, 24).trim());
  } catch (e) { /* пренебрегваме */ }
}
