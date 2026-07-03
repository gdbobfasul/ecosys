// Version: 1.0001
// knowledge.js — „Източници на знание“: локалното е ВИНАГИ master.
//
// Принципи:
//   • Local (default) — канонично; роботът никога не зависи от сървър. Дори всичко
//     друго да изчезне, локалната памет остава.
//   • Export/Backup → JSON на цялата памет; запазва на устройството (Filesystem) +
//     предлага Android Share; показва ЧЕСТНО пътя на телефона (апът не пише на PC).
//   • Import ← JSON → слива в локалното (dedupe).
//   • Pull from URL (по избор, изключено по подразбиране) → ДОБАВЯ към локалното.
//   • Export-to-server → POST към продукционен endpoint (по избор; локалното остава master).
//
// Форматът на пакета (стабилен): { app, kind:'slf-knowledge', version, exportedAt,
//   entries:[{type,key,value,keywords}] }. entries идват от паметта (memory-store).

import { getState, persist } from './storage.js';
import { listMemory, addMemory, tokenize } from './memory-store.js';
import { fetchTimeout } from './net.js';

const PACK_KIND = 'slf-knowledge';
const PACK_VERSION = 1;

// Capacitor плъгини (налични само в нативния build). Грациозно null в браузър.
function cap(name) {
  try {
    if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins) {
      return window.Capacitor.Plugins[name] || null;
    }
  } catch (_) { /* пада към браузър */ }
  return null;
}

// --- Изграждане на пакет от локалната памет --------------------------------
export function buildKnowledgePack() {
  const entries = listMemory().map((m) => ({
    type: m.type, key: m.key, value: m.value,
    keywords: Array.isArray(m.keywords) ? m.keywords : []
  }));
  return {
    app: 'selflearning-friend',
    kind: PACK_KIND,
    version: PACK_VERSION,
    exportedAt: new Date().toISOString(),
    count: entries.length,
    entries
  };
}

// Нормализира различни форми на вход в масив от записи {type,key,value,keywords}.
function entriesFromAny(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;                 // чист масив от записи
  if (Array.isArray(data.entries)) return data.entries; // наш пакет
  return [];
}

// Сливане на записи в локалната памет с dedupe (по type+key+value).
// Връща { added, skipped }.
export function mergeEntries(entries) {
  const list = entriesFromAny(entries);
  const existing = new Set(listMemory().map((m) => keyOf(m)));
  let added = 0, skipped = 0;
  for (const e of list) {
    if (!e || (e.value == null && e.key == null)) { skipped++; continue; }
    const rec = {
      type: e.type || 'fact',
      key: String(e.key != null ? e.key : e.value).trim(),
      value: String(e.value != null ? e.value : e.key).trim(),
      keywords: Array.isArray(e.keywords) && e.keywords.length ? e.keywords : tokenize(e.key || e.value)
    };
    if (!rec.value) { skipped++; continue; }
    if (existing.has(keyOf(rec))) { skipped++; continue; }
    addMemory(rec);
    existing.add(keyOf(rec));
    added++;
  }
  return { added, skipped };
}

function keyOf(m) {
  return `${m.type}::${String(m.key || '').toLowerCase()}::${String(m.value || '').toLowerCase()}`;
}

// --- Export / Backup to file ----------------------------------------------
// Записва пакета като JSON. На нативен build → Filesystem (Documents) + опит за Share.
// В браузър → blob download. Връща { ok, path, shared, reason }.
export async function exportToFile() {
  const pack = buildKnowledgePack();
  const json = JSON.stringify(pack, null, 2);
  const fname = `slf-knowledge-${stamp()}.json`;

  const Filesystem = cap('Filesystem');
  if (Filesystem && typeof Filesystem.writeFile === 'function') {
    try {
      const dir = 'DOCUMENTS';
      await Filesystem.writeFile({ path: fname, data: json, directory: dir, encoding: 'utf8' });
      let uriResult = null;
      try { uriResult = await Filesystem.getUri({ path: fname, directory: dir }); } catch (_) { /* по избор */ }
      const path = (uriResult && uriResult.uri) || `Documents/${fname}`;
      // Опит за Android Share (по избор).
      let shared = false;
      const Share = cap('Share');
      if (Share && typeof Share.share === 'function' && uriResult && uriResult.uri) {
        try {
          await Share.share({ title: 'Знание (бекъп)', text: 'Резервно копие на знанието', url: uriResult.uri });
          shared = true;
        } catch (_) { /* потребителят може да откаже */ }
      }
      return { ok: true, path, shared, count: pack.count, json };
    } catch (e) {
      return { ok: false, reason: 'Filesystem запис неуспешен: ' + (e && e.message || e), json };
    }
  }

  // Браузър fallback: blob download.
  try {
    if (typeof document !== 'undefined' && typeof URL !== 'undefined') {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fname; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      return { ok: true, path: '(сваляне в браузъра: ' + fname + ')', shared: false, count: pack.count, json };
    }
  } catch (_) { /* пада към връщане на JSON */ }
  return { ok: true, path: '(няма файлова система — копирай ръчно)', shared: false, count: pack.count, json };
}

