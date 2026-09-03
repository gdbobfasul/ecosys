#!/usr/bin/env node
// read-computer-passwords.cjs — ДЕСКТОП инструмент за Pupikes Authenticator: чете паролите от браузърите
// НА КОМПЮТЪРА (Chrome/Edge/Brave + Firefox) и ги изнася в `pupikes-auth-import.json` (същия формат като
// анализатора). После пренасяш файла на телефона и внасяш през Настройки → Импорт → 🤖 Бот → Автоматичен
// анализатор.  ⚠️ ВСИЧКО СТАВА ЛОКАЛНО — нищо не се качва навън. Пусни го ТИ на своя компютър.
//
// Употреба (Windows):
//   node --experimental-sqlite huawei/authenticator/tools/read-computer-passwords.cjs [опции]
//   Опции:
//     (без опции)            → чете Chrome+Edge+Brave+Firefox автоматично
//     --chrome / --edge / --brave / --firefox  → само избрания браузър
//     --csv <файл.csv> …     → чете браузърен CSV експорт (резерв, ако авто-четенето не стане)
//     --out <файл>           → изходен файл (по подразбиране pupikes-auth-import.json до инструмента)
//   Забележка: за авто-четене затвори браузъра (файлът може да е заключен). Ако не стане → изнеси CSV
//   от браузъра (Настройки → Пароли → Експорт) и подай с --csv.

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

let DatabaseSync = null;
try { ({ DatabaseSync } = require('node:sqlite')); } catch (_) {}

const args = process.argv.slice(2);
const only = { chrome: args.includes('--chrome'), edge: args.includes('--edge'), brave: args.includes('--brave'), firefox: args.includes('--firefox') };
const anyOnly = Object.values(only).some(Boolean);
const csvFiles = args.map((a, i) => (a === '--csv' ? args[i + 1] : null)).filter(Boolean);
const outArg = (args.map((a, i) => (a === '--out' ? args[i + 1] : null)).filter(Boolean))[0];
const OUT = path.resolve(outArg || path.join(__dirname, 'pupikes-auth-import.json'));

const isWin = process.platform === 'win32';
const LOCALAPPDATA = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
const APPDATA = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');

function log(s) { console.log(s); }
function copyToTemp(src) {
  const tmp = path.join(os.tmpdir(), 'pupikes-' + Date.now() + '-' + Math.random().toString(36).slice(2) + path.basename(src));
  fs.copyFileSync(src, tmp); return tmp;
}
function rmQuiet(p) { try { fs.unlinkSync(p); } catch (_) {} }

// ── Windows DPAPI (за Chrome ключа + legacy пароли) — през PowerShell, без native модул ──
function dpapiUnprotect(buf) {
  if (!isWin) throw new Error('DPAPI само на Windows');
  const b64 = Buffer.from(buf).toString('base64');
  const ps = "$ErrorActionPreference='Stop';Add-Type -AssemblyName System.Security;" +
    "$b=[Convert]::FromBase64String('" + b64 + "');" +
    "$d=[System.Security.Cryptography.ProtectedData]::Unprotect($b,$null,'CurrentUser');" +
    "[Convert]::ToBase64String($d)";
  const out = execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { maxBuffer: 32 * 1024 * 1024 });
  return Buffer.from(String(out).trim(), 'base64');
}

