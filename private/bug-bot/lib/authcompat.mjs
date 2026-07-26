// authcompat.mjs — тества ИМПОРТ/ЕКСПОРТ съвместимостта на Pupikes Authenticator с ДРУГИ приложения
// БЕЗ да инсталираме нищо: (1) двупосочно (нашият билдър → нашия парсер, за всеки формат) и
// (2) внасяне на РЕАЛНИ примерни файлове (фикстури), както ги изнасят Aegis / 2FAS / Google
// Authenticator / универсален otpauth. Зарежда чистите модули на апа директно (ESM).
// Връща { findings, summary }. Вика се от run.js (--authcompat).
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CORE = path.resolve(HERE, '..', '..', '..', 'rustore', 'authenticator', 'src', 'core');
const imp = (f) => import('file://' + path.join(CORE, f).replace(/\\/g, '/'));

// Примерни акаунти (както биха стояли в апа): TOTP, HOTP (с брояч), Steam.
const SAMPLE = [
  { type: 'totp', issuer: 'GitHub', account: 'alice@example.com', secret: 'JBSWY3DPEHPK3PXP', algorithm: 'SHA1', digits: 6, period: 30, counter: 0 },
  { type: 'totp', issuer: 'Google', account: 'bob@gmail.com', secret: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', algorithm: 'SHA256', digits: 8, period: 60, counter: 0 },
  { type: 'hotp', issuer: 'ACME', account: 'counter-token', secret: 'KRSXG5CTMVRXEZLU', algorithm: 'SHA1', digits: 6, period: 30, counter: 5 },
  { type: 'steam', issuer: 'Steam', account: 'gamer', secret: 'ONSWG4TFOQ======', algorithm: 'SHA1', digits: 5, period: 30, counter: 0 }
];

const norm = (s) => String(s || '').replace(/\s/g, '').toUpperCase();
// Съвпадат ли два записа по същинските полета? (Steam няма период/алгоритъм смисъл навсякъде.)
function sameEntry(a, b, fields) {
  for (const f of fields) {
    let x = a[f], y = b[f];
    if (f === 'secret') { x = norm(x); y = norm(y); }
    if (f === 'algorithm' || f === 'type') { x = String(x).toUpperCase(); y = String(y).toUpperCase(); }
    if (f === 'digits' || f === 'period' || f === 'counter') { x = parseInt(x, 10); y = parseInt(y, 10); }
    if (String(x) !== String(y)) return `${f}: „${a[f]}" ≠ „${b[f]}"`;
  }
  return null;
}
// Намери внесения запис по тайна (тайната е уникалният ключ).
const bySecret = (list, secret) => list.find((e) => norm(e.secret) === norm(secret));

export async function runAuthCompat({ log } = {}) {
  const say = (m) => { if (log) log(m); };
  const findings = [];
  const now = () => new Date().toISOString();
  const fail = (kind, detail) => findings.push({ ts: now(), severity: 'error', kind: 'authcompat', app: 'authenticator', detail });
  const okc = { n: 0 };
  const pass = (m) => { okc.n++; say(`   ✓ ${m}`); };

  const aegis = await imp('aegis.js');
  const twofas = await imp('twofas.js');
  const otp = await imp('otp.js');
  const gauth = await imp('gauth-migration.js');
  const pw = await imp('passwords-io.js');

  // ── 1) ДВУПОСОЧНО: нашият експорт → нашия импорт (за всеки формат) ──
  const CMP = ['type', 'issuer', 'account', 'secret', 'algorithm', 'digits', 'period', 'counter'];

  // Aegis
  try {
    const json = aegis.buildAegisExport(SAMPLE);
    const r = aegis.parseAegisExport(json);
    if (!r.ok) fail('authcompat', `Aegis двупосочно: парсерът не прочете нашия експорт (${r.reason})`);
    else { let bad = 0; for (const s of SAMPLE) { const g = bySecret(r.entries, s.secret); if (!g) { fail('authcompat', `Aegis: липсва акаунт ${s.issuer}`); bad++; continue; } const d = sameEntry(s, g, CMP.filter((f) => f !== 'account' || true)); if (d) { fail('authcompat', `Aegis акаунт ${s.issuer}: ${d}`); bad++; } } if (!bad) pass(`Aegis двупосочно (${SAMPLE.length} акаунта)`); }
  } catch (e) { fail('authcompat', 'Aegis двупосочно гръмна: ' + e.message); }

  // 2FAS
  try {
    const json = twofas.build2FAS(SAMPLE);
    const r = twofas.parse2FAS(json);
    if (!r.ok) fail('authcompat', `2FAS двупосочно: парсерът не прочете нашия експорт (${r.reason})`);
    else { let bad = 0; for (const s of SAMPLE) { const g = bySecret(r.entries, s.secret); if (!g) { fail('authcompat', `2FAS: липсва акаунт ${s.issuer}`); bad++; continue; } const d = sameEntry(s, g, CMP); if (d) { fail('authcompat', `2FAS акаунт ${s.issuer}: ${d}`); bad++; } } if (!bad) pass(`2FAS двупосочно (${SAMPLE.length} акаунта)`); }
  } catch (e) { fail('authcompat', '2FAS двупосочно гръмна: ' + e.message); }

  // otpauth:// URI
  try {
    let bad = 0;
    for (const s of SAMPLE) {
      const uri = otp.buildOtpauthURI(s);
      if (!/^otpauth:\/\//.test(uri)) { fail('authcompat', `otpauth: невалиден URI за ${s.issuer}`); bad++; continue; }
      const g = otp.parseOtpauthURI(uri);
      if (!g) { fail('authcompat', `otpauth: не се парсва ${s.issuer}`); bad++; continue; }
      const d = sameEntry(s, g, ['type', 'issuer', 'secret', 'algorithm', 'digits']);
      if (d) { fail('authcompat', `otpauth ${s.issuer}: ${d}`); bad++; }
    }
    if (!bad) pass(`otpauth:// двупосочно (${SAMPLE.length} акаунта)`);
  } catch (e) { fail('authcompat', 'otpauth двупосочно гръмна: ' + e.message); }

  // Google Authenticator (otpauth-migration) — Steam се пропуска (Google не го поддържа)
  try {
    const nonSteam = SAMPLE.filter((s) => s.type !== 'steam');
    const { uris, exported } = gauth.buildGoogleMigrationURIs(nonSteam, 10);
    const got = [];
    for (const u of uris) { if (!/^otpauth-migration:\/\/offline\?data=/.test(u)) fail('authcompat', 'Google: невалиден migration URI'); const list = gauth.parseGoogleMigration(u); if (list) got.push(...list); }
    let bad = 0;
    for (const s of nonSteam) { const g = bySecret(got, s.secret); if (!g) { fail('authcompat', `Google: липсва акаунт ${s.issuer}`); bad++; continue; } const d = sameEntry(s, g, ['type', 'secret', 'digits']); if (d) { fail('authcompat', `Google акаунт ${s.issuer}: ${d}`); bad++; } }
    if (!bad && exported === nonSteam.length) pass(`Google миграция двупосочно (${exported} акаунта, Steam пропуснат коректно)`);
  } catch (e) { fail('authcompat', 'Google миграция гръмна: ' + e.message); }

  // ── 2) ВНАСЯНЕ НА РЕАЛНИ ЧУЖДИ ФИКСТУРИ (както ги изнасят другите приложения) ──
  // Aegis 3.x некриптиран експорт
  const AEGIS_FIXTURE = JSON.stringify({
    version: 1, header: { slots: null, params: null },
    db: { version: 3, entries: [
      { type: 'totp', uuid: 'a1', name: 'user@aegis.test', issuer: 'AegisApp', note: '', icon: null, info: { secret: 'NB2W45DFOIZA', algo: 'SHA1', digits: 6, period: 30 } },
      { type: 'hotp', uuid: 'a2', name: 'hotp-acct', issuer: 'HOTPCorp', info: { secret: 'MFRGGZDFMZTWQ2LK', algo: 'SHA1', digits: 6, counter: 3 } }
    ] }
  });
  try {
    const r = aegis.parseAegisExport(AEGIS_FIXTURE);
    if (!r.ok || r.entries.length !== 2 || !bySecret(r.entries, 'NB2W45DFOIZA')) fail('authcompat', `внасяне от Aegis (реален файл) се провали: ${r.reason || 'липсват акаунти'}`);
    else pass('внасяне от Aegis (реален некриптиран експорт, 2 акаунта)');
  } catch (e) { fail('authcompat', 'внасяне от Aegis гръмна: ' + e.message); }

  // 2FAS v4 некриптиран експорт
  const TWOFAS_FIXTURE = JSON.stringify({
    schemaVersion: 4, appVersionCode: 5000000, appOrigin: 'android',
    services: [
      { name: 'TwoFasSite', secret: 'JBSWY3DPEHPK3PXP', otp: { account: 'me@2fas.test', issuer: 'TwoFasSite', digits: 6, period: 30, algorithm: 'SHA1', tokenType: 'TOTP' } },
      { name: 'SteamGame', secret: 'ONSWG4TFOQ', otp: { account: 'steamer', tokenType: 'STEAM', digits: 5 } }
    ]
  });
  try {
    const r = twofas.parse2FAS(TWOFAS_FIXTURE);
    const steam = r.ok && r.entries.find((e) => e.type === 'steam');
    if (!r.ok || r.entries.length !== 2 || !bySecret(r.entries, 'JBSWY3DPEHPK3PXP') || !steam) fail('authcompat', `внасяне от 2FAS (реален файл) се провали: ${r.reason || 'липсват акаунти/steam'}`);
    else pass('внасяне от 2FAS (реален v4 експорт, вкл. Steam токен)');
  } catch (e) { fail('authcompat', 'внасяне от 2FAS гръмна: ' + e.message); }

  // Универсален otpauth:// (както изнасят FreeOTP / andOTP / много други)
  const OTPAUTH_FIXTURE = 'otpauth://totp/FreeOTP:foreign@user?secret=KRSXG5CTMVRXEZLU&issuer=FreeOTP&algorithm=SHA1&digits=6&period=30';
  try {
    const g = otp.parseOtpauthURI(OTPAUTH_FIXTURE);
    if (!g || norm(g.secret) !== 'KRSXG5CTMVRXEZLU' || g.issuer !== 'FreeOTP') fail('authcompat', 'внасяне на универсален otpauth:// (FreeOTP/andOTP стил) се провали');
    else pass('внасяне на универсален otpauth:// URI (FreeOTP/andOTP/…)');
  } catch (e) { fail('authcompat', 'внасяне на otpauth гръмна: ' + e.message); }

  // ── 3) БРАУЗЪРНИ ПАРОЛИ: Chrome/Edge (Chromium CSV) + Firefox CSV ──
  const PW_SAMPLE = [
    { title: 'GitHub', url: 'https://github.com/login', login: 'alice', password: 'p@ss,w"ord', note: 'work' },
    { title: 'Example', url: 'https://example.com', login: 'bob@x.io', password: 's3cret', note: '' }
  ];
  const findPw = (list, login) => list.find((e) => e.login === login);
  const cmpPw = (a, b) => (a.url === b.url && a.login === b.login && a.password === b.password) ? null : `url/login/парола не съвпадат за ${a.login}`;

  // Chrome/Edge двупосочно (един и същ Chromium формат за двата)
  try {
    const csv = pw.buildChromiumCsv(PW_SAMPLE);
    const r = pw.parseBrowserCsv(csv);
    if (!r.ok || r.format !== 'chromium') fail('authcompat', `Chrome/Edge двупосочно: не се разпозна (${r.reason || r.format})`);
    else { let bad = 0; for (const s of PW_SAMPLE) { const g = findPw(r.entries, s.login); if (!g) { fail('authcompat', `Chrome/Edge: липсва парола ${s.login}`); bad++; continue; } const d = cmpPw(s, g); if (d) { fail('authcompat', `Chrome/Edge: ${d}`); bad++; } } if (!bad) pass(`Chrome/Edge пароли двупосочно (${PW_SAMPLE.length}, вкл. запетаи/кавички)`); }
  } catch (e) { fail('authcompat', 'Chrome/Edge пароли гръмна: ' + e.message); }

  // Firefox двупосочно
  try {
    const csv = pw.buildFirefoxCsv(PW_SAMPLE);
    const r = pw.parseBrowserCsv(csv);
    if (!r.ok || r.format !== 'firefox') fail('authcompat', `Firefox двупосочно: не се разпозна (${r.reason || r.format})`);
    else { let bad = 0; for (const s of PW_SAMPLE) { const g = findPw(r.entries, s.login); if (!g) { fail('authcompat', `Firefox: липсва парола ${s.login}`); bad++; continue; } const d = cmpPw(s, g); if (d) { fail('authcompat', `Firefox: ${d}`); bad++; } } if (!bad) pass(`Firefox пароли двупосочно (${PW_SAMPLE.length})`); }
  } catch (e) { fail('authcompat', 'Firefox пароли гръмна: ' + e.message); }

  // Внасяне на РЕАЛЕН Chrome/Edge експорт (Chromium CSV)
  const CHROME_FIXTURE = 'name,url,username,password,note\nGoogle,https://accounts.google.com,me@gmail.com,hunter2,\nGitHub,https://github.com,ghuser,"pa,ss",backup\n';
  try {
    const r = pw.parseBrowserCsv(CHROME_FIXTURE);
    if (!r.ok || r.format !== 'chromium' || r.entries.length !== 2 || !findPw(r.entries, 'me@gmail.com')) fail('authcompat', `внасяне от Chrome/Edge (реален CSV) се провали: ${r.reason || r.format}`);
    else pass('внасяне от Chrome/Edge (реален паролен CSV, 2 записа)');
  } catch (e) { fail('authcompat', 'внасяне от Chrome/Edge гръмна: ' + e.message); }

  // Внасяне на РЕАЛЕН Firefox експорт (about:logins → Export)
  const FIREFOX_FIXTURE = '"url","username","password","httpRealm","formActionOrigin","guid","timeCreated","timeLastUsed","timePasswordChanged"\n"https://mozilla.test","fxuser","fxPass!","","https://mozilla.test","{123}","1600000000000","",""\n';
  try {
    const r = pw.parseBrowserCsv(FIREFOX_FIXTURE);
    if (!r.ok || r.format !== 'firefox' || !findPw(r.entries, 'fxuser')) fail('authcompat', `внасяне от Firefox (реален CSV) се провали: ${r.reason || r.format}`);
    else pass('внасяне от Firefox (реален about:logins CSV)');
  } catch (e) { fail('authcompat', 'внасяне от Firefox гръмна: ' + e.message); }

  // ── 4) КРИПТИРАН КРЪГ: генерираме КРИПТИРАН файл със СЪЩАТА схема, която апът очаква, после
  // го декриптираме с функцията на апа (+ проверка, че ГРЕШНА парола се отхвърля грациозно). ──
  const gcmEnc = (keyBuf, ivBuf, ptBuf) => { const c = crypto.createCipheriv('aes-256-gcm', keyBuf, ivBuf); const ct = Buffer.concat([c.update(ptBuf), c.final()]); return { ct, tag: c.getAuthTag() }; };
  const PWD = 'S3cretPass!';

  // Криптиран Aegis (scrypt → slotKey → AES-GCM(masterKey); masterKey → AES-GCM(db))
  try {
    const N = 16384, r = 8, p = 1;
    const master = crypto.randomBytes(32);
    const dbJson = JSON.stringify({ version: 2, entries: [
      { type: 'totp', name: 'enc@aegis.test', issuer: 'EncAegis', info: { secret: 'JBSWY3DPEHPK3PXP', algo: 'SHA1', digits: 6, period: 30 } }
    ] });
    const dbNonce = crypto.randomBytes(12);
    const dbE = gcmEnc(master, dbNonce, Buffer.from(dbJson, 'utf8'));
    const salt = crypto.randomBytes(16);
    const slotKey = crypto.scryptSync(Buffer.from(PWD, 'utf8'), salt, 32, { N, r, p, maxmem: 128 * 1024 * 1024 });
    const slotNonce = crypto.randomBytes(12);
    const slotE = gcmEnc(slotKey, slotNonce, master);
    const fixture = JSON.stringify({
      version: 1,
      header: { slots: [{ type: 1, uuid: 's1', key: slotE.ct.toString('hex'), key_params: { nonce: slotNonce.toString('hex'), tag: slotE.tag.toString('hex') }, n: N, r, p, salt: salt.toString('hex') }],
                params: { nonce: dbNonce.toString('hex'), tag: dbE.tag.toString('hex') } },
      db: dbE.ct.toString('base64')
    });
    const good = await aegis.decryptAegisExport(fixture, PWD);
    const bad = await aegis.decryptAegisExport(fixture, 'wrong-password');
    if (!good.ok || !bySecret(good.entries, 'JBSWY3DPEHPK3PXP')) fail('authcompat', `Aegis КРИПТИРАН: декрипцията с вярна парола се провали (${good.reason || ''} ${good.detail || ''})`);
    else if (bad.ok || bad.reason !== 'password') fail('authcompat', `Aegis КРИПТИРАН: грешна парола НЕ е отхвърлена коректно (reason=${bad.reason})`);
    else pass('Aegis КРИПТИРАН (scrypt+AES-GCM): вярна парола внася · грешна се отхвърля');
  } catch (e) { fail('authcompat', 'Aegis криптиран гръмна: ' + e.message); }

  // Криптиран 2FAS (PBKDF2-SHA256 10000 → AES-GCM; формат "данни:сол:iv")
  try {
    const services = [{ name: 'EncSite', secret: 'KRSXG5CTMVRXEZLU', otp: { account: 'enc@2fas.test', issuer: 'EncSite', digits: 6, period: 30, algorithm: 'SHA1', tokenType: 'TOTP' } }];
    const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12);
    const key = crypto.pbkdf2Sync(Buffer.from(PWD, 'utf8'), salt, 10000, 32, 'sha256');
    const e = gcmEnc(key, iv, Buffer.from(JSON.stringify(services), 'utf8'));
    const data = Buffer.concat([e.ct, e.tag]);
    const enc = data.toString('base64') + ':' + salt.toString('base64') + ':' + iv.toString('base64');
    const fixture = JSON.stringify({ servicesEncrypted: enc, schemaVersion: 4 });
    const good = await twofas.decrypt2FAS(fixture, PWD);
    const bad = await twofas.decrypt2FAS(fixture, 'wrong-password');
    if (!good.ok || !bySecret(good.entries, 'KRSXG5CTMVRXEZLU')) fail('authcompat', `2FAS КРИПТИРАН: декрипцията с вярна парола се провали (${good.reason || ''})`);
    else if (bad.ok || bad.reason !== 'password') fail('authcompat', `2FAS КРИПТИРАН: грешна парола НЕ е отхвърлена коректно (reason=${bad.reason})`);
    else pass('2FAS КРИПТИРАН (PBKDF2+AES-GCM): вярна парола внася · грешна се отхвърля');
  } catch (e) { fail('authcompat', '2FAS криптиран гръмна: ' + e.message); }

  const err = findings.length;
  say(`   → ${okc.n} съвместими формата · ${err} проблема`);
  return { findings, summary: { passed: okc.n, failed: err } };
}
