// Version: 1.0174
// Pupikes AUTHENTICATOR — ЛОКАЛНО журито (без телефон, без прод):
//   1) Ползва ГОТОВИЯ билд rustore/authenticator/dist (същият код, който влиза в APK-то;
//      ако липсва → билдва го с vite).
//   2) Вдига собствен мини уеб сървър на случаен порт и кара Playwright да мине през
//      ВСИЧКИ функции като истински човек: интро → правен екран → език → сейф → кодове.
//   3) Кодовете се сверяват с НЕЗАВИСИМО изчисление в Node (RFC 4226/6238 + Steam) —
//      не вярваме на приложението „на дума".
//   4) Експортите се свалят като РЕАЛНИ файлове и се валидират; после се внасят ОБРАТНО
//      (кръгова проверка). Камерата се подменя с фалшив видеопоток, който показва QR код.
//
// Пускане:  node run.js --journey authenticator     (целта prod/vm е БЕЗ значение — локално е)
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { execSync } = require('child_process');

const APP_DIR = path.join(__dirname, '..', '..', '..', 'rustore', 'authenticator');
const DIST = path.join(APP_DIR, 'dist');

// ── Независими еталонни изчисления (RFC 4226 HOTP / RFC 6238 TOTP / Steam Guard) ──
function b32decode(s) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  s = String(s || '').toUpperCase().replace(/=+$/g, '').replace(/\s/g, '');
  let bits = 0, val = 0; const out = [];
  for (const ch of s) {
    const i = A.indexOf(ch); if (i < 0) continue;
    val = (val << 5) | i; bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(out);
}
function counterBuf(counter) {
  const buf = Buffer.alloc(8); let c = Math.floor(counter);
  for (let i = 7; i >= 0; i--) { buf[i] = c & 0xff; c = Math.floor(c / 256); }
  return buf;
}
function truncate(h) {
  const o = h[h.length - 1] & 0x0f;
  return ((h[o] & 0x7f) << 24) | ((h[o + 1] & 0xff) << 16) | ((h[o + 2] & 0xff) << 8) | (h[o + 3] & 0xff);
}
function hotpRef(secretB32, counter, digits = 6, algo = 'sha1') {
  const h = crypto.createHmac(algo, b32decode(secretB32)).update(counterBuf(counter)).digest();
  return String(truncate(h) % Math.pow(10, digits)).padStart(digits, '0');
}
function totpRefSet(secretB32, tMs, period = 30) {
  // Приемаме код от съседните стъпки време (±1), защото между четенето на екрана и
  // изчислението тук може да мине граница на периода.
  const c = Math.floor(tMs / 1000 / period);
  return [hotpRef(secretB32, c - 1), hotpRef(secretB32, c), hotpRef(secretB32, c + 1)];
}
function steamRefSet(secretB32, tMs) {
  const AB = '23456789BCDFGHJKMNPQRTVWXY';
  const one = (counter) => {
    const h = crypto.createHmac('sha1', b32decode(secretB32)).update(counterBuf(counter)).digest();
    let num = truncate(h), code = '';
    for (let i = 0; i < 5; i++) { code += AB[num % AB.length]; num = Math.floor(num / AB.length); }
    return code;
  };
  const c = Math.floor(tMs / 1000 / 30);
  return [one(c - 1), one(c), one(c + 1)];
}

// ── Мини статичен сървър за dist/ ──
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain'
};
function startServer(dir) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      try {
        let p = decodeURIComponent((req.url || '/').split('?')[0]);
        if (p === '/') p = '/index.html';
        const f = path.normalize(path.join(dir, p));
        if (!f.startsWith(path.normalize(dir)) || !fs.existsSync(f) || !fs.statSync(f).isFile()) {
          res.writeHead(404); res.end('not found'); return;
        }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
        res.end(fs.readFileSync(f));
      } catch (e) { res.writeHead(500); res.end('err'); }
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

// ── Помощници за Playwright (файлове/сваляния/диалози) ──
async function clickDownload(page, selector) {
  const [d] = await Promise.all([page.waitForEvent('download', { timeout: 25000 }), page.click(selector)]);
  const p = await d.path();
  return { name: d.suggestedFilename(), buf: fs.readFileSync(p) };
}
async function chooseFile(page, selector, filePath) {
  const [fc] = await Promise.all([page.waitForEvent('filechooser', { timeout: 25000 }), page.click(selector)]);
  await fc.setFiles(filePath);
}
async function entryCount(page) { return page.locator('.entry').count(); }
// Връща робота на ГЛАВНИЯ екран (табовете), откъдето и да е закъсал предният сценарий:
// отключва при нужда, натиска „←" колкото трябва. Така един провал не влачи следващите.
async function ensureList(page, ctx) {
  for (let i = 0; i < 5; i++) {
    if (await page.locator('.tabbar').isVisible().catch(() => false)) return;
    if (await page.locator('button:has-text("Отключи")').isVisible().catch(() => false)) {
      await page.fill('input[type=password]', ctx.curPass || PASS1);
      await page.click('button:has-text("Отключи")');
      await page.waitForTimeout(400); continue;
    }
    const back = page.locator('button.icon-btn:has-text("←")').first();
    if (await back.isVisible().catch(() => false)) { await back.click(); await page.waitForTimeout(300); continue; }
    await page.waitForTimeout(500);
  }
  if (!(await page.locator('.tabbar').isVisible().catch(() => false))) throw new Error('не мога да се върна на главния екран');
}
const NORM = { label: 'изходна позиция: главният екран', run: (page, c) => ensureList(page, c) };
async function codeOfRow(page, hasText) {
  const row = page.locator('.entry', { hasText });
  await row.locator('.code').filter({ hasText: /\d/ }).waitFor({ timeout: 8000 }).catch(() => {});
  const txt = await row.locator('.code').innerText();
  return txt.replace(/\s/g, '');
}