// ── Chromium браузъри (Chrome/Edge/Brave) ──
const CHROMIUM = [
  { key: 'chrome', name: 'Google Chrome', dir: path.join(LOCALAPPDATA, 'Google', 'Chrome', 'User Data') },
  { key: 'edge', name: 'Microsoft Edge', dir: path.join(LOCALAPPDATA, 'Microsoft', 'Edge', 'User Data') },
  { key: 'brave', name: 'Brave', dir: path.join(LOCALAPPDATA, 'BraveSoftware', 'Brave-Browser', 'User Data') }
];
function chromiumAesKey(userDataDir) {
  const lsPath = path.join(userDataDir, 'Local State');
  const ls = JSON.parse(fs.readFileSync(lsPath, 'utf8'));
  let enc = Buffer.from(ls.os_crypt.encrypted_key, 'base64');
  if (enc.slice(0, 5).toString('latin1') === 'DPAPI') enc = enc.slice(5);
  return dpapiUnprotect(enc);   // 32 байта AES ключ
}
function decryptChromiumValue(blob, aesKey) {
  if (!blob || !blob.length) return '';
  const prefix = blob.slice(0, 3).toString('latin1');
  if (prefix === 'v10' || prefix === 'v11') {
    const nonce = blob.slice(3, 15);
    const tag = blob.slice(blob.length - 16);
    const ct = blob.slice(15, blob.length - 16);
    const dec = crypto.createDecipheriv('aes-256-gcm', aesKey, nonce);
    dec.setAuthTag(tag);
    try { return Buffer.concat([dec.update(ct), dec.final()]).toString('utf8'); } catch (_) { return ''; }
  }
  try { return dpapiUnprotect(blob).toString('utf8'); } catch (_) { return ''; }   // legacy DPAPI
}
function readChromium(br) {
  const out = [];
  if (!fs.existsSync(br.dir)) return out;
  if (!DatabaseSync) { log('  ⚠ node:sqlite липсва — пусни с `node --experimental-sqlite …`'); return out; }
  // обходи всички профили (Default, Profile 1, …)
  let profiles = [];
  try { profiles = fs.readdirSync(br.dir).filter((d) => /^(Default|Profile \d+)$/.test(d) && fs.existsSync(path.join(br.dir, d, 'Login Data'))); } catch (_) {}
  if (!profiles.length) return out;
  let aesKey = null;
  try { aesKey = chromiumAesKey(br.dir); } catch (e) { log('  ⚠ ' + br.name + ': не разчетох ключа (' + (e.message || '').slice(0, 50) + ')'); return out; }
  for (const prof of profiles) {
    const src = path.join(br.dir, prof, 'Login Data');
    let tmp = null;
    try {
      tmp = copyToTemp(src);   // браузърът заключва оригинала → работим на копие
      const db = new DatabaseSync(tmp, { readOnly: true });
      const rows = db.prepare('SELECT origin_url, username_value, password_value FROM logins').all();
      db.close();
      for (const r of rows) {
        const pw = decryptChromiumValue(Buffer.from(r.password_value), aesKey);
        if (!r.username_value && !pw) continue;
        out.push({ title: hostOf(r.origin_url), url: r.origin_url || '', login: r.username_value || '', password: pw, note: br.name + (profiles.length > 1 ? ' · ' + prof : '') });
      }
    } catch (e) { log('  ⚠ ' + br.name + '/' + prof + ': ' + (e.message || '').slice(0, 60)); }
    finally { if (tmp) rmQuiet(tmp); }
  }
  log('  ✓ ' + br.name + ': ' + out.length + ' пароли');
  return out;
}

