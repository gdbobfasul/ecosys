// Version: 1.0001
// gauth-migration.js — разбор на ЕКСПОРТ QR от Google Authenticator („Прехвърли акаунти").
// Такъв QR е otpauth-migration://offline?data=<base64>, който съдържа МНОГО акаунта,
// кодирани в Google protobuf. Тук има минимален protobuf четец (БЕЗ външна библиотека),
// колкото да извадим акаунтите. Връща масив записи във вътрешния формат на приложението.
import { base32Encode } from './base32.js';

// base64 (вкл. URL-вариант) → Uint8Array.
function b64ToBytes(b64) {
  const s = String(b64).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Чете един varint като обикновено число (умножение, не битови отмествания — за да пази
// и стойности над 32 бита, напр. голям HOTP брояч; точно до 2^53). БЕЗ BigInt, защото
// билд-таргетът е es2017 (BigInt литералите „7n" не се поддържат там).
function readVarint(buf, pos) {
  let result = 0, mul = 1, b;
  do {
    b = buf[pos.i++];
    result += (b & 0x7f) * mul;
    mul *= 128;
  } while (b & 0x80);
  return result;
}

// Разбор на protobuf съобщение [start,end) → { номер_на_поле: [стойности] }.
function parseFields(buf, start, end) {
  const pos = { i: start };
  const fields = {};
  while (pos.i < end) {
    const tag = readVarint(buf, pos);
    const fieldNo = Math.floor(tag / 8);
    const wire = tag % 8;
    let val;
    if (wire === 0) { val = readVarint(buf, pos); }                  // varint
    else if (wire === 2) {                                            // дължина + байтове
      const len = Number(readVarint(buf, pos));
      val = buf.subarray(pos.i, pos.i + len); pos.i += len;
    } else if (wire === 5) { val = buf.subarray(pos.i, pos.i + 4); pos.i += 4; }
    else if (wire === 1) { val = buf.subarray(pos.i, pos.i + 8); pos.i += 8; }
    else return fields; // непознат wire type → спираме безопасно
    (fields[fieldNo] = fields[fieldNo] || []).push(val);
  }
  return fields;
}

// Enum-и от Google migration схемата.
const ALGO = { 1: 'SHA1', 2: 'SHA256', 3: 'SHA512', 4: 'MD5' };
const DIGITS = { 1: 6, 2: 8 };
const OTPTYPE = { 1: 'hotp', 2: 'totp' };

function bytesToStr(b) { try { return new TextDecoder().decode(b); } catch (_) { return ''; } }

// Разбира otpauth-migration:// URI → масив от записи (или null, ако не е такъв/празен).
// Запис: { type, issuer, account, secret(Base32), algorithm, digits, period, counter }.
export function parseGoogleMigration(uri) {
  let u;
  try { u = new URL(String(uri).trim()); } catch (_) { return null; }
  if (u.protocol !== 'otpauth-migration:') return null;
  const data = u.searchParams.get('data');
  if (!data) return null;

  let buf;
  try { buf = b64ToBytes(decodeURIComponent(data)); }
  catch (_) { try { buf = b64ToBytes(data); } catch (__) { return null; } }

  let top;
  try { top = parseFields(buf, 0, buf.length); } catch (_) { return null; }
  const params = top[1] || []; // repeated OtpParameters otp_parameters = 1
  const entries = [];
  for (const p of params) {
    let f;
    try { f = parseFields(p, 0, p.length); } catch (_) { continue; }
    const secretBytes = f[1] && f[1][0];
    if (!secretBytes || !secretBytes.length) continue;
    const name = f[2] ? bytesToStr(f[2][0]) : '';
    let issuer = f[3] ? bytesToStr(f[3][0]) : '';
    const algorithm = f[4] ? (ALGO[Number(f[4][0])] || 'SHA1') : 'SHA1';
    const digits = f[5] ? (DIGITS[Number(f[5][0])] || 6) : 6;
    const type = f[6] ? (OTPTYPE[Number(f[6][0])] || 'totp') : 'totp';
    const counter = f[7] ? Number(f[7][0]) : 0;

    // „issuer:account" в името, ако отделният issuer липсва.
    let account = name;
    if (!issuer && name.includes(':')) {
      const parts = name.split(':');
      issuer = parts[0].trim();
      account = parts.slice(1).join(':').trim();
    }
    entries.push({
      type,
      issuer: issuer.trim(),
      account: account.trim(),
      secret: base32Encode(secretBytes),
      algorithm,
      digits,
      period: 30,
      counter
    });
  }
  return entries.length ? entries : null;
}

// Бърза проверка дали низ е миграционен QR (за UI разклонения).
export function isGoogleMigration(s) {
  return /^otpauth-migration:/i.test(String(s || '').trim());
}

// ── ЕКСПОРТ: сглобява otpauth-migration:// URI(та) от нашите записи (за „Експорт към Google
//    Authenticator"). Връща МАСИВ URI-та (на партиди, за да остане QR-ът сканируем). Steam
//    НЕ се поддържа от Google Authenticator → пропуска се (върнат отделно в skipped). ──
import { base32Decode } from './base32.js';

const ALGO_R = { SHA1: 1, SHA256: 2, SHA512: 3, MD5: 4 };
const DIGITS_R = { 6: 1, 8: 2 };

// Кодира varint (обикновени числа, без BigInt — заради es2017 билд таргета).
function vEnc(n) {
  const o = []; let v = Math.max(0, Math.floor(n));
  do { let b = v % 128; v = Math.floor(v / 128); if (v > 0) b |= 0x80; o.push(b); } while (v > 0);
  return o;
}
function fLen(field, bytes) { return [...vEnc((field << 3) | 2), ...vEnc(bytes.length), ...bytes]; }
function fVar(field, n) { return [...vEnc((field << 3) | 0), ...vEnc(n)]; }
function utf8(s) { return [...new TextEncoder().encode(String(s || ''))]; }

function encodeOtpParameters(e) {
  const secret = [...base32Decode(e.secret)];
  const out = [
    ...fLen(1, secret),
    ...fLen(2, utf8(e.account || '')),
    ...fLen(3, utf8(e.issuer || '')),
    ...fVar(4, ALGO_R[String(e.algorithm || 'SHA1').toUpperCase()] || 1),
    ...fVar(5, DIGITS_R[parseInt(e.digits, 10)] || 1),
    ...fVar(6, e.type === 'hotp' ? 1 : 2)
  ];
  if (e.type === 'hotp') out.push(...fVar(7, parseInt(e.counter, 10) || 0));
  return out;
}

function bytesToB64(arr) {
  let bin = '';
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i] & 0xff);
  return btoa(bin);
}

// entries → { uris:[...], exported:N, skipped:N }. perBatch ограничава акаунтите на QR.
export function buildGoogleMigrationURIs(entries, perBatch = 10) {
  const supported = (entries || []).filter((e) => e.type !== 'steam' && e.secret);
  const skipped = (entries || []).length - supported.length;
  const batches = [];
  for (let i = 0; i < supported.length; i += perBatch) batches.push(supported.slice(i, i + perBatch));
  const uris = [];
  batches.forEach((batch, idx) => {
    let payload = [];
    for (const e of batch) payload.push(...fLen(1, encodeOtpParameters(e)));
    payload = payload.concat(
      fVar(2, 1),               // version
      fVar(3, batches.length),  // batch_size
      fVar(4, idx),             // batch_index
      fVar(5, 0)                // batch_id
    );
    uris.push('otpauth-migration://offline?data=' + encodeURIComponent(bytesToB64(payload)));
  });
  return { uris, exported: supported.length, skipped };
}
