// Version: 1.0001
// compliance.js — СТАТИЧЕН одит на всяко приложение спрямо изискванията на Huawei AppGallery + RuStore.
// Върви офлайн върху дърветата rustore/* и huawei/*. За всеки ап проверява:
//   A. Правен слой ВЪТРЕ в апа (Huawei 7.1): main.js вика mountPrivacyLink / mountLegalGate.
//   B. Правни документи налични: publish/{hw,rustore}-privacy.html + -terms.html, непразни.
//   C. appId консистентност: capacitor.config.json.appId == android build.gradle applicationId.
//   D. Разрешения обосновани: AndroidManifest uses-permission — чувствителните да са очаквани.
//   E. Мед. дисклеймър за медицинските апове (Doctor/Medicines).
//   F. Без остатъчно „kcy" в кода (марка).
//   G. Билднат dist (иначе няма какво да се качи в магазина).
// Връща находки (severity error/warn) — интегрират се в стандартния доклад на робота.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const TREES = ['rustore', 'huawei'];

// Разрешения, които са ОК за конкретни апове (очаквани). Всичко извън „безопасните" → warn „обоснови в privacy".
const SAFE_PERMS = new Set(['INTERNET', 'ACCESS_NETWORK_STATE', 'VIBRATE', 'WAKE_LOCK', 'FOREGROUND_SERVICE', 'POST_NOTIFICATIONS', 'RECEIVE_BOOT_COMPLETED', 'SCHEDULE_EXACT_ALARM', 'USE_EXACT_ALARM']);
const SENSITIVE = new Set(['CAMERA', 'RECORD_AUDIO', 'ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION', 'READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE', 'READ_MEDIA_IMAGES', 'USE_BIOMETRIC', 'READ_CONTACTS', 'SEND_SMS', 'READ_SMS', 'CALL_PHONE', 'READ_CALL_LOG', 'BIND_NOTIFICATION_LISTENER_SERVICE']);
// Разрешения, които магазините ГЛЕДАТ под лупа (изискват силна обосновка) — flag дори да са очаквани.
const HIGH_RISK = new Set(['READ_CONTACTS', 'SEND_SMS', 'READ_SMS', 'CALL_PHONE', 'READ_CALL_LOG', 'ACCESS_FINE_LOCATION']);

function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch (_) { return ''; } }
function exists(p) { try { return fs.statSync(p).size > 40; } catch (_) { return false; } }

function auditApp(tree, app) {
  const base = path.join(ROOT, tree, app);
  const F = [];
  const id = `${tree}/${app}`;
  const add = (severity, kind, detail) => F.push({ ts: new Date().toISOString(), severity, kind, app: id, detail: `${app} (${tree}) — ${detail}` });

  // G. билднат?
  if (!exists(path.join(base, 'dist', 'index.html'))) add('warn', 'compliance-build', 'няма билднат dist (пусни билд преди публикуване)');

  // A. правен слой в апа (Huawei 7.1)
  const main = read(path.join(base, 'src', 'main.js'));
  if (main && !/mountPrivacyLink|mountLegalGate/.test(main)) add('error', 'compliance-legal-bar', 'НЯМА правен бутон в апа (mountPrivacyLink/mountLegalGate) — Huawei 7.1 иска privacy достъпен вътре');

  // B. правни документи. КАНОНИЧНО МЯСТО: gen-privacy пише ДВАТА варианта (hw+rustore) в
  // huawei/<app>/publish/ — обслужва и двата магазина. Затова проверяваме там (+ локалния publish).
  const pubDirs = [path.join(ROOT, 'huawei', app, 'publish'), path.join(base, 'publish')];
  const anyFile = (names) => pubDirs.some((d) => names.some((n) => exists(path.join(d, n))));
  const hasPriv = anyFile(['hw-privacy.html', 'rustore-privacy.html', 'ru-privacy.html']);
  const hasTerms = anyFile(['hw-terms.html', 'rustore-terms.html', 'ru-terms.html']);
  if (!hasPriv) add('error', 'compliance-privacy-file', 'липсва генериран privacy документ в publish/');
  if (!hasTerms) add('error', 'compliance-terms-file', 'липсва генериран terms документ в publish/');

  // C. appId консистентност
  let appId = '';
  try { appId = (JSON.parse(read(path.join(base, 'capacitor.config.json'))) || {}).appId || ''; } catch (_) {}
  const gradle = read(path.join(base, 'android', 'app', 'build.gradle'));
  const gm = gradle.match(/applicationId\s+["']([^"']+)["']/);
  if (appId && gm && gm[1] !== appId) add('error', 'compliance-appid', `appId разминаване: capacitor=${appId} · gradle=${gm[1]}`);
  if (appId && !/^com\.pupikes\./.test(appId)) add('warn', 'compliance-appid', `appId не е com.pupikes.* (${appId})`);

  // D. разрешения
  const manifest = read(path.join(base, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'));
  const perms = [...new Set((manifest.match(/android\.permission\.[A-Z_]+/g) || []).map((s) => s.split('.').pop()))];
  const sens = perms.filter((p) => SENSITIVE.has(p));
  const highs = perms.filter((p) => HIGH_RISK.has(p));
  const unknown = perms.filter((p) => !SAFE_PERMS.has(p) && !SENSITIVE.has(p));
  if (highs.length) add('warn', 'compliance-perm-highrisk', `рискови разрешения (магазините ги гледат под лупа): ${highs.join(', ')} — увери се, че privacy ги обяснява`);
  if (sens.length) add('info', 'compliance-perm', `чувствителни разрешения: ${sens.join(', ')} (провери обосновка в privacy)`);
  if (unknown.length) add('warn', 'compliance-perm-unknown', `непознати разрешения: ${unknown.join(', ')}`);

  // E. медицински дисклеймър
  if (/medicines|doctor/.test(app) && main && !/disclaimer/i.test(main)) add('error', 'compliance-med-disclaimer', 'медицински ап без дисклеймър в main.js (задължителен за магазините)');

  // F. остатъчно kcy в кода
  const srcDir = path.join(base, 'src');
  let kcyHits = 0;
  (function walk(d) { let e = []; try { e = fs.readdirSync(d, { withFileTypes: true }); } catch (_) { return; } for (const x of e) { const p = path.join(d, x.name); if (x.isDirectory()) walk(p); else if (/\.(js|css|json|html)$/.test(x.name)) { if (/kcy|KCY|Kcy/.test(read(p))) kcyHits++; } } })(srcDir);
  if (kcyHits) add('warn', 'compliance-kcy', `${kcyHits} файла в src още съдържат „kcy" (марка)`);

  return { id, appId, perms, findings: F };
}

function checkCompliance({ log } = {}) {
  const say = (m) => { if (log) log(m); };
  const all = [];
  const apps = new Set();
  for (const tree of TREES) {
    let dirs = [];
    try { dirs = fs.readdirSync(path.join(ROOT, tree), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch (_) {}
    for (const app of dirs) {
      if (!exists(path.join(ROOT, tree, app, 'capacitor.config.json'))) continue; // само апове
      const r = auditApp(tree, app); all.push(...r.findings); apps.add(`${tree}/${app}`);
    }
  }
  say(`   одит на ${apps.size} приложения (rustore+huawei) спрямо Huawei/RuStore изисквания`);
  const err = all.filter((f) => f.severity === 'error').length;
  const warn = all.filter((f) => f.severity === 'warn').length;
  say(`   → ${err} нарушения · ${warn} за проверка`);
  return all;
}

module.exports = { checkCompliance };
