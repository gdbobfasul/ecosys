// Version: 1.0021
// sealcrypto.js — криптографията и хранилището на „Затворен кръг" (Pupikes Sealed Docs).
// Всичко е WebCrypto на устройството: ECDH P-256 (запечатване на ключа на групата за всеки член),
// AES-256-GCM (файловете и ключовете), ECDSA P-256 (подпис на подателя). Никакъв сървър.
//
// Файлов формат .pupsealed (двоичен):
//   „PUPSEALED1" (10 байта) + u32 дължина на заглавието + заглавие (JSON, UTF-8)
//   + u32 дължина на подписа + подпис (ECDSA) + шифротекст (AES-GCM, AAD = заглавието).
//   Подписът е върху (заглавие ‖ шифротекст) → вижда се кой е пратил файла и че не е променян.
//
// Хранилище: „сейф" в localStorage (самоличност + групи + ключове), по избор шифрован с ПИН
// (PBKDF2 → AES-GCM); лентите на групите (метаданни) в localStorage; байтовете на файловете —
// ЗАПЕЧАТАНИ (както са получени) — в IndexedDB. Разкодира се само при отваряне.

const MAGIC = 'PUPSEALED1';
const VAULT_KEY = 'sealed.vault.v1';
const FEED_KEY = 'sealed.feed.v1';
const DB_NAME = 'pupikes-sealed';
const DB_STORE = 'files';
const subtle = crypto.subtle;
const te = new TextEncoder();
const td = new TextDecoder('utf-8');

// ---------- помощни ----------
export function b64u(bytes) {
  let bin = ''; const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function unb64u(s) {
  s = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
export function b64std(bytes) { // за Filesystem (стандартен base64)
  let bin = ''; const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return btoa(bin);
}
export function unb64std(s) {
  const bin = atob(String(s || '')); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
export function randHex(n) {
  const a = new Uint8Array(n); crypto.getRandomValues(a);
  return Array.from(a).map((b) => b.toString(16).padStart(2, '0')).join('');
}
function concat(...arrs) {
  let n = 0; arrs.forEach((a) => { n += a.length; });
  const out = new Uint8Array(n); let o = 0;
  arrs.forEach((a) => { out.set(a, o); o += a.length; });
  return out;
}
function u32(n) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n); return b; }
function rd32(bytes, off) { return new DataView(bytes.buffer, bytes.byteOffset + off, 4).getUint32(0); }

// Пръстов отпечатък на публичен ключ за подпис: първите 8 байта от SHA-256 (16 hex знака).
export async function fingerprint(pubB64u) {
  const h = new Uint8Array(await subtle.digest('SHA-256', unb64u(pubB64u)));
  return Array.from(h.subarray(0, 8)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------- самоличност ----------
// { id, name, e (ECDH pub raw b64u), s (ECDSA pub raw b64u), ePriv (JWK), sPriv (JWK) }
export async function createIdentity(name) {
  const ecdh = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const ecdsa = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  return {
    id: randHex(4),
    name: String(name || '').slice(0, 24),
    e: b64u(new Uint8Array(await subtle.exportKey('raw', ecdh.publicKey))),
    s: b64u(new Uint8Array(await subtle.exportKey('raw', ecdsa.publicKey))),
    ePriv: await subtle.exportKey('jwk', ecdh.privateKey),
    sPriv: await subtle.exportKey('jwk', ecdsa.privateKey)
  };
}
export function identityQR(idn) { return JSON.stringify({ v: 1, t: 'pk', i: idn.id, n: idn.name, e: idn.e, s: idn.s }); }
export function parseQR(text) {
  try {
    const o = JSON.parse(String(text || ''));
    if (!o || o.v !== 1 || (o.t !== 'pk' && o.t !== 'gk')) return null;
    if (o.t === 'pk' && !(o.i && o.e && o.s)) return null;
    if (o.t === 'gk' && !(o.g && o.k && o.p && o.r)) return null;
    return o;
  } catch (e) { return null; }
}

// ---------- ECDH обвиване на ключа на групата ----------
async function sharedAesKey(myEcdhPrivJwk, theirPubB64u, info) {
  const priv = await subtle.importKey('jwk', myEcdhPrivJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  const pub = await subtle.importKey('raw', unb64u(theirPubB64u), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const bits = await subtle.deriveBits({ name: 'ECDH', public: pub }, priv, 256);
  const hk = await subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
  return subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: te.encode('pupsealed-wrap-v1'), info: te.encode(info) },
    hk, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function wrapGroupKey(myIdentity, memberEcdhPub, groupKeyBytes, groupId, epoch) {
  const k = await sharedAesKey(myIdentity.ePriv, memberEcdhPub, groupId + ':' + epoch);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, k, groupKeyBytes));
  return { iv: b64u(iv), ct: b64u(ct) };
}
export async function unwrapGroupKey(myIdentity, organizerEcdhPub, wrap, groupId, epoch) {
  const k = await sharedAesKey(myIdentity.ePriv, organizerEcdhPub, groupId + ':' + epoch);
  return new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: unb64u(wrap.iv) }, k, unb64u(wrap.ct)));
}
export function newGroupKey() { return crypto.getRandomValues(new Uint8Array(32)); }