// ── Firefox (NSS / key4.db) ──
// Минимален DER парсер (само за нужните структури: SEQUENCE, OCTET STRING, INTEGER, OID).
function der(buf, pos) {
  const tag = buf[pos]; let len = buf[pos + 1]; let hl = 2;
  if (len & 0x80) { const n = len & 0x7f; len = 0; for (let i = 0; i < n; i++) len = (len << 8) | buf[pos + 2 + i]; hl = 2 + n; }
  return { tag, len, hl, content: buf.slice(pos + hl, pos + hl + len), end: pos + hl + len };
}
function readFirefoxProfileLogins(profDir) {
  const out = [];
  const key4 = path.join(profDir, 'key4.db');
  const loginsJson = path.join(profDir, 'logins.json');
  if (!fs.existsSync(key4) || !fs.existsSync(loginsJson)) return out;
  if (!DatabaseSync) { log('  ⚠ node:sqlite липсва за Firefox'); return out; }
  let tmp = null, decKey = null;
  try {
    tmp = copyToTemp(key4);
    const db = new DatabaseSync(tmp, { readOnly: true });
    const meta = db.prepare("SELECT item1, item2 FROM metaData WHERE id='password'").get();
    const nss = db.prepare('SELECT a11, a102 FROM nssPrivate').all().find((r) => r.a11);
    db.close();
    if (!meta || !nss) { log('  ⚠ Firefox: няма ключова информация в key4.db'); return out; }
    const globalSalt = Buffer.from(meta.item1);
    decKey = firefoxDecryptKey(globalSalt, Buffer.from(nss.a11), '');   // празна master парола
    if (!decKey) { log('  ⚠ Firefox: не разчетох ключа (може да има master парола — тогава ползвай CSV експорт)'); return out; }
  } catch (e) { log('  ⚠ Firefox key4.db: ' + (e.message || '').slice(0, 60)); return out; }
  finally { if (tmp) rmQuiet(tmp); }
  try {
    const data = JSON.parse(fs.readFileSync(loginsJson, 'utf8'));
    for (const l of (data.logins || [])) {
      const user = firefoxDecryptItem(l.encryptedUsername, decKey);
      const pass = firefoxDecryptItem(l.encryptedPassword, decKey);
      if (user == null && pass == null) continue;
      out.push({ title: hostOf(l.hostname), url: l.hostname || '', login: user || '', password: pass || '', note: 'Firefox' });
    }
  } catch (e) { log('  ⚠ Firefox logins.json: ' + (e.message || '').slice(0, 60)); }
  return out;
}
// Разшифрова главния ключ от nssPrivate.a11 (PBES2: PBKDF2-SHA256 + AES-256-CBC), после вади 3DES ключа.
function firefoxDecryptKey(globalSalt, a11, masterPass) {
  try {
    // a11 = SEQUENCE { SEQUENCE { OID pkcs5PBES2, SEQUENCE { SEQUENCE{OID pbkdf2, SEQUENCE{salt,iter,keylen,SEQUENCE{OID hmacSHA256}}}, SEQUENCE{OID aes256-CBC, IV} } }, OCTET ciphertext }
    let p = der(a11, 0);                      // външен SEQUENCE
    const inner = p.content;
    const algSeq = der(inner, 0);             // SEQUENCE (алгоритъм)
    const cipherText = der(inner, algSeq.end).content;   // OCTET (шифрован ключ)
    // навлез в algSeq: OID PBES2, после SEQUENCE{ kdfSeq, encSeq }
    let a = der(algSeq.content, 0);           // OID pbes2
    const params = der(algSeq.content, a.end);// SEQUENCE { kdfSeq, encSeq }
    const kdfSeq = der(params.content, 0);    // SEQUENCE { OID pbkdf2, SEQUENCE{ salt, iter, keylen, prfSeq } }
    const encSeq = der(params.content, kdfSeq.end); // SEQUENCE { OID aes256-CBC, IV }
    // kdf params
    const kOid = der(kdfSeq.content, 0);
    const kParams = der(kdfSeq.content, kOid.end);      // SEQUENCE { salt(OCTET), iter(INT), keylen(INT), prf }
    const entrySalt = der(kParams.content, 0);          // OCTET salt
    const iterNode = der(kParams.content, entrySalt.end); // INTEGER iterations
    let iterations = 0; for (const b of iterNode.content) iterations = (iterations << 8) | b;
    const keyLenNode = der(kParams.content, iterNode.end); // INTEGER keylen (обикновено 32)
    let keyLen = 0; for (const b of keyLenNode.content) keyLen = (keyLen << 8) | b; if (!keyLen) keyLen = 32;
    // enc IV
    const eOid = der(encSeq.content, 0);
    const ivNode = der(encSeq.content, eOid.end);       // OCTET IV (16 байта)
    // ключ: PBKDF2-SHA256( SHA1(globalSalt+masterPass), entrySalt, iter, keyLen )
    const hp = crypto.createHash('sha1').update(Buffer.concat([globalSalt, Buffer.from(masterPass, 'utf8')])).digest();
    const key = crypto.pbkdf2Sync(hp, entrySalt.content, iterations, keyLen, 'sha256');
    const dec = crypto.createDecipheriv('aes-256-cbc', key, ivNode.content);
    dec.setAutoPadding(false);
    const clear = Buffer.concat([dec.update(cipherText), dec.final()]);
    // clear съдържа 3DES ключа (последните 24 байта са ключът за логините)
    return clear.slice(clear.length - 24);
  } catch (_) { return null; }
}
// Разшифрова едно поле от logins.json (3DES-CBC: SEQUENCE{ keyId, SEQUENCE{OID des3, IV}, ciphertext }).
function firefoxDecryptItem(b64, key3des) {
  try {
    if (!b64) return '';
    const asn = Buffer.from(b64, 'base64');
    const seq = der(asn, 0);
    const keyId = der(seq.content, 0);
    const algo = der(seq.content, keyId.end);            // SEQUENCE { OID des-ede3-cbc, IV }
    const oid = der(algo.content, 0);
    const iv = der(algo.content, oid.end);               // OCTET IV (8 байта)
    const ct = der(seq.content, algo.end);               // OCTET ciphertext
    const dec = crypto.createDecipheriv('des-ede3-cbc', key3des, iv.content);
    dec.setAutoPadding(true);
    return Buffer.concat([dec.update(ct.content), dec.final()]).toString('utf8');
  } catch (_) { return ''; }
}
function readFirefox() {
  const out = [];
  const base = path.join(APPDATA, 'Mozilla', 'Firefox', 'Profiles');
  if (!fs.existsSync(base)) return out;
  let profs = [];
  try { profs = fs.readdirSync(base).map((d) => path.join(base, d)).filter((d) => fs.existsSync(path.join(d, 'logins.json'))); } catch (_) {}
  for (const p of profs) out.push(...readFirefoxProfileLogins(p));
  log('  ✓ Firefox: ' + out.length + ' пароли');
  return out;
}

