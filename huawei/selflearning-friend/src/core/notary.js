// Version: 1.0036
// notary.js — „Нотариус“: регистър и изповедник на собственика.
//   will        — завещание: кой какво получава и защо / кой не получава и защо;
//   deals       — покупки, продажби и по-големи сделки (с резултат: печалба/загуба/неутрално);
//   confessions — признания: къде е сгрешил, какво е искал/иска да направи.
// ОТДЕЛЕН ПИН (различен от кодовата дума). Всичко е ШИФРОВАНО на устройството с WebCrypto:
//   ключ = PBKDF2(ПИН, сол, 120000 итерации, SHA-256) → AES-GCM 256; в state.notary стои САМО
//   { v, salt, iv, blob, updated, allowAdvisor } — никога открит текст. Няма резервен ключ: забравен
//   ПИН = изгубени записи (казваме го честно в UI).
// Разшифрованите данни живеят само в паметта на модула, докато е отключен; заключваме се сами,
// когато апът отиде на заден план. Износ = същият шифрован пакет във файл; внос = с ПИН-а на файла.
// Съветникът чете Нотариуса САМО ако е отключен И собственикът е разрешил (allowAdvisor).

import { getState, persist, uid } from './storage.js';
import { tokenize } from './memory-store.js';
import { saveTextFile } from './recovery.js';
import { pickTextFile } from './filepick.js';

export const KINDS = ['will', 'deals', 'confessions'];
const ITER = 120000;
const MAX_FAILS = 5;
const COOLDOWN_MS = 30000;

let _key = null;      // CryptoKey (само докато е отключен)
let _data = null;     // { will:[], deals:[], confessions:[] }
let _fails = 0;
let _cooldownUntil = 0;

function subtle() {
  try { return (typeof crypto !== 'undefined' && crypto.subtle) ? crypto.subtle : null; } catch (_) { return null; }
}
export function cryptoAvailable() { return !!subtle(); }

function box() {
  const st = getState();
  if (!st.notary || typeof st.notary !== 'object') st.notary = {};
  return st.notary;
}

