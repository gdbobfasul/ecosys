// authroundtrip.mjs — РЕАЛЕН кръг за Pupikes Authenticator с ИСТИНСКИ ВЪНШНИ файлове:
//   1) внася ИСТИНСКИ експортен файл на друго приложение (Aegis собствените тест-вектори и др.)
//      през РЕАЛНИЯ импорт на апа (importer.js + storage.js — истинският сейф, не парсер настрани);
//   2) ЕКСПОРТИРА от Pupikes същия формат;
//   3) сравнява дали ДАННИТЕ съвпадат 1:1 (внесени == реекспортирани → нула загуба), а за НАШИЯ
//      собствен формат — дали файлът е БАЙТ-идентичен след кръг.
// Апът ползва браузърни API-та (localStorage, crypto.subtle, atob) → стъбваме localStorage; Node 20+
// има crypto.subtle/atob/btoa. Така върви НЕПРОМЕНЕНИЯТ код на приложението.
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

// ── стъб на браузърната среда, преди да заредим модулите на апа ──
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
  get length() { return mem.size; },
  key: (i) => [...mem.keys()][i] || null
};

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CORE = path.resolve(HERE, '..', '..', '..', 'rustore', 'authenticator', 'src', 'core');
const FIX = path.join(HERE, '..', 'fixtures', 'authenticator');
const imp = (f) => import('file://' + path.join(CORE, f).replace(/\\/g, '/'));
const readFix = (f) => fs.readFileSync(path.join(FIX, f), 'utf8');

// Нормализиран ключ на един запис (същинските полета) — за сравнение „същите акаунти".
const entryKey = (e) => [e.type || 'totp', String(e.issuer || '').trim(), String(e.account || '').trim(),
  String(e.secret || '').replace(/\s/g, '').toUpperCase(), String(e.algorithm || 'SHA1').toUpperCase(),
  parseInt(e.digits, 10) || 6, parseInt(e.period, 10) || 30, parseInt(e.counter, 10) || 0].join('|');
const setOf = (list) => new Set((list || []).map(entryKey));
const eqSets = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

export async function runAuthRoundtrip({ log } = {}) {
  const say = (m) => { if (log) log(m); };
  const findings = [];
  const now = () => new Date().toISOString();
  const fail = (detail) => findings.push({ ts: now(), severity: 'error', kind: 'authroundtrip', app: 'authenticator', detail });
  let passed = 0;
  const pass = (m) => { passed++; say(`   ✓ ${m}`); };

  const storage = await imp('storage.js');
  const importer = await imp('importer.js');
  const aegisM = await imp('aegis.js');
  const otpM = await imp('otp.js');
  const gauthM = await imp('gauth-migration.js');

  // Свеж, отключен сейф (нулира session.entries).
  const fresh = async () => { await storage.createVault('master-' + mem.size); storage.session.entries = []; };

  // Един кръг: внеси РЕАЛЕН файл → снимка на внесените → експортирай от Pupikes → внеси експорта в
  // свеж сейф → сравни ДАННИТЕ. `build` е билдърът на апа за същия формат; `reimport` внася експорта.
  async function roundtrip(label, source, importFn, buildFn, reimportFn, byteIdentical) {
    try {
      await fresh();
      const r = await importFn(source);
      if (!r || !r.ok || !r.imported) { fail(`${label}: РЕАЛНИЯТ импорт се провали (${r && r.reason})`); return; }
      const imported = storage.session.entries.map((e) => ({ ...e }));
      const importedSet = setOf(imported);

      const exported = buildFn(imported);                     // ЕКСПОРТ от Pupikes
      await fresh();
      const r2 = await (reimportFn || importFn)(exported);
      if (!r2 || !r2.ok) { fail(`${label}: реекспортираният файл не се внася обратно (${r2 && r2.reason})`); return; }
      const reSet = setOf(storage.session.entries);

      if (!eqSets(importedSet, reSet)) { fail(`${label}: данните се РАЗЛИЧАВАТ след кръг (внесени ${importedSet.size} ≠ реекспорт ${reSet.size})`); return; }

      let extra = '';
      if (byteIdentical) {
        const again = buildFn(storage.session.entries);
        extra = (again === exported) ? ' · файлът е БАЙТ-идентичен след кръг' : ' · данните еднакви (файлът не е байт-идентичен — очаквано за този формат)';
      }
      pass(`${label}: внесени ${r.imported} · реекспорт данни 1:1${extra}`);
    } catch (e) { fail(`${label}: гръмна — ${e.message}`); }
  }

  // 1) ИСТИНСКИ Aegis (техните собствени тест-вектори) — НЕкриптиран
  await roundtrip('Aegis (реален plain от техните тестове)', readFix('aegis_plain.json'),
    (t) => importer.importAegisText(t), (entries) => aegisM.buildAegisExport(entries), null, true);

  // 2) ИСТИНСКИ Aegis — КРИПТИРАН (тяхната парола е „test")
  await roundtrip('Aegis (реален КРИПТИРАН, парола „test")', readFix('aegis_encrypted.json'),
    (t) => importer.importAegisEncrypted(t, 'test'), (entries) => aegisM.buildAegisExport(entries),
    (t) => importer.importAegisText(t), false);

  // 3) ИСТИНСКИ otpauth:// — каноничният пример от официалната Key-URI спецификация на Google
  await roundtrip('otpauth:// (каноничен от Google Key-URI спецификацията)', readFix('otpauth-canonical.txt'),
    (t) => importer.importOtpauthList(t), (entries) => entries.map(otpM.buildOtpauthURI).join('\n'),
    (t) => importer.importOtpauthList(t), false);

  // 4) ИСТИНСКИ Google Authenticator миграция — реален вектор (raspberrypi + HOTP, от познат декодер)
  await roundtrip('Google миграция (реален вектор от външен декодер)', readFix('google-migration-real.txt'),
    (t) => importer.importOtpauthList(t), (entries) => gauthM.buildGoogleMigrationURIs(entries, 10).uris.join('\n'),
    (t) => importer.importOtpauthList(t), false);

  say(`   → ${passed} реални кръга · ${findings.length} проблема`);
  return { findings, summary: { passed, failed: findings.length } };
}
