// Version: 1.0021
// hawk-crypto.js — шифроване НА УСТРОЙСТВОТО за пакетите между носещ и наблюдаващ.
//
//   • Ключ: PBKDF2(код за сдвояване, сол „pupikes-hawk-v1", 120 000 итерации, SHA-256) → AES-GCM 256.
//   • Идентификатор на двойката за сървъра: SHA-256('hawk-pair:' + код) → първите 32 hex знака.
//     Самият код НИКОГА не се праща — сървърът вижда само хеша и непрозрачни шифровани низове.
//   • Пакет: base64( IV(12 байта) || шифротекст ). Всеки пакет има нов случаен IV.
//
// Всичко през WebCrypto (crypto.subtle); в Capacitor WebView (https://localhost) е наличен.

const SALT = 'pupikes-hawk-v1';
const ITER = 120000;

const _keys = new Map(); // код → CryptoKey (кеш)

function subtle() {
  try { return (typeof crypto !== 'undefined' && crypto.subtle) ? crypto.subtle : null; } catch (_) { return null; }
}
export function cryptoAvailable() { return !!subtle(); }

// Нормализира кода: главни букви, без интервали/тирета (за да може да се въвежда свободно).
export function normalizeCode(code) {
  return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// Кратък код за сдвояване (8 знака от азбука без двусмислени букви: без 0/O, 1/I).
export function generateCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const a = new Uint8Array(8);
  try { crypto.getRandomValues(a); } catch (_) { for (let i = 0; i < 8; i++) a[i] = Math.floor(Math.random() * 256); }
  let s = '';
  for (let i = 0; i < 8; i++) s += alphabet[a[i] % alphabet.length];
  return s.slice(0, 4) + '-' + s.slice(4);
}

function b64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function unb64(str) {
  const bin = atob(String(str || ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function hex(bytes) { return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join(''); }

async function deriveKey(code) {
  const norm = normalizeCode(code);
  if (_keys.has(norm)) return _keys.get(norm);
  const s = subtle();
  if (!s) throw new Error('no-webcrypto');
  const enc = new TextEncoder();
  const base = await s.importKey('raw', enc.encode(norm), 'PBKDF2', false, ['deriveKey']);
  const key = await s.deriveKey(
    { name: 'PBKDF2', salt: enc.encode(SALT), iterations: ITER, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
  _keys.set(norm, key);
  return key;
}

// Идентификатор на двойката (за URL-а на сървъра). Не разкрива кода.
export async function pairId(code) {
  const s = subtle();
  if (!s) throw new Error('no-webcrypto');
  const d = await s.digest('SHA-256', new TextEncoder().encode('hawk-pair:' + normalizeCode(code)));
  return hex(new Uint8Array(d)).slice(0, 32);
}

// Обект → шифрован base64 низ.
export async function encryptJson(code, obj) {
  const key = await deriveKey(code);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const data = new TextEncoder().encode(JSON.stringify(obj));
  const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, key, data));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0); out.set(ct, iv.length);
  return b64(out);
}

// Шифрован base64 низ → обект (null при грешен ключ/повреден пакет — никога не хвърля).
export async function decryptJson(code, blob) {
  try {
    const key = await deriveKey(code);
    const all = unb64(blob);
    if (all.length < 13) return null;
    const iv = all.slice(0, 12), ct = all.slice(12);
    const pt = await subtle().decrypt({ name: 'AES-GCM', iv }, key, ct);
    return JSON.parse(new TextDecoder().decode(pt));
  } catch (_) { return null; }
}
