// Version: 1.0013
// exporter.js — ЕДИНЕН експорт: наш .json бекъп, Aegis JSON, Google Authenticator (миграционен
// QR като PNG), „всички като QR" (.zip), браузърни пароли (CSV) и крипто портфейли (.json).
// Сваля файл на устройството (Blob + native saveFile). Нищо не се качва навън.
import { session } from './storage.js';
import { buildAegisExport } from './aegis.js';
import { build2FAS } from './twofas.js';
import { buildOtpauthURI } from './otp.js';
import { buildGoogleMigrationURIs } from './gauth-migration.js';
import { buildChromiumCsv, buildFirefoxCsv } from './passwords-io.js';
import { zipStore } from './zip.js';
import { saveFile } from './filesave.js';

function dataURLtoBytes(durl) {
  const b64 = durl.split(',')[1] || '';
  const s = atob(b64);
  const arr = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) arr[i] = s.charCodeAt(i);
  return arr;
}

// Наш .json бекъп.
export async function exportJsonFile() {
  if (!session.entries.length) return { ok: false, reason: 'empty' };
  const data = JSON.stringify({ app: 'kcy-authenticator', version: 1, entries: session.entries }, null, 2);
  await saveFile('kcy-authenticator-export.json', data, 'application/json', { isText: true });
  return { ok: true, count: session.entries.length };
}

// Aegis JSON експорт (некриптиран) — отваря се директно в Aegis → Импорт.
export async function exportAegisFile() {
  if (!session.entries.length) return { ok: false, reason: 'empty' };
  const json = buildAegisExport(session.entries);
  await saveFile('aegis-export.json', json, 'application/json', { isText: true });
  return { ok: true, count: session.entries.length };
}

// 2FAS експорт (некриптиран .2fas JSON) — внася се в 2FAS Auth → Settings → Import.
export async function export2FASFile() {
  if (!session.entries.length) return { ok: false, reason: 'empty' };
  await saveFile('kcy-export.2fas', build2FAS(session.entries), 'application/json', { isText: true });
  return { ok: true, count: session.entries.length };
}

// УНИВЕРСАЛЕН otpauth:// списък (текст, по един URI на ред) — внася се в почти всеки authenticator.
export async function exportOtpauthListFile() {
  if (!session.entries.length) return { ok: false, reason: 'empty' };
  const txt = session.entries.map(buildOtpauthURI).join('\n') + '\n';
  await saveFile('otpauth-list.txt', txt, 'text/plain', { isText: true });
  return { ok: true, count: session.entries.length };
}

// ── ПАРОЛИ → браузър (CSV) ──
// Chrome и Microsoft Edge ползват ЕДИН И СЪЩ Chromium CSV → един файл за двата.
export async function exportChromiumCsv() {
  if (!session.passwords.length) return { ok: false, reason: 'empty' };
  await saveFile('kcy-passwords-chrome-edge.csv', buildChromiumCsv(session.passwords), 'text/csv', { isText: true });
  return { ok: true, count: session.passwords.length };
}
export async function exportFirefoxCsv() {
  if (!session.passwords.length) return { ok: false, reason: 'empty' };
  await saveFile('kcy-passwords-firefox.csv', buildFirefoxCsv(session.passwords), 'text/csv', { isText: true });
  return { ok: true, count: session.passwords.length };
}

// ── КРИПТО ПОРТФЕЙЛИ → наш .json бекъп (за прехвърляне между СВОИ устройства) ──
// Няма стандартен формат за seed фрази между портфейлите → пазим НАШ JSON. Файлът съдържа
// тайните В ЧИСТ ВИД → предупреждаваме потребителя (UI) да го пази като златото си.
export async function exportSeedsJson() {
  if (!session.seeds.length) return { ok: false, reason: 'empty' };
  const data = JSON.stringify({ app: 'kcy-authenticator', kind: 'wallets', version: 1, seeds: session.seeds }, null, 2);
  await saveFile('kcy-wallets-backup.json', data, 'application/json', { isText: true });
  return { ok: true, count: session.seeds.length };
}

// Google Authenticator миграционен QR (PNG). Много акаунти → партиди → ако са няколко
// QR-а, пакетираме PNG-тата в .zip. Steam се пропуска (Google не го поддържа).
export async function exportGoogleQR() {
  if (!session.entries.length) return { ok: false, reason: 'empty' };
  let QR;
  try { QR = (await import('qrcode')).default; } catch (_) { QR = null; }
  if (!QR) return { ok: false, reason: 'nolib' };

  const { uris, exported, skipped } = buildGoogleMigrationURIs(session.entries, 10);
  if (!uris.length) return { ok: false, reason: 'empty' };

  if (uris.length === 1) {
    const durl = await QR.toDataURL(uris[0], { width: 480, margin: 2, errorCorrectionLevel: 'M' });
    await saveFile('google-authenticator-qr.png', dataURLtoBytes(durl), 'image/png');
  } else {
    const files = [];
    for (let i = 0; i < uris.length; i++) {
      const durl = await QR.toDataURL(uris[i], { width: 480, margin: 2, errorCorrectionLevel: 'M' });
      files.push({ name: 'google-auth-' + (i + 1) + '.png', data: dataURLtoBytes(durl) });
    }
    await saveFile('google-authenticator-qr.zip', zipStore(files), 'application/zip');
  }
  return { ok: true, count: exported, skipped, batches: uris.length };
}
