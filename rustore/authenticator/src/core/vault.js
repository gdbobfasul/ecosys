// Version: 1.0001
// vault.js — шифриран сейф за тайните (като Aegis).
// Тайните НИКОГА не се пазят в чист вид. Master паролата извежда ключ през
// PBKDF2 (SHA-256, 210 000 итерации), с който AES-GCM шифрира JSON със записите.
// Запазеният блок е: { v, salt, iv, ct } (всичко base64). Без паролата няма достъп.

const PBKDF2_ITERATIONS = 210000;
const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64(bytes) {
  let s = '';
  const b = new Uint8Array(bytes);
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}
function fromB64(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

// Извежда AES-GCM ключ от паролата и солта.
async function deriveKey(password, salt) {
  const baseKey = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Шифрира произволен обект (записите) с master паролата.
export async function encryptVault(obj, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const plaintext = enc.encode(JSON.stringify(obj));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return { v: 1, salt: toB64(salt), iv: toB64(iv), ct: toB64(ct) };
}

// Разшифрова блока с паролата. Връща обекта или хвърля при грешна парола.
export async function decryptVault(blob, password) {
  if (!blob || !blob.salt || !blob.iv || !blob.ct) throw new Error('bad_vault');
  const salt = fromB64(blob.salt);
  const iv = fromB64(blob.iv);
  const key = await deriveKey(password, salt);
  let plaintext;
  try {
    plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, fromB64(blob.ct));
  } catch (e) {
    throw new Error('wrong_password');   // GCM проверката се проваля при грешна парола
  }
  return JSON.parse(dec.decode(plaintext));
}
