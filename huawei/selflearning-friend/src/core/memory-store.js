// Version: 1.0001
// memory-store.js — РЕАЛНО локално самообучение (НЕ стъб).
//
// Памет = масив от записи { id, type, key, value, keywords:[], created, updated, uses }.
//   type:
//     'qa'     — потребителско Q&A („като кажа X, отговаряй Y“)
//     'fact'   — факт за собственика („казвам се…“, „обичам…“, „живея в…“)
//     'pref'   — предпочитание
// Recall: токенизира заявката, оценява всеки запис по припокриване на ключови думи +
//   нечетлива близост (Dice коефициент върху биграми) и връща най-добрия над праг.
// Editing: review/edit/delete (екран „Памет“) — пълен CRUD върху записите.

import { getState, persist, uid } from './storage.js';

// Български + латински стоп-думи (изключваме ги от ключовите думи).
const STOP = new Set([
  'и', 'или', 'но', 'а', 'да', 'не', 'че', 'е', 'се', 'си', 'съм', 'ще', 'ли', 'то',
  'за', 'на', 'в', 'във', 'с', 'със', 'от', 'до', 'по', 'при', 'като', 'що', 'как',
  'кога', 'къде', 'кой', 'коя', 'кое', 'кои', 'аз', 'ти', 'той', 'тя', 'то', 'ние',
  'вие', 'те', 'ми', 'те', 'го', 'я', 'ги', 'му', 'й', 'им', 'this', 'that', 'the',
  'a', 'an', 'is', 'are', 'i', 'you', 'me', 'my', 'to', 'of', 'and', 'or'
]);

export function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOP.has(w));
}

// Биграми за нечетлива близост.
function bigrams(s) {
  const t = String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const out = [];
  for (let i = 0; i < t.length - 1; i++) out.push(t.slice(i, i + 2));
  return out;
}

// Dice коефициент (0..1) между два низа.
function diceSim(a, b) {
  const A = bigrams(a), B = bigrams(b);
  if (!A.length || !B.length) return 0;
  const map = new Map();
  for (const g of A) map.set(g, (map.get(g) || 0) + 1);
  let inter = 0;
  for (const g of B) {
    const c = map.get(g);
    if (c > 0) { inter++; map.set(g, c - 1); }
  }
  return (2 * inter) / (A.length + B.length);
}

export function listMemory() {
  return getState().memory.slice();
}

// Добавя запис в паметта. Връща записа.
export function addMemory({ type = 'qa', key, value, keywords }) {
  const st = getState();
  const kw = (keywords && keywords.length) ? keywords : tokenize(key);
  const rec = {
    id: uid(),
    type,
    key: String(key || '').trim(),
    value: String(value || '').trim(),
    keywords: Array.from(new Set(kw)),
    created: Date.now(),
    updated: Date.now(),
    uses: 0
  };
  st.memory.push(rec);
  persist();
  return rec;
}

export function updateMemory(id, patch) {
  const st = getState();
  const rec = st.memory.find((m) => m.id === id);
  if (!rec) return null;
  if (patch.key != null) rec.key = String(patch.key).trim();
  if (patch.value != null) rec.value = String(patch.value).trim();
  if (patch.keywords != null) rec.keywords = Array.from(new Set(patch.keywords));
  else if (patch.key != null) rec.keywords = Array.from(new Set(tokenize(rec.key)));
  rec.updated = Date.now();
  persist();
  return rec;
}

export function deleteMemory(id) {
  const st = getState();
  const i = st.memory.findIndex((m) => m.id === id);
  if (i === -1) return false;
  st.memory.splice(i, 1);
  persist();
  return true;
}

// Извличане на най-добрия запис за дадена заявка.
// Връща { rec, score } или null. score в [0..1].
export function recall(query, { threshold = 0.34 } = {}) {
  const st = getState();
  if (!st.memory.length) return null;
  const qTokens = tokenize(query);
  const qSet = new Set(qTokens);
  let best = null;

  for (const rec of st.memory) {
    // 1) припокриване на ключови думи (Jaccard-подобно)
    let overlap = 0;
    for (const kw of rec.keywords) if (qSet.has(kw)) overlap++;
    const kwScore = rec.keywords.length
      ? overlap / Math.max(rec.keywords.length, qSet.size || 1)
      : 0;
    // 2) нечетлива близост на целия ключ спрямо заявката
    const fuzzy = diceSim(query, rec.key);
    // комбиниран резултат: ключовите думи носят повече тежест
    const score = Math.min(1, kwScore * 0.65 + fuzzy * 0.55);
    if (!best || score > best.score) best = { rec, score };
  }

  if (best && best.score >= threshold) return best;
  return null;
}

// Отбелязва използване (за статистика/прецизиране).
export function markUsed(id) {
  const st = getState();
  const rec = st.memory.find((m) => m.id === id);
  if (rec) { rec.uses = (rec.uses || 0) + 1; persist(); }
}

export function memoryCount() {
  return getState().memory.length;
}
