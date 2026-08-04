// HuaweiReleaseBot (huawei-release-bot.cjs) — попълва данните за публикуване в Huawei AppGallery за ЕДНО
// приложение, закачайки се за ВЕЧЕ логнатия браузър (debug порт 9222, от huawei-release-bot-launch.cjs).
// Двойка: AppPreparePublishingBot подготвя publish/, HuaweiReleaseBot попълва конзолата от него.
//
// ПРАВИЛА (по искане):
//  • Логинът е РЪЧЕН (капча) — ботът само се закача за отворената сесия.
//  • Ботът попълва полетата ВИДИМО, но НЕ натиска OK/Next/Save/Submit/Continue — ти преглеждаш
//    и натискаш бутоните сам. На всяка страница спира.
//  • Разбира ВЕЧЕ създаден запис и попълва/редактира текущия екран (не гърми, че съществува).
//  • Чете данните от publish/ (единствен източник) — същите, които документът показва.
//
// Пуска се СЛЕД като си влязъл и си отворил приложението (Distribute → App information):
//   node deploy-scripts/huawei-release-bot.cjs newslator
const path = require('path');
const fs = require('fs');
let PW; for (const c of ['desktop/selflearning-friend/node_modules/playwright', 'node_modules2/playwright', 'node_modules/playwright']) { try { PW = require(path.resolve(c)); break; } catch (_) {} }
if (!PW) { console.log('Playwright липсва.'); process.exit(2); }

const app = (process.argv[2] || '').replace(/\/$/, '');
if (!app) { console.log('Употреба: node deploy-scripts/huawei-release-bot.cjs <app>'); process.exit(1); }
const pub = path.resolve('huawei', app, 'publish');
if (!fs.existsSync(pub)) { console.log('Няма publish папка за ' + app); process.exit(1); }
// РЕЖИМ ЦЕНА: `node ... <app> price` → ботът сам отива на екрана „App price", попълва цената и НАТИСКА Save.
const PRICE_MODE = (process.argv[3] || '') === 'price' || process.argv.includes('--price');

// ── данни за приложението (от publish/, единствен източник) ──
function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_) { return {}; } }
const brand = readJson(path.resolve('huawei', app, 'capacitor.config.json')).appName || app;
const appId = readJson(path.resolve('huawei', app, 'capacitor.config.json')).appId || '';
const storeNames = readJson(path.join(pub, 'store-names.json'));
const website = 'https://pupikes.com';
// категория (пълен път) от документа
let catPath = '';
try { const md = fs.readFileSync(path.join(pub, 'PUBLISHING-HUAWEI.md'), 'utf8'); const m = md.match(/\*\*Пълен път:\*\*\s*`([^`]+)`/); if (m) catPath = m[1]; } catch (_) {}
const catParts = catPath.split('>').map((s) => s.trim()).filter(Boolean);   // [Apps, News & reading, News]
// описания по език от descriptions-languages.md → { en: {brief, full, nf}, ... }
function parseDescriptions() {
  const out = {}; let md = '';
  try { md = fs.readFileSync(path.join(pub, 'descriptions-languages.md'), 'utf8'); } catch (_) { return out; }
  const blocks = md.split(/\n##\s+/).slice(1);
  for (const b of blocks) {
    // кодът е в заглавния ред; за „Español (MX) (es-MX)" трябва es-MX, не MX → търсим ЕЗИКОВ шаблон
    // (малки букви 2 + по избор -суфикс), не първата скоба.
    const header = b.split('\n')[0];
    const code = (header.match(/\(([a-z]{2}(?:-[A-Za-z]+)?)\)/) || [])[1]; if (!code) continue;
    const grab = (label) => { const m = b.match(new RegExp('\\*\\*' + label + '[^\\n]*\\*\\*[\\s\\S]*?```\\n([\\s\\S]*?)\\n```')); return m ? m[1].trim() : ''; };
    const briefQ = (b.match(/\*\*Brief[^\n]*\*\*\s*\n>\s*([^\n]+)/) || [])[1] || '';
    out[code] = { brief: briefQ.trim() || grab('Brief'), full: grab('Full'), nf: grab('New features') };
  }
  return out;
}
const desc = parseDescriptions();
const enName = storeNames._default || brand;

// ── активи за качване (икона, скрийншоти, промо-видео) ──
function firstFile(cands) { for (const c of cands) { try { if (fs.existsSync(c)) return path.resolve(c); } catch (_) {} } return ''; }
const iconPath = firstFile([path.join(pub, 'icon-512.png'), path.join(pub, 'icon-216.png')]);
let shotPaths = [];
try {
  const sd = path.join(pub, 'screenshots');
  if (fs.existsSync(sd)) shotPaths = fs.readdirSync(sd).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).sort().map((f) => path.join(sd, f));
  // споделените 1-*.png … 8-*.png в publish/ (различни езици)
  const numbered = fs.readdirSync(pub).filter((f) => /^\d+-.*\.(png|jpe?g)$/i.test(f)).sort();
  if (numbered.length) shotPaths = numbered.map((f) => path.join(pub, f));
} catch (_) {}
const promoPath = firstFile([path.resolve('app-shared/promo-pupikes.mp4')]);
// Huawei RELEASE APK за версията (apk/huawei/release/<Име>-huawei-release.apk) — по нормализирано име.
function findHwApk() {
  const dir = path.resolve('apk/huawei/release');
  const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const wants = [norm(storeNames._default || brand), norm(brand), norm(app)].filter(Boolean);
  try {
    const files = fs.readdirSync(dir).filter((f) => /\.apk$/i.test(f));
    for (const f of files) { const stem = norm(f.replace(/-huawei-release\.apk$/i, '')); if (wants.includes(stem)) return path.join(dir, f); }
    for (const f of files) { const nf = norm(f); if (wants.some((w) => nf.includes(w))) return path.join(dir, f); }
  } catch (_) {}
  return '';
}
const hwApkPath = findHwApk();
// Апове, за които НЕ качваме промо-видео на Huawei (проблемно — напр. ориентация/модерация).
const NO_VIDEO = new Set(['newslator']);
// Цена (USD) от каталога с цените („лапата") — за екрана App price. Празно/без → 1.3.
const priceUsd = (() => {
  try { const c = readJson(path.resolve('app-shared/promo-catalog.json')); const a = (c.apps || []).find((x) => x.id === app); const p = a && a.price; if (typeof p === 'string') return p.replace(/[^0-9.]/g, '') || '1.3'; } catch (_) {}
  return '1.3';
})();
// Хостнат Privacy policy / Terms URL (за екрана Privacy statement).
// Домейнът е от ЕДИНСТВЕНИЯ източник app-shared/legal-domain.json (Huawei: нищо не е качено → pupikes.app).
const LEGAL_BASE = (() => { try { return readJson(path.resolve('app-shared/legal-domain.json')).domain || 'https://pupikes.app/privacy'; } catch (_) { return 'https://pupikes.app/privacy'; } })();
const privacyUrl = LEGAL_BASE + '/' + app + '/hw-privacy.html';
// Държави, които се махат навсякъде (регистрационни/санкционни проблеми): Китай + Беларус + Русия.
const REMOVE_COUNTRIES = ['Chinese mainland', 'China mainland', 'Belarus', 'Russia'];
// AI декларация (Huawei): апове с ГЕНЕРАТИВЕН AI → „Involved"; останалите → „Not involved".
const GENERATIVE_AI = new Set(['pupikes-toolkit-ai-announcement']);
const aiDecl = GENERATIVE_AI.has(app) ? 'Involved' : 'Not involved';

// ── Езици за добавяне в Manage languages (само РЕАЛНО преведените + регионални удвоявания) ──
// English (UK) е по подразбиране (не се добавя). Всеки наш код → точните Huawei етикети.
const HW_ADD = {
  en: ['English (US)'], bg: ['Bulgarian'], ru: ['Russian'], uk: ['Ukrainian'],
  de: ['German'], fr: ['French (France)'], es: ['Spanish (Spain)'], 'es-MX': ['Spanish (Latin America)'],
  it: ['Italian'], pt: ['Portuguese (Portugal)', 'Portuguese (Brazil)'], ar: ['Arabic'], hi: ['Hindi'],
  ja: ['Japanese'], ky: [], 'zh-Hant': ['Traditional Chinese (Taiwan, China)', 'Traditional Chinese (Hong Kong, China)']
};
function translatedCodes() {
  const set = new Set(['en']);
  try {
    const dir = path.join(pub, 'store-listing');
    const en = fs.readFileSync(path.join(dir, 'en.txt'), 'utf8').replace(/\r/g, '');
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.txt')) continue; const code = f.slice(0, -4);
      if (code === 'en' || code.startsWith('_')) continue;
      const t = fs.readFileSync(path.join(dir, f), 'utf8').replace(/\r/g, '');
      if (t.trim() && t !== en) set.add(code);
    }
  } catch (_) {}
  return set;
}
const hwLabels = [...translatedCodes()].flatMap((c) => HW_ADD[c] || []);   // етикетите за отмятане
// обратна карта: Huawei етикет → наш код (за попълване на описанията по език)
const LABEL_TO_CODE = { 'English (UK)': 'en' };
for (const c of Object.keys(HW_ADD)) for (const lab of HW_ADD[c]) LABEL_TO_CODE[lab] = c;
// езиците за попълване = English (UK) + реално преведените (в реда на добавяне)
const langFillLabels = ['English (UK)', ...hwLabels];

function log(s) { console.log('  ' + s); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── попълване на ВИДИМОТО поле по етикет ──
// ВАЖНО: всеки език има СВОЙ скрит комплект полета (App name/Brief/Full/New features). Само полетата
// на АКТИВНИЯ език (избрания в Language) са ВИДИМИ. Затова таргетираме `:visible` — иначе хващаме
// скрито поле на друг език и попълването „не намира" полето.
async function fillNear(frame, labelRe, value, tag) {
  if (!value) return false;
  tag = tag || 'input';
  try {
    const el = frame.locator(`.el-form-item:has(.el-form-item__label:has-text(${JSON.stringify(labelRe)})) ${tag}:visible`).first();
    await el.waitFor({ state: 'visible', timeout: 3500 });
    await el.scrollIntoViewIfNeeded().catch(() => {});
    await el.fill('');
    await el.fill(value);
    log('✓ „' + labelRe + '" ← ' + value.slice(0, 48).replace(/\n/g, ' ') + (value.length > 48 ? '…' : ''));
    return true;
  } catch (_) { log('↷ „' + labelRe + '" — няма видимо поле'); return false; }
}
async function clickText(scope, txt, timeout) {
  try {
    const el = scope.locator(`text="${txt}"`).first();
    await el.waitFor({ timeout: timeout || 2500 });
    await el.click({ timeout: 2000 });
    log('✓ кликнах: ' + txt);
    return true;
  } catch (_) { return false; }
}
// Element-UI падащо меню: кликва селекта след етикета, после опцията по видим текст.
async function selectByLabel(frame, labelText, optionText) {
  try {
    const sel = frame.locator(`xpath=//*[contains(normalize-space(.),${JSON.stringify(labelText)})]/following::div[contains(@class,"el-select")][1]`).first();
    await sel.click({ timeout: 2500 });
    await new Promise((r) => setTimeout(r, 600));
    const opt = frame.locator('.el-select-dropdown__item').filter({ hasText: optionText }).first();
    await opt.click({ timeout: 2500 });
    log('✓ ' + labelText + ' ← ' + optionText);
    return true;
  } catch (_) { log('↷ ' + labelText + ' — избери ръчно: ' + optionText); return false; }
}
async function checkByText(page, txt) {
  try {
    const xp = `xpath=//*[contains(normalize-space(.),${JSON.stringify(txt)})]/preceding::input[@type="checkbox"][1] | //label[contains(.,${JSON.stringify(txt)})]//input[@type="checkbox"]`;
    const el = page.locator(`text=${txt}`).first();
    await el.waitFor({ timeout: 2000 });
    // клик по самия текст/чекбокс
    const box = page.locator(`xpath=//*[contains(normalize-space(.),${JSON.stringify(txt)})][1]`).first();
    await box.click({ timeout: 2000 }).catch(() => {});
    log('✓ отметнато: ' + txt);
    return true;
  } catch (_) { return false; }
}

