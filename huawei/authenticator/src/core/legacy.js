// Version: 1.0025
// legacy.js — „Наследство" (11.09.2026): шифрован пакет за ДОВЕРЕН ЧОВЕК. Избрани раздели от сейфа
// + инструкциите ти („ако не се обаждам 30 дни — …") се шифроват със СОБСТВЕНА парола на пакета
// (PBKDF2-SHA256 210 000 итерации → AES-256-GCM; същият изпитан механизъм като сейфа, vault.js).
// Файлът е .json с четим „readme" и незашифрована подсказка за паролата (по избор), за да знае
// човекът какво държи и как да го отвори (с това приложение → Защита → Наследство → Отвори пакет).
// Образецът е „Затворен кръг" (sealcrypto в Pupikes Toolkit PDF): магия + заглавие + шифротекст.
// НИЩО не напуска устройството — файлът се записва/споделя през системния диалог.
import { encryptVault, decryptVault } from './vault.js';
import { session, persist, loadSettings, saveSettings } from './storage.js';
import { saveFile } from './filesave.js';

export const MAGIC = 'PUPLEGACY1';
export const LEGACY_TABS = ['passwords', 'entries', 'seeds', 'collection', 'ssh', 'networks', 'tokens'];

const README = 'This is an encrypted LEGACY PACKAGE created with Pupikes Authenticator & Passwords. '
  + 'It contains passwords / 2FA keys / wallet keys chosen by the owner and their instructions for you. '
  + 'Open it: install the app → Security tab → Legacy → Open package → choose this file → enter the package password '
  + '(the owner told you the password or left a hint below). Cryptography: PBKDF2-SHA256 (210000 iterations, salt) → AES-256-GCM; '
  + 'fields salt/iv/ct are base64. Nothing in this file leaves your device.';

// Прави пакета и го записва (споделя). tabs = ['passwords', ...]; връща { ok, count, fileName } или { ok:false, reason }.
export async function buildLegacyPackage({ tabs, instructions, password, forWhom, hint }) {
  const sel = (tabs || []).filter((tb) => LEGACY_TABS.indexOf(tb) > -1);
  const data = {};
  let count = 0;
  sel.forEach((tb) => { const arr = Array.isArray(session[tb]) ? session[tb].filter((x) => x && !x.sample) : []; data[tb] = arr; count += arr.length; });
  if (!count && !String(instructions || '').trim()) return { ok: false, reason: 'empty' };
  if (!password || String(password).length < 8) return { ok: false, reason: 'password' };
  const payload = { instructions: String(instructions || ''), data, createdAt: Date.now(), forWhom: String(forWhom || '') };
  const blob = await encryptVault(payload, String(password));
  const file = {
    app: 'pupikes-authenticator', kind: 'legacy', magic: MAGIC, version: 1,
    createdAt: new Date().toISOString(), forWhom: String(forWhom || ''), hint: String(hint || ''),
    readme: README, blob
  };
  const safeName = String(forWhom || 'trusted').replace(/[^\w\-]+/g, '_').slice(0, 30) || 'trusted';
  const fileName = 'pupikes-legacy-' + safeName + '.json';
  await saveFile(fileName, JSON.stringify(file, null, 2), 'application/json', { isText: true });
  saveSettings({ legacyLastAt: Date.now(), legacyForWhom: String(forWhom || '') });
  return { ok: true, count, fileName };
}

// Отваря пакет: текст на файла + парола → { ok, instructions, data, createdAt, forWhom, count } | { ok:false, reason }.
export async function openLegacyPackage(text, password) {
  let file;
  try { file = JSON.parse(String(text || '')); } catch (_) { return { ok: false, reason: 'format' }; }
  if (!file || file.magic !== MAGIC || !file.blob) return { ok: false, reason: 'format' };
  let payload;
  try { payload = await decryptVault(file.blob, String(password || '')); } catch (_) { return { ok: false, reason: 'password' }; }
  const data = (payload && payload.data) || {};
  let count = 0; LEGACY_TABS.forEach((tb) => { if (Array.isArray(data[tb])) count += data[tb].length; });
  return { ok: true, instructions: String(payload.instructions || ''), data, createdAt: payload.createdAt || null, forWhom: String(payload.forWhom || file.forWhom || ''), hint: String(file.hint || ''), count };
}

// Внася данните от отворен пакет в ТОЗИ сейф (дедуп по id). Изисква отключен сейф.
export async function importLegacyData(data) {
  let imported = 0, duplicates = 0;
  for (const tb of LEGACY_TABS) {
    const incoming = Array.isArray(data && data[tb]) ? data[tb] : [];
    if (!Array.isArray(session[tb])) session[tb] = [];
    const seen = new Set(session[tb].map((x) => x && x.id).filter((v) => v != null));
    for (const item of incoming) {
      if (!item || typeof item !== 'object') continue;
      if (item.id != null && seen.has(item.id)) { duplicates++; continue; }
      if (item.id != null) seen.add(item.id);
      session[tb].push(item); imported++;
    }
  }
  try { await persist(); } catch (_) { return { ok: false, reason: 'locked' }; }
  return { ok: true, imported, duplicates };
}

// За таблото: кога е правен последният пакет и за кого (нетайно, в настройките).
export function legacyInfo() {
  const s = loadSettings();
  return { lastAt: s.legacyLastAt || null, forWhom: s.legacyForWhom || '' };
}
