// Version: 1.0013
// storage.js — устойчиво съхранение + сесийно състояние.
// • Шифрираният блок със записите се пази в localStorage (VAULT_KEY).
// • Нетайните настройки (език, авто-заключване, биометрия, подредба) — в SETTINGS_KEY.
// • Разшифрованите записи и master паролата живеят САМО в паметта, докато сейфът
//   е отключен (за да можем да пишем нови записи и да ги шифроваме отново).
import { encryptVault, decryptVault } from './vault.js';

const VAULT_KEY = 'kcyauth.vault';
const SETTINGS_KEY = 'kcyauth.settings';

const DEFAULT_SETTINGS = {
  lang: null,            // null = още не е избран (показваме избор на език)
  autoLockSec: 60,       // авто-заключване след N СЕКУНДИ бездействие (0 = никога)
  autoLockMin: 1,        // (наследено) минути — пази съвместимост; autoLockSec има предимство
  biometric: false,      // отключване с пръстов отпечатък (ако устройството поддържа)
  sort: 'manual',        // подредба: manual | issuer | account
  lockOnBlur: true       // true = заключва ВЕДНАГА при смяна на приложението (както досега);
                         // false = НЕ заключва при загуба на фокус — само по таймаута за
                         // бездействие (проверен и при връщане на фокуса)
};

// Сесийно състояние (в паметта). ВСИЧКИ колекции се шифроват заедно в сейфа и живеят САМО
// на устройството — нищо не се качва на сървър (виж persist: пише само в localStorage).
export const session = {
  unlocked: false,
  password: null,        // master паролата, докато сейфът е отключен
  entries: [],           // таб „Аутентикация": [{ id, type, issuer, account, secret, ... }]
  collection: [],        // таб „Колекция": [{ id, title, content, image }] (QR кодове със заглавие)
  passwords: [],         // таб „Пароли": [{ id, title, login, password, note, url }]
  seeds: []              // таб „Портфейли": крипто акаунти (seed фрази/ключове) — виж seedFields()
};

export function hasVault() {
  try { return !!localStorage.getItem(VAULT_KEY); } catch (e) { return false; }
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return Object.assign({}, DEFAULT_SETTINGS, raw ? JSON.parse(raw) : {});
  } catch (e) { return Object.assign({}, DEFAULT_SETTINGS); }
}

export function saveSettings(patch) {
  const cur = loadSettings();
  const next = Object.assign(cur, patch || {});
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch (e) {}
  return next;
}

// Таймаут за авто-заключване В СЕКУНДИ (0 = никога). Предпочита autoLockSec; ако липсва,
// пада към стария autoLockMin (×60) за съвместимост със стари инсталации.
export function autoLockSeconds() {
  const s = loadSettings();
  if (typeof s.autoLockSec === 'number') return s.autoLockSec;
  if (typeof s.autoLockMin === 'number') return s.autoLockMin * 60;
  return 60;
}

// Създава нов сейф с дадена парола (първоначална настройка).
export async function createVault(password) {
  session.entries = [];
  session.collection = [];
  session.passwords = [];
  session.seeds = [];
  session.password = password;
  session.unlocked = true;
  await persist();
}

// Отключва сейфа с паролата. Хвърля при грешна парола.
export async function unlockVault(password) {
  const blob = JSON.parse(localStorage.getItem(VAULT_KEY));
  const data = await decryptVault(blob, password);   // хвърля 'wrong_password'
  session.entries = Array.isArray(data.entries) ? data.entries : [];
  session.collection = Array.isArray(data.collection) ? data.collection : [];
  session.passwords = Array.isArray(data.passwords) ? data.passwords : [];
  session.seeds = Array.isArray(data.seeds) ? data.seeds : [];
  session.password = password;
  session.unlocked = true;
}

// Записва целия сейф шифровано (с паролата от сесията). ПИШЕ САМО В localStorage на
// устройството — няма мрежова заявка, нищо не се изпраща навън (важи и за seed фразите).
export async function persist() {
  if (!session.unlocked || session.password == null) throw new Error('locked');
  const blob = await encryptVault({
    entries: session.entries,
    collection: session.collection,
    passwords: session.passwords,
    seeds: session.seeds
  }, session.password);
  localStorage.setItem(VAULT_KEY, JSON.stringify(blob));
}

// Сменя master паролата (прешифрова сейфа).
export async function changePassword(newPassword) {
  session.password = newPassword;
  await persist();
}

// Заключва сейфа — чисти ВСИЧКИ тайни от паметта (вкл. seed фразите).
export function lock() {
  session.unlocked = false;
  session.password = null;
  session.entries = [];
  session.collection = [];
  session.passwords = [];
  session.seeds = [];
}

// Изтрива целия сейф (нужна е парола за пресъздаване).
export function wipeVault() {
  try { localStorage.removeItem(VAULT_KEY); } catch (e) {}
  lock();
}