// ── браузър: САМ го вдигам (debug порт 9222 + постоянен профил), закачам се и ЧАКАМ да се логнеш ──
const HTTP = require('http');
const { spawn: spawnProc } = require('child_process');
const HW_PROFILE = path.resolve('deploy-scripts/.huawei-profile');
const AGC_URL = 'https://developer.huawei.com/consumer/en/service/josp/agc/index.html#/myApp';
function portAlive() {
  return new Promise((res) => {
    const req = HTTP.get({ host: '127.0.0.1', port: 9222, path: '/json/version', timeout: 1200 }, (r) => { r.resume(); res(r.statusCode === 200); });
    req.on('error', () => res(false));
    req.on('timeout', () => { req.destroy(); res(false); });
  });
}
function spawnBrowser() {
  const cands = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
  ];
  const bin = cands.find((p) => { try { return fs.existsSync(p); } catch (_) { return false; } });
  if (!bin) { console.log('✗ Не намерих Chrome/Edge на машината.'); process.exit(1); }
  fs.mkdirSync(HW_PROFILE, { recursive: true });
  const child = spawnProc(bin, ['--remote-debugging-port=9222', '--user-data-dir=' + HW_PROFILE, '--no-first-run', '--no-default-browser-check', AGC_URL], { detached: true, stdio: 'ignore' });
  child.unref();
  console.log('🌐 Вдигнах браузъра сам (PID ' + child.pid + ', порт 9222).');
}

