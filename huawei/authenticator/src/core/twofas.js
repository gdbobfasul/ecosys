// Version: 1.0001
// twofas.js — импорт/експорт за 2FAS Auth (популярен отворен authenticator).
// 2FAS експортира JSON (.2fas) с масив `services`. Поддържаме НЕкриптирания експорт; ако файлът е
// криптиран (поле `servicesEncrypted`, без `services`) → казваме на потребителя да експортира без парола.
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
  return JSON.stringify({ services, schemaVersion: 4, appOrigin: 'android', appVersionCode: 0, appVersionName: 'KCY Authenticator', groups: [] }, null, 2);
}
