// Version: 1.0001
// base32.js — RFC 4648 Base32 (без подложка), за тайните на OTP акаунтите.
// Тайните в otpauth:// са Base32, главни букви A–Z и цифри 2–7.
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

// Декодира Base32 низ до Uint8Array. Игнорира интервали, тирета и подложка „=".
export function base32Decode(input) {
  const clean = String(input || '').toUpperCase().replace(/[\s\-=]/g, '');
  let bits = 0, value = 0;
  const out = [];
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx === -1) continue;          // пропускаме непознати символи
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}

// Кодира Uint8Array до Base32 низ (за експорт/споделяне на тайна).
export function base32Encode(bytes) {
  let bits = 0, value = 0, out = '';
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += ALPHABET[(value >>> bits) & 31];
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}
