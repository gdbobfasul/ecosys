// Version: 1.0001
// aegis.js — импорт от ЕКСПОРТ файл на Aegis Authenticator (Android, отворен код).
// Aegis експортира JSON. Поддържаме НЕкриптирания (plain) експорт; криптираният (scrypt +
// AES-GCM) изисква декриптиране с парола, което не правим тук — за него казваме на потребителя
// да експортира без парола.
//
// Структура (plain):
//   { "version":1, "header":{ "slots":null, "params":null },
//     "db":{ "version":2, "entries":[
//        { "type":"totp"|"hotp"|"steam", "name":"<акаунт>", "issuer":"<издател>",
//          "info":{ "secret":"<Base32>", "algo":"SHA1", "digits":6, "period":30, "counter":0 } }
//     ] } }
// Криптиран: "db" е base64 НИЗ, а "header.slots" е масив.
//
// ВАЖНО (поправка на „не отключва на телефона"): scrypt-js се внася СТАТИЧНО горе, за да
// влезе в ОСНОВНИЯ bundle. Преди се ползваше динамичен `await import('scrypt-js')`, който при
// `base:'./'` + зареждане от file:// на устройството правеше ОТДЕЛНО async парче, ненамираемо
// в WebView-а → ключът от паролата не се извличаше и отключването падаше въпреки вярната парола.
import scryptDefault, * as scryptNS from 'scrypt-js';
// Взимаме И двата варианта (от namespace ИЛИ от default — според това как бъндлерът интерпретира
// CommonJS модула). Предпочитаме СИНХРОННИЯ syncScrypt: асинхронният scrypt разчита на setTimeout
// за разбиване на работата, което в някои Android WebView-та се държи различно/бавно → ключът
// не излизаше и отключването „падаше" въпреки вярната парола. syncScrypt е чисто изчисление.
const _syncScrypt = (scryptNS && scryptNS.syncScrypt) || (scryptDefault && scryptDefault.syncScrypt) || null;
const _asyncScrypt = (scryptNS && scryptNS.scrypt) || (scryptDefault && scryptDefault.scrypt) || null;
const scryptFn = _syncScrypt || _asyncScrypt || null;

// Извежда ключ от парола чрез scrypt. Ползва синхронния вариант, ако е наличен (по-надеждно
// на телефон); иначе async. Хвърля при липсваща реализация — викащият го хваща и докладва.
async function scryptDerive(pw, salt, n, r, p, dkLen) {
  if (_syncScrypt) return _syncScrypt(pw, salt, n, r, p, dkLen);
  if (_asyncScrypt) return await _asyncScrypt(pw, salt, n, r, p, dkLen);
  throw new Error('scrypt липсва в бъндъла');
}

// Връща { ok:true, entries:[...] } или { ok:false, reason:'json'|'not_aegis'|'encrypted'|'empty' }.
// reason='encrypted' → UI казва „експортирай от Aegis без парола".
export function parseAegisExport(text) {
  let j;
  try { j = JSON.parse(text); } catch (_) { return { ok: false, reason: 'json' }; }
  if (!j || typeof j !== 'object') return { ok: false, reason: 'not_aegis' };

  const db = j.db;
  if (db == null) return { ok: false, reason: 'not_aegis' };
  if (typeof db === 'string') return { ok: false, reason: 'encrypted' }; // криптиран Aegis (scrypt)

  const list = Array.isArray(db.entries) ? db.entries : [];
  if (!list.length) return { ok: false, reason: 'empty' };

  const entries = [];
  for (const e of list) {
    if (!e || !e.info || !e.info.secret) continue;
    const rawType = String(e.type || 'totp').toLowerCase();
    const info = e.info;
    entries.push({
      type: (rawType === 'hotp' || rawType === 'steam') ? rawType : 'totp',
      issuer: String(e.issuer || '').trim(),
      account: String(e.name || '').trim(),
      secret: String(info.secret).replace(/\s/g, '').toUpperCase(),
      algorithm: String(info.algo || 'SHA1').toUpperCase(),
      digits: parseInt(info.digits, 10) || (rawType === 'steam' ? 5 : 6),
      period: parseInt(info.period, 10) || 30,
      counter: parseInt(info.counter, 10) || 0
    });
  }
  if (!entries.length) return { ok: false, reason: 'empty' };
  return { ok: true, entries };
}

// Сглобява НЕкриптиран Aegis JSON експорт от нашите записи (за „Експорт към Aegis").
// Резултатът се отваря директно в Aegis → Импорт.
export function buildAegisExport(entries) {
  const list = (entries || []).map((e, i) => {
    const type = (e.type === 'hotp' || e.type === 'steam') ? e.type : 'totp';
    const info = {
      secret: String(e.secret || '').toUpperCase(),
      algo: String(e.algorithm || 'SHA1').toUpperCase(),
      digits: parseInt(e.digits, 10) || (type === 'steam' ? 5 : 6)
    };
    if (type === 'hotp') info.counter = parseInt(e.counter, 10) || 0;
    else info.period = parseInt(e.period, 10) || 30;
    return {
      type,
      uuid: 'kcy-' + (e.id || i),
      name: String(e.account || ''),
      issuer: String(e.issuer || ''),
      note: '',
      icon: null,
      info
    };
  });
  return JSON.stringify({
    version: 1,
    header: { slots: null, params: null },
    db: { version: 3, entries: list }
  }, null, 2);
}