// ── Браузърен CSV експорт (резерв за всеки браузър) ──
function parseCsv(text) {
  const rows = []; let i = 0, field = '', row = [], inQ = false;
  const pushF = () => { row.push(field); field = ''; };
  const pushR = () => { pushF(); rows.push(row); row = []; };
  while (i < text.length) {
    const c = text[i];
    if (inQ) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; } else field += c; }
    else { if (c === '"') inQ = true; else if (c === ',') pushF(); else if (c === '\n') pushR(); else if (c === '\r') {} else field += c; }
    i++;
  }
  if (field.length || row.length) pushR();
  return rows;
}
function readCsvFile(f) {
  const out = [];
  const text = fs.readFileSync(f, 'utf8');
  const rows = parseCsv(text).filter((r) => r.length && r.some((c) => c && c.trim()));
  if (!rows.length) return out;
  const head = rows[0].map((h) => h.toLowerCase().trim());
  const ci = (names) => head.findIndex((h) => names.includes(h));
  const iUrl = ci(['url', 'website', 'origin', 'login_uri', 'hostname']);
  const iUser = ci(['username', 'login', 'user', 'login_username', 'email']);
  const iPass = ci(['password', 'login_password', 'pass']);
  const iName = ci(['name', 'title']);
  for (const r of rows.slice(1)) {
    const url = iUrl >= 0 ? r[iUrl] : ''; const login = iUser >= 0 ? r[iUser] : ''; const pass = iPass >= 0 ? r[iPass] : '';
    if (!login && !pass) continue;
    out.push({ title: (iName >= 0 && r[iName]) || hostOf(url), url: url || '', login: login || '', password: pass || '', note: 'CSV: ' + path.basename(f) });
  }
  log('  ✓ CSV ' + path.basename(f) + ': ' + out.length + ' пароли');
  return out;
}

function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (_) { return String(u || '').replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] || 'Запис'; } }

function main() {
  console.log('🔐 Pupikes Authenticator — четец на пароли ОТ КОМПЮТЪРА (локално, нищо не се качва навън)\n');
  let all = [];
  if (csvFiles.length) { for (const f of csvFiles) { try { all.push(...readCsvFile(f)); } catch (e) { log('  ⚠ CSV ' + f + ': ' + e.message); } } }
  else {
    for (const br of CHROMIUM) { if (!anyOnly || only[br.key]) all.push(...readChromium(br)); }
    if (!anyOnly || only.firefox) all.push(...readFirefox());
  }
  // дедуп по url+login+password
  const seen = new Set(); const uniq = [];
  for (const p of all) { const k = (p.url || '') + '|' + (p.login || '') + '|' + (p.password || ''); if (seen.has(k)) continue; seen.add(k); uniq.push(p); }
  const payload = { passwords: uniq, seeds: [], entries: [], collection: [], ssh: [], networks: [], tokens: [] };
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 1), 'utf8');
  const withPw = uniq.filter((p) => p.password).length;
  console.log('\n📊 Общо: ' + uniq.length + ' записа (' + withPw + ' с парола).');
  console.log('💾 Записах: ' + OUT);
  console.log('\n→ Пренеси файла на телефона и внеси през: Настройки → Импорт → 🤖 Бот → Автоматичен анализатор.');
  if (!uniq.length) console.log('\nℹ Нищо не се прочете. Затвори браузъра и опитай пак, ИЛИ изнеси CSV от браузъра (Пароли → Експорт) и подай с --csv <файл>.');
}
main();