// Пакет за раздаване на ключа (един QR/файл ЗА ВСЕКИ член): { t:'gk', g, n, e, r (получател),
// o (организатор {i,n,f}), p (ECDH pub на организатора), k (обвит ключ), m (списък {i,n,f}) }.
export async function buildKeyPacket(group, organizer, member, epoch) {
  const keyBytes = unb64u(group.keys[epoch]);
  const wrap = await wrapGroupKey(organizer, member.e, keyBytes, group.g, epoch);
  const roster = [];
  for (const m of group.members) roster.push({ i: m.i, n: m.n, f: m.f });
  return JSON.stringify({ v: 1, t: 'gk', g: group.g, n: group.n, e: epoch, r: member.i,
    o: { i: organizer.id, n: organizer.name, f: await fingerprint(organizer.s) }, p: organizer.e, k: wrap, m: roster });
}

// ---------- запечатване / разпечатване на файл ----------
async function groupAesKey(keyB64u, usage) {
  return subtle.importKey('raw', unb64u(keyB64u), { name: 'AES-GCM' }, false, [usage]);
}
export async function sealFile(group, identity, fileName, mime, bytes) {
  const epoch = group.epoch;
  const key = await groupAesKey(group.keys[epoch], 'encrypt');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const core = { v: 1, g: group.g, e: epoch, i: identity.id, n: identity.name, p: identity.s,
    fn: String(fileName || 'file'), fm: String(mime || 'application/octet-stream'), fz: bytes.length, t: Date.now(), iv: b64u(iv) };
  const coreBytes = te.encode(JSON.stringify(core));
  const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: coreBytes }, key, bytes));
  const sPriv = await subtle.importKey('jwk', identity.sPriv, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = new Uint8Array(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, sPriv, concat(coreBytes, ct)));
  return { bytes: concat(te.encode(MAGIC), u32(coreBytes.length), coreBytes, u32(sig.length), sig, ct), core };
}
export function parseSealed(bytes) {
  try {
    if (!bytes || bytes.length < 20) return null;
    if (td.decode(bytes.subarray(0, MAGIC.length)) !== MAGIC) return null;
    let off = MAGIC.length;
    const cl = rd32(bytes, off); off += 4;
    const coreBytes = bytes.subarray(off, off + cl); off += cl;
    const sl = rd32(bytes, off); off += 4;
    const sig = bytes.subarray(off, off + sl); off += sl;
    const ct = bytes.subarray(off);
    const core = JSON.parse(td.decode(coreBytes));
    if (!core || core.v !== 1 || !core.g || !core.iv || !core.p) return null;
    return { core, coreBytes, sig, ct };
  } catch (e) { return null; }
}
export async function verifySealed(parsed) {
  try {
    const pub = await subtle.importKey('raw', unb64u(parsed.core.p), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    return await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, parsed.sig, concat(parsed.coreBytes, parsed.ct));
  } catch (e) { return false; }
}
export async function unsealFile(parsed, keyB64u) {
  const key = await groupAesKey(keyB64u, 'decrypt');
  return new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: unb64u(parsed.core.iv), additionalData: parsed.coreBytes }, key, parsed.ct));
}

