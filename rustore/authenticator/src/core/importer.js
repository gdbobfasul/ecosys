// Version: 1.0001
// importer.js — ЕДИНЕН импорт за всички източници (QR/otpauth, .json бекъп, Aegis, Google
// Authenticator миграция). Прави ДЕДУПЛИКАЦИЯ (прескача вече съществуващи кодове) и връща
// единен резултат { ok, imported, duplicates, method, reason }, който UI-ят описва еднакво
// навсякъде с describeResult() — за да се изписва КОЛКО кода и ПО КАКЪВ начин при ВСЕКИ импорт.
import { session, addEntry } from './storage.js';
import { parseOtpauthURI } from './otp.js';
import { parseGoogleMigration } from './gauth-migration.js';
import { parseAegisExport, decryptAegisExport } from './aegis.js';
import { t, tf } from './i18n.js';

// Ключ за дубликат: ТАЙНА (нормализирана) + ТИП. Един и същ код = един и същ акаунт.
function keyOf(e) {
  return String(e.secret || '').toUpperCase().replace(/\s/g, '') + '|' + (e.type || 'totp');
}

// Добавя записи, като ПРЕСКАЧА дубликатите (спрямо вече наличните и в рамките на партидата).
// Връща { imported, duplicates }.
export async function addEntriesDedup(entries) {
  const seen = new Set();
  for (const e of session.entries) seen.add(keyOf(e));
  let imported = 0, duplicates = 0;
  for (const e of (entries || [])) {
    if (!e || !e.secret) continue;
    const k = keyOf(e);
    if (seen.has(k)) { duplicates++; continue; }
    seen.add(k);
    await addEntry({
      type: e.type || 'totp',
      issuer: e.issuer || '',
      account: e.account || '',
      secret: String(e.secret).toUpperCase().replace(/\s/g, ''),
      algorithm: (e.algorithm || 'SHA1').toUpperCase(),
      digits: parseInt(e.digits, 10) || (e.type === 'steam' ? 5 : 6),
      period: parseInt(e.period, 10) || 30,
      counter: parseInt(e.counter, 10) || 0
    });
    imported++;
  }
  return { imported, duplicates };
}

// Импорт от наш .json бекъп (масив или { entries:[…] }).
export async function importJsonText(text) {
  let parsed;
  try { parsed = JSON.parse(text); } catch (_) { return { ok: false, method: 'json', reason: 'json' }; }
  const list = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.entries) ? parsed.entries : []);
  const norm = list
    .filter((it) => it && it.secret)
    .map((it) => ({
      type: it.type || 'totp', issuer: it.issuer || '', account: it.account || it.name || '',
      secret: it.secret, algorithm: it.algorithm || 'SHA1', digits: it.digits || 6,
      period: it.period || 30, counter: it.counter || 0
    }));
  if (!norm.length) return { ok: false, method: 'json', reason: 'empty' };
  const r = await addEntriesDedup(norm);
  return { ok: true, method: 'json', ...r };
}

// Импорт от Aegis JSON експорт (некриптиран). Ако е КРИПТИРАН → reason:'encrypted'
// (UI пита парола и вика importAegisEncrypted).
export async function importAegisText(text) {
  const a = parseAegisExport(text);
  if (!a.ok) return { ok: false, method: 'aegis', reason: a.reason };
  const r = await addEntriesDedup(a.entries);
  return { ok: true, method: 'aegis', ...r };
}

// Импорт от КРИПТИРАН Aegis експорт с парола (scrypt + AES-GCM).
export async function importAegisEncrypted(text, password) {
  const a = await decryptAegisExport(text, password);
  if (!a.ok) return { ok: false, method: 'aegis', reason: a.reason, detail: a.detail };
  const r = await addEntriesDedup(a.entries);
  return { ok: true, method: 'aegis', ...r };
}

// Импорт от декодиран QR низ: единичен otpauth:// ИЛИ Google миграция (много акаунта).
export async function importQRData(data) {
  const s = String(data || '').trim();
  if (/^otpauth-migration:/i.test(s)) {
    const list = parseGoogleMigration(s);
    if (!list || !list.length) return { ok: false, method: 'google', reason: 'qr' };
    const r = await addEntriesDedup(list);
    return { ok: true, method: 'google', ...r };
  }
  const p = parseOtpauthURI(s);
  if (!p) return { ok: false, method: 'qr', reason: 'qr' };
  const r = await addEntriesDedup([p]);
  return { ok: true, method: 'qr', ...r };
}

// Синхронна проверка дали низ е импортируем QR (за да не спираме камерата напразно).
export function isImportableQR(s) {
  const x = String(s || '').trim();
  return /^otpauth-migration:/i.test(x) ? !!parseGoogleMigration(x) : !!parseOtpauthURI(x);
}

const METHOD_KEY = {
  qr: 'method_qr', google: 'method_google', aegis: 'method_aegis', json: 'method_json'
};

// ЕДИННО съобщение за резултата: при УСПЕХ — колко кода и по какъв начin (+ колко дубликата
// прескочени); при неуспех — ясна причина. Ползва се от ВСИЧКИ пътища за импорт.
export function describeResult(res) {
  if (!res || !res.ok) {
    const r = res && res.reason;
    if (r === 'encrypted') return t('aegis_encrypted');
    if (r === 'password') return t('aegis_bad_password');
    if (r === 'noscrypt') return t('import_failed') + ' (scrypt липсва)';
    // Техническа грешка при извеждане на ключа — показваме реалната причина, за да се диагностицира.
    if (r === 'scrypt_error') return t('import_failed') + (res.detail ? ' — ' + res.detail : ' (scrypt)');
    if (r === 'not_aegis') return t('aegis_not') + (res.detail ? ' — ' + res.detail : '');
    if (r === 'qr') return t('qr_not_found');
    if (r === 'empty') return t('import_empty');
    return t('import_failed');
  }
  const method = t(METHOD_KEY[res.method] || 'method_qr');
  if (res.imported === 0 && res.duplicates > 0) return tf('import_all_dups', res.duplicates, method);
  if (res.duplicates > 0) return tf('import_result_dups', res.imported, method, res.duplicates);
  return tf('import_result', res.imported, method);
}
