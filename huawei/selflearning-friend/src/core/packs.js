// Version: 1.0015
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
import { ensureSubject, addNote, addInterest } from './subjects.js';
import { fetchTimeout } from './net.js';
import { dbSizeBytes, maxDbMB } from './learn-budget.js';
import { getState, persist } from './storage.js';
import { serverInfo } from './server-link.js';

// Вградени стартови пакети (бъндълнати в билда чрез статичен import — работят офлайн).
import programmingBasics from '../packs/programming-basics.json';
import linuxBasics from '../packs/linux-basics.json';
import cryptoFinanceTerms from '../packs/crypto-finance-terms.json';
import storePublishing from '../packs/store-publishing.json';

// Регистър на наличните вградени пакети (id → { meta, data }).
export const BUNDLED_PACKS = {
  'programming-basics': programmingBasics,
  'linux-basics': linuxBasics,
  'crypto-finance-terms': cryptoFinanceTerms,
  'store-publishing': storePublishing
};

// Пакети, които се зареждат ПО ПОДРАЗБИРАНЕ при първо стартиране (без потребителят да ги иска).
// „store-publishing" е знанието за правене и публикуване на приложения за Huawei AppGallery и
// RuStore — ботът трябва да го знае веднага, наготово. seedDefaultPacks() ги слива еднократно
// (пази флаг в състоянието); mergeEntries дедупва, тъй че повторно извикване е безвредно.
const DEFAULT_SEED_PACKS = ['store-publishing'];

export function seedDefaultPacks() {
  const st = getState();
  const seeded = (st.settings && st.settings.seededPacks) || [];
  let changed = false;
  for (const id of DEFAULT_SEED_PACKS) {
    if (seeded.indexOf(id) >= 0) continue;      // вече засято
    const r = importBundledPack(id);
    if (r && r.ok) { seeded.push(id); changed = true; }
  }
  if (changed) {
    st.settings = { ...(st.settings || {}), seededPacks: seeded };
    try { persist(); } catch (_) {}
  }
  return seeded;
}

// Списък за UI: [{ id, name, topic, count }] — count брои и записи, и термини.
export function listBundledPacks() {
  return Object.keys(BUNDLED_PACKS).map((id) => {
    const p = BUNDLED_PACKS[id] || {};
    const count = (Array.isArray(p.entries) ? p.entries.length : 0) + (Array.isArray(p.terms) ? p.terms.length : 0);
    return { id, name: p.name || id, topic: p.topic || '', count };
  });
}

// Валидира шейпа на пакет. Връща { ok, reason }.
// Пакетът е валиден, ако носи ПОНЕ едно от двете: memory-записи (entries) ИЛИ речник термини (terms).
export function validatePack(pack) {
  if (!pack || typeof pack !== 'object') return { ok: false, reason: 'Пакетът не е обект.' };
  const hasEntries = Array.isArray(pack.entries) && pack.entries.length;
  const hasTerms = Array.isArray(pack.terms) && pack.terms.length;
  if (!hasEntries && !hasTerms) return { ok: false, reason: 'Пакетът е празен (няма „entries“ нито „terms“).' };
  if (hasEntries) {
    let good = 0;
    for (const e of pack.entries) if (e && (e.value != null || e.key != null)) good++;
    if (!good && !hasTerms) return { ok: false, reason: 'Никой запис няма „key“ или „value“.' };
  }
  if (hasTerms) {
    let good = 0;
    for (const t of pack.terms) if (t && (t.term || t.name) && (t.definition || t.value || t.text)) good++;
    if (!good && !hasEntries) return { ok: false, reason: 'Никой термин няма „term“ + „definition“.' };
  }
  return { ok: true };
}