// ---------- сейф (самоличност + групи), по избор с ПИН ----------
let vault = null;      // отключен сейф в паметта: { identity, groups: [], known: {} }
let pinKey = null;     // AES ключ от ПИН (докато апът е отворен)
let pinSalt = null;

function readRaw() { try { return JSON.parse(localStorage.getItem(VAULT_KEY)) || null; } catch (e) { return null; } }
function emptyVault() { return { identity: null, groups: [], known: {} }; }
export function vaultLocked() { const r = readRaw(); return !!(r && r.pin) && !vault; }
export function vaultHasPin() { const r = readRaw(); return !!(r && r.pin); }
async function pinDerive(pin, saltBytes) {
  const base = await subtle.importKey('raw', te.encode(String(pin)), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations: 200000 }, base,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export function getVault() {
  if (vault) return vault;
  const r = readRaw();
  if (!r) { vault = emptyVault(); return vault; }
  if (r.pin) return null; // заключен → първо unlockVault(pin)
  vault = Object.assign(emptyVault(), r.data || {});
  return vault;
}
export async function unlockVault(pin) {
  const r = readRaw(); if (!r || !r.pin) return getVault();
  try {
    const salt = unb64u(r.salt); const k = await pinDerive(pin, salt);
    const plain = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: unb64u(r.iv) }, k, unb64u(r.ct)));
    vault = Object.assign(emptyVault(), JSON.parse(td.decode(plain)));
    pinKey = k; pinSalt = salt;
    return vault;
  } catch (e) { return null; }
}
export async function saveVault() {
  if (!vault) return;
  if (pinKey) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, pinKey, te.encode(JSON.stringify(vault))));
    localStorage.setItem(VAULT_KEY, JSON.stringify({ pin: true, salt: b64u(pinSalt), iv: b64u(iv), ct: b64u(ct) }));
  } else {
    localStorage.setItem(VAULT_KEY, JSON.stringify({ pin: false, data: vault }));
  }
}
export async function setPin(pin) {
  if (!vault) return;
  pinSalt = crypto.getRandomValues(new Uint8Array(16));
  pinKey = await pinDerive(pin, pinSalt);
  await saveVault();
}
export async function removePin() { pinKey = null; pinSalt = null; await saveVault(); }

// ---------- лента на групата (метаданни) + байтове (IndexedDB) ----------
export function readFeed() { try { return JSON.parse(localStorage.getItem(FEED_KEY)) || {}; } catch (e) { return {}; } }
export function writeFeed(f) { try { localStorage.setItem(FEED_KEY, JSON.stringify(f)); } catch (e) {} }
export function addFeedEntry(groupId, entry) {
  const f = readFeed(); (f[groupId] = f[groupId] || []).unshift(entry); writeFeed(f); return entry;
}
export function removeFeedEntry(groupId, entryId) {
  const f = readFeed(); f[groupId] = (f[groupId] || []).filter((e) => e.id !== entryId); writeFeed(f);
}
export function dropFeed(groupId) { const f = readFeed(); delete f[groupId]; writeFeed(f); }

function openDB() {
  return new Promise((resolve, reject) => {
    const rq = indexedDB.open(DB_NAME, 1);
    rq.onupgradeneeded = () => { rq.result.createObjectStore(DB_STORE); };
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error || new Error('IndexedDB'));
  });
}
function idb(mode, fn) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, mode); const st = tx.objectStore(DB_STORE);
    const rq = fn(st);
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error || new Error('IndexedDB'));
    tx.oncomplete = () => db.close();
  }));
}
export function putBytes(id, bytes) { return idb('readwrite', (st) => st.put(bytes, id)); }
export function getBytes(id) { return idb('readonly', (st) => st.get(id)).then((v) => (v ? new Uint8Array(v) : null)); }
export function delBytes(id) { return idb('readwrite', (st) => st.delete(id)); }