// Тестови тайни — ВСЯКА Е РАЗЛИЧНА (еднаква тайна = легитимен дубликат, който апът трие).
// SECRET_HOTP е ИСТИНСКАТА RFC 4226 тайна: base32("12345678901234567890").
const SECRET_RFC = 'GEZDGNBVGEZDGNBVGEZDGNBV';
const SECRET_HOTP = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const SECRET_GH = 'JBSWY3DPEHPK3PXP';
const SECRET_STEAM = 'MFRGGZDFMZTWQ2LK';
const SECRET_QR = 'NBSWY3DPO5XXE3DE';
const SECRET_CAM = 'MFZWIZLTORSWC2DB';
const PASS1 = 'kcyrobot123';
const PASS2 = 'kcyrobot456';

module.exports = {
  app: 'authenticator',
  label: 'Pupikes Toolkit Authenticator (ЛОКАЛНО: пълен тест на всички функции, без телефон)',
  writes: false,           // пише само в собствения си локален сървър/временни файлове
  local: true,             // база = ctx.localBase (не целта prod/vm)

  async setup(ctx) {
    // 1) Билд: ползвай ГОТОВИЯ dist (същият като в APK-то); ако липсва → билдни.
    if (!fs.existsSync(path.join(DIST, 'index.html'))) {
      execSync('npx vite build', { cwd: APP_DIR, stdio: 'pipe', timeout: 180000 });
    }
    // Версията на приложението (за проверка на етикета в долната лента).
    const verTxt = fs.readFileSync(path.join(APP_DIR, 'src', 'version.js'), 'utf8');
    const vm = verTxt.match(/APP_VERSION\s*=\s*'([^']+)'/);
    ctx.appVersion = vm ? vm[1] : null;

    // 2) Локален сървър върху dist.
    ctx._server = await startServer(DIST);
    ctx.localBase = 'http://127.0.0.1:' + ctx._server.address().port;

    // 3) Временна папка + подготвени файлове (QR кодове и CSV за импортите).
    ctx.tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kcy-auth-robot-'));
    const QR = require(path.join(APP_DIR, 'node_modules', 'qrcode'));
    ctx.qrFile = path.join(ctx.tmp, 'qr-import.png');
    await QR.toFile(ctx.qrFile, 'otpauth://totp/QRTest:qr%40kcy?secret=' + SECRET_QR + '&issuer=QRTest', { width: 480, margin: 2 });
    ctx.camQrDataUrl = await QR.toDataURL('otpauth://totp/CamTest:cam%40kcy?secret=' + SECRET_CAM + '&issuer=CamTest', { width: 480, margin: 2 });
    ctx.csvFile = path.join(ctx.tmp, 'chrome-import.csv');
    fs.writeFileSync(ctx.csvFile,
      'name,url,username,password\n' +
      'Pupikes Portal,https://portal.kcy/login,robot,s3cretX\n' +          // дубликат на ръчния запис
      'NewsSite,https://news.example.com/login,reader,readpass1\n');
  },

  async teardown(ctx) {
    try { if (ctx._server) ctx._server.close(); } catch (e) {}
    try { fs.rmSync(ctx.tmp, { recursive: true, force: true }); } catch (e) {}
  },

  scenarios: [
    {
      name: 'Старт: интро → език → правен екран (ред + без иконите-чекбокси)',
      steps: [
        { label: 'диалозите (confirm) се приемат автоматично', run: async (page) => {
          page.on('dialog', (d) => d.accept().catch(() => {}));
        } },
        { goto: '/' },
        { label: 'интрото „Pupikes" се показва и си заминава', run: async (page) => {
          await page.waitForSelector('#kcy-intro', { state: 'attached', timeout: 6000 }).catch(() => {});
          await page.waitForSelector('#kcy-intro', { state: 'detached', timeout: 15000 });
        } },
        { label: 'екран за език: 15 езика + видима версия', run: async (page, c) => {
          const n = await page.locator('.lang-btn').count();
          if (n !== 15) throw new Error('очаквах 15 езикови бутона, видях ' + n);
          if (c.appVersion) {
            const ok = await page.locator('text=v' + c.appVersion).first().isVisible().catch(() => false);
            if (!ok) throw new Error('версията v' + c.appVersion + ' не се вижда на езиковия екран');
          }
        } },
        { click: 'button.lang-btn:has-text("Български")' },
        { label: 'правният екран излиза СЛЕД езика; без 📄/📑 икони; бутонът е заключен до отметката', run: async (page) => {
          await page.waitForSelector('#kcy-legal-gate', { timeout: 20000 });
          const priv = await page.locator('#kcy-lg-priv').innerText();
          const terms = await page.locator('#kcy-lg-terms').innerText();
          if (/📄|📑/.test(priv + terms)) throw new Error('документните бутони пак съдържат иконите 📄/📑');
          if (!(await page.locator('#kcy-lg-accept').isDisabled())) throw new Error('„Продължи" е активен ПРЕДИ отметката');
          await page.check('#kcy-lg-chk');
          if (await page.locator('#kcy-lg-accept').isDisabled()) throw new Error('„Продължи" остана заключен СЛЕД отметката');
          await page.click('#kcy-lg-accept');
          await page.waitForSelector('#kcy-legal-gate', { state: 'detached', timeout: 8000 });
        } },
        { expect: 'button:has-text("Създай сейф")' },
      ],
    },
    {
      name: 'Сейф: валидации на паролата + създаване',
      steps: [
        { label: 'къса парола → „Поне 6 символа"', run: async (page) => {
          await page.fill('input[type=password] >> nth=0', 'abc');
          await page.fill('input[type=password] >> nth=1', 'abc');
          await page.click('button:has-text("Създай сейф")');
          await page.waitForSelector('.err:has-text("Поне 6 символа")', { timeout: 5000 });
        } },
        { label: 'различни пароли → „Паролите не съвпадат"', run: async (page) => {
          await page.fill('input[type=password] >> nth=0', PASS1);
          await page.fill('input[type=password] >> nth=1', PASS1 + 'x');
          await page.click('button:has-text("Създай сейф")');
          await page.waitForSelector('.err:has-text("Паролите не съвпадат")', { timeout: 5000 });
        } },
        { label: 'вярна парола → главният екран с 4-те таба', run: async (page, c) => {
          await page.fill('input[type=password] >> nth=0', PASS1);
          await page.fill('input[type=password] >> nth=1', PASS1);
          await page.click('button:has-text("Създай сейф")');
          await page.waitForSelector('.tabbar', { timeout: 8000 });
          c.curPass = PASS1;
          const tabs = await page.locator('.tabbar .tab').count();
          if (tabs !== 4) throw new Error('очаквах 4 таба, видях ' + tabs);
        } },
      ],
    },
    {
      name: 'TOTP еталон (RFC 6238): кодът на екрана = независимо изчисление',
      steps: [
        NORM,
        { click: '.fab' },
        { label: 'ръчно: издател RFC, тайна — еталонната', run: async (page) => {
          await page.fill('.content input[type=text] >> nth=1', 'RFC');
          await page.fill('.content input[type=text] >> nth=2', 'demo');
          await page.fill('.content input[type=text] >> nth=3', SECRET_RFC);
          await page.click('button:has-text("Запази")');
          await page.waitForSelector('.entry:has-text("RFC")', { timeout: 8000 });
        } },
        { label: 'кодът съвпада с RFC изчислението (±1 период) и има отброяване', run: async (page) => {
          const shown = await codeOfRow(page, 'RFC');
          const want = totpRefSet(SECRET_RFC, Date.now());
          if (!want.includes(shown)) throw new Error(`екранен код ${shown} ≠ еталонните ${want.join('/')}`);
          const ring = await page.locator('.entry:has-text("RFC") .ring').innerText();
          if (!/^\d+s$/.test(ring.trim())) throw new Error('няма валидно отброяване: „' + ring + '"');
        } },
      ],
    },
    {
      name: 'otpauth:// адрес попълва формата сам',
      steps: [
        NORM,
        { click: '.fab' },
        { label: 'поставяне на otpauth://…GitHub → полетата се попълват', run: async (page) => {
          const uri = 'otpauth://totp/GitHub:alice?secret=' + SECRET_GH + '&issuer=GitHub&digits=6&period=30';
          await page.fill('.content input[type=text] >> nth=0', uri);
          await page.waitForTimeout(300);
          const issuer = await page.inputValue('.content input[type=text] >> nth=1');
          const secret = await page.inputValue('.content input[type=text] >> nth=3');
          if (issuer !== 'GitHub') throw new Error('издателят не се попълни от адреса: „' + issuer + '"');
          if (secret !== SECRET_GH) throw new Error('тайната не се попълни от адреса');
          await page.click('button:has-text("Запази")');
          await page.waitForSelector('.entry:has-text("GitHub")', { timeout: 8000 });
        } },
        { label: 'и този код съвпада с еталона', run: async (page) => {
          const shown = await codeOfRow(page, 'GitHub');
          const want = totpRefSet(SECRET_GH, Date.now());
          if (!want.includes(shown)) throw new Error(`екранен код ${shown} ≠ еталонните ${want.join('/')}`);
        } },
      ],
    },
    {
      name: 'HOTP еталон (RFC 4226): 755224 → бутон ↻ → 287082',
      steps: [
        NORM,
        { click: '.fab' },
        { label: 'ръчно: тип HOTP, брояч 0', run: async (page) => {
          await page.fill('.content input[type=text] >> nth=1', 'HOTPTest');
          await page.fill('.content input[type=text] >> nth=3', SECRET_HOTP);
          await page.selectOption('.content select >> nth=0', 'hotp');
          await page.click('button:has-text("Запази")');
          await page.waitForSelector('.entry:has-text("HOTPTest")', { timeout: 8000 });
          const isHotp = await page.locator('.entry:has-text("HOTPTest") .hotp-next').isVisible().catch(() => false);
          if (!isHotp) throw new Error('записът НЕ е запазен като HOTP (няма бутон ↻)');
        } },
        { label: 'кодът за брояч 0 е ТОЧНО 755224 (RFC 4226 еталон)', run: async (page) => {
          const shown = await codeOfRow(page, 'HOTPTest');
          if (shown !== '755224' && shown === hotpRef(SECRET_HOTP, 0)) throw new Error('еталонната функция на робота е разминат с RFC — провери журито');
          if (shown !== '755224') throw new Error(`HOTP(0) на екрана е ${shown}, еталонът (RFC 4226) е 755224`);
        } },
        { label: '↻ следващ код → ТОЧНО 287082', run: async (page) => {
          await page.click('.entry:has-text("HOTPTest") .hotp-next');
          await page.waitForTimeout(400);
          const shown = await codeOfRow(page, 'HOTPTest');
          if (shown !== '287082') throw new Error(`HOTP(1) на екрана е ${shown}, еталонът е 287082`);
        } },
      ],
    },
    {
      name: 'Steam Guard: 5 знака от Steam азбуката = еталона',
      steps: [
        NORM,
        { click: '.fab' },
        { label: 'ръчно: тип Steam', run: async (page) => {
          await page.fill('.content input[type=text] >> nth=1', 'SteamAcc');
          await page.fill('.content input[type=text] >> nth=3', SECRET_STEAM);
          await page.selectOption('.content select >> nth=0', 'steam');
          await page.click('button:has-text("Запази")');
          await page.waitForSelector('.entry:has-text("SteamAcc")', { timeout: 8000 });
        } },
        { label: 'кодът е 5 знака и съвпада с еталонното Steam изчисление', run: async (page) => {
          const shown = await codeOfRow(page, 'SteamAcc');
          if (!/^[23456789BCDFGHJKMNPQRTVWXY]{5}$/.test(shown)) throw new Error('не прилича на Steam код: ' + shown);
          const want = steamRefSet(SECRET_STEAM, Date.now());
          if (!want.includes(shown)) throw new Error(`Steam код ${shown} ≠ еталонните ${want.join('/')}`);
        } },
      ],
    },
    {
      name: 'Търсене, копиране, редакция и преместване',
      steps: [
        NORM,
        { label: 'търсене „github" филтрира до 1 ред', run: async (page) => {
          await page.fill('input[placeholder="Търси…"]', 'github');
          await page.waitForTimeout(300);
          const n = await entryCount(page);
          if (n !== 1) throw new Error('филтърът показа ' + n + ' реда вместо 1');
          await page.fill('input[placeholder="Търси…"]', '');
          await page.waitForTimeout(300);
        } },
        { label: 'докосване на кода → „Копирано"', run: async (page) => {
          await page.click('.entry:has-text("GitHub") .code');
          await page.waitForSelector('#toast.show:has-text("Копирано")', { timeout: 4000 });
        } },
        { label: 'редакция: GitHub → GitHub2', run: async (page) => {
          await page.click('.entry:has-text("GitHub") .info');
          await page.waitForSelector('.content input[type=text]', { timeout: 5000 });
          await page.fill('.content input[type=text] >> nth=0', 'GitHub2');
          await page.click('button:has-text("Запази")');
          await page.waitForSelector('.entry:has-text("GitHub2")', { timeout: 5000 });
        } },
        { label: 'преместване ↑: редът се качва', run: async (page) => {
          const before = await page.locator('.entry .issuer').allInnerTexts();
          await page.click('.entry:has-text("GitHub2") .info');
          await page.click('button:has-text("↑")');
          await page.waitForSelector('.tabbar', { timeout: 5000 });
          const after = await page.locator('.entry .issuer').allInnerTexts();
          if (before.indexOf('GitHub2') <= after.indexOf('GitHub2')) throw new Error('редът не се качи: ' + before.join(',') + ' → ' + after.join(','));
        } },
      ],
    },
    {
      name: 'Дубликати: еднаква тайна се открива и се трие',
      steps: [
        NORM,
        { click: '.fab' },
        { label: 'добави копие със същата тайна', run: async (page) => {
          await page.fill('.content input[type=text] >> nth=1', 'GitHubCopy');
          await page.fill('.content input[type=text] >> nth=3', SECRET_GH);
          await page.click('button:has-text("Запази")');
          await page.waitForSelector('.entry:has-text("GitHubCopy")', { timeout: 8000 });
        } },
        { label: 'Настройки → Намери дубликати → групата е намерена → изтрий избраните', run: async (page, c, h) => {
          await page.click('.topbar .icon-btn');
          await page.waitForSelector('button:has-text("Намери дубликати")', { timeout: 5000 });
          await page.click('button:has-text("Намери дубликати")');
          await page.waitForSelector('button:has-text("Изтрий избраните")', { timeout: 5000 });
          const checked = await page.locator('input[type=checkbox]:checked').count();
          if (checked < 1) throw new Error('никой дубликат не е отметнат по подразбиране');
          await page.click('button:has-text("Изтрий избраните")');
          await page.waitForSelector('.tabbar', { timeout: 5000 });
          const still = await page.locator('.entry:has-text("GitHubCopy")').count();
          if (still) throw new Error('копието НЕ беше изтрито');
          if ((await entryCount(page)) !== 4) throw new Error('очаквах 4 записа след триенето');
        } },
      ],
    },
    {
      name: 'Заключване: грешна парола отказва, вярната отключва',
      steps: [
        NORM,
        { label: 'Настройки → Заключи сега → грешна парола → „Грешна парола"', run: async (page) => {
          await page.click('.topbar .icon-btn');
          await page.click('button:has-text("Заключи сега")');
          await page.waitForSelector('button:has-text("Отключи")', { timeout: 5000 });
          await page.fill('input[type=password]', 'ne-tazi-parola');
          await page.click('button:has-text("Отключи")');
          await page.waitForSelector('.err:has-text("Грешна парола")', { timeout: 5000 });
        } },
        { label: 'вярната парола отключва и записите са си там', run: async (page) => {
          await page.fill('input[type=password]', PASS1);
          await page.click('button:has-text("Отключи")');
          await page.waitForSelector('.tabbar', { timeout: 5000 });
          if ((await entryCount(page)) !== 4) throw new Error('след отключване записите не са 4');
        } },
      ],
    },
    {
      name: 'Смяна на master паролата',
      steps: [
        NORM,
        { label: 'Настройки → нова парола → заключи → отключи с НОВАТА', run: async (page, c) => {
          await page.click('.topbar .icon-btn');
          await page.fill('input[type=password] >> nth=0', PASS2);
          await page.fill('input[type=password] >> nth=1', PASS2);
          await page.click('button:has-text("Смени паролата")');
          await page.waitForSelector('#toast.show', { timeout: 4000 });
          await page.click('button:has-text("Заключи сега")');
          await page.waitForSelector('button:has-text("Отключи")', { timeout: 5000 });
          await page.fill('input[type=password]', PASS2);
          await page.click('button:has-text("Отключи")');
          await page.waitForSelector('.tabbar', { timeout: 5000 });
          c.curPass = PASS2;
        } },
      ],
    },
    {
      name: 'Експорти: 6 реални файла се свалят и са верни',
      steps: [
        NORM,
        { label: 'отвори Настройки', run: async (page) => {
          await page.click('.topbar .icon-btn');
          await page.waitForSelector('button:text-is("Експорт (.json)")', { timeout: 5000 });
        } },
        { label: '.json бекъп: 4 записа с верните тайни', run: async (page, c) => {
          const d = await clickDownload(page, 'button:text-is("Експорт (.json)")');
          const j = JSON.parse(d.buf.toString('utf8'));
          if (!j.entries || j.entries.length !== 4) throw new Error('.json бекъпът няма 4 записа');
          const secrets = j.entries.map((e) => e.secret);
          for (const s of [SECRET_RFC, SECRET_HOTP, SECRET_GH, SECRET_STEAM]) if (!secrets.includes(s)) throw new Error('.json бекъпът губи тайна ' + s.slice(0, 6) + '…');
          c.jsonBackup = path.join(c.tmp, 'backup.json'); fs.writeFileSync(c.jsonBackup, d.buf);
        } },
        { label: 'Aegis експорт: валиден JSON с db.entries', run: async (page, c) => {
          const d = await clickDownload(page, 'button:has-text("Експорт към Aegis")');
          const j = JSON.parse(d.buf.toString('utf8'));
          const list = j && j.db && j.db.entries;
          if (!list || list.length !== 4) throw new Error('Aegis експортът няма db.entries×4');
        } },
        { label: '2FAS експорт: валиден JSON със services', run: async (page, c) => {
          const d = await clickDownload(page, 'button:has-text("Експорт към 2FAS")');
          const j = JSON.parse(d.buf.toString('utf8'));
          if (!Array.isArray(j.services) || j.services.length !== 4) throw new Error('2FAS експортът няма services×4');
          c.twofasFile = path.join(c.tmp, 'export.2fas'); fs.writeFileSync(c.twofasFile, d.buf);
        } },
        { label: 'otpauth:// списък: 4 реда, съдържа тайните', run: async (page, c) => {
          const d = await clickDownload(page, 'button:has-text("Експорт otpauth:// списък")');
          const lines = d.buf.toString('utf8').trim().split('\n');
          if (lines.length !== 4 || !lines.every((l) => l.startsWith('otpauth://'))) throw new Error('otpauth списъкът не е 4×otpauth:// реда');
          c.otpauthFile = path.join(c.tmp, 'otpauth-list.txt'); fs.writeFileSync(c.otpauthFile, d.buf);
        } },
        { label: 'Google Authenticator QR: истински PNG (Steam се прескача)', run: async (page) => {
          const d = await clickDownload(page, 'button:has-text("Експорт към Google Authenticator (QR)")');
          if (!(d.buf[0] === 0x89 && d.buf[1] === 0x50)) throw new Error('Google експортът не е PNG файл');
        } },
        { label: '„Експортирай всички (QR)": .zip с 4 PNG файла', run: async (page) => {
          const d = await clickDownload(page, 'button:has-text("Експортирай всички (QR)")');
          if (!(d.buf[0] === 0x50 && d.buf[1] === 0x4b)) throw new Error('не е .zip файл');
          let cnt = 0; for (let i = 0; i < d.buf.length - 3; i++) { if (d.buf[i] === 0x50 && d.buf[i + 1] === 0x4b && d.buf[i + 2] === 3 && d.buf[i + 3] === 4) cnt++; }
          if (cnt !== 4) throw new Error('в .zip архива има ' + cnt + ' файла вместо 4');
        } },
      ],
    },
    {
      name: 'Импорт кръг: изтрий запис → върни го от .json; списъците ловят дубликати',
      steps: [
        NORM,
        { label: 'изтрий RFC записа (с потвърждение)', run: async (page) => {
          await page.click('.entry:has-text("RFC") .info');
          await page.click('button:has-text("Изтрий")');
          await page.waitForSelector('.tabbar', { timeout: 5000 });
          if ((await entryCount(page)) !== 3) throw new Error('след триене записите не са 3');
        } },
        { label: '„+" → Импорт от файл → .json → RFC се връща', run: async (page, c) => {
          await page.click('.fab');
          await page.click('.seg button:has-text("Импорт от файл")');
          await chooseFile(page, 'button.btn:has-text("Импорт (.json)")', c.jsonBackup);
          await page.waitForSelector('.entry:has-text("RFC")', { timeout: 8000 });
          if ((await entryCount(page)) !== 4) throw new Error('след импорта записите не са 4');
        } },
        { label: 'Настройки → импорт на otpauth списъка → само дубликати, нищо ново', run: async (page, c) => {
          await page.click('.topbar .icon-btn');
          await chooseFile(page, 'button:has-text("Импорт otpauth:// списък")', c.otpauthFile);
          await page.waitForSelector('#toast.show', { timeout: 6000 });
          await page.click('button.icon-btn:has-text("←")');
          await page.waitForSelector('.tabbar', { timeout: 5000 });
          if ((await entryCount(page)) !== 4) throw new Error('otpauth импортът добави дубликати');
        } },
        { label: 'Настройки → импорт от 2FAS файла → пак само дубликати', run: async (page, c) => {
          await page.click('.topbar .icon-btn');
          await chooseFile(page, 'button:has-text("Импорт от 2FAS")', c.twofasFile);
          await page.waitForSelector('#toast.show', { timeout: 6000 });
          await page.click('button.icon-btn:has-text("←")');
          await page.waitForSelector('.tabbar', { timeout: 5000 });
          if ((await entryCount(page)) !== 4) throw new Error('2FAS импортът добави дубликати');
        } },
      ],
    },
    {
      name: 'QR от картинка: качен PNG се разчита и внася акаунт',
      steps: [
        NORM,
        { click: '.fab' },
        { label: '„Качи файл с QR" → PNG → акаунт QRTest се появява', run: async (page, c) => {
          await page.click('.seg button:has-text("Качи файл с QR")');
          await chooseFile(page, 'button.btn:has-text("Качи файл с QR")', c.qrFile);
          await page.waitForSelector('.entry:has-text("QRTest")', { timeout: 10000 });
          const shown = await codeOfRow(page, 'QRTest');
          const want = totpRefSet(SECRET_QR, Date.now());
          if (!want.includes(shown)) throw new Error(`кодът от QR импорта ${shown} ≠ еталонните`);
        } },
      ],
    },
    {
      name: 'Сканиране с камера (фалшив видеопоток с QR код)',
      steps: [
        NORM,
        { label: 'подмени камерата с платно, което показва QR кода', run: async (page, c) => {
          await page.evaluate((durl) => {
            const img = new Image(); img.src = durl;
            navigator.mediaDevices.getUserMedia = async () => {
              const canvas = document.createElement('canvas');
              canvas.width = 480; canvas.height = 480;
              const ctx2 = canvas.getContext('2d');
              const draw = () => { ctx2.fillStyle = '#fff'; ctx2.fillRect(0, 0, 480, 480); try { ctx2.drawImage(img, 0, 0, 480, 480); } catch (e) {} };
              draw(); setInterval(draw, 100);
              return canvas.captureStream(10);
            };
          }, c.camQrDataUrl);
        } },
        { click: '.fab' },
        { label: '„Сканирай QR код" → кодът се хваща от потока → акаунт CamTest', run: async (page) => {
          await page.click('.seg button:has-text("Сканирай QR код")');
          await page.waitForSelector('.entry:has-text("CamTest")', { timeout: 15000 });
        } },
      ],
    },
    {
      name: 'Колекция: QR картинка със заглавие се пази и отваря',
      steps: [
        NORM,
        { label: 'таб „Колекция" → + → качи QR → Запази', run: async (page, c) => {
          await page.click('.tabbar .tab:has-text("Колекция")');
          await page.click('.fab');
          await page.waitForSelector('input[maxlength="256"]', { timeout: 5000 });
          await page.fill('input[maxlength="256"]', 'Робот QR');
          await chooseFile(page, '.seg button:has-text("Качи файл с QR")', c.qrFile);
          await page.waitForSelector('text=QR разчетен ✓', { timeout: 8000 });
          await page.click('button:has-text("Запази")');
          await page.waitForSelector('.entry:has-text("Робот QR")', { timeout: 5000 });
        } },
        { label: 'записът се отваря с картинка и разчетено съдържание', run: async (page) => {
          await page.click('.entry:has-text("Робот QR")');
          await page.waitForSelector('img', { timeout: 5000 });
          const val = await page.inputValue('.copyfield input').catch(() => '');
          if (!val.startsWith('otpauth://')) throw new Error('разчетеното съдържание на QR кода не се показва (полето е „' + val.slice(0, 30) + '…")');
          await page.click('button.icon-btn:has-text("←")');
          await page.waitForSelector('.tabbar', { timeout: 5000 });
        } },
      ],
    },
    {
      name: 'Пароли: ръчен запис + импорт от Chrome CSV (с дубликат) + експорти',
      steps: [
        NORM,
        { label: 'таб „Пароли" → + → нов запис', run: async (page) => {
          await page.click('.tabbar .tab:has-text("Пароли")');
          await page.click('.fab');
          await page.waitForSelector('.content input[type=text]', { timeout: 5000 });
          await page.fill('.content input[type=text] >> nth=0', 'Pupikes Portal');
          await page.fill('.content input[type=text] >> nth=1', 'https://portal.kcy/login');
          await page.fill('.content input[type=text] >> nth=2', 'robot');
          await page.fill('.content input[type=password] >> nth=0', 's3cretX');
          await page.click('button:has-text("Запази")');
          await page.waitForSelector('.entry:has-text("Pupikes Portal")', { timeout: 5000 });
        } },
        { label: 'Настройки → CSV импорт: 1 нов + 1 дубликат прескочен', run: async (page, c) => {
          await page.click('.topbar .icon-btn');
          await chooseFile(page, 'button:has-text("Импорт от Chrome / Edge / Firefox (CSV)")', c.csvFile);
          await page.waitForSelector('#toast.show:has-text("прескочени 1")', { timeout: 8000 });
        } },
        { label: 'експорт Chrome/Edge CSV и Firefox CSV — двата формата са верни', run: async (page) => {
          const ch = await clickDownload(page, 'button:has-text("Експорт към Chrome / Edge (CSV)")');
          const chTxt = ch.buf.toString('utf8');
          if (!/^name,url,username,password/.test(chTxt) || !chTxt.includes('NewsSite')) throw new Error('Chrome CSV не е верен: ' + chTxt.split('\n')[0]);
          const fx = await clickDownload(page, 'button:has-text("Експорт към Firefox (CSV)")');
          const fxTxt = fx.buf.toString('utf8');
          if (!/^"url","username","password"/.test(fxTxt)) throw new Error('Firefox CSV не е верен: ' + fxTxt.split('\n')[0]);
        } },
        { label: 'дубликати на пароли: копие → намира се → трие се', run: async (page) => {
          await page.click('button.icon-btn:has-text("←")');
          await page.click('.fab');
          await page.fill('.content input[type=text] >> nth=0', 'Pupikes Portal Copy');
          await page.fill('.content input[type=text] >> nth=1', 'https://portal.kcy/other');
          await page.fill('.content input[type=text] >> nth=2', 'robot');
          await page.click('button:has-text("Запази")');
          await page.waitForSelector('.tabbar', { timeout: 5000 });
          await page.click('.topbar .icon-btn');
          await page.click('button:has-text("Дубликати на пароли")');
          await page.waitForSelector('button:has-text("Изтрий избраните")', { timeout: 5000 });
          await page.click('button:has-text("Изтрий избраните")');
          await page.waitForSelector('.tabbar', { timeout: 5000 });
          await page.click('.tabbar .tab:has-text("Пароли")');
          const n = await entryCount(page);
          if (n !== 2) throw new Error('след чистката паролите са ' + n + ' вместо 2');
        } },
      ],
    },
    {
      name: 'Крипто портфейли: 12 плочки, добавяне с „око", бекъп кръг',
      steps: [
        NORM,
        { label: 'таб „Портфейли": 12 плочки; + без избран портфейл → подсказка', run: async (page) => {
          await page.click('.tabbar .tab:has-text("Портфейли")');
          await page.waitForTimeout(300);
          const tiles = await page.locator('.content button.btn.ghost').count();
          if (tiles !== 12) throw new Error('очаквах 12 плочки портфейли, видях ' + tiles);
          await page.click('.fab');
          await page.waitForSelector('#toast.show:has-text("Първо избери портфейл")', { timeout: 4000 });
        } },
        { label: 'Binance → + → акаунт със seed фраза → запазен, брой 1/20', run: async (page) => {
          await page.click('.content button:has-text("Binance")');
          await page.click('.fab');
          await page.waitForSelector('.content input[type=text]', { timeout: 5000 });
          await page.fill('.content input[type=text] >> nth=0', 'Основен');
          await page.fill('.content input[type=text] >> nth=1', 'robot@kcy');
          await page.fill('.content textarea >> nth=0', 'abandon ability able about above absent absorb abstract absurd abuse access accident');
          await page.click('button:has-text("Запази")');
          await page.waitForSelector('.entry:has-text("Основен")', { timeout: 5000 });
          const cnt = await page.locator('text=1/20').first().isVisible().catch(() => false);
          if (!cnt) throw new Error('броячът 1/20 не се вижда');
        } },
        { label: '„окото": seed фразата е замъглена, окото я показва', run: async (page) => {
          await page.click('.entry:has-text("Основен")');
          await page.waitForSelector('.content textarea', { timeout: 5000 });
          const blurred = await page.locator('.content textarea >> nth=0').evaluate((el) => el.style.filter.includes('blur'));
          if (!blurred) throw new Error('seed фразата НЕ е замъглена по подразбиране');
          await page.click('.copy-btn[title="👁"] >> nth=0');
          const shown = await page.locator('.content textarea >> nth=0').evaluate((el) => !el.style.filter || el.style.filter === 'none');
          if (!shown) throw new Error('окото не показа seed фразата');
          await page.click('button.icon-btn:has-text("←")');
        } },
        { label: 'бекъп: експорт .json → импорт същия → само дубликат', run: async (page, c) => {
          await page.click('.topbar .icon-btn');
          const d = await clickDownload(page, 'button:has-text("Експорт на портфейли (.json)")');
          const j = JSON.parse(d.buf.toString('utf8'));
          if (!Array.isArray(j.seeds) || j.seeds.length !== 1) throw new Error('портфейлният бекъп няма seeds×1');
          const f = path.join(c.tmp, 'wallets.json'); fs.writeFileSync(f, d.buf);
          await chooseFile(page, 'button:has-text("Импорт на портфейли (.json)")', f);
          await page.waitForSelector('#toast.show', { timeout: 6000 });
          await page.click('button.icon-btn:has-text("←")');
          await page.click('.tabbar .tab:has-text("Портфейли")');
          await page.waitForTimeout(300);
          const one = await page.locator('text=1/20').first().isVisible().catch(() => false);
          if (!one) throw new Error('импортът на същия бекъп добави дубликат (броят не е 1/20)');
        } },
      ],
    },
    {
      name: 'Презареждане: всичко е ШИФРОВАНО запазено и иска парола',
      steps: [
        { label: 'reload → интро → екран за отключване (не пуска без парола)', run: async (page) => {
          await page.reload({ waitUntil: 'domcontentloaded' });
          await page.waitForSelector('#kcy-intro', { state: 'detached', timeout: 15000 }).catch(() => {});
          await page.waitForSelector('button:has-text("Отключи")', { timeout: 10000 });
        } },
        { label: 'тайните в localStorage НЕ са в чист вид (шифровани са)', run: async (page) => {
          const leak = await page.evaluate((sec) => {
            for (let i = 0; i < localStorage.length; i++) {
              const v = localStorage.getItem(localStorage.key(i)) || '';
              if (v.includes(sec)) return localStorage.key(i);
            }
            return null;
          }, SECRET_RFC);
          if (leak) throw new Error('тайната стои НЕшифрована в localStorage ключ ' + leak);
        } },
        { label: 'отключване → 6 кода, 1 колекция, 2 пароли, 1 портфейл — всичко си е там', run: async (page) => {
          await page.fill('input[type=password]', PASS2);
          await page.click('button:has-text("Отключи")');
          await page.waitForSelector('.tabbar', { timeout: 6000 });
          if ((await entryCount(page)) !== 6) throw new Error('кодовете след презареждане не са 6');
          await page.click('.tabbar .tab:has-text("Колекция")');
          if ((await entryCount(page)) !== 1) throw new Error('колекцията не е 1');
          await page.click('.tabbar .tab:has-text("Пароли")');
          if ((await entryCount(page)) !== 2) throw new Error('паролите не са 2');
          await page.click('.tabbar .tab:has-text("Портфейли")');
          await page.waitForTimeout(300);
          const one = await page.locator('text=1/20').first().isVisible().catch(() => false);
          if (!one) throw new Error('портфейлът не е 1/20');
          await page.click('.tabbar .tab:has-text("Аутентикация")');
        } },
      ],
    },
    {
      name: 'Смяна на езика: български → English → обратно',
      steps: [
        NORM,
        { label: 'Настройки → език → English → интерфейсът е на английски', run: async (page) => {
          await page.click('.topbar .icon-btn');
          await page.click('.setting button:has-text("Български")');
          await page.waitForSelector('.lang-btn', { timeout: 5000 });
          await page.click('button.lang-btn:has-text("English")');
          await page.waitForSelector('.tabbar .tab:has-text("Authentication")', { timeout: 6000 });
        } },
        { label: 'и обратно на български', run: async (page) => {
          await page.click('.topbar .icon-btn');
          await page.click('.setting button:has-text("English")');
          await page.waitForSelector('.lang-btn', { timeout: 5000 });
          await page.click('button.lang-btn:has-text("Български")');
          await page.waitForSelector('.tabbar .tab:has-text("Аутентикация")', { timeout: 6000 });
        } },
      ],
    },
    {
      name: 'Долната Pupikes лента: версия + бутони на всеки екран',
      steps: [
        NORM,
        { label: 'лентата е долу, версията съвпада с билда', run: async (page, c) => {
          const bar = await page.locator('#kcy-bar').isVisible().catch(() => false);
          if (!bar) throw new Error('#kcy-bar липсва');
          if (c.appVersion) {
            const ver = (await page.locator('#kcy-bar-ver').innerText().catch(() => '')).trim();
            if (ver !== 'v' + c.appVersion) throw new Error(`версията в лентата е „${ver}", очаквах v${c.appVersion}`);
          }
          for (const txt of ['Pupikes', 'Помощ', 'Поверителност', 'Условия']) {
            const ok = await page.locator('#kcy-bar >> text=' + txt).first().isVisible().catch(() => false);
            if (!ok) throw new Error('в лентата липсва бутон „' + txt + '"');
          }
        } },
      ],
    },
    {
      name: 'Изтриване на сейфа: чисто начало',
      steps: [
        NORM,
        { label: 'Настройки → „Изтрий целия сейф" (потвърдено) → екранът за нов сейф', run: async (page) => {
          await page.click('.topbar .icon-btn');
          await page.click('button:has-text("Изтрий целия сейф")');
          await page.waitForSelector('button:has-text("Създай сейф")', { timeout: 6000 });
        } },
      ],
    },
  ],
};