// РЕЧНИК ОТ ТЕРМИНИ → сяда като ТЕМИ (subjects): всеки термин става тема със заземена бележка
// (определението). Така ботът ИМА готово базово знание веднага, а последващото учене НАДГРАЖДА
// същите теми (addNote дедупва). По избор `seedInterests:true` в пакета → добавя термините и като
// интереси (учебният цикъл ги задълбочава по дървото). Връща { subjects, notes }.
function importTerms(terms, { seedInterests = false, source = '' } = {}) {
  let subjects = 0, notes = 0, stopped = false;
  // Предпазител: не преливай лимита на базата (на телефон 8 MB, на сървър/десктоп — голям). Спираме
  // да сипваме, щом стигнем тавана — така голям тематичен пакет сяда докрай само където има място.
  let maxBytes = 0;
  try { maxBytes = maxDbMB() * 1024 * 1024; } catch (_) { maxBytes = 0; }
  let checkIn = 0;
  for (const t of (terms || [])) {
    if (!t) continue;
    const name = String(t.term || t.name || '').trim();
    const def = String(t.definition || t.value || t.text || '').trim();
    if (!name || !def) continue;
    // Проверка на размера на всеки 25 термина (JSON.stringify на цялата база не е безплатно).
    if (maxBytes && (checkIn++ % 25 === 0)) {
      try { if (dbSizeBytes() >= maxBytes) { stopped = true; break; } } catch (_) {}
    }
    ensureSubject(name); subjects++;
    if (addNote(name, { text: def, source: t.source || source || 'речник (пакет)', url: t.url || '' })) notes++;
    if (seedInterests || t.interest) { try { addInterest(name); } catch (_) {} }
  }
  return { subjects, notes, stopped };
}

// Внася (слива) пакет знание в локалната памет.
// Приема обект-пакет ({name,topic,entries?,terms?}) ИЛИ суров масив от записи.
// Връща { ok, name, topic, added, skipped, total, termSubjects, termNotes, reason }.
export function importPack(pack) {
  const v = validatePack(pack);
  if (!v.ok) return { ok: false, added: 0, skipped: 0, total: 0, reason: v.reason };
  let added = 0, skipped = 0, total = 0;
  if (Array.isArray(pack.entries) && pack.entries.length) {
    const res = mergeEntries(pack.entries); // dedupe вече е в mergeEntries
    added = res.added; skipped = res.skipped; total = pack.entries.length;
  }
  let termSubjects = 0, termNotes = 0, termStopped = false;
  if (Array.isArray(pack.terms) && pack.terms.length) {
    const r = importTerms(pack.terms, { seedInterests: !!pack.seedInterests, source: pack.name || '' });
    termSubjects = r.subjects; termNotes = r.notes; termStopped = r.stopped; total += pack.terms.length;
  }
  return {
    ok: true,
    name: pack.name || '',
    topic: pack.topic || '',
    added, skipped, total, termSubjects, termNotes, termStopped
  };
}