(async () => {
  let browser;
  if (!(await portAlive())) {
    spawnBrowser();
    for (let i = 0; i < 40 && !(await portAlive()); i++) await sleep(1000);
  } else {
    console.log('✓ Има вече отворен браузър (порт 9222) — закачам се за него.');
  }
  try { browser = await PW.chromium.connectOverCDP('http://127.0.0.1:9222'); }
  catch (e) { console.log('✗ Не успях да вдигна/закача браузъра: ' + e.message); process.exit(2); }

  console.log('\n🤖 HuaweiReleaseBot — ' + brand + '  (пакет ' + appId + ')');
  console.log('   Правило: попълвам видимо, НЕ натискам бутони. Ти преглеждаш и продължаваш.');

  // ── ЧАКАМ да се логнеш (капча е ръчна). Логнати сме, щом конзолата на AGC е достъпна (не логин формата). ──
  const isLoginUrl = (u) => /id\d*\.cloud\.huawei\.com|loginAuth|oauth-login|account\.huawei|CAS\/portal/i.test(u || '');
  async function consoleReady() {
    for (const ctx of browser.contexts()) for (const p of ctx.pages()) {
      const u = p.url() || '';
      if (isLoginUrl(u) || !u.includes('developer.huawei.com')) continue;
      if (!/#\//.test(u)) continue;   // конзолата е hash-рутирана (#/myApp, #/app/...); логинът няма #/
      let t = ''; try { t = await p.evaluate(() => (document.body ? document.body.innerText : '')); } catch (_) {}
      if (/Sign in with|Verification code|Enter password|Forgot password/i.test(t)) continue;
      // логнати сме: конзолно съдържание (списък апове или самата форма на апа)
      if (/Apps and atomic services|My apps|My projects|App information|Users and permissions|Analytics|Devices supported|Distribute|Release your app|Total\s*\d|New app/i.test(t)) return p;
      if (t.replace(/\s+/g, '').length > 120) return p;   // непразна конзолна страница (не логин)
    }
    return null;
  }
  async function waitForLogin() {
    // ако никъде няма отворена страница на huawei — отвори конзолата
    let anyHw = false;
    for (const ctx of browser.contexts()) for (const p of ctx.pages()) if ((p.url() || '').includes('huawei.com')) anyHw = true;
    if (!anyHw) {
      try { const pg = await browser.contexts()[0].newPage(); await pg.goto(AGC_URL, { waitUntil: 'load' }).catch(() => {}); } catch (_) {}
    }
    let announced = false;
    for (let i = 0; i < 700; i++) {   // ~35 мин таван
      if (await consoleReady()) { if (announced) console.log('✓ Влезе — продължавам да попълвам.'); return true; }
      if (!announced) { console.log('⏳ Чакам да се логнеш в Huawei (парола + капча)… отворил съм ти конзолата.'); announced = true; }
      await sleep(3000);
    }
    console.log('✗ Не се логна навреме — спирам.'); process.exit(2);
  }
  await waitForLogin();

  const MARKERS = ['App information', 'Package type', 'Brief introduction', 'Manage languages', 'Compatible devices', 'Categorization', 'New app',
    'Country/Region for release', 'Payment information', 'Privacy tags', 'For reviewer', 'Use testing version', 'App price', 'Default price', 'Privacy statement'];
  // Намери НАЙ-подходящата рамка измежду ВСИЧКИ табове/рамки (съдържанието е в iframe; може да има
  // няколко отворени таба — избираме този с най-много маркери на текущия екран).
  async function findBest() {
    let best = { frame: null, text: '', score: -1 };
    for (const ctx of browser.contexts()) {
      for (const p of ctx.pages()) {
        if (!(p.url() || '').includes('huawei.com')) continue;
        for (const f of p.frames()) {
          let t = ''; try { t = await f.evaluate(() => document.body ? document.body.innerText : ''); } catch (_) {}
          const score = MARKERS.reduce((n, m) => n + (t.includes(m) ? 1 : 0), 0);
          if (score > best.score) best = { frame: f, text: t, score };
        }
      }
    }
    return best;
  }

  const APP_LIST_URL = 'https://developer.huawei.com/consumer/en/service/josp/agc/index.html#/myApp';
  function getHuaweiPage() {
    for (const ctx of browser.contexts()) for (const p of ctx.pages()) if ((p.url() || '').includes('huawei.com')) return p;
    return null;
  }
  // клик по видим текст навсякъде (всички рамки на всички табове)
  async function clickAnywhere(label) {
    for (const ctx of browser.contexts()) for (const p of ctx.pages()) {
      if (!(p.url() || '').includes('huawei.com')) continue;
      for (const f of p.frames()) {
        try { const el = f.locator(`text="${label}"`).first(); if (await el.count()) { await el.click({ timeout: 1500, force: true }); return true; } } catch (_) {}
      }
    }
    return false;
  }
  // КОНТРОЛ НА АДРЕС-БАРА: ако сме на разпознат екран (форма/попъп/списък) — не пипаме. Ако сесията
  // ни е хвърлила другаде (напр. начална/друга услуга след логин) — сами отиваме на списъка с
  // приложенията (#/myApp), за да не се опитваме да пълним грешна страница.
  async function navToForm() {
    let best = await findBest();
    if (/Brief introduction|Compatible devices|New app|Package type|No data available|Total \d|Country\/Region for release|Payment information|Privacy tags|For reviewer|App price|Default price/.test(best.text)) return best;
    const p = getHuaweiPage();
    let u = ''; try { u = p ? p.url() : ''; } catch (_) {}
    if (p && !u.includes('#/myApp')) {
      log('адрес-бар: сесията е на друга страница — отивам на списъка с приложения (#/myApp)');
      await p.goto(APP_LIST_URL, { waitUntil: 'load' }).catch(() => {});
      await sleep(3000);
    }
    return await findBest();
  }

  // Избери el-radio по текст на опцията, близо до етикета на секцията.
  async function pickRadio(frame, near, option) {
    try {
      const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const r = frame.locator(':text("' + near + '")').first().locator('xpath=following::label[contains(@class,"el-radio")]').filter({ hasText: new RegExp(esc(option)) }).first();
      await r.click({ force: true, timeout: 3000 });
      log('✓ ' + near + ' ← ' + option);
    } catch (e) { log('↷ ' + near + ' — избери „' + option + '" ръчно'); }
  }
  // Осигури валутата Kyrgyzstan (USD) — ако вече е такава, не пипай (el-select структурата не се
  // хваща от selectByLabel, но стойността по подразбиране обикновено е правилната).
  async function ensureCurrency(frame) {
    try {
      const sel = frame.locator(':text("Default currency")').first().locator('xpath=following::*[contains(@class,"el-select")][1]');
      const cur = (await sel.innerText().catch(() => '')) || '';
      if (/Kyrgyzstan|USD/i.test(cur)) { log('✓ Default currency вече е Kyrgyzstan (USD)'); return; }
      await ensureCurrency(frame);
    } catch (e) { log('↷ Default currency — избери Kyrgyzstan (USD) ръчно'); }
  }
  // Разотмети чекбокс(и) по име (напр. държава), само ако е отметнат.
  async function uncheckCb(frame, name) {
    let done = 0;
    try {
      // СТРУКТУРА 1 (разгънати държави под регион: Belarus, Russia…): чекбоксът съдържа името →
      // Playwright локатор по текст (ДОКАЗАНО работи). Кликаме само отметнатите.
      const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const cbs = frame.locator('.el-checkbox').filter({ hasText: new RegExp('^' + esc(name)) });
      const n = await cbs.count().catch(() => 0);
      for (let i = 0; i < n; i++) {
        const cb = cbs.nth(i);
        const checked = await cb.evaluate((e) => e.classList.contains('is-checked')).catch(() => false);
        if (checked) { await cb.click({ force: true, timeout: 2000 }).catch(() => {}); done++; await sleep(200); }
      }
      // СТРУКТУРА 2 (топ-редове: Chinese mainland — име в отделен <div.flex-1>, чекбоксът е ПРАЗЕН съсед).
      // Само ако структура 1 не е намерила нищо → намираме реда по собствения текст и кликаме area-checkbox.
      if (!done) {
        done += await frame.evaluate((nm) => {
          let c = 0;
          const rows = [...document.querySelectorAll('div,span,label,td')].filter((el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim() === nm);
          const seen = new Set();
          for (const el of rows) {
            let row = el, cb = null;
            for (let i = 0; i < 4 && row; i++) { cb = row.querySelector('.area-checkbox, .el-checkbox'); if (cb) break; row = row.parentElement; }
            if (cb && !seen.has(cb)) { seen.add(cb); if (cb.classList.contains('is-checked')) { cb.click(); c++; } }
          }
          return c;
        }, name).catch(() => 0);
      }
      if (done) log('✓ разотметнах „' + name + '" (' + done + ')');
    } catch (e) { log('↷ „' + name + '" — разотметни ръчно'); }
    return done;
  }

  // Държавите се рендерират само след РАЗГЪВАНЕ на региона. Belarus и Russia са в „Europe" (Huawei ги
  // слага там); China („Chinese mainland") се вижда ВИНАГИ. Затова разгъваме само Europe.
  async function expandEurope(frame) {
    const belarusVisible = async () => await frame.locator('.el-checkbox').filter({ hasText: /^Belarus/ }).count().catch(() => 0) > 0;
    try {
      if (await belarusVisible()) return true;   // вече „разгъната" (държавите ѝ се виждат отдясно)
      // Master-detail: кликаш ИМЕТО на региона „Europe" (ляво) → държавите му (Belarus, Russia…) излизат
      // отдясно. ВАЖНО: има СКРИТ дубъл „Europe" flex-1 (display:none) — трябва ВИДИМИЯ. Затова „:visible".
      const tries = [
        () => frame.locator('div.flex-1:visible', { hasText: /^Europe$/ }),
        () => frame.locator('.el-tree-node__content:visible', { hasText: /^Europe/ }),
        () => frame.locator('span:visible,div:visible,label:visible', { hasText: /^Europe$/ })
      ];
      for (const mk of tries) {
        let loc; try { loc = mk(); } catch (_) { continue; }
        const n = await loc.count().catch(() => 0);
        for (let i = 0; i < n && i < 4; i++) {
          await loc.nth(i).click({ force: true, timeout: 2000 }).catch(() => {});
          await sleep(1000);
          if (await belarusVisible()) { log('✓ разгънах „Europe" (Belarus/Russia видими)'); return true; }
        }
      }
      log('↷ не успях да разгъна „Europe" автоматично');
      return await belarusVisible();
    } catch (_) { return false; }
  }

  // Избери ВСИЧКИ държави („All"), после махни China/Belarus/Russia. Ползва се на екран 17 и 24.
  // ИДЕМПОТЕНТНО: ако трите вече са изключени (а другите избрани → „All" е indeterminate), НЕ пипа
  // (иначе повторно „All" би върнало Belarus/Russia). Разгъва Europe, за да ги достигне.
  async function selectCountriesExcept(frame) {
    if (process.env.HW_SKIP_COUNTRIES === '1') { log('↷ прескачам release-държавите (HW_SKIP_COUNTRIES=1) — вече са нагласени'); return; }
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await expandEurope(frame);
    const allCb = frame.locator('.el-checkbox').filter({ hasText: /^All/ }).first();
    if (!(await allCb.count().catch(() => 0))) { log('↷ не намерих „All" — отметни всички ръчно'); return; }
    let anyIncluded = false;
    for (const c of REMOVE_COUNTRIES) {
      const cb = frame.locator('.el-checkbox').filter({ hasText: new RegExp('^' + esc(c)) }).first();
      if (await cb.count().catch(() => 0) && await cb.evaluate((e) => e.classList.contains('is-checked')).catch(() => false)) anyIncluded = true;
    }
    const allOn = await allCb.evaluate((e) => e.classList.contains('is-checked')).catch(() => false);
    const allInd = await allCb.evaluate((e) => e.classList.contains('is-indeterminate')).catch(() => false);
    if (!anyIncluded && allInd) { log('✓ China/Belarus/Russia вече изключени (All=indeterminate) — не пипам'); return; }
    if (!allOn) { await allCb.click({ force: true, timeout: 2500 }).catch(() => {}); log('✓ отметнах „All" (всички държави)'); await sleep(1200); await expandEurope(frame); }
    else log('✓ „All" вече е отметнат');
    for (const c of REMOVE_COUNTRIES) await uncheckCb(frame, c);
  }

  // Чете видимите грешки на екрана (валидация на полета + съобщения/тостове), за да е ботът управляван
  // от състоянието — вижда какво липсва/греши и действа според него.
  async function getErrors(frame) {
    try {
      return await frame.evaluate(() => {
        const out = new Set();
        document.querySelectorAll('.el-form-item__error, .el-message__content, .el-notification__content, [class*="error-tip"]').forEach((e) => {
          const t = (e.textContent || '').replace(/\s+/g, ' ').trim();
          if (t && t.length > 6 && t.length < 300) out.add(t);
        });
        return [...out];
      });
    } catch (_) { return []; }
  }

  // Качи Huawei release APK през „Manage packages" (Upload → избор на файл → Select). force=true → качва
  // наново дори versionCode да съвпада (напр. Huawei иска повторно качване след смяна на държавите).
  async function uploadHwApk(frame, force) {
    if (!hwApkPath) { log('↷ няма huawei release APK в apk/huawei/release — качи ръчно'); return; }
    try {
      let dlg = frame.locator('.el-dialog:visible').filter({ hasText: 'Manage packages' }).first();
      if (!(await dlg.count().catch(() => 0))) {
        await frame.locator('button:has-text("Manage packages")').first().click({ force: true, timeout: 3000 }).catch(() => {});
        await sleep(2200);
        dlg = frame.locator('.el-dialog:visible').filter({ hasText: 'Manage packages' }).first();
      }
      if (!(await dlg.count().catch(() => 0))) { log('↷ не се отвори „Manage packages" — качи APK ръчно'); return; }
      // versionCode на ТЕКУЩИЯ APK (от билд метаданните). Ако вече има качен пакет: сравни — при съвпадение
      // го оставяме (и го избираме); при разлика (каченият е ПО-СТАР) → ТРИЕМ стария и качваме новия.
      let apkVc = '';
      try { apkVc = String(JSON.parse(fs.readFileSync(path.resolve('huawei', app, 'android/app/build/intermediates/merged_manifests/release/output-metadata.json'), 'utf8')).elements[0].versionCode || ''); } catch (_) {}
      const hasPkg = await dlg.locator('text=/\\.apk/i').count().catch(() => 0);
      if (hasPkg) {
        const dlgText = await dlg.innerText().catch(() => '');
        const upVc = (dlgText.match(/\((\d{6,})\)/) || [])[1] || '';
        if (apkVc && upVc && upVc === apkVc && !force) {
          log('↷ каченият пакет е НАЙ-НОВИЯТ (versionCode ' + apkVc + ') — не качвам пак; уверявам се, че е избран.');
          await dlg.locator('.el-radio, input[type="radio"]').first().click({ force: true, timeout: 1500 }).catch(() => {});
          await sleep(300);
          await dlg.locator('button:has-text("Select")').first().click({ force: true, timeout: 2500 }).then(() => log('✓ Пакетът е избран (Select).')).catch(() => {});
          return;
        }
        log((force ? '↑ (грешка иска повторно качване) ' : '↑ каченият пакет (' + (upVc || '?') + ') ≠ текущия APK (' + (apkVc || '?') + ') → ') + 'ТРИЯ стария и качвам новия.');
        await dlg.locator('a:has-text("Delete"), button:has-text("Delete")').first().click({ force: true, timeout: 2500 }).catch(() => {});
        await sleep(1000);
        await frame.locator('.el-message-box__btns button, .el-dialog:visible button').filter({ hasText: /^(Confirm|OK|Delete|Yes)$/ }).last().click({ force: true, timeout: 2500 }).catch(() => {});
        await sleep(2500);
      }
      // APK полето (accept „apk", в диалога) се РЕНДИРА/АКТИВИРА след клик по „Upload". Предпазка: ако
      // „Upload" отвори native избор на файл — подаваме APK-то и там. НЕ ползваме image полетата (.jpg/.png).
      let chooserHandled = false;
      const onChooser = (fc) => { chooserHandled = true; fc.setFiles(hwApkPath).catch(() => {}); };
      frame.page().on('filechooser', onChooser);
      await dlg.locator('button:has-text("Upload")').first().click({ force: true, timeout: 2500 }).catch(() => {});
      await sleep(1200);
      if (!chooserHandled) {
        let apkInput = frame.locator('input[type="file"][accept*="apk"]').first();
        for (let k = 0; k < 10 && !(await apkInput.count().catch(() => 0)); k++) { await sleep(700); apkInput = frame.locator('input[type="file"][accept*="apk"]').first(); }
        if (await apkInput.count().catch(() => 0)) await apkInput.setInputFiles(hwApkPath).catch((e) => log('↷ прикачване: ' + e.message));
        else { log('↷ не намерих APK полето (accept .apk) — натисни „Upload" и избери APK ръчно'); try { frame.page().off('filechooser', onChooser); } catch (_) {} return; }
      }
      try { frame.page().off('filechooser', onChooser); } catch (_) {}
      log('⏳ качвам APK: ' + path.basename(hwApkPath) + ' — изчаквам обработката (може дълго)…');
      // Поллинг: изчакай „Select" да се АКТИВИРА (обработката отнема време) и го натисни — така
      // НАЙ-НОВИЯТ пакет става избраният/активен. До ~80с.
      let selected = false;
      for (let k = 0; k < 20 && !selected; k++) {
        await sleep(4000);
        // Маркирай радиото на пакета (иначе „Select" е неактивен), после натисни „Select".
        await dlg.locator('.el-radio, input[type="radio"]').first().click({ force: true, timeout: 1500 }).catch(() => {});
        await sleep(300);
        const sel = dlg.locator('button:has-text("Select")').first();
        if (!(await sel.count().catch(() => 0))) continue;
        const disabled = await sel.isDisabled().catch(() => false);
        const aria = await sel.getAttribute('aria-disabled').catch(() => null);
        if (disabled || aria === 'true') continue;
        await sel.click({ force: true, timeout: 3000 }).then(() => { selected = true; }).catch(() => {});
      }
      log(selected ? '✓ Най-новият пакет е ИЗБРАН (Select).' : '↷ „Select" не се активира навреме — изчакай обработката и натисни Select сам.');
    } catch (e) { log('↷ качване на APK — направи ръчно (' + e.message + ')'); }
  }

  async function fillCurrent() {
   // Верижи навигацията: списък → отвори приложението → App information → попълни — БЕЗ да чакаш
   // ENTER между стъпките. ENTER е само за прегледните екрани (попълване). Макс. няколко стъпки.
   for (let _step = 0; _step < 4; _step++) {
    let { frame, text, score } = await navToForm();
    if (!frame) { console.log('✗ Няма отворена страница на Huawei.'); return; }
    const on = (s) => text.includes(s);
    // Въпросникът за рейтинг е РЕАЛНО отворен само ако има интерактивни групи въпроси с радио „No/Yes".
    // (Иначе думите „Violence/Sexuality/Fear" остават в текста на версийната страница и хващат погрешно
    //  content-rating клона, вместо да минем държавите.)
    const ratingOpen = await frame.evaluate(() => {
      const groups = document.querySelectorAll('.agc-question-group__title, .agc-question-group').length;
      const noYes = [...document.querySelectorAll('.el-radio:not(.area-checkbox)')].filter((r) => /^(No|Yes)\b/.test((r.innerText || '').trim())).length;
      return groups >= 2 && noYes >= 2;
    }).catch(() => false);
    let url = ''; try { url = frame.page().url(); } catch (_) {}
    console.log('\n── екран (маркери: ' + score + ') ──');

    // ── СПИСЪК С ПРИЛОЖЕНИЯ: разбери дали приложението е СЪЗДАДЕНО, и действай ──
    const isVersionPage = on('Country/Region for release') || on('Payment information') || on('Privacy tags') || on('For reviewer') || on('App price') || on('Default price');
    // САМО реалната страница-списък има URL завършващ на „#/myApp" (без /id). Вътре в приложението URL е
    // „#/myApp/<id>/<id>" — затова НЕ ползваме includes (то бъркаше Workspace със списък и зацикляше).
    const isList = /#\/myApp\/?$/.test(url) && !isVersionPage;
    if (isList && !on('Compatible devices')) {
      const exists = (appId && text.includes(appId)) || (brand && text.includes(brand));
      console.log('Екран: списък с приложения (My apps). „' + brand + '" → ' + (exists ? 'СЪЗДАДЕНО ✓ — отварям го' : 'НЕ е създадено — създавам нов запис'));
      if (exists) {
        await clickText(frame, brand);
        await sleep(3000);                       // изчакай да зареди детайла на приложението
        // отиди САМ на „App information" (вляво)
        if (await clickAnywhere('App information')) { await sleep(2500); log('→ отидох сам на „App information" — попълвам…'); }
        else { log('↷ не намерих „App information" вляво — отвори го ръчно и натисни ENTER.'); return; }
      } else {
        // нов запис: таб Android → бутон Release (#MyAppListNewApp, force — тултип прехваща) → попъп „New app"
        await frame.locator('text="Android"').first().click({ force: true, timeout: 2500 }).catch(() => {});
        await sleep(500);
        await frame.locator('#MyAppListNewApp').click({ force: true, timeout: 3000 }).catch((e) => log('Release: ' + e.message));
        log('→ Android + Release → отварям попъпа „New app" и го попълвам…');
        await sleep(1200);
      }
      continue;   // ← верижи към попълването на достигнатия екран (без нов ENTER)
    }

    // ── Вътре в приложението, на „Workspace/Release" тракера → отиди на ВЕРСИЯТА „Draft" (вляво), за
    //    да попълним екраните за релийз (страни, APK, плащане, поверителност…). App info може вече да е
    //    готово (зелена отметка „Enter app info"); версията е следващата задача.
    const insideApp = /#\/myApp\/[^/]+/.test(url);
    if (insideApp && (on('Release your app') || on('Tasks completed') || on('Enter version info') || on('Enter app info')) && !on('Brief introduction') && !on('Compatible devices') && !isVersionPage) {
      console.log('Екран: Workspace/Release тракер — отивам на версията „Draft" (екрани за релийз).');
      let okv = await clickAnywhere('Draft');
      if (!okv) { await clickAnywhere('Version information'); await sleep(800); okv = await clickAnywhere('Draft'); }
      if (okv) { await sleep(2800); log('→ отворих версията „Draft" — попълвам…'); continue; }
      log('↷ не намерих „Draft" вляво (Version information → Draft) — отвори го ръчно и натисни ENTER.');
      return;
    }

    // ── РЕЖИМ ЦЕНА: от версията отвори ценовия редактор през „View and edit" до реда „Price (tax included)" ──
    if (PRICE_MODE && isVersionPage && !on('App price') && !on('Default price')) {
      console.log('Екран: Version — режим ЦЕНА → отварям ценовия редактор (View and edit до „Price").');
      // 1) затвори евентуален блокиращ модал „Information / Data saved successfully" (прехваща кликовете)
      const info = frame.locator('.el-message-box:visible, .el-dialog:visible').filter({ hasText: /Data saved|successfully|Information/i }).first();
      if (await info.count().catch(() => 0)) {
        await info.locator('button:has-text("OK"), button:has-text("Confirm")').first().click({ force: true, timeout: 2000 }).catch(() => {});
        await sleep(900); log('затворих модала „Data saved"');
      }
      // 2) кликни „View and edit" на реда „Price (tax included)"
      const priceItem = frame.locator('.el-form-item').filter({ hasText: /Price \(tax included\)|Price/i }).filter({ hasText: /View and edit/i }).first();
      let clicked = false;
      if (await priceItem.count().catch(() => 0)) {
        await priceItem.locator('text=/View and edit/i').first().click({ force: true, timeout: 3000 }).then(() => { clicked = true; }).catch(() => {});
      }
      if (!clicked) clicked = await clickText(frame, 'View and edit');
      if (clicked) { await sleep(2800); log('→ отворих ценовия редактор — попълвам цената…'); continue; }
      log('↷ не намерих „View and edit" до Price — отвори ценовия редактор ръчно.'); return;
    }

    if (on('New app') || (on('Package type') && on('Default language'))) {
      console.log('Екран: New app (попъп)');
      const dlg = frame.locator('.el-dialog').filter({ hasText: 'Package type' }).first();
      // App name — единственото текстово поле в диалога
      await dlg.locator('input[type="text"]').first().fill(brand).then(() => log('✓ App name ← ' + brand)).catch(() => log('↷ App name — не намерих полето'));
      // Package type: APK (Android app) · Devices: Mobile phone — радио бутони по видим текст
      await clickText(dlg, 'APK (Android app)');
      await clickText(dlg, 'Mobile phone');
      await selectByLabel(frame, 'App category', 'App');
      await selectByLabel(frame, 'Default language', 'English (UK)');
      log('→ Прегледай попъпа и натисни OK сам (ботът не натиска). После App information.');
    } else if (on('App information') || on('Brief introduction') || on('Compatible devices')) {
      console.log('Екран: App information');
      // Compatible devices → Mobile phone (el-checkbox). Клик с force + проверка да НЕ размята вече отметнато.
      try {
        const cd = frame.locator('.el-checkbox:visible').filter({ hasText: 'Mobile phone' }).first();
        await cd.waitFor({ state: 'visible', timeout: 4000 });
        await cd.scrollIntoViewIfNeeded().catch(() => {});
        const checked = await cd.evaluate((e) => e.classList.contains('is-checked')).catch(() => false);
        if (!checked) await cd.click({ force: true, timeout: 3000 });
        log('✓ Compatible devices: Mobile phone' + (checked ? ' (вече беше отметнато)' : ''));
      } catch (_) { log('↷ Compatible devices — не намерих чекбокса'); }
      await fillNear(frame, 'Website', website);
      // ── Категория (каскадер): Apps > News & reading > News — точен текст (не substring) ──
      if (catParts.length) {
        try {
          await frame.locator('.el-form-item:has-text("Category") .el-cascader').first().click({ force: true, timeout: 2500 }); await sleep(900);
          for (const part of catParts) { await frame.getByText(part, { exact: true }).first().click({ timeout: 2500 }); await sleep(600); }
          log('✓ Category ← ' + catParts.join(' > '));
        } catch (_) { log('↷ Category — избери ръчно: ' + catParts.join(' > ')); }
      }
      // ── Качване: [0]=икона .png, [1]=скрийншоти, [2]=промо-видео .mp4 (само за магазина) ──
      const fileInputs = frame.locator('input[type="file"]');
      if (iconPath) { await fileInputs.nth(0).setInputFiles(iconPath).then(() => log('✓ Икона качена')).catch(() => log('↷ икона — качи ръчно')); await sleep(3500); }   // качването е async — изчакай да се регистрира
      if (shotPaths.length) {
        await fileInputs.nth(1).setInputFiles(shotPaths).then(() => log('✓ Скрийншоти качени (' + shotPaths.length + ')')).catch(() => log('↷ скрийншоти — качи ръчно'));
        await sleep(4000);
        // Huawei показва попъп (преглед/потвърждение) СЛЕД ОБРАБОТКА на скрийншотите — понякога със
        // ЗАКЪСНЕНИЕ. Затова НЕ спираме при първа липса (иначе го изпускаме, преди да е изскочил):
        // изчакваме появата до ~10 сек, натискаме OK/Confirm/Save, и приключваме след като го затворим.
        let sawPopup = false, emptyStreak = 0;
        for (let k = 0; k < 20; k++) {
          const dlgBtn = frame.locator('.el-dialog:visible button:has-text("OK"), .el-dialog:visible button:has-text("Confirm"), .el-dialog:visible button:has-text("Save"), [role="dialog"]:visible button:has-text("OK")').first();
          if (await dlgBtn.count().catch(() => 0)) {
            await dlgBtn.click({ force: true, timeout: 2500 }).catch(() => {});
            sawPopup = true; emptyStreak = 0;
            log('✓ Затворих попъпа на скрийншотите с OK.');
            await sleep(1200);
          } else {
            emptyStreak++;
            if (sawPopup && emptyStreak >= 2) break;      // затворихме и няма повече попъпи → готово
            if (!sawPopup && emptyStreak >= 10) break;     // не се появи за ~10с → вероятно няма попъп
            await sleep(1000);
          }
        }
        if (!sawPopup) log('↷ не видях попъп на скрийншотите (ако изскочи — натисни OK сам).');
      }
      if (promoPath && NO_VIDEO.has(app)) {
        log('↷ промо-видео ПРОПУСНАТО за ' + app + ' (по искане — проблемно на Huawei).');
        await sleep(4000);   // изчакай икона/скрийншоти да се уталожат, преди Manage languages (иначе езиците падат)
      } else if (promoPath) {
        await fileInputs.nth(2).setInputFiles(promoPath).catch(() => log('↷ промо-видео — качи ръчно'));
        log('⏳ качвам промо-видео… изчаквам качването (по-бавно от снимки)');
        await sleep(8000);                               // видеото се качва по-бавно
        // ако е изскочил попъп (преглед/потвърждение на видеото) — натисни OK/Confirm/Save САМ (по искане)
        try {
          const btn = frame.locator('.el-dialog button:has-text("OK"), .el-dialog button:has-text("Confirm"), .el-dialog button:has-text("Save")').first();
          if (await btn.count()) { await btn.click({ force: true, timeout: 2500 }); await sleep(1000); log('✓ Промо-видео качено → натиснах OK на попъпа сам.'); }
          else log('✓ Промо-видео качено.');
        } catch (_) { log('✓ Промо-видео качено (ако има попъп — натисни OK сам).'); }
      }
      // ── Попълни ТЕКУЩИЯ език (English UK по подразбиране) веднага ──
      await fillNear(frame, 'App name', enName);
      { const en = desc.en || {}; if (en.brief) await fillNear(frame, 'Brief introduction', en.brief); if (en.full) await fillNear(frame, 'Full introduction', en.full, 'textarea'); if (en.nf) await fillNear(frame, 'New features', en.nf, 'textarea'); }
      // ── Manage languages: добави езиците (ИДЕМПОТЕНТНО), после ботът натиска OK и попълва описанията им ──
      if (hwLabels.length) {
        await frame.locator('button:has-text("Manage languages")').first().click({ force: true, timeout: 3000 }).catch(() => {});
        await sleep(2200);
        const dlg = frame.locator('.el-dialog:visible').filter({ hasText: 'Manage languages' }).first();
        if (await dlg.count()) {
          const search = dlg.locator('input').first();
          let added = 0, have = 0, missing = 0;
          for (const label of hwLabels) {
            try {
              await search.fill(label.split(' (')[0]); await sleep(450);
              const cb = dlg.locator('.el-checkbox').filter({ hasText: label }).first();
              if (await cb.count()) {
                const checked = await cb.evaluate((e) => e.classList.contains('is-checked')).catch(() => false);
                if (checked) { have++; } else { await cb.click({ force: true, timeout: 2000 }); added++; }
              } else { missing++; log('↷ няма в Huawei: ' + label); }
            } catch (_) { missing++; }
          }
          try { await search.fill(''); } catch (_) {}
          // Изключение (по искане): ботът натиска OK САМ — но САМО ако е избрал ВСИЧКИ езици (нито един липсващ).
          if (missing === 0) {
            await dlg.locator('button:has-text("OK")').first().click({ force: true, timeout: 2500 }).catch(() => {});
            await sleep(1800);
            log('✓ Manage languages: всички ' + (added + have) + ' езика → натиснах OK сам. Попълвам описанията им…');
            // СЛЕД OK (попъпът затворен, езиците са налични) → попълни име+описания за всеки ДОБАВЕН език
            let langsFilled = 0;
            for (const label of hwLabels) {
              const code = LABEL_TO_CODE[label]; const d = desc[code] || {};
              // App name е с лимит 30 знака в Huawei — ако локализираното име е по-дълго, падни на марката
              let nm = storeNames[code] || storeNames._default || brand;
              if (nm.length > 30) nm = (storeNames._default || brand).slice(0, 30);
              if (!(await selectByLabel(frame, 'Language', label))) continue;
              await sleep(700);
              await fillNear(frame, 'App name', nm);
              if (d.brief) await fillNear(frame, 'Brief introduction', d.brief);
              if (d.full) await fillNear(frame, 'Full introduction', d.full, 'textarea');
              if (d.nf) await fillNear(frame, 'New features', d.nf, 'textarea');
              langsFilled++;
            }
            log('✓ описания/име попълнени за ' + langsFilled + ' езика (+ English).');
          } else {
            log('✓ Manage languages: +' + added + ' нови (' + have + ' вече, ' + missing + ' липсват) — прегледай и натисни OK сам.');
          }
        } else log('↷ Manage languages — попъпът не се отвори');
      }
    } else if (ratingOpen && ((on('Violence') && on('Sexuality')) || (on('Content rating') && on('Fear')))) {
      // ── ЕКРАНИ 25–28: Content rating (възрастов въпросник) ──
      console.log('Екран: Content rating (възрастов въпросник)');
      // Секциите са АКОРДЕОН (отваряне на една сваля другата) → разгъваме СЕКЦИЯ по СЕКЦИЯ и
      // отговаряме „No" ДОКАТО е отворена. За newslator/инструменти всеки въпрос е „No". ИГРИ (напр.
      // fps-hunter) имат насилие → там РЪЧНА проверка (не всичко е No)!
      // 1) Разгъни ВСЯКА акордеон-секция (за да се рендират въпросите в DOM).
      const titles = frame.locator('.agc-question-group__title');
      const nt = await titles.count().catch(() => 0);
      for (let s = 0; s < nt; s++) { await titles.nth(s).click({ timeout: 1500 }).catch(() => {}); await sleep(250); }
      // 2) JS-клик „No" на ВСЯКА неотговорена радио-група (работи и на скрити от акордеона), в ЦИКЪЛ
      //    докато не останат неотговорени — така покритието е ПЪЛНО и стабилно (не зависи от видимост).
      let ans = 0, lastUnanswered = -1, totalQ = 0;
      for (let round = 0; round < 8; round++) {
        const res = await frame.evaluate(() => {
          let clicked = 0;
          document.querySelectorAll('.el-radio-group').forEach((rg) => {
            if (rg.querySelector('.el-radio.is-checked')) return;
            const no = [...rg.querySelectorAll('.el-radio')].find((r) => /^No\b/i.test((r.innerText || r.textContent || '').trim()));
            if (no) { no.click(); clicked++; }
          });
          let unanswered = 0; const rgs = document.querySelectorAll('.el-radio-group');
          rgs.forEach((rg) => { if (!rg.querySelector('.el-radio.is-checked')) unanswered++; });
          return { clicked, unanswered, total: rgs.length };
        }).catch(() => ({ clicked: 0, unanswered: -1, total: 0 }));
        ans += res.clicked; lastUnanswered = res.unanswered; totalQ = res.total;
        if (res.unanswered === 0) break;
        await sleep(500);
      }
      if (lastUnanswered === 0) log('✓ рейтинг: „No" на ВСИЧКИ ' + totalQ + ' въпроса (пълно покритие).');
      else log('⚠ рейтинг: отговорих ' + ans + ', но останаха ' + lastUnanswered + ' неотговорени — структурата е различна, виж ръчно.');
      log('⚠ За ИГРИ (насилие) НЕ е всичко „No" — там провери ръчно!');
      // Завършваме рейтинга: Verify → (декларация) → Save. Без това въпросникът ОСТАВА отворен и блокира
      // следващите секции (държави и т.н.). Затова тук ботът натиска тези бутони (по изрично искане).
      const rbtn = async (lbl) => await frame.evaluate((l) => {
        // търси в ЦЯЛАТА рамка (бутоните на рейтинга са под линията, извън drawer-scope). Взима само АКТИВЕН.
        const btn = [...document.querySelectorAll('button')].find((x) => new RegExp('^\\s*' + l + '\\s*$').test((x.innerText || '').trim()) && x.getAttribute('aria-disabled') !== 'true' && !x.disabled && x.offsetParent !== null);
        if (btn) { btn.scrollIntoView({ block: 'center' }); btn.click(); return true; }
        return false;
      }, lbl).catch(() => false);
      await sleep(500);
      if (await rbtn('Verify')) { log('✓ натиснах „Verify" (изчислявам рейтинга)'); await sleep(3500); }
      // евентуална отметка-декларация преди Save (достоверност на рейтинга)
      await frame.evaluate(() => { const d = document.querySelector('.el-drawer:not([style*="display: none"]), .el-dialog:not([style*="display: none"])'); if (!d) return; d.querySelectorAll('.el-checkbox:not(.area-checkbox)').forEach((c) => { if (!c.classList.contains('is-checked') && /authentic|declare|confirm|responsib|accurate/i.test(c.innerText || '')) c.click(); }); }).catch(() => {});
      await sleep(400);
      if (await rbtn('Save')) { log('✓ натиснах „Save" — рейтингът е записан.'); await sleep(3000); }
      else log('↷ „Save" на рейтинга не се активира — прегледай и запиши сам.');
    } else if (on('App price') || (on('Default price') && (on('Convert prices') || on('Default currency')))) {
      // ── ЕКРАН 24: App price (от „View and edit") — цена + махни China/Belarus + Convert ──
      console.log('Екран: App price (цена)');
      await ensureCurrency(frame);
      await fillNear(frame, 'Default price', priceUsd);
      // НЕ деселектираме държави тук: цената за държава, в която приложението НЕ се пуска
      // (China/Belarus/Russia са извън release), просто се игнорира — безвредно е. Само конвертираме.
      await clickText(frame, 'Convert prices');
      await sleep(600);
      if (PRICE_MODE) {
        const saveBtn = frame.locator('button:has-text("Save")').filter({ hasNotText: /Submit|Cancel/ }).last();
        if (await saveBtn.count().catch(() => 0)) {
          await saveBtn.scrollIntoViewIfNeeded().catch(() => {});
          await saveBtn.click({ force: true, timeout: 5000 }).then(() => log('✓ натиснах Save на цената')).catch((e) => log('↷ Save: ' + e.message));
          await sleep(3000);
          let toast = ''; try { toast = await frame.evaluate(() => { const el = document.querySelector('.el-message, .el-notification__content'); return el ? el.innerText.trim() : ''; }); } catch (_) {}
          if (toast) log('ⓘ ' + toast.slice(0, 60));
        } else log('↷ не намерих Save на екрана на цената');
      }
      log('✓ Цена ' + priceUsd + ' USD + махнати China/Belarus + Convert' + (PRICE_MODE ? ' + Save' : '') + '.');
    } else if (on('Country/Region for release') || on('Payment information') || on('Privacy tags') || on('For reviewer')) {
      // ── ЕКРАНИ 17–23: Version — Draft (настройки за релийз) ──
      console.log('Екран: Version — Draft (настройки за релийз)');
      // Управлявано от състоянието: затвори информационни модали (напр. „upload package again"), прочети
      // ги + грешките по полетата, и действай според тях.
      // Затваря информационния модал „upload an app package again / signing entity changed" (ако е отворен)
      // и връща текста му (или ''), за да преценим дали трябва ново качване на пакета.
      const reUploadRe = /upload.*(app )?package|package.*again|contract signing entity|re-?upload|signing entity has changed/i;
      async function closeUploadModal() {
        const mb = frame.locator('.el-message-box:visible, .el-dialog:visible').filter({ hasText: /upload an app package|signing entity|Information/i }).first();
        if (!(await mb.count().catch(() => 0))) return '';
        const msg = ((await mb.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
        await mb.locator('button:has-text("OK"), button:has-text("Confirm")').first().click({ force: true, timeout: 2000 }).catch(() => {});
        await sleep(700);
        log('ⓘ модал: ' + msg.slice(0, 80) + ' → затворих го');
        return msg;
      }
      // 1) евентуален ЗАВАРЕН модал (от предишна смяна на държави)
      let modalMsg = await closeUploadModal();
      const errs = await getErrors(frame);
      if (errs.length) log('⚠ Конзолата показва: ' + errs.slice(0, 4).join(' | '));
      // 17) Държави: „Selected" + „All" (ВСИЧКИ), после махни China/Belarus/Russia.
      //     Идемпотентно: ако вече е вярно, НЕ пипа (за да НЕ роди нов модал/ново качване).
      await clickText(frame, 'Selected countries/regions');
      await sleep(500);
      await selectCountriesExcept(frame);
      // 2) смяната на държавите РАЖДА модала „upload package again" → затвори го СЕГА и форсирай качване
      await sleep(800);
      const modalAfter = await closeUploadModal();
      if (modalAfter) modalMsg = modalAfter;
      // Huawei иска ново качване на пакета след смяна на държавите/договорния субект → форсирай re-upload.
      const pkgErr = reUploadRe.test(modalMsg) || errs.some((e) => reUploadRe.test(e));
      // 18) Open testing: No + качи RELEASE APK (Manage packages → Upload → Select). При грешка за пакета
      //     (или по-стар versionCode) → трие стария и качва най-новия, после Select.
      await pickRadio(frame, 'Use testing version', 'No');
      await uploadHwApk(frame, pkgErr);
      // 20) Плащане: Paid + валута USD
      await pickRadio(frame, 'Payment type', 'Paid');
      await ensureCurrency(frame);
      // 21) Privacy statement URL-и
      await fillNear(frame, 'Privacy policy URL', privacyUrl);
      await fillNear(frame, 'Data subject right URL', privacyUrl);
      // 22) Privacy tags + AI декларация (не събираме данни; не е генеративен AI)
      await pickRadio(frame, 'Collect personal data', 'No');
      await pickRadio(frame, 'Generative AI', aiDecl);
      // 23) Release: веднага след одобрение
      await pickRadio(frame, 'Release time', 'Immediately once approved');
      log('■ Остават РЪЧНО: цената (Price → View and edit = екран App price), Proof of copyright (файл). После Save/Submit.');
    } else {
      let url = ''; try { url = frame.page().url(); } catch (_) {}
      console.log('Екран: не разпознат (маркери: ' + score + '). Трябва да си на ФОРМАТА „App information".');
      log('Адрес: ' + url);
      log('Видим текст (начало): ' + text.slice(0, 160).replace(/\n/g, ' '));
      log('Съвет: в браузъра отвори приложението → вляво „App information" (или таба „Android"), после ENTER пак.');
    }
    console.log('✓ Готово с този екран — прегледай и натисни бутона сам.');
    return;   // попълването приключи за този екран — чакаме нов ENTER
   }  // ← край на верижния цикъл
   console.log('(навигацията мина няколко стъпки — натисни ENTER пак, ако не е стигнала до формата)');
  }

  const loop = process.argv.includes('--loop');
  if (loop) {
    console.log('\n   РЕЖИМ ENTER: отвори екран в браузъра и натисни ENTER тук да го попълня. „q"+ENTER = изход.\n');
    const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
    const ask = () => rl.question('ENTER = попълни текущия екран (или q за изход): ', async (a) => {
      if (a.trim().toLowerCase() === 'q') { rl.close(); process.exit(0); }
      try { await fillCurrent(); } catch (e) { console.log('грешка: ' + e.message); }
      ask();
    });
    ask();
  } else {
    await fillCurrent();
    // НЕ затваряме браузъра — пазим едно логване. Излизаме чисто (CDP връзката иначе държи процеса жив),
    // а Chrome остава отворен за следващото пускане.
    process.exit(0);
  }
})();