// ── Операции върху записите (изискват отключен сейф) ──
function newId() {
  return 'e' + Date.now().toString(36) + Math.floor(performance.now()).toString(36);
}

export async function addEntry(entry) {
  const e = Object.assign({ id: newId(), type: 'totp', algorithm: 'SHA1', digits: 6, period: 30, counter: 0, group: '' }, entry);
  session.entries.push(e);
  await persist();
  return e;
}

export async function updateEntry(id, patch) {
  const e = session.entries.find((x) => x.id === id);
  if (!e) return;
  Object.assign(e, patch);
  await persist();
}

export async function deleteEntry(id) {
  session.entries = session.entries.filter((x) => x.id !== id);
  await persist();
}

export async function moveEntry(id, dir) {
  const i = session.entries.findIndex((x) => x.id === id);
  if (i < 0) return;
  const j = i + dir;
  if (j < 0 || j >= session.entries.length) return;
  const tmp = session.entries[i];
  session.entries[i] = session.entries[j];
  session.entries[j] = tmp;
  await persist();
}

export async function incrementCounter(id) {
  const e = session.entries.find((x) => x.id === id);
  if (!e || e.type !== 'hotp') return;
  e.counter = (e.counter || 0) + 1;
  await persist();
}

// Ограничава текстово поле до 256 знака (заглавия/логин/парола/описание).
function cap256(s) { return String(s == null ? '' : s).slice(0, 256); }

// ── Таб „Колекция" (запазени QR кодове) ──
export async function addCollectionItem(item) {
  const it = {
    id: newId(),
    title: cap256(item && item.title),
    content: String(item && item.content || ''),   // декодираният текст на QR-а
    image: String(item && item.image || '')         // картинката (dataURL) за повторно показване
  };
  session.collection.push(it);
  await persist();
  return it;
}
export async function updateCollectionItem(id, patch) {
  const x = session.collection.find((c) => c.id === id);
  if (!x) return;
  if (patch.title != null) patch.title = cap256(patch.title);
  Object.assign(x, patch);
  await persist();
}
export async function deleteCollectionItem(id) {
  session.collection = session.collection.filter((c) => c.id !== id);
  await persist();
}

// ── Таб „Пароли" (+ url за импорт/експорт от браузъри) ──
export async function addPassword(item) {
  const it = {
    id: newId(),
    title: cap256(item && item.title),
    url: cap256(item && item.url),
    login: cap256(item && item.login),
    password: cap256(item && item.password),
    note: cap256(item && item.note)
  };
  session.passwords.push(it);
  await persist();
  return it;
}
export async function updatePassword(id, patch) {
  const x = session.passwords.find((p) => p.id === id);
  if (!x) return;
  ['title', 'url', 'login', 'password', 'note'].forEach((k) => { if (patch[k] != null) patch[k] = cap256(patch[k]); });
  Object.assign(x, patch);
  await persist();
}
export async function deletePassword(id) {
  session.passwords = session.passwords.filter((p) => p.id !== id);
  await persist();
}

// ── Таб „Портфейли" (крипто акаунти: seed фрази, ключове, пароли — САМО локално) ──
// Полетата, които пазим за крипто портфейл/борса. Всички са опционални освен label;
// чувствителните се показват през „око". seedPhrase/privateKey/passphrase = най-тайните.
export const SEED_FIELDS = ['label', 'account', 'seedPhrase', 'passphrase', 'password', 'pin', 'privateKey', 'publicAddress', 'derivationPath', 'note'];
// По-дълъг лимит за seed/ключове (не 256): 24-думни фрази + деривации.
function capField(k, v) { return String(v == null ? '' : v).slice(0, k === 'seedPhrase' || k === 'note' || k === 'privateKey' ? 2000 : 256); }

export async function addSeed(item) {
  const it = { id: newId(), wallet: cap256(item && item.wallet) || 'other', walletName: cap256(item && item.walletName), at: Date.now() };
  for (const k of SEED_FIELDS) it[k] = capField(k, item && item[k]);
  session.seeds.push(it);
  await persist();
  return it;
}
export async function updateSeed(id, patch) {
  const x = session.seeds.find((s) => s.id === id);
  if (!x) return;
  if (patch.wallet != null) x.wallet = cap256(patch.wallet);
  if (patch.walletName != null) x.walletName = cap256(patch.walletName);
  for (const k of SEED_FIELDS) { if (patch[k] != null) x[k] = capField(k, patch[k]); }
  await persist();
}
export async function deleteSeed(id) {
  session.seeds = session.seeds.filter((s) => s.id !== id);
  await persist();
}
// Колко акаунта има за даден портфейл (за лимитите 20 / 100).
export function seedCountFor(walletKey) {
  return session.seeds.filter((s) => s.wallet === walletKey).length;
}