// ── base64 помощници ─────────────────────────────────────────────────────────────────
function b64(buf) { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); }
function unb64(s) { const bin = atob(String(s || '')); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
function randomBytes(n) { const u = new Uint8Array(n); crypto.getRandomValues(u); return u; }

async function deriveKey(pin, saltU8) {
  const enc = new TextEncoder();
  const base = await subtle().importKey('raw', enc.encode(String(pin)), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey({ name: 'PBKDF2', salt: saltU8, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function encryptJson(key, obj) {
  const iv = randomBytes(12);
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(obj)));
  return { iv: b64(iv), blob: b64(ct) };
}
async function decryptJson(key, ivB64, blobB64) {
  const pt = await subtle().decrypt({ name: 'AES-GCM', iv: unb64(ivB64) }, key, unb64(blobB64));
  return JSON.parse(new TextDecoder().decode(pt));
}

function emptyData() { return { will: [], deals: [], confessions: [] }; }
function normData(d) {
  const out = emptyData();
  for (const k of KINDS) if (d && Array.isArray(d[k])) out[k] = d[k].filter((x) => x && typeof x === 'object');
  return out;
}

// ── Състояние ────────────────────────────────────────────────────────────────────────
export function isSetUp() { const n = box(); return !!(n.salt && n.blob); }
export function isOpen() { return !!(_key && _data); }
export function advisorAllowed() { return !!box().allowAdvisor; }
export function setAdvisorAllowed(v) { box().allowAdvisor = !!v; persist(); return !!v; }
export function cooldownLeftMs() { return Math.max(0, _cooldownUntil - Date.now()); }
export function validPin(pin) { return String(pin || '').length >= 4; }

async function save() {
  if (!isOpen()) return false;
  const n = box();
  const enc = await encryptJson(_key, _data);
  n.v = 1; n.iv = enc.iv; n.blob = enc.blob; n.updated = Date.now();
  persist();
  return true;
}

// Първоначално създаване с ПИН → празен регистър, отключен.
export async function setup(pin) {
  if (!cryptoAvailable() || !validPin(pin) || isSetUp()) return false;
  const salt = randomBytes(16);
  _key = await deriveKey(pin, salt);
  _data = emptyData();
  box().salt = b64(salt);
  box().allowAdvisor = false;
  await save();
  return true;
}

// Отключване: грешният ПИН НЕ може да разшифрова (AES-GCM проверява целостта) → false.
export async function unlock(pin) {
  if (!cryptoAvailable() || !isSetUp()) return false;
  if (cooldownLeftMs() > 0) return false;
  const n = box();
  try {
    const key = await deriveKey(pin, unb64(n.salt));
    const data = await decryptJson(key, n.iv, n.blob);
    _key = key; _data = normData(data); _fails = 0;
    return true;
  } catch (_) {
    _fails++;
    if (_fails >= MAX_FAILS) { _fails = 0; _cooldownUntil = Date.now() + COOLDOWN_MS; }
    return false;
  }
}

export function lock() { _key = null; _data = null; }

export async function changePin(oldPin, newPin) {
  if (!isOpen() || !validPin(newPin)) return false;
  const n = box();
  try { await decryptJson(await deriveKey(oldPin, unb64(n.salt)), n.iv, n.blob); } catch (_) { return false; }
  const salt = randomBytes(16);
  _key = await deriveKey(newPin, salt);
  n.salt = b64(salt);
  await save();
  return true;
}

// Изтрива ВСИЧКО (записи + ПИН). Без връщане.
export function wipe() {
  const st = getState();
  st.notary = {};
  lock();
  persist();
  return true;
}

// ── Записи ───────────────────────────────────────────────────────────────────────────
export function list(kind) {
  if (!isOpen() || !KINDS.includes(kind)) return [];
  return _data[kind].slice().sort((a, b) => (b.updated || b.at || 0) - (a.updated || a.at || 0));
}
export function counts() {
  const c = { will: 0, deals: 0, confessions: 0, total: 0 };
  if (isOpen()) for (const k of KINDS) { c[k] = _data[k].length; c.total += c[k]; }
  return c;
}

function strFields(obj, fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields || {})) if (v != null && typeof v !== 'object') out[k] = String(v).trim();
  return Object.assign(obj, out);
}

export async function add(kind, fields) {
  if (!isOpen() || !KINDS.includes(kind)) return null;
  const e = strFields({ id: uid(), at: Date.now(), updated: Date.now() }, fields);
  _data[kind].unshift(e);
  await save();
  return e;
}
export async function update(kind, id, patch) {
  if (!isOpen() || !KINDS.includes(kind)) return null;
  const e = _data[kind].find((x) => x.id === id);
  if (!e) return null;
  strFields(e, patch); e.updated = Date.now();
  await save();
  return e;
}
export async function remove(kind, id) {
  if (!isOpen() || !KINDS.includes(kind)) return false;
  const i = _data[kind].findIndex((x) => x.id === id);
  if (i === -1) return false;
  _data[kind].splice(i, 1);
  await save();
  return true;
}

// ── Износ / внос (шифрован файл; същият ключ = същият ПИН) ───────────────────────────
function stamp() { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`; }

export async function exportFile({ share = true } = {}) {
  if (!isOpen()) return { ok: false, reason: 'locked' };
  await save();
  const n = box();
  const pack = { app: 'selflearning-friend', kind: 'slf-notary', version: 1, exportedAt: new Date().toISOString(), iterations: ITER, salt: n.salt, iv: n.iv, blob: n.blob };
  return saveTextFile(`slf-notary-${stamp()}.json`, JSON.stringify(pack, null, 2), 'Notary (SLF)', { share });
}

// Внос: избира файл, разшифрова с ПИН-а на ФАЙЛА и СЛИВА записите (по id) в текущия регистър.
// Ако още няма създаден Нотариус — файлът става регистърът и ПИН-ът му става ПИН-ът тук.
export async function importFromPickedFile(pin) {
  if (!cryptoAvailable()) return { ok: false, reason: 'nocrypto' };
  const f = await pickTextFile();
  if (!f) return { ok: false, cancelled: true };
  let pack; try { pack = JSON.parse(f.text); } catch (_) { return { ok: false, reason: 'bad' }; }
  if (!pack || pack.kind !== 'slf-notary' || !pack.salt || !pack.iv || !pack.blob) return { ok: false, reason: 'bad' };
  let data;
  try { data = normData(await decryptJson(await deriveKey(pin, unb64(pack.salt)), pack.iv, pack.blob)); }
  catch (_) { return { ok: false, reason: 'bad' }; }
  let added = 0;
  if (!isSetUp()) {
    _key = await deriveKey(pin, unb64(pack.salt));
    _data = data;
    box().salt = pack.salt; box().allowAdvisor = false;
    for (const k of KINDS) added += data[k].length;
    await save();
    return { ok: true, added, fresh: true };
  }
  if (!isOpen()) return { ok: false, reason: 'locked' };
  for (const k of KINDS) {
    const seen = new Set(_data[k].map((x) => x.id));
    for (const e of data[k]) if (e && e.id && !seen.has(e.id)) { _data[k].push(e); seen.add(e.id); added++; }
  }
  await save();
  return { ok: true, added, fresh: false };
}

// ── За Съветника ─────────────────────────────────────────────────────────────────────
function entryText(kind, e) {
  if (kind === 'will') return [e.person, e.what, e.why].filter(Boolean).join(' · ');
  if (kind === 'deals') return [e.what, e.amount, e.party, e.date, e.note].filter(Boolean).join(' · ');
  return [e.text, e.about, e.wish, e.date].filter(Boolean).join(' · ');
}
function entryMood(kind, e) {
  if (kind === 'deals') return e.result === 'gain' ? 'good' : e.result === 'loss' ? 'bad' : 'neutral';
  if (kind === 'confessions') return 'bad';      // признанието е поука от грешка
  return 'neutral';
}

// Доказателства за Съветника — САМО при отключен регистър и дадено разрешение.
export function evidenceFor(tokens, { max = 6 } = {}) {
  if (!isOpen() || !advisorAllowed()) return [];
  const qset = new Set(tokens || []);
  if (!qset.size) return [];
  const out = [];
  for (const k of KINDS) {
    for (const e of _data[k]) {
      const txt = entryText(k, e);
      const et = new Set(tokenize(txt));
      let overlap = 0;
      for (const w of qset) if (w.length >= 3 && et.has(w)) overlap++;
      if (!overlap) continue;
      out.push({ id: e.id, kind: k, mood: entryMood(k, e), text: txt, score: overlap / Math.sqrt(qset.size), deal: k === 'deals' ? e.kind : '' });
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, max);
}

// Статистика на сделките по вид (покупка/продажба/сделка) — как са минавали (за съвети).
export function dealStats() {
  const s = {};
  if (!isOpen() || !advisorAllowed()) return s;
  for (const e of _data.deals) {
    const k = e.kind || 'deal';
    s[k] = s[k] || { n: 0, gain: 0, loss: 0 };
    s[k].n++; if (e.result === 'gain') s[k].gain++; else if (e.result === 'loss') s[k].loss++;
  }
  return s;
}

// Самозаключване при минимизиране на апа (пести и почтеност: никой не чете открития регистър).
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.hidden) lock(); });
}
