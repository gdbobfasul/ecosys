// Version: 1.0014
// importer.js — ЕДИНЕН импорт за всички източници (QR/otpauth, .json бекъп, Aegis, Google
// Authenticator миграция). Прави ДЕДУПЛИКАЦИЯ (прескача вече съществуващи кодове) и връща
// единен резултат { ok, imported, duplicates, method, reason }, който UI-ят описва еднакво
// навсякъде с describeResult() — за да се изписва КОЛКО кода и ПО КАКЪВ начин при ВСЕКИ импорт.
import { session, addEntry, addPassword, addSeed } from './storage.js';
import { parseOtpauthURI } from './otp.js';
import { parseGoogleMigration } from './gauth-migration.js';
import { parseAegisExport, decryptAegisExport, looksLikeAegis } from './aegis.js';
import { parse2FAS, looksLike2FAS, decrypt2FAS } from './twofas.js';
import { parseBrowserCsv, passwordFullKey } from './passwords-io.js';
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

// Импорт от 2FAS Auth експорт (некриптиран JSON). Криптиран → reason:'encrypted'.
export async function import2FASText(text) {
  const a = parse2FAS(text);
  if (!a.ok) return { ok: false, method: '2fas', reason: a.reason };
  const r = await addEntriesDedup(a.entries);
  return { ok: true, method: '2fas', ...r };
}

// Импорт от КРИПТИРАН 2FAS експорт (с парола): PBKDF2-SHA256 (10000) + AES-GCM
// (twofas.decrypt2FAS). Грешна парола → reason:'password' (викащият пита пак).
export async function import2FASEncrypted(text, password) {
  const a = await decrypt2FAS(text, password);
  if (!a.ok) return { ok: false, method: '2fas', reason: a.reason, detail: a.detail };
  const r = await addEntriesDedup(a.entries);
  return { ok: true, method: '2fas', ...r };
}

// Импорт от УНИВЕРСАЛЕН otpauth:// списък (текст, по един URI на ред). Поддържа и otpauth-migration
// (Google) редове. Това е форматът, който почти всеки authenticator може да изнесе/внесе.
export async function importOtpauthList(text) {
  const lines = String(text || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const list = [];
  for (const ln of lines) {
    if (/^otpauth-migration:/i.test(ln)) { const g = parseGoogleMigration(ln); if (g) list.push(...g); }
    else if (/^otpauth:/i.test(ln)) { const p = parseOtpauthURI(ln); if (p) list.push(p); }
  }
  if (!list.length) return { ok: false, method: 'otpauth', reason: 'qr' };
  const r = await addEntriesDedup(list);
  return { ok: true, method: 'otpauth', ...r };
}

// АВТО-разпознаване на формат от съдържанието на файл: otpauth списък / Aegis / 2FAS / наш .json бекъп.
// Aegis/2FAS криптирани връщат reason:'encrypted' → викащият да поиска парола (за Aegis) или да упъти.
export async function importAnyText(text) {
  const s = String(text || '').trim();
  if (!s) return { ok: false, method: 'json', reason: 'empty' };
  if (s[0] !== '{' && s[0] !== '[' && /^otpauth(-migration)?:/im.test(s)) return importOtpauthList(text);
  if (looksLikeAegis(s)) return importAegisText(text);
  if (looksLike2FAS(s)) return import2FASText(text);
  return importJsonText(text);
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

// ── ПАРОЛИ: импорт от браузърен CSV (Chrome/Edge/Firefox) с ДЕДУПЛИКАЦИЯ ──
// Прескача само при ПЪЛНО СЪВПАДЕНИЕ (сайт + потребител + парола). Различна парола или
// различен потребител за същия сайт = НОВ запис (добавя се, не се брои за дубликат).
export async function importPasswordsCsv(text) {
  const p = parseBrowserCsv(text);
  if (!p.ok) return { ok: false, method: 'passwords', reason: p.reason, detail: p.detail };
  const seen = new Set(session.passwords.map(passwordFullKey));
  let imported = 0, duplicates = 0;
  for (const e of p.entries) {
    const k = passwordFullKey(e);
    if (seen.has(k)) { duplicates++; continue; }
    seen.add(k);
    await addPassword({ title: e.title, url: e.url, login: e.login, password: e.password, note: e.note });
    imported++;
  }
  return { ok: true, method: 'passwords', format: p.format, imported, duplicates };
}

// ── КРИПТО ПОРТФЕЙЛИ: импорт от наш .json бекъп (дедуп по портфейл+етикет+seed) ──
export async function importSeedsJson(text) {
  let parsed;
  try { parsed = JSON.parse(text); } catch (_) { return { ok: false, method: 'seeds', reason: 'json' }; }
  const list = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.seeds) ? parsed.seeds : []);
  if (!list.length) return { ok: false, method: 'seeds', reason: 'empty' };
  const keyS = (s) => (s.wallet || 'other') + '|' + (s.label || '') + '|' + (s.seedPhrase || s.privateKey || '');
  const seen = new Set(session.seeds.map(keyS));
  let imported = 0, duplicates = 0;
  for (const s of list) {
    if (!s || typeof s !== 'object') continue;
    const k = keyS(s);
    if (seen.has(k)) { duplicates++; continue; }
    seen.add(k);
    await addSeed(s);
    imported++;
  }
  return { ok: true, method: 'seeds', imported, duplicates };
}

const METHOD_KEY = {
  qr: 'method_qr', google: 'method_google', aegis: 'method_aegis', json: 'method_json',
  '2fas': 'method_2fas', otpauth: 'method_otpauth', passwords: 'method_passwords', seeds: 'method_seeds'
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
    if (r === 'not_browser_csv') return t('pw_not_csv') + (res.detail ? ' — ' + res.detail : '');
    if (r === 'empty') return t('import_empty');
    return t('import_failed');
  }
  const method = t(METHOD_KEY[res.method] || 'method_qr');
  if (res.imported === 0 && res.duplicates > 0) return tf('import_all_dups', res.duplicates, method);
  if (res.duplicates > 0) return tf('import_result_dups', res.imported, method, res.duplicates);
  return tf('import_result', res.imported, method);
}
