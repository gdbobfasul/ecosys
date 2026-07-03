// Version: 1.0001
// packs.js — „Пакети знание“: внасяне на готови знания в локалната памет.
//
// Пакет знание = JSON { name, topic, entries:[{type,key,value,keywords}] }.
//   • name  — кратко име на пакета (за човека), напр. „Основи на програмирането“.
//   • topic — тема/категория, напр. „programming“ / „linux“.
//   • entries — масив от записи в ШЕЙПА на memory-store ({type,key,value,keywords}).
//
// Внасянето минава през съществуващото mergeEntries (knowledge.js), т.е. слива в
// локалното с dedupe по type+key+value — НЕ дублира вече наученото и НИЩО не трие.
//
// Тук живеят и ВГРАДЕНИТЕ стартови пакети (src/packs/*.json), за да може роботът да
// ИМА основи (програмиране + Linux) с едно докосване, изцяло локално и офлайн.

import { mergeEntries } from './knowledge.js';

// Вградени стартови пакети (бъндълнати в билда чрез статичен import — работят офлайн).
import programmingBasics from '../packs/programming-basics.json';
import linuxBasics from '../packs/linux-basics.json';

// Регистър на наличните вградени пакети (id → { meta, data }).
export const BUNDLED_PACKS = {
  'programming-basics': programmingBasics,
  'linux-basics': linuxBasics
};

// Списък за UI: [{ id, name, topic, count }].
export function listBundledPacks() {
  return Object.keys(BUNDLED_PACKS).map((id) => {
    const p = BUNDLED_PACKS[id] || {};
    return {
      id,
      name: p.name || id,
      topic: p.topic || '',
      count: Array.isArray(p.entries) ? p.entries.length : 0
    };
  });
}

// Валидира шейпа на пакет. Връща { ok, reason }.
export function validatePack(pack) {
  if (!pack || typeof pack !== 'object') return { ok: false, reason: 'Пакетът не е обект.' };
  if (!Array.isArray(pack.entries)) return { ok: false, reason: 'Липсва списък „entries“.' };
  if (!pack.entries.length) return { ok: false, reason: 'Пакетът е празен (няма записи).' };
  let good = 0;
  for (const e of pack.entries) {
    if (e && (e.value != null || e.key != null)) good++;
  }
  if (!good) return { ok: false, reason: 'Никой запис няма „key“ или „value“.' };
  return { ok: true };
}

// Внася (слива) пакет знание в локалната памет.
// Приема обект-пакет ({name,topic,entries}) ИЛИ суров масив от записи.
// Връща { ok, name, topic, added, skipped, total, reason }.
export function importPack(pack) {
  const v = validatePack(pack);
  if (!v.ok) return { ok: false, added: 0, skipped: 0, total: 0, reason: v.reason };
  const res = mergeEntries(pack.entries); // dedupe вече е в mergeEntries
  return {
    ok: true,
    name: pack.name || '',
    topic: pack.topic || '',
    added: res.added,
    skipped: res.skipped,
    total: (Array.isArray(pack.entries) ? pack.entries.length : 0)
  };
}

// Внася вграден стартов пакет по id (напр. 'programming-basics').
export function importBundledPack(id) {
  const pack = BUNDLED_PACKS[id];
  if (!pack) return { ok: false, added: 0, skipped: 0, total: 0, reason: 'Няма такъв вграден пакет: ' + id };
  return importPack(pack);
}

// Внася пакет от суров JSON текст (от textarea или файл).
// Връща { ok, name, topic, added, skipped, total, reason }.
export function importPackFromJsonText(text) {
  let data;
  try { data = JSON.parse(text); }
  catch (_) { return { ok: false, added: 0, skipped: 0, total: 0, reason: 'Текстът не е валиден JSON.' }; }
  // Позволяваме и чист масив от записи — увиваме го в минимален пакет.
  if (Array.isArray(data)) data = { name: 'Внесен пакет', topic: '', entries: data };
  return importPack(data);
}