// Сваля пакет от URL (по желание на клиента) и го внася. Ползва нативния HTTP (без CORS на телефона).
// Връща същото като importPack (+ reason при неуспех).
export async function importPackFromUrl(url) {
  const u = String(url || '').trim();
  if (!/^https?:\/\//i.test(u)) return { ok: false, added: 0, skipped: 0, total: 0, reason: 'Дай пълен линк (http/https) към JSON речник/пакет.' };
  let data;
  try {
    const res = await fetchTimeout(u, { headers: { Accept: 'application/json,*/*' } }, 20000);
    if (!res || !res.ok) return { ok: false, added: 0, skipped: 0, total: 0, reason: 'Линкът не се отвори (HTTP ' + (res && res.status) + ').' };
    data = await res.json();
  } catch (e) {
    return { ok: false, added: 0, skipped: 0, total: 0, reason: 'Не свалих пакета (' + ((e && e.message) || 'мрежова грешка') + ').' };
  }
  if (Array.isArray(data)) data = { name: 'Свален пакет', topic: '', entries: data };
  return importPack(data);
}

// Внася вграден стартов пакет по id (напр. 'programming-basics').
export function importBundledPack(id) {
  const pack = BUNDLED_PACKS[id];
  if (!pack) return { ok: false, added: 0, skipped: 0, total: 0, reason: 'Няма такъв вграден пакет: ' + id };
  return importPack(pack);
}

// ── КАТАЛОГ от готови тематични речници (хостнати, напр. /dict/catalog.json на сървъра) ──────
// Позволява „зареди знание за <тема>" → апът намира речника в каталога и го сваля. Каталогът е
// { packs:[{theme, category, file, count, bytes}] } (генериран от collect-all.mjs).

// URL на каталога: ръчно зададен (Настройки) ИЛИ по подразбиране на свързания сървър /dict/catalog.json.
export function catalogUrl() {
  const k = (getState().settings && getState().settings.knowledge) || {};
  const manual = String(k.catalogUrl || '').trim();
  if (manual) return manual;
  try {
    const si = serverInfo();
    if (si.configured && si.domain) return `https://${si.domain}/dict/catalog.json`;
  } catch (_) {}
  return '';
}
export function setCatalogUrl(url) {
  const st = getState();
  st.settings.knowledge = { ...(st.settings.knowledge || {}), catalogUrl: String(url || '').trim() };
  persist();
  return st.settings.knowledge.catalogUrl;
}

// Сваля каталога. Приема URL към catalog.json ИЛИ базова папка (добавя catalog.json).
// Връща { ok, base, packs, reason }. `base` е за да сглобим URL на всеки пакет.
export async function fetchCatalog(url) {
  let u = String(url || catalogUrl() || '').trim();
  if (!/^https?:\/\//i.test(u)) return { ok: false, packs: [], reason: 'Няма зададен каталог. Задай URL в Настройки → Източници, или „зареди знание за <тема> от <URL>".' };
  if (!/catalog\.json($|\?)/i.test(u)) u = u.replace(/\/?$/, '/') + 'catalog.json';
  try {
    const res = await fetchTimeout(u, { headers: { Accept: 'application/json,*/*' } }, 20000);
    if (!res || !res.ok) return { ok: false, packs: [], reason: 'Каталогът не се отвори (HTTP ' + (res && res.status) + ').' };
    const data = await res.json();
    const packs = Array.isArray(data) ? data : (Array.isArray(data.packs) ? data.packs : []);
    return { ok: true, base: u, packs };
  } catch (e) {
    return { ok: false, packs: [], reason: 'Не свалих каталога (' + ((e && e.message) || 'мрежова грешка') + ').' };
  }
}

// Списък теми/категории от каталога (по избор филтрирано по категория). Връща { ok, packs, categories }.
export async function listCatalog({ url = '', category = '' } = {}) {
  const c = await fetchCatalog(url);
  if (!c.ok) return { ok: false, packs: [], categories: [], reason: c.reason };
  let packs = c.packs;
  const cats = [...new Set(packs.map((p) => p.category).filter(Boolean))].sort();
  if (category) {
    const q = category.toLowerCase();
    packs = packs.filter((p) => (p.category || '').toLowerCase().includes(q));
  }
  return { ok: true, packs, categories: cats, base: c.base };
}

// „Зареди знание за <тема>": намира речника в каталога (по тема, после по категория) и го сваля.
// Връща резултата на importPack (+ matched theme). Ако темата е категория → зарежда всичките ѝ
// речници до `maxPacks` (за да не прелее наведнъж).
export async function importFromCatalog(query, { url = '', maxPacks = 8 } = {}) {
  const c = await fetchCatalog(url);
  if (!c.ok) return { ok: false, reason: c.reason };
  const q = String(query || '').trim().toLowerCase();
  if (!q) return { ok: false, reason: 'За коя тема да заредя знание?' };
  const packUrl = (file) => { try { return new URL(file, c.base).href; } catch (_) { return ''; } };

  // 1) точна/частична тема
  let hit = c.packs.find((p) => (p.theme || '').toLowerCase() === q)
        || c.packs.find((p) => (p.theme || '').toLowerCase().includes(q) || q.includes((p.theme || '').toLowerCase()));
  if (hit) {
    const r = await importPackFromUrl(packUrl(hit.file));
    return { ...r, matched: hit.theme, kind: 'theme' };
  }
  // 2) като КАТЕГОРИЯ → зареди няколко речника от нея
  const inCat = c.packs.filter((p) => (p.category || '').toLowerCase().includes(q));
  if (inCat.length) {
    let subjects = 0, notes = 0, loaded = 0, stopped = false;
    for (const p of inCat.slice(0, maxPacks)) {
      const r = await importPackFromUrl(packUrl(p.file));
      if (r.ok) { subjects += r.termSubjects || 0; notes += (r.termNotes || 0) + (r.added || 0); loaded++; if (r.termStopped) { stopped = true; break; } }
    }
    return { ok: loaded > 0, kind: 'category', matched: inCat[0].category, loaded, total: inCat.length, termSubjects: subjects, termNotes: notes, termStopped: stopped };
  }
  return { ok: false, reason: `Не намерих „${query}" в каталога. Кажи „какви теми мога да заредя" за списък.` };
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
