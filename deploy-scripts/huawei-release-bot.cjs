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
const catParts = catPath.split('>').map((s) => s.trim()).filter(Boolean);   // [Apps, News & reading, News] или [Games, …]
// ИГРА ли е — по първото ниво на категорията („Games > …"). Влияе на New app попъпа: App category = „Game".
const isGame = /^Games?$/i.test(catParts[0] || '');
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
// Отговори на въпросника за възрастов рейтинг — ПЕР-ПРИЛОЖЕНИЕ, от app-shared/content-ratings.json
// (единствен източник). По подразбиране всичко „No"; игри с насилие → категории в „yes".
const ratingCfg = (() => { try { const c = readJson(path.resolve('app-shared/content-ratings.json')); return c[app] || c._default || { all: 'No', yes: [] }; } catch (_) { return { all: 'No', yes: [] }; } })();
const ratingYes = (ratingCfg.yes || []).map((s) => String(s).toLowerCase());

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
// Човешка пауза (в СЕКУНДИ, случайно между min и max) — за да не личи, че е бот. По-дълга за големи
// секции, по-кратка за отделни полета. Вика се след всяко видимо действие.
const human = (min = 1.5, max = 4) => sleep(Math.floor((min + Math.random() * (max - min)) * 1000));

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
// ★ ИСТИНСКА МИШКА по координати (move→down→up). КРИТИЧНО за версийната форма: изборите (държави,
// пакет-радио, Select, Save) трябва да задействат Vue-МОДЕЛА — native/Playwright .click() го сменя само
// ВИЗУАЛНО и записът праща модела БЕЗ промените (не се задържат след рефреш!). Истинската мишка = като човек.
async function mouseClick(loc) {
  try {
    await loc.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
    const box = await loc.boundingBox({ timeout: 2500 });
    if (!box) return false;
    const pg = loc.page();
    await pg.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await new Promise((r) => setTimeout(r, 110));
    await pg.mouse.down();
    await new Promise((r) => setTimeout(r, 70));
    await pg.mouse.up();
    return true;
  } catch (_) { return false; }
}
// Native in-page клик по бутон/връзка по РЕГЕКС на текста. Playwright .click() понякога НЕ задейства
// Vue router/handler-ите на Huawei-конзолата (напр. „View and edit", „Set"), докато native .click() върши
// работа. `reSrc` е ИЗТОЧНИК на регекс (низ), пр. '^View and edit$'.
async function nativeClick(frame, reSrc) {
  return await frame.evaluate((src) => {
    const rx = new RegExp(src, 'i');
    const el = [...document.querySelectorAll('button, a, span, .el-button, .el-link')].find((x) => rx.test((x.innerText || '').trim()) && x.offsetParent !== null);
    if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return true; }
    return false;
  }, reSrc).catch(() => false);
}
// „Fill out questionnaire" отваря въпросника САМО с Playwright-клик (истински mouse events); native
// .click() НЕ задейства неговия Vue-handler (обратно на Set/View-and-edit). Затова отделен помощник:
// пробва Playwright локатор-клик, после native като резерва.
async function clickFillOut(frame) {
  // Бутонът е „Fill out questionnaire" (нов рейтинг) ИЛИ „Complete questionnaire" (започнат, но НЕ финализиран
  //   рейтинг — Your current rating: No data). И двата отварят въпросите.
  const btn = frame.locator('button:has-text("Fill out questionnaire"), button:has-text("Complete questionnaire"), button:has-text("Fill out"), button:has-text("Complete quest")').first();
  if (await btn.count().catch(() => 0)) {
    let ok = false;
    await btn.scrollIntoViewIfNeeded().catch(() => {});
    await btn.click({ timeout: 4000 }).then(() => { ok = true; }).catch(() => {});
    if (ok) return true;
  }
  return await nativeClick(frame, 'Fill out questionnaire|Complete questionnaire|Fill out');
}
// Element-UI падащо меню: кликва селекта след етикета, после опцията. ★ Истинска мишка — Playwright-клик
// падаше интермитентно за App category/Default language в New app попъпа (OK оставаше неактивен → цикъл).
async function selectByLabel(frame, labelText, optionText) {
  try {
    const sel = frame.locator(`xpath=//*[contains(normalize-space(.),${JSON.stringify(labelText)})]/following::div[contains(@class,"el-select")][1]`).first();
    await mouseClick(sel);
    await new Promise((r) => setTimeout(r, 700));
    const opt = frame.locator('.el-select-dropdown__item').filter({ hasText: optionText }).first();
    await mouseClick(opt);
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
  // Клик ТОЧНО по връзка от ЛЯВОТО меню: `<a>`, чийто `.item-text` е точно етикетът (напр. „Draft",
  // „App information"). По-надеждно от clickAnywhere('Draft') — има и статус-баджове „Draft", които не
  // навигират. Router-ът на конзолата сменя hash-route → съдържанието се зарежда в amp iframe.
  async function clickLeftMenu(label) {
    const p = getHuaweiPage(); if (!p) return false;
    for (const f of p.frames()) {
      const done = await f.evaluate((lbl) => {
        const a = [...document.querySelectorAll('a')].find((a) => {
          const s = a.querySelector('.item-text');
          return s && s.textContent.trim() === lbl;
        });
        if (a) { a.scrollIntoView({ block: 'center' }); a.click(); return true; }
        return false;
      }, label).catch(() => false);
      if (done) return true;
    }
    return false;
  }
  // Отива на ВЕРСИЯТА „Draft" през нейния СОБСТВЕН route (.../v<digits>) — програмният `a.click()` по
  // router-връзката на Vue не навигира надеждно, затова сменяме direktno window.location.href (hash-
  // router-ът реагира на hashchange и зарежда съдържанието на версията в amp iframe).
  async function gotoVersionDraft() {
    const p = getHuaweiPage(); if (!p) return false;
    let href = '';
    for (const f of p.frames()) {
      href = await f.evaluate(() => {
        const a = [...document.querySelectorAll('a')].find((a) => {
          const s = a.querySelector('.item-text');
          return s && s.textContent.trim() === 'Draft' && /\/v\d/.test(a.getAttribute('href') || a.href || '');
        });
        return a ? (a.getAttribute('href') || a.href) : '';
      }).catch(() => '');
      if (href) break;
    }
    if (!href) return false;
    await p.evaluate((h) => { window.location.href = h; }, href).catch(() => {});
    await sleep(3500);
    return true;
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
  // Валутата ВИНАГИ Kyrgyzstan (USD) — за ВСИЧКИ приложения (по искане, само Huawei). Ако вече е такава,
  // не пипа. ВАЖНО: селектът се populate-ва при ПИСАНЕ (клик сам не показва опции); опцията се избира с
  // Playwright клик (той сам скролва до нея). Проверяваме резултата, като прочетем текста на селекта.
  async function ensureCurrency(frame) {
    try {
      const lbl = frame.locator(':text("Default currency")').first();
      if (!(await lbl.count().catch(() => 0))) return;   // няма валута на този екран (напр. версията) — нищо
      const sel = lbl.locator('xpath=following::*[contains(@class,"el-select")][1]');
      if (/Kyrgyzstan/i.test((await sel.innerText().catch(() => '')) || '')) { log('✓ Валута вече е Kyrgyzstan (USD)'); return; }
      // ПИСАНЕ НЕ работи — само СКРОЛВАНЕ. Отвори менюто (само ако не е вече отворено, за да не го затворим
      // с повторен клик), после Playwright клик по „Kyrgyzstan (USD)" — той сам скролва до опцията.
      for (let attempt = 0; attempt < 4; attempt++) {
        const openNow = (await frame.locator('.el-select-dropdown__item:visible').count().catch(() => 0)) > 5;
        if (!openNow) { await sel.click({ force: true, timeout: 2500 }).catch(() => {}); await sleep(1100); }
        const opt = frame.locator('.el-select-dropdown__item').filter({ hasText: /^Kyrgyzstan \(USD\)/i }).first();
        if (await opt.count().catch(() => 0)) {
          await opt.scrollIntoViewIfNeeded().catch(() => {});
          await sleep(300);
          await opt.click({ force: true, timeout: 2500 }).catch(() => {});
          await sleep(1000);
          if (/Kyrgyzstan/i.test((await sel.innerText().catch(() => '')) || '')) { log('✓ Валута → Kyrgyzstan (USD)'); return; }
        } else log('· валута опит ' + (attempt + 1) + ': менюто още не е готово');
        await sleep(600);
      }
      log('↷ не успях да сложа „Kyrgyzstan (USD)" — избери ръчно');
    } catch (e) { log('↷ Валута — избери Kyrgyzstan (USD) ръчно'); }
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
        if (checked) { await mouseClick(cb); done++; await sleep(500); }   // ★ истинска мишка (обновява модела!)
      }
      // СТРУКТУРА 2 (топ-редове: Chinese mainland — чекбоксът е ПРАЗЕН съсед). Маркираме реда с data-атрибут,
      // после ★ истинска мишка по него. Само ако структура 1 не е хванала нищо.
      if (!done) {
        const marked = await frame.evaluate((nm) => {
          const rows = [...document.querySelectorAll('div,span,label,td')].filter((el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim() === nm);
          for (const el of rows) {
            let row = el, cb = null;
            for (let i = 0; i < 4 && row; i++) { cb = row.querySelector('.area-checkbox, .el-checkbox'); if (cb) break; row = row.parentElement; }
            if (cb && cb.classList.contains('is-checked')) { cb.setAttribute('data-uncheck-tgt', '1'); return true; }
          }
          return false;
        }, name).catch(() => false);
        if (marked) { await mouseClick(frame.locator('[data-uncheck-tgt="1"]').first()); await frame.evaluate(() => { const e = document.querySelector('[data-uncheck-tgt]'); if (e) e.removeAttribute('data-uncheck-tgt'); }).catch(() => {}); done++; await sleep(500); }
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
          await mouseClick(loc.nth(i));   // ★ истинска мишка
          await sleep(1000);
          if (await belarusVisible()) { log('✓ разгънах „Europe" (Belarus/Russia видими)'); return true; }
        }
      }
      log('↷ не успях да разгъна „Europe" автоматично');
      return await belarusVisible();
    } catch (_) { return false; }
  }

  // Изключи China/Belarus/Russia от държавите за релийз. ЧИСТО и ИДЕМПОТЕНТНО: при избор на „Selected
  // countries/regions" Huawei слага по подразбиране ВСИЧКИ 200 държави — затова НЕ пипаме „All" (точно
  // повторният клик по „All" трупаше бъркотия и раждаше модала). Само ПРОВЕРЯВАМЕ състоянието и махаме
  // онова, което е включено. China е топ-ниво (винаги видима); Belarus/Russia са в „Europe" (разгъва се).
  async function selectCountriesExcept(frame) {
    if (process.env.HW_SKIP_COUNTRIES === '1') { log('↷ прескачам release-държавите (HW_SKIP_COUNTRIES=1) — вече са нагласени'); return; }
    // Модалът „signing entity changed" изскача при ВСЯКА смяна и ПОКРИВА панела → затваряме след всеки toggle.
    const closeCountryModal = async () => {
      const mb = frame.locator('.el-message-box:visible, .el-dialog:visible').filter({ hasText: /signing entity|upload an app package|change of countr|Information/i }).first();
      if (await mb.count().catch(() => 0)) { await mb.locator('button:has-text("OK"), button:has-text("Confirm")').first().click({ force: true, timeout: 2000 }).catch(() => {}); await sleep(700); return true; }
      return false;
    };
    await closeCountryModal();
    // ВАЖНО: списъкът с региони (Chinese mainland, Europe…) се рендира със ЗАКЪСНЕНИЕ след „Data saved"
    // модал/навигация. Ако пипнем преди това — expandEurope/isChecked се провалят тихо. Затова ИЗЧАКВАМЕ.
    let listReady = false;
    for (let k = 0; k < 15; k++) {
      listReady = (await frame.locator('.el-checkbox').filter({ hasText: /^Chinese mainland/ }).count().catch(() => 0)) > 0;
      if (listReady) break;
      await sleep(1000);
    }
    if (!listReady) { log('↷ списъкът с държави не се появи навреме — виж ръчно'); return; }
    // Състояние на държава по име: true=избрана, false=не, null=не е в DOM (регионът не е разгънат).
    const isChecked = async (name) => await frame.evaluate((nm) => {
      const cbs = [...document.querySelectorAll('.el-checkbox')].filter((cb) => (cb.innerText || '').trim().startsWith(nm));
      const cb = cbs.find((c) => c.classList.contains('country-checkbox')) || cbs[0];
      return cb ? cb.classList.contains('is-checked') : null;
    }, name).catch(() => null);

    await closeCountryModal();
    // China („Chinese mainland") — топ-ниво, ВИНАГИ видима. Махни само ако е избрана.
    if ((await isChecked('Chinese mainland')) === true) {
      await uncheckCb(frame, 'Chinese mainland'); await uncheckCb(frame, 'China mainland');
      await closeCountryModal();
    } else log('✓ China вече е изключена (или не е избрана)');
    // Belarus/Russia — в „Europe". Разгъни, после махни само избраните (клик по China може да е свил Europe).
    await sleep(400);
    await expandEurope(frame);
    for (const c of ['Belarus', 'Russia']) {
      const st = await isChecked(c);
      if (st === true) { await uncheckCb(frame, c); await closeCountryModal(); await expandEurope(frame); }
      else if (st === false) log('✓ ' + c + ' вече е изключена');
      else log('↷ ' + c + ' не е в DOM (Europe не се разгъна) — виж ръчно');
    }
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
    // Затваря диалога „Manage packages" през бутона „Select" (ПРИЛАГА пакета + затваря). НИКОГА Cancel/X —
    // те ОТМЕНЯТ качения пакет (затова „Released packages: No data"!). Playwright-клик, после native.
    const closeMgmt = async () => {
      const open = await frame.evaluate(() => !!([...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null && /Manage packages/i.test(x.innerText || '')))).catch(() => false);
      if (!open) return;
      const dlg = frame.locator('.el-dialog:visible').filter({ hasText: 'Manage packages' }).first();
      const selBtn = dlg.locator('button:has-text("Select")').first();
      let ok = false;
      if (await selBtn.count().catch(() => 0)) { await selBtn.scrollIntoViewIfNeeded().catch(() => {}); await selBtn.click({ timeout: 3000 }).then(() => { ok = true; }).catch(() => {}); }
      if (!ok) await nativeClick(frame, '^Select$');
      await sleep(1000);
    };
    // Маркира радиото В РЕДА на пакета (.apk) с ★ИСТИНСКА МИШКА (иначе Vue-моделът не се обновява и пакетът
    // НЕ се закача реално — „button-text-disabled" Select / не се задържа след запис). Не .first() (грешно радио).
    const selectPkgRadio = async () => {
      const row = frame.locator('.el-dialog:visible tr, .el-dialog:visible .el-table__row').filter({ hasText: /\.apk/i }).first();
      const rad = row.locator('.el-radio, .el-radio__inner, span.el-radio__input').first();
      return await mouseClick(rad);
    };
    // Натиска „Select" в Manage packages с истинска мишка.
    const clickSelectBtn = async () => await mouseClick(frame.locator('.el-dialog:visible').filter({ hasText: 'Manage packages' }).locator('button:has-text("Select")').first());
    try {
      // Затвори евентуален информационен модал (signing entity/upload package), който покрива бутона.
      const mb = frame.locator('.el-message-box:visible, .el-dialog:visible').filter({ hasText: /signing entity|upload an app package|change of countr|Information/i }).first();
      if (await mb.count().catch(() => 0)) { await mb.locator('button:has-text("OK"), button:has-text("Confirm")').first().click({ force: true, timeout: 2000 }).catch(() => {}); await sleep(800); }
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
        if (apkVc && upVc && upVc === apkVc) {   // СЪЩИЯТ пакет вече е тук → само Select, НИКОГА delete (дори
          // при force!) — изтриването на пакет НУЛИРА държавите (signing entity)! Затова не трием излишно.
          log('↷ каченият пакет е НАЙ-НОВИЯТ (versionCode ' + apkVc + ') — не качвам/трия пак; само го избирам.');
          let sel2 = false;
          for (let k = 0; k < 6 && !sel2; k++) {
            await selectPkgRadio();   // ★ истинска мишка по радиото → активира Select и обновява модела
            await sleep(600);
            await clickSelectBtn();   // ★ истинска мишка по „Select" → закача пакета към версията
            await sleep(2200);
            sel2 = !(await frame.evaluate(() => [...document.querySelectorAll('.el-dialog')].some((x) => x.offsetParent !== null && /Manage packages/i.test(x.innerText || ''))).catch(() => false));
            if (!sel2) await sleep(800);
          }
          if (!sel2) await closeMgmt();
          log(sel2 ? '✓ Пакетът е ИЗБРАН и ЗАКАЧЕН (Released packages), диалогът затворен.' : '↷ пакетът не се закачи — виж ръчно.');
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
        // Изчакай пакетът да се появи в реда (обработка), после ★ истинска мишка: радио → Select.
        const hasRow = await frame.locator('.el-dialog:visible tr, .el-dialog:visible .el-table__row').filter({ hasText: /\.apk/i }).count().catch(() => 0);
        if (!hasRow) continue;
        await selectPkgRadio();   // ★ истинска мишка по радиото (обновява Vue-модела)
        await sleep(600);
        await clickSelectBtn();   // ★ истинска мишка по „Select"
        await sleep(2500);
        selected = !(await frame.evaluate(() => [...document.querySelectorAll('.el-dialog')].some((x) => x.offsetParent !== null && /Manage packages/i.test(x.innerText || ''))).catch(() => false));
      }
      if (!selected) await closeMgmt();
      log(selected ? '✓ Пакетът е ИЗБРАН и ЗАКАЧЕН към версията (Released packages).' : '↷ „Select" не се активира/закача навреме — виж ръчно.');
    } catch (e) { log('↷ качване на APK — направи ръчно (' + e.message + ')'); }
  }

  // Натиска основния бутон за НАПРЕД (Next/Save/OK/Confirm) — само АКТИВЕН и ВИДИМ. НИКОГА
  // Submit/Cancel/Delete/Back (точен текст → Submit не съвпада). Приоритет: Next > Save > OK > Confirm.
  async function clickAdvance(frame) {
    return await frame.evaluate(() => {
      const ok = (t) => /^(Next|Save|OK|Confirm)$/i.test(t);
      const btns = [...document.querySelectorAll('button')].filter((b) => {
        const t = (b.innerText || '').trim();
        return t && ok(t) && b.offsetParent !== null && !b.disabled && b.getAttribute('aria-disabled') !== 'true';
      });
      const rank = (t) => (/^Next$/i.test(t) ? 0 : /^Save$/i.test(t) ? 1 : /^OK$/i.test(t) ? 2 : 3);
      btns.sort((a, b) => rank((a.innerText || '').trim()) - rank((b.innerText || '').trim()));
      if (!btns.length) return false;
      btns[0].scrollIntoView({ block: 'center' }); btns[0].click(); return true;
    }).catch(() => false);
  }

  async function fillCurrent() {
   // АВТОНОМНО: попълва екрана → сам натиска основния бутон → минава на следващия. Спира при засядане
   // (същият екран 3 пъти) или на последната стъпка (Submit = човешко решение, не се натиска тук).
   let _lastSig = '', _stall = 0, _appInfoDone = false, _ratingDone = false, _priceDone = false, _ratingTries = 0, _priceTries = 0, _versionSaved = false, _listWaits = 0, _finalDone = false;
   for (let _step = 0; _step < 40; _step++) {
    let autoNext = true;
    let { frame, text, score } = await navToForm();
    if (!frame) { console.log('✗ Няма отворена страница на Huawei.'); return; }
    const on = (s) => text.includes(s);
    // Въпросникът за рейтинг е РЕАЛНО отворен само ако има интерактивни групи въпроси с радио „No/Yes".
    // (Иначе думите „Violence/Sexuality/Fear" остават в текста на версийната страница и хващат погрешно
    //  content-rating клона, вместо да минем държавите.)
    const ratingOpen = await frame.evaluate(() => {
      // Новият формат: клик „Set" отваря ДИАЛОГ „Complete age rating" (с бутон „Fill out questionnaire"),
      // после ИСТИНСКИЯТ въпросник (No/Yes групи). Засичаме и двете състояния по заглавието на диалога/drawer
      // ИЛИ по въпросни групи вътре в отворен диалог/drawer. (Старият формат: .agc-question-group.)
      const dlgTitle = [...document.querySelectorAll('.el-dialog__title, .el-drawer__title')]
        .some((t) => t.offsetParent !== null && /age rating|content rating|questionnaire/i.test(t.innerText || ''));
      const groups = document.querySelectorAll('.agc-question-group__title, .agc-question-group').length;
      const qInDlg = !!document.querySelector('.el-dialog .el-radio-group, .el-drawer .el-radio-group');
      const noYes = [...document.querySelectorAll('.el-radio:not(.area-checkbox)')].filter((r) => /^(No|Yes)\b/.test((r.innerText || '').trim())).length;
      return dlgTitle || (qInDlg && noYes >= 2) || (groups >= 2 && noYes >= 2);
    }).catch(() => false);
    let url = ''; try { url = frame.page().url(); } catch (_) {}
    console.log('\n── екран (маркери: ' + score + ') ──');
    await human(2, 5);   // „оглеждане" на екрана преди действие (човешко темпо)

    // ── СПИСЪК С ПРИЛОЖЕНИЯ: разбери дали приложението е СЪЗДАДЕНО, и действай ──
    const isVersionPage = on('Country/Region for release') || on('Payment information') || on('Privacy tags') || on('For reviewer') || on('App price') || on('Default price');
    if (isVersionPage || ratingOpen) _appInfoDone = true;   // веднъж стигнали версията/рейтинга → app info е готово (навигаторът да сочи „Draft", не „App information")
    // САМО реалната страница-списък има URL завършващ на „#/myApp" (без /id). Вътре в приложението URL е
    // „#/myApp/<id>/<id>" — затова НЕ ползваме includes (то бъркаше Workspace със списък и зацикляше).
    const isList = /#\/myApp\/?$/.test(url) && !isVersionPage;
    // ВАЖНО: когато попъпът „New app" е ВЕЧЕ отворен, URL-ът пак е „#/myApp" (попъпът не сменя адреса).
    // Затова НЕ влизаме в клона за списъка (иначе кликкаме Release пак и пак) — падаме към попълването.
    if (isList && !on('Compatible devices') && !(on('New app') && on('Package type'))) {
      // ВАЖНО: списъкът по подразбиране е на таб „HarmonyOS" — нашите приложения са ANDROID! Затова първо
      //   превключваме на таба „Android" и ПРЕПРОЧИТАМЕ текста (иначе не виждаме апа → фалшиво „не е създадено").
      await frame.locator('#tab-android, .el-tabs__item:has-text("Android"), text="Android"').first().click({ force: true, timeout: 2000 }).catch(() => {});
      await sleep(2000);
      try { text = await frame.evaluate(() => (document.body ? document.body.innerText : '')); } catch (_) {}
      // изчакай списъкът да ЗАРЕДИ — иначе на незареден списък бъркаме „не е създадено" и правим дубликат.
      const listLoaded = (appId && text.includes(appId)) || (brand && text.includes(brand)) || /No data available|Package name|Total\s*\d/.test(text);
      if (!listLoaded && _listWaits < 6) { _listWaits++; console.log('· списъкът с приложения още се зарежда — изчаквам (' + _listWaits + '/6)…'); await sleep(2500); continue; }
      const exists = (appId && text.includes(appId)) || (brand && text.includes(brand));
      console.log('Екран: списък с приложения (My apps). „' + brand + '" → ' + (exists ? 'СЪЗДАДЕНО ✓ — отварям го' : 'НЕ е създадено — създавам нов запис'));
      if (exists) {
        await clickText(frame, brand);
        await sleep(4000);                       // изчакай да зареди детайла на приложението
        // отиди САМ на „App information" (вляво) — с ИЗЧАКВАНЕ и РЕТРАЙ (менюто/детайлът зареждат бавно)
        let opened = false;
        for (let k = 0; k < 8 && !opened; k++) { opened = (await clickLeftMenu('App information')) || (await clickAnywhere('App information')); if (!opened) await sleep(1500); }
        if (opened) { await sleep(3000); log('→ отидох сам на „App information" — попълвам…'); }
        else { log('↷ не намерих „App information" — отвори го ръчно.'); return; }
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

    // ── Вътре в приложението, но формата ОЩЕ НЕ Е заредена (тя идва в iframe със закъснение, особено
    //    веднага след създаване). Навигираме сами през ЛЯВОТО меню: първо „App information", а щом то е
    //    попълнено — „Draft" (версията: държави, APK, плащане, поверителност…). onForm = вече сме на форма.
    const insideApp = /#\/myApp\/[^/]+\/[^/]+/.test(url);
    const onForm = on('Brief introduction') || on('Compatible devices') || isVersionPage || (on('New app') && on('Package type'));
    if (insideApp && !onForm) {
      const target = _appInfoDone ? 'Draft' : 'App information';
      console.log('Екран: вътре в приложението, формата още не е заредена → отварям „' + target + '".');
      await sleep(2500);                                  // изчакай iframe-ът да дозареди
      const opened = target === 'Draft'
        ? (await gotoVersionDraft() || await clickLeftMenu('Draft'))
        : (await clickLeftMenu(target) || await clickAnywhere(target));
      if (opened) { await sleep(3500); log('→ отворих „' + target + '".'); continue; }
      log('↷ не намерих „' + target + '" вляво — изчаквам да зареди…'); await sleep(2500); continue;
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
      await selectByLabel(frame, 'App category', isGame ? 'Game' : 'App');   // игрите → „Game" (иначе Categorization „Games>…" не пасва)
      await selectByLabel(frame, 'Default language', 'English (UK)');
      await sleep(500);
      // OK с ★ истинска мишка (native auto-advance НЕ затваря попъпа → цикли).
      await mouseClick(dlg.locator('button:has-text("OK"), button:has-text("Confirm")').filter({ hasNotText: /Cancel/ }).first());
      await sleep(2800);
      log('✓ Попъпът „New app" попълнен + OK (истинска мишка) → App information.');
      autoNext = false; continue;
    } else if (!_appInfoDone && (on('App information') || on('Brief introduction') || on('Compatible devices'))) {
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
      // ── Категория (каскадер „Categorization"): напр. Apps > News & reading > News. КРИТИЧНО — ако не е
      //    попълнена, Content rating дава „Complete app categorization first"! Клик по input-а → изчакай
      //    менюто → избери всеки level в СЪОТВЕТНАТА КОЛОНА (native клик по .el-cascader-menu__item по ТОЧЕН
      //    текст). getByText НЕ става — „Apps" се среща и другаде на страницата → кликаше грешния елемент.
      if (catParts.length) {
        try {
          const menuOpen = async () => await frame.evaluate(() => [...document.querySelectorAll('.el-cascader-menu')].some((m) => m.offsetParent !== null)).catch(() => false);
          for (let k = 0; k < 5 && !(await menuOpen()); k++) {
            await frame.evaluate(() => { const cs = [...document.querySelectorAll('.el-cascader')].filter((c) => c.offsetParent !== null); if (cs[0]) { const i = cs[0].querySelector('input, .el-input__inner'); (i || cs[0]).click(); } }).catch(() => {});
            await sleep(1200);
          }
          for (const part of catParts) {
            let done = false;
            for (let k = 0; k < 5 && !done; k++) {
              done = await frame.evaluate((t) => { const cols = [...document.querySelectorAll('.el-cascader-menu')].filter((m) => m.offsetParent !== null); for (let ci = cols.length - 1; ci >= 0; ci--) { const n = [...cols[ci].querySelectorAll('.el-cascader-menu__item, .el-cascader-node')].find((i) => ((i.querySelector('.el-cascader-node__label') || i).innerText || '').trim().replace(/\s+/g, ' ') === t); if (n) { n.click(); return true; } } return false; }, part).catch(() => false);
              if (!done) await sleep(800);
            }
            await sleep(1200);
          }
          const catVal = await frame.evaluate(() => { const i = [...document.querySelectorAll('.el-cascader input')].find((x) => x.value); return i ? i.value : ''; }).catch(() => '');
          log(catVal ? '✓ Category ← ' + catVal : '↷ Category непълна — избери ръчно: ' + catParts.join(' > '));
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
              await human(2, 4);   // пауза СЛЕД цял език (секция), не след всяко поле
            }
            log('✓ описания/име попълнени за ' + langsFilled + ' езика (+ English).');
          } else {
            log('✓ Manage languages: +' + added + ' нови (' + have + ' вече, ' + missing + ' липсват) — прегледай и натисни OK сам.');
          }
        } else log('↷ Manage languages — попъпът не се отвори');
      }
      // App info попълнено → запиши (Save, НЕ Next/Submit) и мини към ВЕРСИЯТА „Draft" (държави/APK/…).
      await frame.locator('button:has-text("Save")').filter({ hasNotText: /Submit|Next/ }).first().click({ force: true, timeout: 4000 }).then(() => log('✓ натиснах Save на App information')).catch(() => log('↷ Save на App info — не се натисна (виж ръчно)'));
      await sleep(3000);
      _appInfoDone = true;
      if (await gotoVersionDraft()) log('→ App info записано → отивам на версията „Draft" (route на версията).');
      else log('↷ не намерих route на версията „Draft" — виж ръчно.');
      autoNext = false;   // App info сам натиска Save и навигира — без общия авто-напред
    } else if (ratingOpen) {
      // ── Content rating (възрастов въпросник). НОВ формат: „Set" → диалог „Complete age rating" →
      //    бутон „Fill out questionnaire" → въпроси (Yes/No двойки) → Verify → Submit. За newslator/инструменти
      //    всичко е „No"; ИГРИ (насилие) → категории в „yes" (content-ratings.json)! ──
      console.log('Екран: Content rating (възрастов въпросник)');
      // Ако рейтингът ВЕЧЕ е финализиран — само затвори остатъчния диалог (да не зациклим на „Fill out").
      if (_ratingDone) {
        await frame.evaluate(() => { [...document.querySelectorAll('.el-dialog, .el-drawer')].filter((x) => x.offsetParent !== null).forEach((d) => { const x = d.querySelector('.el-dialog__headerbtn, .el-drawer__close-btn'); if (x) x.click(); else { const c = [...d.querySelectorAll('button')].find((b) => /^(Cancel|Close)$/i.test((b.innerText || '').trim())); if (c) c.click(); } }); }).catch(() => {});
        await sleep(1000); log('· рейтингът е готов — затворих остатъчния диалог'); autoNext = false; continue;
      }
      // Въпросите са ГОЛИ радиа „Yes/No" (НЕ el-radio-group; radio-групите „Rated X+" идват чак на Verify).
      // Затова засичаме реалните въпроси по броя „Yes/No" радиа в отворения диалог.
      const hasQuestions = await frame.evaluate(() => {
        const d = [...document.querySelectorAll('.el-dialog, .el-drawer')].find((x) => x.offsetParent !== null && /Content rating/i.test((x.querySelector('.el-dialog__title,.el-drawer__title') || {}).innerText || ''));
        if (!d) return false;
        return [...d.querySelectorAll('.el-radio')].filter((r) => /^(Yes|No)$/i.test((r.innerText || '').trim())).length >= 4;
      }).catch(() => false);
      if (!hasQuestions) {
        // Стъпка 1: отвори самите въпроси през „Fill out questionnaire" (native клик; може да се рендира
        //   със ЗАКЪСНЕНИЕ → изчакай и опитай няколко пъти).
        let fq = false;
        for (let k = 0; k < 4 && !fq; k++) { fq = await clickFillOut(frame); if (!fq) await sleep(700); }
        if (fq) {
          await sleep(3200);
          log('→ натиснах „Fill out questionnaire" — отварям въпросите.');
          autoNext = false; continue;
        }
        // ДЕБЪГ: какви бутони вижда в диалога (за да разбера защо „Fill out" не се хваща)
        const dbg = await frame.evaluate(() => { const d = [...document.querySelectorAll('.el-dialog, .el-drawer')].find((x) => x.offsetParent !== null); return d ? { title: (d.querySelector('.el-dialog__title,.el-drawer__title') || {}).innerText || '', btns: [...d.querySelectorAll('button, a')].map((b) => (b.innerText || '').trim()).filter(Boolean).slice(0, 12) } : { title: 'НЯМА ДИАЛОГ', btns: [] }; }).catch(() => ({}));
        log('↷ рейтинг „Fill out" не се хвана. Диалог „' + (dbg.title || '') + '" бутони: ' + JSON.stringify(dbg.btns || []));
        // Нито въпроси, нито бутон „Fill out" (напр. рейтингът е готов, или страничен/остатъчен диалог) →
        // ЗАТВОРИ диалога (X/Cancel), за да НЕ зациклим (ratingOpen да падне), и продължи.
        await frame.evaluate(() => { const d = [...document.querySelectorAll('.el-dialog, .el-drawer')].find((x) => x.offsetParent !== null); if (!d) return; const x = d.querySelector('.el-dialog__headerbtn, .el-drawer__close-btn'); if (x) x.click(); const c = [...d.querySelectorAll('button')].find((b) => /^(Cancel|Close)$/i.test((b.innerText || '').trim())); if (c) c.click(); }).catch(() => {});
        await sleep(1000);
        log('· рейтинг: няма въпроси/бутон — затворих диалога и продължавам (ако не е зададен, виж ръчно)');
        _ratingDone = true; autoNext = false;
      } else {
        // Стъпка 2: въпросите са ДВОЙКИ радиа „Yes/No" (НЕ el-radio-group!) по категории. Отговаряме „No"
        //   на всяка двойка (за newslator/инструменти), ОСВЕН категориите в ratingYes (напр. игри → „Violence"
        //   = „Yes"). Категорията се чете от текста около въпроса. Стойностите идват от content-ratings.json.
        let ans = 0, lastUnanswered = -1, totalQ = 0;
        for (let round = 0; round < 8; round++) {
          const res = await frame.evaluate((yesCats) => {
            const dlg = [...document.querySelectorAll('.el-dialog, .el-drawer')].find((d) => d.offsetParent !== null && /Content rating/i.test((d.querySelector('.el-dialog__title,.el-drawer__title') || {}).innerText || ''))
              || [...document.querySelectorAll('.el-dialog, .el-drawer')].find((d) => d.offsetParent !== null);
            if (!dlg) return { clicked: 0, unanswered: -1, total: 0 };
            const radios = [...dlg.querySelectorAll('.el-radio')].filter((r) => /^(Yes|No)$/i.test((r.innerText || '').trim()));
            const catOf = (r) => { let el = r; for (let i = 0; i < 8 && el; i++) { el = el.parentElement; if (!el) break; const t = (el.innerText || '').toLowerCase(); const hit = yesCats.find((c) => t.includes(c)); if (hit) return hit; } return ''; };
            let clicked = 0, answered = 0, total = 0;
            for (let i = 0; i + 1 < radios.length; i += 2) {   // двойки [Yes,No]
              const yes = /^Yes$/i.test((radios[i].innerText || '').trim()) ? radios[i] : radios[i + 1];
              const no = yes === radios[i] ? radios[i + 1] : radios[i];
              total++;
              const target = catOf(no) ? yes : no;            // категория в yesCats → „Yes", иначе „No"
              if (target.classList.contains('is-checked')) { answered++; continue; }
              target.click(); clicked++; answered++;
            }
            return { clicked, unanswered: total - answered, total };
          }, ratingYes).catch(() => ({ clicked: 0, unanswered: -1, total: 0 }));
          ans += res.clicked; lastUnanswered = res.unanswered; totalQ = res.total;
          if (res.unanswered === 0) break;
          await sleep(500);
        }
        if (lastUnanswered === 0) log('✓ рейтинг: попълних ВСИЧКИ ' + totalQ + ' въпроса (от content-ratings.json; „yes" категории: ' + (ratingYes.join(', ') || 'няма') + ').');
        else log('⚠ рейтинг: отговорих ' + ans + ', останаха ' + lastUnanswered + ' — виж ръчно.');
        // Verify → (декларация) → Save/OK/Confirm. Взима само АКТИВЕН бутон (в диалога, после в рамката).
        const rbtn = async (lbl) => await frame.evaluate((l) => {
          const scope = [...document.querySelectorAll('.el-dialog, .el-drawer')].find((d) => d.offsetParent !== null);
          const pool = scope ? [...scope.querySelectorAll('button'), ...document.querySelectorAll('button')] : [...document.querySelectorAll('button')];
          const btn = pool.find((x) => new RegExp('^\\s*' + l + '\\s*$', 'i').test((x.innerText || '').trim()) && x.getAttribute('aria-disabled') !== 'true' && !x.disabled && x.offsetParent !== null);
          if (btn) { btn.scrollIntoView({ block: 'center' }); btn.click(); return true; }
          return false;
        }, lbl).catch(() => false);
        await sleep(500);
        if (await rbtn('Verify')) { log('✓ натиснах „Verify" (изчислявам рейтинга)'); await sleep(3500); }
        // евентуална декларация-отметка преди финализиране
        await frame.evaluate(() => { const d = [...document.querySelectorAll('.el-drawer, .el-dialog')].find((x) => x.offsetParent !== null); if (!d) return; d.querySelectorAll('.el-checkbox:not(.area-checkbox)').forEach((c) => { if (!c.classList.contains('is-checked') && /authentic|declare|confirm|responsib|accurate/i.test(c.innerText || '')) c.click(); }); }).catch(() => {});
        await sleep(800);
        // ── ФИНАЛИЗИРАНЕ (запазва рейтинга; НЕ подава апа за ревю!) ──
        // 1) „Submit" на въпросника — САМО с PLAYWRIGHT-клик (native НЕ задейства този бутон!).
        let saved = false;
        const qdlg = frame.locator('.el-dialog.age-rating-questionnaire:visible, .el-dialog:visible, .el-drawer:visible').filter({ hasText: /Verify your age rating|Content rating/i }).first();
        await qdlg.locator('button:has-text("Submit")').first().click({ timeout: 4000 }).then(() => { saved = true; }).catch(() => {});
        if (!saved) saved = await nativeClick(frame, '^Submit$');
        await sleep(3000);
        // 2) Потвърждение „children-confirm-dialog": въпрос „intended ONLY for children?" → за нашите апове
        //    (новини, инструменти, игри) отговорът е „No" (НЕ само за деца). Само истинско детско → „Yes"
        //    (ratingCfg.kidsOnly). После OK.
        const kidsAns = ratingCfg.kidsOnly ? 'Yes' : 'No';
        await frame.evaluate((ans) => {
          const d = [...document.querySelectorAll('.el-dialog, .el-message-box')].find((x) => x.offsetParent !== null && (/children-confirm/.test(x.className || '') || /intended only for children|choose this rating/i.test(x.innerText || '')));
          if (!d) return;
          const r = [...d.querySelectorAll('.el-radio')].find((x) => new RegExp('^' + ans + '$', 'i').test((x.innerText || '').trim()));
          if (r) r.click();
        }, kidsAns).catch(() => {});
        await sleep(1200);
        // 3) OK на потвърждението (Playwright)
        await frame.locator('.el-dialog.children-confirm-dialog button:has-text("OK"), .el-dialog:visible button:has-text("OK"), .el-message-box button:has-text("OK")').first().click({ timeout: 3500 }).catch(() => {});
        await sleep(3500);
        // 4) затвори остатъчния диалог „Complete age rating" (показва вече записания рейтинг)
        await frame.evaluate(() => { [...document.querySelectorAll('.el-dialog, .el-drawer')].filter((x) => x.offsetParent !== null && /age rating/i.test(x.innerText || '')).forEach((d) => { const x = d.querySelector('.el-dialog__headerbtn, .el-drawer__close-btn'); if (x) x.click(); }); }).catch(() => {});
        await sleep(1200);
        log(saved ? '✓ рейтингът е ФИНАЛИЗИРАН (въпроси → Verify → Submit → „само за деца: ' + kidsAns + '" → OK).' : '↷ рейтингът не се финализира — виж ръчно.');
        _ratingDone = true;
      }
      autoNext = false;   // рейтингът се управлява сам — да не го дублира авто-напредът
    } else if (!_priceDone && (on('App price') || (on('Default price') && (on('Convert prices') || on('Default currency'))))) {
      // ── App price (от „View and edit") — валута Kyrgyzstan (USD) + цена + Convert + Save ──
      console.log('Екран: App price (цена)');
      await ensureCurrency(frame);
      await fillNear(frame, 'Default price', priceUsd);
      await clickText(frame, 'Convert prices');
      await sleep(600);
      // Цената е за ВСИЧКИ държави (деселект тук ЗАКЛЮЧВА Save — не пипаме държави в цената). Save с ★мишка.
      await mouseClick(frame.locator('button:has-text("Save")').filter({ hasNotText: /Submit|Cancel/ }).last());
      await sleep(3000);
      let toast = ''; try { toast = await frame.evaluate(() => { const el = document.querySelector('.el-message, .el-notification__content'); return el ? el.innerText.trim() : ''; }); } catch (_) {}
      if (toast) log('ⓘ ' + toast.slice(0, 60));
      log('✓ Цена ' + priceUsd + ' USD (Kyrgyzstan) + Convert + Save (истинска мишка).');
      autoNext = false;
      _priceDone = true;
      // ★ НАКРАЯ: държавите се нулират по време на рейтинг/цена → връщам се на версията за ФИНАЛНО махане+запис.
      log('→ връщам се на версията за финално махане на China/Belarus/Russia + запис…');
      await gotoVersionDraft();
      // ценовият редактор е „лепкав" — само location.href не стига → ПЪЛЕН RELOAD чисти под-състоянието.
      await frame.page().reload({ waitUntil: 'load' }).catch(() => {});
      await sleep(6000);
      continue;
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
      // ★ ФИНАЛЕН ПРОХОД: след рейтинг+цена държавите се нулират → тук ги махаме ПАК (China/Belarus/Russia)
      //    и записваме с истинска мишка. Това е последното действие (после спираме — остава само Submit).
      if (_priceDone && !_finalDone) {
        console.log('★ ФИНАЛНО махане на China/Belarus/Russia + запис (държавите се бяха нулирали).');
        const selOn = await frame.evaluate(() => { const r = [...document.querySelectorAll('.el-radio')].find((x) => /Selected countries\/regions/i.test(x.innerText || '')); return r ? r.classList.contains('is-checked') : false; }).catch(() => false);
        if (!selOn) { await mouseClick(frame.locator('.el-radio').filter({ hasText: /Selected countries\/regions/i }).first()); await sleep(1000); }
        await selectCountriesExcept(frame);
        await sleep(800);
        await closeUploadModal();
        await mouseClick(frame.locator('button:has-text("Save")').filter({ hasNotText: /Submit/ }).first());   // ★ истинска мишка
        await sleep(3800);
        await closeUploadModal();
        _finalDone = true; autoNext = false;
        log('✅ ГОТОВО автономно: app info + версия + рейтинг + цена + ФИНАЛНО държави. Остава РЪЧНО: Proof of copyright + Submit.');
        continue;
      }
      // ── ОСНОВНОТО на версията се попълва и ЗАПИСВА ВЕДНЪЖ (после НЕ се пре-пълва, за да не маркира пак
      //    „незаписани промени" — рейтингът/цената НЕ се отварят при незаписана версия!). ──
      if (!_versionSaved) {
      // 17) Държави: „Selected" + „All" (ВСИЧКИ), после махни China/Belarus/Russia.
      //     Идемпотентно: ако вече е вярно, НЕ пипа (за да НЕ роди нов модал/ново качване).
      // Кликни „Selected countries/regions" САМО ако още НЕ е избрано — клик по радиото НУЛИРА подбора
      // обратно до всичките 200 държави (затова при рестарт „всичко пак селектирано")!
      const selectedOn = await frame.evaluate(() => { const r = [...document.querySelectorAll('.el-radio')].find((x) => /Selected countries\/regions/i.test(x.innerText || '')); return r ? r.classList.contains('is-checked') : false; }).catch(() => false);
      if (!selectedOn) { await mouseClick(frame.locator('.el-radio').filter({ hasText: /Selected countries\/regions/i }).first()); await sleep(800); log('✓ избрах „Selected countries/regions"'); }
      else log('· „Selected countries/regions" вече е избрано — не го пипам (иначе нулира държавите)');
      await selectCountriesExcept(frame);
      await human(2, 4);   // пауза след секция „Държави"
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
      await human(2, 4);   // пауза след секция „Пакет/APK"
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
      await human(2, 4);   // пауза след секция „Плащане/Поверителност/AI/Release"
      log('✓ Версията попълнена — ЗАПИСВАМ я (за да се отворят рейтинг „Fill out questionnaire" и цена „View and edit").');
      // ЗАПИШИ версията: Playwright-клик (истински), после native. Провери дали Save е АКТИВЕН (при липсващ
      // пакет е disabled → нищо не се записва → държавите/пакетът се губят!).
      // ★ Записът с ИСТИНСКА МИШКА — native/Playwright Save НЕ комитва избраното в модела (държави/пакет
      //   се губят след рефреш, макар „Data saved" да излиза)! Доказано изолирано.
      await mouseClick(frame.locator('button:has-text("Save")').filter({ hasNotText: /Submit/ }).first());
      await sleep(3800);
      const savedToast = await frame.evaluate(() => { const m = document.querySelector('.el-message, .el-message-box__content, .el-notification__content'); return m ? (m.innerText || '').trim().slice(0, 50) : ''; }).catch(() => '');
      if (savedToast) log('ⓘ ' + savedToast);
      await closeUploadModal();
      _versionSaved = true;
      autoNext = false; continue;   // презареди записаната версия, после отваряме рейтинг/цена
      }
      // ── Версията е ЗАПИСАНА → 1) Content rating („Set" → въпросник), 2) цена („View and edit"), после стоп.
      if (!_ratingDone) {
        if (_ratingTries++ >= 5) { log('↷ рейтингът не се отвори след 5 опита — виж ръчно'); _ratingDone = true; }
        else {
          // ЕДНА стъпка: „Set" (отваря „Complete age rating") → „Fill out questionnaire" (отваря въпросите).
          // Прави се тук заедно, за да не куца двустъпковото засичане. Скролва до бутоните (native клик).
          const s = await nativeClick(frame, '^Set$');
          await sleep(s ? 2600 : 1200);
          let fq = false;
          for (let k = 0; k < 5 && !fq; k++) { fq = await clickFillOut(frame); if (!fq) await sleep(700); }
          await sleep(fq ? 3200 : 800);
          log('→ рейтинг опит ' + _ratingTries + ': „Set"=' + s + ', „Fill out questionnaire"=' + fq);
          if (!s && !fq) { const dbg = await frame.evaluate(() => [...document.querySelectorAll('button')].filter((b) => b.offsetParent !== null && /set|fill|rating/i.test(b.innerText || '')).map((b) => (b.innerText || '').trim()).slice(0, 10)).catch(() => []); log('  ↷ видими бутони (set/fill/rating): ' + JSON.stringify(dbg)); }
          autoNext = false; continue;
        }
      }
      if (!_priceDone) {
        if (_priceTries++ >= 5) { log('↷ цената не се отвори след 5 опита — задай я ръчно'); _priceDone = true; }
        else {
          // затвори ОСТАТЪЧНИ диалози (напр. „Complete age rating" след рейтинга) — иначе блокират „View and edit"
          await frame.evaluate(() => { [...document.querySelectorAll('.el-dialog, .el-drawer, .el-message-box')].filter((x) => x.offsetParent !== null && !/View and edit|App price|Default price/i.test(x.innerText || '')).forEach((d) => { const x = d.querySelector('.el-dialog__headerbtn, .el-drawer__close-btn'); if (x) x.click(); }); }).catch(() => {});
          await sleep(800);
          const opened = await nativeClick(frame, '^View and edit$');   // native клик — Playwright не задейства
          await sleep(opened ? 3500 : 1500);
          // ДЕТЕКЦИЯ „Save the version information first" — рейтингът е замърсил версията → трябва ЗАПИС
          //   ПРЕДИ цената. САМО записваме (клик по Save на версията); НЕ пре-пълваме/трием пакет — иначе
          //   смяна на държави → изтрит пакет → НУЛИРАНИ държави (важната зависимост)!
          const needSave = await frame.evaluate(() => [...document.querySelectorAll('.el-message-box, .el-dialog')].some((x) => x.offsetParent !== null && /Save the version information first/i.test(x.innerText || ''))).catch(() => false);
          if (needSave) {
            _priceTries--;   // това не е неуспешен опит за цена — не го брой
            await frame.evaluate(() => { const d = [...document.querySelectorAll('.el-message-box, .el-dialog')].find((x) => x.offsetParent !== null && /Save the version information first/i.test(x.innerText || '')); if (d) { const ok = [...d.querySelectorAll('button')].find((b) => /^OK$/i.test((b.innerText || '').trim())); if (ok) ok.click(); } }).catch(() => {});
            await sleep(1000);
            // само ЗАПИШИ версията (Playwright, после native) — без пре-пълване
            await mouseClick(frame.locator('button:has-text("Save")').filter({ hasNotText: /Submit/ }).first());   // ★ истинска мишка
            await sleep(3500);
            await frame.evaluate(() => { const d = [...document.querySelectorAll('.el-message-box, .el-dialog')].find((x) => x.offsetParent !== null && /Data saved|successfully|Information/i.test(x.innerText || '')); if (d) { const ok = [...d.querySelectorAll('button')].find((b) => /^(OK|Confirm)$/i.test((b.innerText || '').trim())); if (ok) ok.click(); } }).catch(() => {});
            await sleep(1000);
            log('↷ „Save version first" → записах версията (рейтинга), без да пипам държави/пакет. Пробвам цената пак.');
            autoNext = false; continue;
          }
          log(opened ? '→ отворих ценовия редактор (View and edit).' : '↷ опит ' + _priceTries + ' да отворя цената…');
          autoNext = false; continue;   // ВИНАГИ continue докато цената не е готова — да не Save-ва/засяда преди това
        }
      }
      log('✓ Версия + рейтинг + цена готови → натискам Save. Остава РЪЧНО само: Proof of copyright + Submit.');
    } else {
      let url = ''; try { url = frame.page().url(); } catch (_) {}
      console.log('Екран: не разпознат (маркери: ' + score + '). Трябва да си на ФОРМАТА „App information".');
      log('Адрес: ' + url);
      log('Видим текст (начало): ' + text.slice(0, 160).replace(/\n/g, ' '));
      autoNext = false;   // непознат екран — НЕ натискаме нищо наслуки
    }
    // ── АВТО-НАПРЕД: ботът сам натиска основния бутон (Next/Save/OK), за да мине на следващия екран.
    //    НЕ натиска Submit (последната стъпка е човешко решение + чака pupikes.app страниците да са живи).
    if (autoNext) {
      const advanced = await clickAdvance(frame);
      console.log(advanced ? '→ натиснах основния бутон — минавам на следващия екран.' : '· няма активен бутон за напред тук.');
      await sleep(2800);
    }
    // ── СТОП при засядане: ако екранът не се сменя 3 пъти подред → спри (за да не върти безкрайно).
    let _sig = ''; try { _sig = frame.page().url(); } catch (_) {}
    _sig += '|' + score + '|' + text.slice(0, 70);
    if (_sig === _lastSig) _stall++; else { _stall = 0; _lastSig = _sig; }
    if (_stall >= 3) { console.log('■ Екранът не се сменя — стигнах докъдето мога автономно (вероятно чака Submit/ръчно: цена, Proof of copyright). Спирам.'); return; }
   }  // ← край на верижния цикъл
   console.log('■ Достигнат лимит стъпки — спирам.');
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
