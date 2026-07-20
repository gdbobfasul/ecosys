// Version: 1.0011
// twofas.js — импорт/експорт за 2FAS Auth (популярен отворен authenticator).
// 2FAS експортира JSON (.2fas) с масив `services`. Поддържаме и НЕкриптирания, и КРИПТИРАНИЯ
// (с парола) експорт: полето `servicesEncrypted` е "данни:сол:iv" (всяко base64); ключът се
// извежда с PBKDF2-HMAC-SHA256 (10000 итерации, 256 бита), шифърът е AES-GCM (тагът е
// залепен след данните — WebCrypto го проверява сам, т.е. грешна парола = отказ на decrypt).
//
// Формат (schemaVersion 4):
//   { "services":[ { "name":"GitHub", "secret":"BASE32",
//       "otp":{ "account":"alice", "issuer":"GitHub", "digits":6, "period":30, "counter":0,
//               "algorithm":"SHA1", "tokenType":"TOTP" } } ], "schemaVersion":4 }

// Бърза проверка дали текст изглежда като 2FAS експорт.
export function looksLike2FAS(text) {
  try {
    const j = JSON.parse(text);
    return !!(j && typeof j === 'object' &&
      (Array.isArray(j.services) || typeof j.servicesEncrypted === 'string') &&
      (j.schemaVersion != null || j.servicesEncrypted != null || j.appVersionCode != null || j.appOrigin != null));
  } catch (_) { return false; }
}

// Връща { ok:true, entries } или { ok:false, reason:'json'|'not_2fas'|'encrypted'|'empty' }.
export function parse2FAS(text) {
  let j;
  try { j = JSON.parse(text); } catch (_) { return { ok: false, reason: 'json' }; }
  if (!j || typeof j !== 'object') return { ok: false, reason: 'not_2fas' };
  // Криптиран експорт (парола): има servicesEncrypted, а services е празен/липсва.
  if (typeof j.servicesEncrypted === 'string' && (!Array.isArray(j.services) || !j.services.length)) {
    return { ok: false, reason: 'encrypted' };
  }
  const list = Array.isArray(j.services) ? j.services : [];
  if (!list.length) return { ok: false, reason: 'empty' };

  const entries = [];
  for (const s of list) {
    const secret = String((s && s.secret) || '').replace(/\s/g, '').toUpperCase();
    if (!secret) continue;
    const otp = (s && s.otp) || {};
    const tt = String(otp.tokenType || otp.otpType || 'TOTP').toLowerCase();
    const type = (tt === 'hotp') ? 'hotp' : (tt === 'steam' ? 'steam' : 'totp');
    entries.push({
      type,
      issuer: String(otp.issuer || s.name || '').trim(),
      account: String(otp.account || otp.label || '').trim(),
      secret,
      algorithm: String(otp.algorithm || 'SHA1').toUpperCase(),
      digits: parseInt(otp.digits, 10) || (type === 'steam' ? 5 : 6),
      period: parseInt(otp.period, 10) || 30,
      counter: parseInt(otp.counter, 10) || 0
    });
  }
  if (!entries.length) return { ok: false, reason: 'empty' };
  return { ok: true, entries };
}

// Декриптира КРИПТИРАН 2FAS експорт (с парола). Връща същото като parse2FAS:
// { ok:true, entries } или { ok:false, reason:'json'|'not_encrypted'|'format'|'password'|'empty' }.
export async function decrypt2FAS(text, password) {
  let j;
  try { j = JSON.parse(text); } catch (_) { return { ok: false, reason: 'json' }; }
  const enc = j && j.servicesEncrypted;
  if (typeof enc !== 'string' || !enc) return { ok: false, reason: 'not_encrypted' };
  const parts = enc.split(':');
  if (parts.length < 3) return { ok: false, reason: 'format', detail: 'очаквах "данни:сол:iv", а частите са ' + parts.length };
  const b64 = (s) => {
    const bin = atob(String(s || '').replace(/\s/g, ''));
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  };
  let data, p1, p2;
  try { data = b64(parts[0]); p1 = b64(parts[1]); p2 = b64(parts[2]); }
  catch (_) { return { ok: false, reason: 'format', detail: 'невалиден base64' }; }
  // Ред "данни:сол:iv"; за всеки случай разпознаваме по ДЪЛЖИНА (IV на GCM е 12 байта).
  let salt = p1, iv = p2;
  if (p1.length === 12 && p2.length !== 12) { iv = p1; salt = p2; }
  try {
    const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(password || '')), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 10000 },
      km, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    const services = JSON.parse(new TextDecoder().decode(plainBuf));   // плейнтекстът е МАСИВЪТ services
    return parse2FAS(JSON.stringify({ services: Array.isArray(services) ? services : [], schemaVersion: j.schemaVersion || 4 }));
  } catch (_) {
    // GCM тагът не мина → почти винаги грешна парола (или повреден файл).
    return { ok: false, reason: 'password' };
  }
}

// Сглобява НЕкриптиран 2FAS JSON от нашите записи (за „Експорт към 2FAS").
export function build2FAS(entries) {
  const services = (entries || []).filter((e) => e && e.secret).map((e, i) => {
    const type = (e.type === 'hotp' || e.type === 'steam') ? e.type : 'totp';
    const tokenType = type === 'hotp' ? 'HOTP' : (type === 'steam' ? 'STEAM' : 'TOTP');
    return {
      name: String(e.issuer || e.account || 'Account'),
      secret: String(e.secret || '').toUpperCase(),
      updatedAt: 0,
      otp: {
        account: String(e.account || ''),
        issuer: String(e.issuer || ''),
        digits: parseInt(e.digits, 10) || (type === 'steam' ? 5 : 6),
        period: type === 'hotp' ? 30 : (parseInt(e.period, 10) || 30),
        counter: type === 'hotp' ? (parseInt(e.counter, 10) || 0) : 0,
        algorithm: String(e.algorithm || 'SHA1').toUpperCase(),
        tokenType,
        source: 'Link'
      },
      order: { position: i },
      icon: { selected: 'Label', label: { text: '', backgroundColor: 'Default' } }
    };
  });
  return JSON.stringify({ services, schemaVersion: 4, appOrigin: 'android', appVersionCode: 0, appVersionName: 'Pupikes Authenticator', groups: [] }, null, 2);
}
