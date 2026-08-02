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
const privacyUrl = 'https://selflearning.bot.nu/privacy/' + app + '/hw-privacy.html';
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

(async () => {
  let browser;
  try { browser = await PW.chromium.connectOverCDP('http://127.0.0.1:9222'); }
  catch (e) { console.log('✗ Не мога да се закача за браузъра (порт 9222). Първо пусни: node deploy-scripts/huawei-release-bot-launch.cjs, влез и отвори приложението.'); process.exit(2); }

  console.log('\n🤖 HuaweiReleaseBot — ' + brand + '  (пакет ' + appId + ')');
  console.log('   Правило: попълвам видимо, НЕ натискам бутони. Ти преглеждаш и продължаваш.');

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
    try {
      const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const cbs = frame.locator('.el-checkbox').filter({ hasText: new RegExp('^' + esc(name)) });
      const n = await cbs.count().catch(() => 0); let done = 0;
      for (let i = 0; i < n; i++) {
        const cb = cbs.nth(i);
        const checked = await cb.evaluate((e) => e.classList.contains('is-checked')).catch(() => false);
        if (checked) { await cb.click({ force: true, timeout: 2000 }).catch(() => {}); done++; await sleep(200); }
      }
      if (done) log('✓ разотметнах „' + name + '" (' + done + ')');
    } catch (e) { log('↷ „' + name + '" — разотметни ръчно'); }
  }

  // Избери ВСИЧКИ държави („All"), после махни China/Belarus/Russia. Ползва се на екран 17 и 24.
  async function selectCountriesExcept(frame) {
    const allCb = frame.locator('.el-checkbox').filter({ hasText: /^All/ }).first();
    if (await allCb.count().catch(() => 0)) {
      const on = await allCb.evaluate((e) => e.classList.contains('is-checked')).catch(() => false);
      if (!on) { await allCb.click({ force: true, timeout: 2500 }).catch(() => {}); log('✓ отметнах „All" (всички държави)'); await sleep(1200); }
      else log('✓ „All" вече е отметнат');
    } else log('↷ не намерих „All" — отметни всички ръчно');
    for (const c of REMOVE_COUNTRIES) await uncheckCb(frame, c);
  }

  // Качи Huawei release APK през „Manage packages" (Upload → избор на файл → Select).
  async function uploadHwApk(frame) {
    if (!hwApkPath) { log('↷ няма huawei release APK в apk/huawei/release — качи ръчно'); return; }
    try {
      let dlg = frame.locator('.el-dialog:visible').filter({ hasText: 'Manage packages' }).first();
      if (!(await dlg.count().catch(() => 0))) {
        await frame.locator('button:has-text("Manage packages")').first().click({ force: true, timeout: 3000 }).catch(() => {});
        await sleep(2200);
        dlg = frame.locator('.el-dialog:visible').filter({ hasText: 'Manage packages' }).first();
      }
      if (!(await dlg.count().catch(() => 0))) { log('↷ не се отвори „Manage packages" — качи APK ръчно'); return; }
      if (await dlg.locator('text=/\\.apk/i').count().catch(() => 0)) { log('↷ вече има качен пакет — не качвам пак (натисни Select ръчно при нужда)'); return; }
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
      await sleep(14000);
      await dlg.locator('button:has-text("Select")').first().click({ force: true, timeout: 3000 }).then(() => log('✓ Пакетът е избран (Select).')).catch(() => log('↷ „Select" още не е активен — изчакай обработката и натисни Select сам.'));
    } catch (e) { log('↷ качване на APK — направи ръчно (' + e.message + ')'); }
  }

  async function fillCurrent() {
   // Верижи навигацията: списък → отвори приложението → App information → попълни — БЕЗ да чакаш
   // ENTER между стъпките. ENTER е само за прегледните екрани (попълване). Макс. няколко стъпки.
   for (let _step = 0; _step < 4; _step++) {
    let { frame, text, score } = await navToForm();
    if (!frame) { console.log('✗ Няма отворена страница на Huawei.'); return; }
    const on = (s) => text.includes(s);
    let url = ''; try { url = frame.page().url(); } catch (_) {}
    console.log('\n── екран (маркери: ' + score + ') ──');

    // ── СПИСЪК С ПРИЛОЖЕНИЯ: разбери дали приложението е СЪЗДАДЕНО, и действай ──
    const isVersionPage = on('Country/Region for release') || on('Payment information') || on('Privacy tags') || on('For reviewer') || on('App price') || on('Default price');
    const isList = (url.includes('#/myApp') || on('Release')) && !on('Brief introduction') && !on('Package type') && !isVersionPage;
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
    } else if ((on('Violence') && on('Sexuality')) || (on('Content rating') && on('Fear'))) {
      // ── ЕКРАНИ 25–28: Content rating (възрастов въпросник) ──
      console.log('Екран: Content rating (възрастов въпросник)');
      // Секциите са АКОРДЕОН (отваряне на една сваля другата) → разгъваме СЕКЦИЯ по СЕКЦИЯ и
      // отговаряме „No" ДОКАТО е отворена. За newslator/инструменти всеки въпрос е „No". ИГРИ (напр.
      // fps-hunter) имат насилие → там РЪЧНА проверка (не всичко е No)!
      const titles = frame.locator('.agc-question-group__title');
      const nt = await titles.count().catch(() => 0); let ans = 0;
      for (let s = 0; s < nt; s++) {
        await titles.nth(s).click({ timeout: 1500 }).catch(() => {}); await sleep(600);
        const noR = frame.locator('.el-radio:visible').filter({ hasText: /^No/ });
        const nr = await noR.count().catch(() => 0);
        for (let i = 0; i < nr; i++) {
          const r = noR.nth(i);
          const checked = await r.evaluate((e) => e.classList.contains('is-checked')).catch(() => false);
          if (!checked) { await r.click({ force: true, timeout: 1500 }).catch(() => {}); ans++; await sleep(120); }
        }
      }
      log('✓ отговорих „No" на ' + ans + ' въпроса (новинарски/инструмент). ПРЕГЛЕДАЙ и натисни Verify → Save сам.');
      log('⚠ За ИГРИ (насилие) НЕ е всичко „No" — там провери ръчно!');
    } else if (on('App price') || (on('Default price') && (on('Convert prices') || on('Default currency')))) {
      // ── ЕКРАН 24: App price (от „View and edit") — цена + махни China/Belarus + Convert ──
      console.log('Екран: App price (цена)');
      await ensureCurrency(frame);
      await fillNear(frame, 'Default price', priceUsd);
      // цената важи за ВСИЧКИ държави без China/Belarus/Russia (както на екран 17)
      await selectCountriesExcept(frame);
      await clickText(frame, 'Convert prices');
      log('✓ Цена ' + priceUsd + ' USD + махнати China/Belarus + Convert. Прегледай и натисни Save сам.');
    } else if (on('Country/Region for release') || on('Payment information') || on('Privacy tags') || on('For reviewer')) {
      // ── ЕКРАНИ 17–23: Version — Draft (настройки за релийз) ──
      console.log('Екран: Version — Draft (настройки за релийз)');
      // 17) Държави: „Selected" + „All" (ВСИЧКИ), после махни China/Belarus/Russia.
      await clickText(frame, 'Selected countries/regions');
      await sleep(500);
      await selectCountriesExcept(frame);
      // 18) Open testing: No + качи RELEASE APK (Manage packages → Upload → Select)
      await pickRadio(frame, 'Use testing version', 'No');
      await uploadHwApk(frame);
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
