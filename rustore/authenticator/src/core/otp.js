// otp.js — генериране на еднократни кодове (като Google Authenticator / Aegis).
// Поддържа TOTP (RFC 6238), HOTP (RFC 4226) и Steam Guard.
// HMAC се смята с WebCrypto (crypto.subtle) → функциите са асинхронни.
import { base32Decode } from './base32.js';

const STEAM_ALPHABET = '23456789BCDFGHJKMNPQRTVWXY';

// Картографиране на име на алгоритъм към WebCrypto хеш.
function hashName(algorithm) {
  switch (String(algorithm || 'SHA1').toUpperCase()) {
    case 'SHA256': return 'SHA-256';
    case 'SHA512': return 'SHA-512';
    default:       return 'SHA-1';
  }
}

// 8-байтов big-endian брояч (за HMAC входа).
function counterBytes(counter) {
  const buf = new Uint8Array(8);
  let c = Math.floor(counter);
  for (let i = 7; i >= 0; i--) { buf[i] = c & 0xff; c = Math.floor(c / 256); }
  return buf;
}

async function hmac(keyBytes, msgBytes, algorithm) {
  const key = await crypto.subtle.importKey(
    'raw', keyBytes, { name: 'HMAC', hash: { name: hashName(algorithm) } }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, msgBytes);
  return new Uint8Array(sig);
}

// Динамично отрязване (RFC 4226) → 31-битово число.
function truncate(hmacBytes) {
  const offset = hmacBytes[hmacBytes.length - 1] & 0x0f;
  return ((hmacBytes[offset] & 0x7f) << 24)
       | ((hmacBytes[offset + 1] & 0xff) << 16)
       | ((hmacBytes[offset + 2] & 0xff) << 8)
       | (hmacBytes[offset + 3] & 0xff);
}

// HOTP код (брояч-базиран).
export async function generateHOTP(secretBase32, counter, opts = {}) {
  const digits = opts.digits || 6;
  const keyBytes = base32Decode(secretBase32);
  const h = await hmac(keyBytes, counterBytes(counter), opts.algorithm);
  const num = truncate(h) % Math.pow(10, digits);
  return String(num).padStart(digits, '0');
}

// TOTP код (време-базиран). По подразбиране 6 цифри, период 30с, SHA1.
export async function generateTOTP(secretBase32, opts = {}) {
  const period = opts.period || 30;
  const t = Math.floor((opts.timestamp != null ? opts.timestamp : Date.now()) / 1000);
  const counter = Math.floor(t / period);
  return generateHOTP(secretBase32, counter, opts);
}

// Steam Guard код (5 символа от собствена азбука, период 30с, SHA1).
export async function generateSteam(secretBase32, opts = {}) {
  const period = opts.period || 30;
  const t = Math.floor((opts.timestamp != null ? opts.timestamp : Date.now()) / 1000);
  const counter = Math.floor(t / period);
  const keyBytes = base32Decode(secretBase32);
  const h = await hmac(keyBytes, counterBytes(counter), 'SHA1');
  let num = truncate(h);
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += STEAM_ALPHABET[num % STEAM_ALPHABET.length];
    num = Math.floor(num / STEAM_ALPHABET.length);
  }
  return code;
}

// Генерира код според типа на записа.
export async function generateCode(entry, timestamp) {
  const opts = {
    digits: entry.digits || 6,
    period: entry.period || 30,
    algorithm: entry.algorithm || 'SHA1',
    timestamp
  };
  if (entry.type === 'hotp') return generateHOTP(entry.secret, entry.counter || 0, opts);
  if (entry.type === 'steam') return generateSteam(entry.secret, opts);
  return generateTOTP(entry.secret, opts);
}

// Колко секунди остават до следващия TOTP/Steam код.
export function secondsRemaining(period, timestamp) {
  const p = period || 30;
  const t = Math.floor((timestamp != null ? timestamp : Date.now()) / 1000);
  return p - (t % p);
}

// Разбор на otpauth:// URI (от QR код или поставен линк).
// Формат: otpauth://TYPE/LABEL?secret=...&issuer=...&algorithm=...&digits=...&period=...&counter=...
export function parseOtpauthURI(uri) {
  let u;
  try { u = new URL(String(uri).trim()); } catch (e) { return null; }
  if (u.protocol !== 'otpauth:') return null;

  const type = (u.host || '').toLowerCase();           // totp | hotp | steam
  if (type !== 'totp' && type !== 'hotp' && type !== 'steam') return null;

  // LABEL = „issuer:account" или само „account"
  let label = decodeURIComponent((u.pathname || '/').replace(/^\//, ''));
  let issuer = u.searchParams.get('issuer') || '';
  let account = label;
  if (label.includes(':')) {
    const parts = label.split(':');
    if (!issuer) issuer = parts[0].trim();
    account = parts.slice(1).join(':').trim();
  }

  const secret = (u.searchParams.get('secret') || '').replace(/\s/g, '');
  if (!secret) return null;

  return {
    type,
    issuer: issuer.trim(),
    account: account.trim(),
    secret,
    algorithm: (u.searchParams.get('algorithm') || 'SHA1').toUpperCase(),
    digits: parseInt(u.searchParams.get('digits') || (type === 'steam' ? '5' : '6'), 10) || 6,
    period: parseInt(u.searchParams.get('period') || '30', 10) || 30,
    counter: parseInt(u.searchParams.get('counter') || '0', 10) || 0
  };
}

// Сглобява otpauth:// URI от запис (за експорт / показване като QR).
export function buildOtpauthURI(entry) {
  const type = entry.type || 'totp';
  const label = entry.issuer
    ? `${encodeURIComponent(entry.issuer)}:${encodeURIComponent(entry.account || '')}`
    : encodeURIComponent(entry.account || '');
  const p = new URLSearchParams();
  p.set('secret', entry.secret);
  if (entry.issuer) p.set('issuer', entry.issuer);
  if (entry.algorithm && entry.algorithm !== 'SHA1') p.set('algorithm', entry.algorithm);
  if (entry.digits && entry.digits !== 6) p.set('digits', String(entry.digits));
  if (entry.period && entry.period !== 30) p.set('period', String(entry.period));
  if (type === 'hotp') p.set('counter', String(entry.counter || 0));
  return `otpauth://${type}/${label}?${p.toString()}`;
}
