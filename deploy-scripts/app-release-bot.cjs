// AppReleaseBot (app-release-bot.cjs) — попълва данните за публикуване в Huawei AppGallery за ЕДНО
// приложение, закачайки се за ВЕЧЕ логнатия браузър (debug порт 9222, от app-release-bot-launch.cjs).
// Двойка: AppPreparePublishingBot подготвя publish/, AppReleaseBot попълва конзолата от него.
//
// ПРАВИЛА (по искане):
//  • Логинът е РЪЧЕН (капча) — ботът само се закача за отворената сесия.
//  • Ботът попълва полетата ВИДИМО, но НЕ натиска OK/Next/Save/Submit/Continue — ти преглеждаш
//    и натискаш бутоните сам. На всяка страница спира.
//  • Разбира ВЕЧЕ създаден запис и попълва/редактира текущия екран (не гърми, че съществува).
//  • Чете данните от publish/ (единствен източник) — същите, които документът показва.
//
// Пуска се СЛЕД като си влязъл и си отворил приложението (Distribute → App information):
//   node deploy-scripts/app-release-bot.cjs newslator
const path = require('path');
const fs = require('fs');
let PW; for (const c of ['desktop/selflearning-friend/node_modules/playwright', 'node_modules2/playwright', 'node_modules/playwright']) { try { PW = require(path.resolve(c)); break; } catch (_) {} }
if (!PW) { console.log('Playwright липсва.'); process.exit(2); }

const app = (process.argv[2] || '').replace(/\/$/, '');
if (!app) { console.log('Употреба: node deploy-scripts/app-release-bot.cjs <app>'); process.exit(1); }
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
    const code = (b.match(/\(([a-zA-Z-]+)\)/) || [])[1]; if (!code) continue;
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

// ── попълване по близък етикет (видимо, без клик по бутони за потвърждение) ──
async function fillNear(page, labelRe, value, tag) {
  if (!value) return false;
  tag = tag || 'input';
  const xp = `xpath=//*[self::label or self::span or self::div][contains(normalize-space(.),${JSON.stringify(labelRe)})]/following::${tag}[1]`;
  try {
    const el = page.locator(xp).first();
    await el.waitFor({ timeout: 2500 });
    await el.scrollIntoViewIfNeeded().catch(() => {});
    await el.fill('');
    await el.fill(value);
    log('✓ „' + labelRe + '" ← ' + value.slice(0, 48).replace(/\n/g, ' ') + (value.length > 48 ? '…' : ''));
    return true;
  } catch (_) { log('↷ „' + labelRe + '" — полето не е на този екран'); return false; }
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
  catch (e) { console.log('✗ Не мога да се закача за браузъра (порт 9222). Първо пусни: node deploy-scripts/app-release-bot-launch.cjs, влез и отвори приложението.'); process.exit(2); }

  console.log('\n🤖 AppReleaseBot — ' + brand + '  (пакет ' + appId + ')');
  console.log('   Правило: попълвам видимо, НЕ натискам бутони. Ти преглеждаш и продължаваш.');

  const MARKERS = ['App information', 'Package type', 'Brief introduction', 'Manage languages', 'Compatible devices', 'Categorization', 'New app'];
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
    if (/Brief introduction|Compatible devices|New app|Package type|No data available|Total \d/.test(best.text)) return best;
    const p = getHuaweiPage();
    let u = ''; try { u = p ? p.url() : ''; } catch (_) {}
    if (p && !u.includes('#/myApp')) {
      log('адрес-бар: сесията е на друга страница — отивам на списъка с приложения (#/myApp)');
      await p.goto(APP_LIST_URL, { waitUntil: 'load' }).catch(() => {});
      await sleep(3000);
    }
    return await findBest();
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
    const isList = (url.includes('#/myApp') || on('Release')) && !on('Brief introduction') && !on('Package type');
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
      // Compatible devices → Mobile phone (el-checkbox)
      await frame.locator('.el-checkbox').filter({ hasText: 'Mobile phone' }).first().click({ timeout: 2000 }).then(() => log('✓ Compatible devices: Mobile phone')).catch(() => log('↷ Compatible devices — не намерих чекбокса'));
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
      if (iconPath) { await fileInputs.nth(0).setInputFiles(iconPath).then(() => log('✓ Икона качена')).catch(() => log('↷ икона — качи ръчно')); }
      if (shotPaths.length) { await fileInputs.nth(1).setInputFiles(shotPaths).then(() => log('✓ Скрийншоти качени (' + shotPaths.length + ')')).catch(() => log('↷ скрийншоти — качи ръчно')); await sleep(1500); }
      if (promoPath) {
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
        await sleep(1500);
        const dlg = frame.locator('.el-dialog').filter({ hasText: 'Manage languages' }).first();
        if (await dlg.count()) {
          const search = dlg.locator('input').first();
          let added = 0, have = 0, missing = 0;
          for (const label of hwLabels) {
            try {
              await search.fill(label.split(' (')[0]); await sleep(450);
              const cb = dlg.locator('.el-checkbox').filter({ hasText: label }).first();
              if (await cb.count()) {
                const checked = await cb.evaluate((e) => e.classList.contains('is-checked')).catch(() => false);
                if (checked) { have++; } else { await cb.click({ timeout: 1500 }); added++; }
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
              const nm = storeNames[code] || storeNames._default || brand;
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
    try { await browser.close(); } catch (_) {}   // CDP: само разкача, не затваря Chrome
  }
})();