// --- Import from file ------------------------------------------------------
// Приема суров JSON текст (от <input type=file> или Filesystem). Слива в локалното.
// Връща { ok, added, skipped, reason }.
export function importFromJsonText(text) {
  let data;
  try { data = JSON.parse(text); }
  catch (_) { return { ok: false, added: 0, skipped: 0, reason: 'Файлът не е валиден JSON.' }; }
  const res = mergeEntries(data);
  return { ok: true, ...res };
}

// --- Pull from URL (по избор, изключено по подразбиране) -------------------
// Взема пакет от конфигуриран URL и ДОБАВЯ към локалното (никога не замества).
// Връща { ok, added, skipped, reason }.
export async function pullFromUrl(url, { timeoutMs = 12000 } = {}) {
  const u = String(url || '').trim();
  if (!u) return { ok: false, added: 0, skipped: 0, reason: 'Няма зададен URL.' };
  if (typeof fetch !== 'function') return { ok: false, added: 0, skipped: 0, reason: 'Няма мрежа в тази среда.' };
  try {
    const res = await fetchTimeout(u, {}, timeoutMs);
    if (!res || !res.ok) return { ok: false, added: 0, skipped: 0, reason: 'Сървърът върна ' + (res ? res.status : 'няма отговор') };
    const data = await res.json();
    const merged = mergeEntries(data);
    return { ok: true, ...merged };
  } catch (e) {
    return { ok: false, added: 0, skipped: 0, reason: 'Грешка при изтегляне (офлайн?): ' + (e && e.message || e) };
  }
}

// --- Export-to-server ------------------------------------------------------
// POST на пакета към конфигуриран продукционен endpoint. Локалното остава master.
// Очакван договор: POST {endpoint} body=пакет → 2xx = успех. Връща { ok, reason }.
export async function exportToServer(endpoint, { timeoutMs = 12000 } = {}) {
  const ep = String(endpoint || '').trim();
  if (!ep) return { ok: false, reason: 'Няма зададен сървърен endpoint.' };
  if (typeof fetch !== 'function') return { ok: false, reason: 'Няма мрежа в тази среда.' };
  const pack = buildKnowledgePack();
  try {
    const res = await fetchTimeout(ep, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pack)
    }, timeoutMs);
    if (!res || !res.ok) return { ok: false, reason: 'Сървърът върна ' + (res ? res.status : 'няма отговор') };
    return { ok: true, count: pack.count };
  } catch (e) {
    return { ok: false, reason: 'Грешка при изпращане (офлайн?): ' + (e && e.message || e) };
  }
}

// --- Настройки на източниците (живеят в state.settings.sources) ------------
export function sourcesSettings() {
  const s = (getState().settings && getState().settings.sources) || {};
  return {
    pullUrl: (s.pullUrl || '').trim(),
    pullEnabled: !!s.pullEnabled,
    serverEndpoint: (s.serverEndpoint || '').trim(),
    autoExport: !!s.autoExport
  };
}

export function saveSourcesSettings(patch) {
  const st = getState();
  st.settings.sources = { ...(st.settings.sources || {}), ...patch };
  persist();
  return sourcesSettings();
}

// --- Индикатор „Къде се пази знанието“ -------------------------------------
// Честно отразява реалното хранилище: знанието живее ЛОКАЛНО на устройството
// (Capacitor Preferences в APK, иначе localStorage в браузър). Ако е зададен
// сървърен endpoint, добавяме бележка, че синхронизацията е САМО по заявка
// (POST), а не автоматично — локалното остава главно (master).
export function storageLocationLabel() {
  let place = 'localStorage (браузър)';
  try {
    if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Preferences) {
      place = 'Capacitor Preferences (това устройство)';
    }
  } catch (_) { /* пада към браузър */ }

  const ep = sourcesSettings().serverEndpoint;
  return {
    place,
    serverConfigured: !!ep,
    text: '📍 Знанието се пази: ЛОКАЛНО на това устройство (' + place + ')'
      + (ep ? ' + синхронизирано към сървър (по заявка)' : '')
  };
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}