// Бърза проверка дали JSON текст изглежда като Aegis експорт (за авто-разпознаване).
export function looksLikeAegis(text) {
  try {
    const j = JSON.parse(text);
    return !!(j && j.db && (typeof j.db === 'string' || Array.isArray(j.db.entries)) && j.header !== undefined);
  } catch (_) { return false; }
}

// ── ДЕКРИПТИРАНЕ на КРИПТИРАН Aegis експорт (по подразбиране Aegis криптира!) ──
// Схема: header.slots (scrypt параметри + мастер ключ, шифриран с ключа от паролата),
// header.params (nonce/tag за базата), db = base64(AES-256-GCM шифрирана база).
function hexToBytes(hex) {
  const s = String(hex || '').replace(/[^0-9a-fA-F]/g, '');
  const a = new Uint8Array(Math.floor(s.length / 2));
  for (let i = 0; i < a.length; i++) a[i] = parseInt(s.substr(i * 2, 2), 16);
  return a;
}
function b64ToBytes(b64) {
  const s = atob(String(b64 || '').replace(/-/g, '+').replace(/_/g, '/'));
  const a = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
  return a;
}
function concatBytes(a, b) { const o = new Uint8Array(a.length + b.length); o.set(a, 0); o.set(b, a.length); return o; }

async function aesGcmDecrypt(keyBytes, ivBytes, ctBytes, tagBytes) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']);
  const data = concatBytes(ctBytes, tagBytes); // WebCrypto иска ciphertext||tag
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes, tagLength: 128 }, key, data);
  return new Uint8Array(pt);
}

function mapAegisEntries(list) {
  return (list || []).filter((e) => e && e.info && e.info.secret).map((e) => {
    const type = (e.type === 'hotp' || e.type === 'steam') ? e.type : 'totp';
    const info = e.info;
    return {
      type,
      issuer: String(e.issuer || '').trim(),
      account: String(e.name || '').trim(),
      secret: String(info.secret).replace(/\s/g, '').toUpperCase(),
      algorithm: String(info.algo || 'SHA1').toUpperCase(),
      digits: parseInt(info.digits, 10) || (type === 'steam' ? 5 : 6),
      period: parseInt(info.period, 10) || 30,
      counter: parseInt(info.counter, 10) || 0
    };
  });
}

// Декриптира криптиран Aegis експорт с парола. Връща { ok:true, entries } или
// { ok:false, reason:'json'|'not_aegis'|'noscrypt'|'password'|'empty' }.
export async function decryptAegisExport(text, password) {
  let j;
  try { j = JSON.parse(text); } catch (_) { return { ok: false, reason: 'json' }; }
  if (!j || typeof j.db !== 'string' || !j.header || !Array.isArray(j.header.slots)) {
    return { ok: false, reason: 'not_aegis' };
  }
  if (!scryptFn) return { ok: false, reason: 'noscrypt' };

  const pw = new TextEncoder().encode(String(password || ''));
  const slots = j.header.slots.filter((s) => s && s.type === 1 && s.key && s.key_params); // password slots
  if (!slots.length) return { ok: false, reason: 'not_aegis', detail: 'няма слот с парола (type 1)' };

  let masterKey = null;
  let scryptErr = null;   // ако извеждането на ключ (scrypt) се счупи — различаваме го от „грешна парола"
  for (const slot of slots) {
    let slotKey = null;
    try {
      const dk = await scryptDerive(pw, hexToBytes(slot.salt), slot.n, slot.r, slot.p, 32);
      slotKey = (dk instanceof Uint8Array) ? dk : new Uint8Array(dk);
    } catch (e) {
      scryptErr = String((e && e.message) || e);   // scrypt не успя (липсва/счупен) → запомни и пробвай нататък
      continue;
    }
    try {
      masterKey = await aesGcmDecrypt(slotKey, hexToBytes(slot.key_params.nonce), hexToBytes(slot.key), hexToBytes(slot.key_params.tag));
      break;
    } catch (_) { /* грешна парола за този слот → пробвай следващия */ }
  }
  if (!masterKey) {
    // Ако scrypt се е счупил на ВСИЧКИ слотове → това НЕ е „грешна парола", а техническа грешка
    // (показваме реалната причина, за да се види на устройството). Иначе наистина е грешна парола.
    if (scryptErr) return { ok: false, reason: 'scrypt_error', detail: scryptErr };
    return { ok: false, reason: 'password' };
  }

  try {
    const params = j.header.params || {};
    const ptBytes = await aesGcmDecrypt(masterKey, hexToBytes(params.nonce), b64ToBytes(j.db), hexToBytes(params.tag));
    const db = JSON.parse(new TextDecoder().decode(ptBytes));
    const entries = mapAegisEntries(Array.isArray(db.entries) ? db.entries : []);
    if (!entries.length) return { ok: false, reason: 'empty' };
    return { ok: true, entries };
  } catch (_) {
    return { ok: false, reason: 'password' };
  }
}
