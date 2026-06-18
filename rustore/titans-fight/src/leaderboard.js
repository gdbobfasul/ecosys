// Локална ранг листа (ТОП 100) за играта „Titans Fight".
//
// ПОВЕРИТЕЛНОСТ: пазим САМО { name, score } — никакви контакти, никакво id,
// никакъв телефон, никаква мрежа. Всичко е единствено на устройството.
//
// СЪХРАНЕНИЕ: СИНХРОННО през localStorage. НЕ ползваме динамичен
// import('@capacitor/...') — той чупи стартирането (boot) в WebView.
// localStorage е напълно синхронен и работи и под Capacitor WebView.
//
// API:
//   addScore(name, score) -> { rank, total }   — добавя резултат и връща мястото
//   getTop(n = 100)       -> [{ name, score }] — подреден намаляващо, до n записа
//   lastName()            -> string            — последно използваното име
//   setLastName(name)     -> void              — запазва последно използваното име

const SCORES_KEY = 'tf_leaderboard';   // масив { name, score }
const LASTNAME_KEY = 'tf_lastname';    // последно въведено име
const MAX_ENTRIES = 100;               // режем до ТОП 100

// Чете и нормализира запазените резултати (винаги връща масив).
function _readAll() {
  let raw;
  try {
    raw = JSON.parse(localStorage.getItem(SCORES_KEY) || '[]');
  } catch (e) {
    raw = [];
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r) => r && typeof r === 'object')
    .map((r) => ({
      name: String(r.name || 'Играч').slice(0, 24).trim() || 'Играч',
      score: Math.max(0, Math.round(Number(r.score) || 0))
    }));
}

// Записва целия масив (вече подреден и отрязан до 100).
function _writeAll(list) {
  try {
    localStorage.setItem(SCORES_KEY, JSON.stringify(list));
  } catch (e) {
    // Ако localStorage е недостъпен, тихо пропускаме — играта не бива да пада.
  }
}

// Подрежда намаляващо по точки и реже до MAX_ENTRIES.
function _sortTrim(list) {
  return [...list].sort((a, b) => b.score - a.score).slice(0, MAX_ENTRIES);
}

// Добавя резултат, преизчислява подредбата, реже до 100 и връща мястото.
// Връща { rank, total }, където rank е 1-базиран ред в крайната листа.
// Ако записът изпадне извън ТОП 100, rank е 0 (не е в листата).
export function addScore(name, score) {
  const clean = String(name || 'Играч').slice(0, 24).trim() || 'Играч';
  const pts = Math.max(0, Math.round(Number(score) || 0));
  const entry = { name: clean, score: pts };

  const all = _readAll();
  all.push(entry);
  const sorted = _sortTrim(all);
  _writeAll(sorted);
  setLastName(clean);

  // Намираме точно ТОЗИ нов запис в подредената листа (по референция).
  const rank = sorted.indexOf(entry) + 1; // 0 ако е изпаднал извън ТОП 100
  return { rank, total: sorted.length };
}

// ТОП-N (по подразбиране 100), подреден намаляващо по точки.
export function getTop(n = MAX_ENTRIES) {
  return _sortTrim(_readAll()).slice(0, n);
}

// Последно използваното име (за дефолт в полето за въвеждане).
export function lastName() {
  try {
    return String(localStorage.getItem(LASTNAME_KEY) || '').slice(0, 24);
  } catch (e) {
    return '';
  }
}

// Запазва последно използваното име.
export function setLastName(name) {
  try {
    localStorage.setItem(LASTNAME_KEY, String(name || '').slice(0, 24));
  } catch (e) {
    // тихо пропускаме
  }
}
