// Version: 1.0001
// Локална ранг листа (leaderboard) за plane-shooter.
// ПОВЕРИТЕЛНОСТ: пазим САМО { name, score }. Без id, без телефон, без контакти,
// без релации — нула лични данни извън свободно въведеното име. Всичко е на
// устройството, БЕЗ сървър и БЕЗ мрежа.
//
// Съхранение: СИНХРОННО през localStorage. НЕ ползваме динамичен import на
// @capacitor/... (той чупи boot-а в WebView). localStorage работи и персистира
// в Capacitor WebView.

const STORE_KEY = 'planeshooter_leaderboard'; // масив { name, score }
const NAME_KEY = 'planeshooter_lastname';     // последно използвано име
const MAX_ENTRIES = 100;

// Прочита запазените записи (връща винаги масив).
function readAll() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    // Подсигуряваме формата: само { name, score }.
    return arr
      .filter((r) => r && typeof r.name === 'string' && Number.isFinite(r.score))
      .map((r) => ({ name: r.name, score: r.score }));
  } catch {
    return [];
  }
}

// Записва масива (вече подреден и отрязан).
function writeAll(arr) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(arr));
  } catch {
    // Ако localStorage е недостъпен/пълен — просто пропускаме (не чупим играта).
  }
}

// Подрежда намаляващо по точки и отрязва до 100.
function sortTrim(arr) {
  arr.sort((a, b) => b.score - a.score);
  if (arr.length > MAX_ENTRIES) arr.length = MAX_ENTRIES;
  return arr;
}

// Добавя резултат и връща { rank, total } за конкретно добавения запис.
// rank е 1-базиран. total е общият брой записи в листата (след отрязването).
export function addScore(name, score) {
  const clean = String(name || 'Играч').slice(0, 24).trim() || 'Играч';
  const pts = Math.max(0, Math.round(Number(score) || 0));

  const all = readAll();
  const entry = { name: clean, score: pts };
  all.push(entry);
  sortTrim(all);
  writeAll(all);
  setLastName(clean);

  // Намираме мястото на точно този запис (по референция след сортирането).
  let rank = all.indexOf(entry) + 1;
  if (rank <= 0) {
    // Ако записът е изпаднал извън топ-100 при отрязването, изчисляваме мястото
    // спрямо това колко записа имат повече точки от него.
    rank = all.filter((r) => r.score > pts).length + 1;
  }
  return { rank, total: all.length };
}

// Топ-N записа (по подразбиране 100), подредени намаляващо по точки.
export function getTop(n = 100) {
  return sortTrim(readAll()).slice(0, Math.max(0, n));
}

// Последно използваното име (за дефолт в полето за въвеждане).
export function lastName() {
  try {
    return localStorage.getItem(NAME_KEY) || '';
  } catch {
    return '';
  }
}

// Запомня последно използваното име.
export function setLastName(name) {
  try {
    localStorage.setItem(NAME_KEY, String(name || '').slice(0, 24));
  } catch {
    // без значение, ако не успее
  }
}
