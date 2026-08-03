// rustore-release-bot.cjs — попълва конзолата на RuStore (console.rustore.ru) ВИДИМО, като се закача
// за вече отворения ти браузър (debug порт 9222). Не натиска финалните бутони (Add/Save/Submit) —
// ти ги натискаш, след като прегледаш. Данните идват от publish/ на приложението (един източник).
//
// Пускане (режим ENTER):  node deploy-scripts/rustore-release-bot.cjs <app> --loop
// После: отвори нужния екран в браузъра и натисни ENTER тук, за да го попълня. „q“+ENTER = изход.
const path = require('path');
const fs = require('fs');

const app = (process.argv[2] || '').replace(/^-+/, '') || 'newslator';
// RuStore ботът чете ВСИЧКИ данни от rustore/ дърво (отделно от Huawei — дори съдържанието да е дублирано).
// Huawei ботът (huawei-release-bot.cjs) чете от huawei/. Публикуване в даден магазин = данни от неговата папка.
const pub = path.resolve('rustore', app, 'publish');
function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return {}; } }
const cfg = readJson(path.resolve('rustore', app, 'capacitor.config.json'));
const brand = cfg.appName || app;
const storeNames = readJson(path.join(pub, 'store-names.json'));
const baseName = storeNames._default || brand;
// Console name (вътрешно, необратимо) = марката „Pupikes" + името на апа, за да се различават апо-
// вете в конзолата. Ако името вече започва с „Pupikes“ — не дублираме.
const appName = /^pupikes/i.test(baseName) ? baseName : ('Pupikes ' + baseName);

// Намери готовото RuStore RELEASE APK за това приложение (apk/rustore/release/<Име>-rustore-release.apk).
// Съпоставя по нормализирано име (без интервали/специални знаци), пробва марка/базово име/id на папката.
function findRustoreApk() {
  const dir = path.resolve('apk/rustore/release');
  const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const wants = [norm(baseName), norm(brand), norm(app)].filter(Boolean);
  try {
    const files = require('fs').readdirSync(dir).filter((f) => /\.apk$/i.test(f));
    for (const f of files) { const stem = norm(f.replace(/-rustore-release\.apk$/i, '')); if (wants.includes(stem)) return path.join(dir, f); }
    for (const f of files) { const nf = norm(f); if (wants.some((w) => nf.includes(w))) return path.join(dir, f); }
  } catch (_) {}
  return '';
}
const apkPath = findRustoreApk();

// активи за стъпка „Media files": икона (1:1, ≤1MB) + вертикални скрийншоти (≥3)
function firstFile(cands) { for (const c of cands) { try { if (require('fs').existsSync(c)) return path.resolve(c); } catch (_) {} } return ''; }
const iconPath = firstFile([path.join(pub, 'icon-512.png'), path.join(pub, 'icon-216.png')]);
let shotPaths = [];
try { shotPaths = require('fs').readdirSync(pub).filter((f) => /^\d+-.*\.(png|jpe?g)$/i.test(f)).sort().map((f) => path.join(pub, f)); } catch (_) {}

// Коментар за модератора (RuStore, на руски). По подразбиране: без акаунт, без лични данни. За апове
// с акаунт/данни сложи publish/moderator.json: { "account":true, "testCreds":"...", "personalData":true,
// "dataDetails":"...", "comment":"пълен ръчен текст (има приоритет)" }.
function moderatorComment() {
  const m = readJson(path.join(pub, 'moderator.json')) || {};
  if (m.comment) return m.comment;
  const s = [];
  if (m.account === true) { s.push('Для работы приложения нужен аккаунт.'); if (m.testCreds) s.push('Тестовые данные для проверки: ' + m.testCreds + '.'); }
  else s.push('Регистрация и вход в аккаунт не требуются.');
  if (m.personalData === true) s.push('Приложение собирает персональные данные: ' + (m.dataDetails || 'см. политику конфиденциальности в приложении') + '.');
  else s.push('Персональные данные не собираются и не передаются.');
  return s.join(' ');
}

// Руски Short/Full описание. Основен източник: descriptions-languages.md (ru блок). Резерва за тулкит
// фамилията (pupikes-toolkit-*), която ползва store-listing/<език>.txt: 1-ви абзац=заглавие,
// 2-ри=постоянно кратко мото, 3+=функции, накрая поддръжка.
function ruDesc() {
  try {
    const md = require('fs').readFileSync(path.join(pub, 'descriptions-languages.md'), 'utf8');
    for (const b of md.split(/\n##\s+/).slice(1)) {
      const h = b.split('\n')[0]; const code = (h.match(/\(([a-z]{2}(?:-[A-Za-z]+)?)\)/) || [])[1];
      if (code === 'ru') {
        const briefQ = (b.match(/\*\*Brief[^\n]*\*\*\s*\n>\s*([^\n]+)/) || [])[1];
        const brief = (briefQ || (b.match(/\*\*Brief[^\n]*\*\*[\s\S]*?```\n([\s\S]*?)\n```/) || [])[1] || '').trim();
        const full = ((b.match(/\*\*Full[^\n]*\*\*[\s\S]*?```\n([\s\S]*?)\n```/) || [])[1] || '').trim();
        if (full) return { brief, full };
      }
    }
  } catch (_) {}
  // Резерва: store-listing/ru.txt (тулкит фамилията)
  try {
    const txt = require('fs').readFileSync(path.join(pub, 'store-listing', 'ru.txt'), 'utf8').replace(/\r/g, '').trim();
    const paras = txt.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    const body = paras.filter((p) => !/^(Поддержка|По вопросам|Support|For questions)/i.test(p));
    const brief = (body[1] && body[1].length <= 80) ? body[1] : (body[0] || '').slice(0, 80);
    const full = body.join('\n\n');
    if (full) return { brief, full };
  } catch (_) {}
  return { brief: '', full: '' };
}
const RU = ruDesc();
// per-app RuStore данни (тип/категория/възраст/цена в рубли)
const rustoreCfg = readJson(path.join(pub, 'rustore.json')) || {};
const GAMES = new Set(['rustam', 'fps-hunter', 'plane-shooter', 'dodge-master', 'duel', 'hmm', 'titans-fight']);
const appType = rustoreCfg.type || (GAMES.has(app) ? 'Game' : 'Application');   // MAIN | GAMES радио
const catMain = rustoreCfg.category || '';       // точен руски надпис от падащото „Main"
const ageR = rustoreCfg.age || '';               // 0+/6+/12+/16+/18+
const priceRub = rustoreCfg.priceRub != null ? String(rustoreCfg.priceRub) : '';
const tags = Array.isArray(rustoreCfg.tags) ? rustoreCfg.tags.slice(0, 5) : [];   // Search Tags (до 5, английски)
const EMAIL = 'miroljubkalaydjiev177@gmail.com';
const WEBSITE = 'https://pupikes.com';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function log(s) { console.log('  ' + s); }

let PW; for (const c of ['desktop/selflearning-friend/node_modules/playwright', 'node_modules/playwright']) { try { PW = require(path.resolve(c)); break; } catch (_) {} }
if (!PW) { console.log('Playwright липсва.'); process.exit(2); }

(async () => {
  let browser;
  try { browser = await PW.chromium.connectOverCDP('http://127.0.0.1:9222'); }
  catch (_) { console.log('Не намирам браузър на 9222. Първо пусни: node deploy-scripts/rustore-release-bot-launch.cjs'); process.exit(2); }
  const ctx = browser.contexts()[0];

  function rsPage() { return ctx.pages().find((p) => /rustore\.ru/.test(p.url())) || ctx.pages()[0]; }

  async function fillCurrent() {
    const page = rsPage();
    let url = ''; try { url = page.url(); } catch (_) {}
    console.log('\nПриложение: ' + app + '  |  Име за конзолата: ' + appName);
    console.log('Адрес: ' + url);

    // ── Екран 0: „New app" (Add an app) — deviceType/monetizationType/name ──
    const nameInput = page.locator('input[name="name"]:visible').first();
    const isNewApp = await nameInput.count().catch(() => 0);
    if (isNewApp) {
      console.log('Екран: New app (Add an app)');
      // deviceType → MOBILE (Universal). ВНИМАНИЕ: „Monetization strategy" е НЕОБРАТИМА (cannot be
      // changed) → приложението е ПЛАТЕНО (PAID), не Free. „Console name" също е неизменяемо.
      // RuStore ползва custom радиа със СКРИТ <input> → .check() на входа не задейства React. Кликваме
      // ОБВИВАЩИЯ етикет и ПРОВЕРЯВАМЕ, че input-ът е избран (резерва: клик по видимия текст).
      async function pickRadioByLabel(name, value, human) {
        const input = page.locator('input[name="' + name + '"][value="' + value + '"]');
        const label = page.locator('label').filter({ has: input }).first();
        if (await label.count().catch(() => 0)) { await label.click({ force: true }).catch(() => {}); await sleep(300); }
        let ok = await input.isChecked().catch(() => false);
        if (!ok) { await page.getByText(human, { exact: false }).first().click({ force: true }).catch(() => {}); await sleep(300); ok = await input.isChecked().catch(() => false); }
        return ok;
      }
      const okDev = await pickRadioByLabel('deviceType', 'MOBILE', 'Universal');
      log(okDev ? '✓ Тип устройство: Universal (MOBILE)' : '↷ deviceType — избери Universal ръчно');
      const okPaid = await pickRadioByLabel('monetizationType', 'PAID', 'Paid');
      log(okPaid ? '✓ Монетизация: Paid (продажба на самото приложение) — НЕОБРАТИМО' : '⚠ monetizationType — НЕ успях да маркирам Paid, направи го РЪЧНО (иначе остава Free — необратимо!)');
      await nameInput.fill(''); await nameInput.fill(appName);
      log('✓ Console name ← ' + appName + ' (неизменяемо)');
      log('■ Прегледай (Paid ли е!) и натисни „Add“ сам, за да създадеш приложението.');
      return;
    }

    // ── Екран: Upload app version → стъпка „Media files" (икона + скрийншоти) ──
    if (await page.locator('input[name="screens"]').count().catch(() => 0)) {
      console.log('Екран: Upload app version — Media files');
      if (iconPath) {
        await page.locator('input[name="icon"]').first().setInputFiles(iconPath).then(() => log('✓ Икона качена: ' + path.basename(iconPath))).catch(() => log('↷ икона — качи ръчно'));
        await sleep(3000);
      } else log('↷ няма икона в publish/');
      if (shotPaths.length) {
        await page.locator('input[name="screens"]').first().setInputFiles(shotPaths).then(() => log('✓ Скрийншоти качени (' + shotPaths.length + ')')).catch(() => log('↷ скрийншоти — качи ръчно'));
        await sleep(4500);
      } else log('↷ няма скрийншоти в publish/');
      log('■ Tablet/Video се пропускат (по избор). Прегледай и натисни „Continue" сам.');
      return;
    }

    // ── Екран: Upload app version → стъпка „Safety" (Requested data / Data types) ──
    // Нашите приложения НЕ събират лични данни → нищо не се избира (остава 0/38).
    if (/\/versions\/add/.test(url) && (await page.locator('text=/Requested data|Data types/i').count().catch(() => 0))) {
      console.log('Екран: Upload app version — Safety (Requested data)');
      // „Sensitive Permissions" (напр. POST_NOTIFICATIONS) — ако APK-то иска чувствително разрешение,
      // RuStore показва поле „Reasons" и иска обяснение. Попълваме неутрална причина (локални известия,
      // без лични данни), за да мине модерацията. Ако полето липсва — пропускаме.
      // Причината идва от файла-форма: rustore/<app>/publish/rustore.json → "sensitivePermissionReason".
      const reasonTa = page.locator('textarea:visible').first();
      if (await reasonTa.count().catch(() => 0)) {
        const reason = rustoreCfg.sensitivePermissionReason || '';
        if (!reason) log('↷ няма „sensitivePermissionReason" в rustore.json — ако RuStore иска причина, добави я във файла');
        else {
          const cur = await reasonTa.inputValue().catch(() => '');
          if (!cur.trim()) await reasonTa.fill(reason).then(() => log('✓ Причина за чувствителното разрешение ← от файла')).catch(() => log('↷ причина — попълни ръчно'));
          else log('↷ причината вече е попълнена — не пипам');
        }
      }
      log('■ Приложението НЕ събира лични данни → „Data types" остава празно (0/38). Натисни „Continue" сам.');
      return;
    }

    // ── Екран: „Upload app version" (/versions/add) → качи RuStore release APK ──
    const fileInput = page.locator('input[type="file"][name="storageUploads"]');
    if (await fileInput.count().catch(() => 0)) {
      console.log('Екран: Upload app version');
      if (!apkPath) { log('↷ Не намерих RuStore release APK в apk/rustore/release — качи ръчно.'); }
      else {
        const already = await page.locator('text=' + JSON.stringify(path.basename(apkPath))).count().catch(() => 0);
        if (already) { log('↷ APK вече е качен (' + path.basename(apkPath) + ') — не качвам повторно.'); }
        else {
          await fileInput.setInputFiles(apkPath).then(() => log('✓ Качих APK: ' + path.basename(apkPath))).catch((e) => log('↷ качване неуспешно: ' + e.message));
          log('⏳ изчаквам обработката на файла (може да отнеме)…');
          await sleep(8000);
        }
      }
      // Коментар за модератора (акаунт? лични данни?) — попълва се ВИНАГИ (APK-то не иска подпис)
      const comment = moderatorComment();
      const cta = page.locator('textarea[placeholder*="account" i], textarea[placeholder*="moderator" i], textarea:visible').first();
      if (await cta.count().catch(() => 0)) await cta.fill(comment).then(() => log('✓ Коментар за модератора ← ' + comment)).catch(() => log('↷ коментар — не попълних'));
      log('■ Прегледай и натисни „Continue" сам.');
      return;
    }

    // ── Екран: Upload app version → стъпка „Information" (име/тип/цена/категория/описания/контакти) ──
    if (await page.locator('input[name="appName"]:visible').count().catch(() => 0)) {
      console.log('Екран: Upload app version — Information');
      const fillByName = async (name, val) => {
        if (!val) return;
        const el = page.locator('[name="' + name + '"]:visible').first();
        if (!(await el.count().catch(() => 0))) { log('↷ няма поле ' + name); return; }
        await el.fill('').catch(() => {}); await el.fill(val).then(() => log('✓ ' + name + ' ← ' + String(val).slice(0, 40))).catch(() => log('↷ не попълних ' + name));
      };
      const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const selectDropdown = async (labelText, optionText) => {
        if (!optionText) return;
        try {
          const trigger = page.locator(':text("' + labelText + '")').first().locator('xpath=following::*[self::input or @role="combobox" or contains(@class,"select")][1]');
          await trigger.click({ timeout: 3000 }); await sleep(1000);
          const opt = page.locator('[role="option"]:visible, .el-select-dropdown__item:visible, li:visible').filter({ hasText: new RegExp('^' + esc(optionText)) }).first();
          await opt.click({ timeout: 3000 });
          log('✓ ' + labelText + ' ← ' + optionText);
          await sleep(500);
        } catch (e) { log('↷ „' + labelText + '" (' + optionText + ') — избери ръчно'); await page.keyboard.press('Escape').catch(() => {}); }
      };
      // Име (публично), Тип, Цена
      await fillByName('appName', baseName);
      await page.locator('input[type="radio"][name="appTypeOption"][value="' + (appType === 'Game' ? 'GAMES' : 'MAIN') + '"]').check({ force: true }).then(() => log('✓ Type ← ' + appType)).catch(() => log('↷ Type — избери ръчно'));
      await fillByName('priceValue', priceRub);
      // Категория (Main) + Възрастово ограничение
      await selectDropdown('Main', catMain);
      await selectDropdown('Age restriction', ageR);
      // Описания (руски) + Контакти
      await fillByName('shortDescription', RU.brief);
      await fillByName('fullDescription', RU.full);
      await fillByName('developerContacts.email', EMAIL);
      await fillByName('developerContacts.website', WEBSITE);
      // Search Tags (react-select мулти-избор, до 5, английски от фиксирания списък)
      if (tags.length) {
        const tanchor = page.locator(':text("Search Tags")').first();
        const tcontrol = tanchor.locator('xpath=following::*[contains(@class,"react-select__control")][1]');
        // ВАЖНО: клик по ВЕЧЕ избран таг го МАХА (react-select toggle). Затова първо четем избраните
        // и НИКОГА не пипаме съществуващ — само добавяме липсващите, с проверка след всяко добавяне.
        // Избраните чипове са с клас „react-select__multi-value__label" (НЕ „…multi-value").
        const chips = () => page.locator('.react-select__multi-value__label').allInnerTexts().catch(() => []);
        // Ботът е авторитетен спрямо файла. Чиповете НЯМАТ бутон „×"; махат се с Backspace (маха последния
        // при празно поле). Ако текущите тагове ≠ желаните → изчиства всички и добавя наново точно тези от
        // файла (RuStore приема макс 5, затова първо се чисти, иначе добавянето се блокира на 5).
        const want = tags.map((t) => t.toLowerCase());
        const curNow = (await chips()).map((t) => t.replace(/\s+/g, ' ').trim().toLowerCase());
        const same = curNow.length === want.length && want.every((w) => curNow.includes(w));
        if (!same && curNow.length) {
          await tcontrol.click({ timeout: 3000 }).catch(() => {}); await sleep(300);
          for (let g = 0; g < 12 && (await chips()).length; g++) { await page.keyboard.press('Backspace'); await sleep(300); }
          await page.keyboard.press('Escape').catch(() => {});
          log('✗ изчистих старите тагове (не съвпадаха с файла)');
        }
        const already = (await chips()).map((t) => t.replace(/\s+/g, ' ').trim().toLowerCase());
        for (const tag of tags) {
          if (already.includes(tag.toLowerCase())) { log('↷ таг „' + tag + '" вече е избран — не пипам'); continue; }
          try {
            await tcontrol.scrollIntoViewIfNeeded().catch(() => {});
            await tcontrol.click({ timeout: 3000 }); await sleep(500);
            // Въвеждане през клавиатурата (истински React събития — fill не филтрира react-select).
            await page.keyboard.type(tag, { delay: 25 });
            await sleep(900);
            const topt = page.locator('.react-select__option').filter({ hasText: new RegExp('^' + esc(tag) + '$', 'i') }).first();
            if (await topt.count().catch(() => 0)) {
              await topt.click({ timeout: 2500 }); await sleep(400);
              const now = (await chips()).map((t) => t.trim().toLowerCase());
              if (now.some((e) => e.includes(tag.toLowerCase()))) { log('✓ таг ← ' + tag); already.push(tag.toLowerCase()); }
              else { log('↷ таг „' + tag + '" — не се потвърди, сложи го ръчно'); await page.keyboard.press('Escape').catch(() => {}); }
            } else { log('↷ таг „' + tag + '" — няма в списъка, сложи го ръчно'); await page.keyboard.press('Escape').catch(() => {}); }
          } catch (e) { log('↷ таг „' + tag + '" — добави ръчно'); }
        }
      }
      log('■ Прегледай всичко (цена ' + (priceRub || '?') + '₽, категория, възраст, тагове) и натисни „Continue" сам. (Не пазя чернова — ти преглеждаш и публикуваш.)');
      return;
    }

    // ── Екран: списък с версии (/versions) → отвори формата за качване ──
    if (/\/versions\/?$/.test(url)) {
      const upBtn = page.locator('button:has-text("Upload the version"), a:has-text("Upload the version")').first();
      if (await upBtn.count().catch(() => 0)) {
        console.log('Екран: версии → отварям „Upload the version"');
        await upBtn.click({ timeout: 4000 }).catch(() => log('↷ не намерих бутона — натисни го ръчно'));
        await sleep(2500);
        log('✓ Отворих формата за качване. Натисни ENTER пак, за да кача APK-то.');
        return;
      }
    }

    // ── Екран: списък с приложения → отвори нашето (по console name) ──
    if (/\/apps\/?$/.test(url)) {
      const row = page.locator('text=' + JSON.stringify(appName)).first();
      if (await row.count().catch(() => 0)) {
        console.log('Екран: списък с приложения → отварям „' + appName + '"');
        await row.click({ timeout: 4000 }).catch(() => log('↷ не можах да кликна приложението — отвори го ръчно'));
        await sleep(2500);
        log('✓ Отворих приложението. Натисни ENTER пак за следващия екран.');
        return;
      }
    }

    // ── Екран: приложението е отворено, но не на „App page" → отиди на „App page" (root) ──
    const mId = url.match(/\/apps\/(\d+)/);
    if (mId && !/\/apps\/\d+\/?$/.test(url)) {
      const appPageLink = page.locator('a[href$="/apps/' + mId[1] + '"]').first();
      if (await appPageLink.count().catch(() => 0)) {
        console.log('Екран: отивам на „App page" (описание/снимки)');
        await appPageLink.click({ timeout: 4000 }).catch(() => log('↷ не намерих линка „App page" — кликни го ръчно вляво'));
        await sleep(2500);
        log('✓ На „App page". Натисни ENTER пак.');
        return;
      }
    }

    // ── Непознат екран: дъмп, за да го разчетем и разширим бота ──
    console.log('Екран: не разпознат — ще дам маркери, за да го добавим.');
    const heads = await page.locator('h1:visible, h2:visible, h3:visible').allInnerTexts().catch(() => []);
    log('Заглавия: ' + [...new Set(heads.map((t) => t.trim()).filter(Boolean))].slice(0, 8).join(' | '));
    const labels = await page.locator('label:visible').allInnerTexts().catch(() => []);
    log('Полета/етикети: ' + [...new Set(labels.map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean))].slice(0, 12).join(' | '));
    const btns = await page.locator('button:visible').allInnerTexts().catch(() => []);
    log('Бутони: ' + [...new Set(btns.map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean))].slice(0, 10).join(' | '));
    log('Съвет: кажи ми на кой екран си (напр. „ru-ekran1“) и ще добавя попълването му.');
  }

  // Намира ВИДИМИЯ активен бутон за „напред" на текущия екран (по приоритет). RuStore крие бутона в
  // дъното на дълга форма → потребителят понякога не го вижда. Ботът пита и, при „да", го натиска сам.
  async function advanceButton() {
    const page = rsPage();
    const labels = ['Submit for Moderation', 'Continue', 'Add', 'Select', 'OK', 'Confirm'];
    const btns = page.locator('button:visible');
    const n = await btns.count().catch(() => 0);
    for (const lb of labels) {
      for (let i = 0; i < n; i++) {
        const btn = btns.nth(i);
        const txt = ((await btn.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
        if (txt.toLowerCase() === lb.toLowerCase()) {
          const disabled = await btn.isDisabled().catch(() => false);
          if (!disabled) return { loc: btn, label: lb };
        }
      }
    }
    return null;
  }

  const loop = process.argv.includes('--loop');
  if (loop) {
    console.log('\n   РЕЖИМ ENTER (RuStore): отвори екран, натисни ENTER да го попълня. После питам за бутона за напред. „q“ = изход.\n');
    const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
    // Устойчиво четене: опашка от редове, за да НЕ се губят при подаване през pipe (async паузи между
    // екрани иначе затварят readline и глътват буферираните редове).
    const queue = []; let waiter = null; let closed = false;
    rl.on('line', (l) => { if (waiter) { const w = waiter; waiter = null; w(l); } else queue.push(l); });
    rl.on('close', () => { closed = true; if (waiter) { const w = waiter; waiter = null; w(null); } });
    const question = (q) => new Promise((res) => {
      process.stdout.write(q);
      if (queue.length) return res(queue.shift());
      if (closed) return res(null);
      waiter = res;
    });
    (async function runLoop() {
      for (;;) {
        const a = await question('ENTER = попълни текущия екран (или q за изход): ');
        if (a === null || a.trim().toLowerCase() === 'q') { try { rl.close(); } catch (_) {} process.exit(0); }
        try { await fillCurrent(); } catch (e) { console.log('грешка: ' + e.message); }
        // ПРАВИЛО: след като екранът е попълнен, ВИНАГИ проверявай бутона за напред.
        //  • има АКТИВЕН бутон → питай дали да го натисна;
        //  • НЯМА активен бутон → вероятно нещо не е попълнено/готово (или още се обработва) = ГРЕШКА,
        //    обяви я (не мълчи), за да се провери екранът.
        let btn = null;
        try { btn = await advanceButton(); } catch (e) { console.log('   (проверка на бутон: ' + e.message + ')'); }
        if (!btn) {
          console.log('   ⚠ ГРЕШКА? Няма АКТИВЕН бутон за напред (Continue/Submit…) на този екран — вероятно');
          console.log('     нещо не е попълнено/готово (или файл още се обработва). Провери екрана, после ENTER пак.');
          continue;
        }
        const yn = await question('   Да натисна ли бутона „' + btn.label + '"? (да/y = натискам, друго = не) : ');
        if (yn === null) { try { rl.close(); } catch (_) {} process.exit(0); }
        if (/^(да|d|y|yes|д)$/i.test(yn.trim())) {
          await btn.loc.scrollIntoViewIfNeeded().catch(() => {});
          await btn.loc.click({ timeout: 6000 }).then(() => console.log('   ✓ натиснах „' + btn.label + '"')).catch((e) => console.log('   ↷ не можах да натисна: ' + e.message));
          await sleep(2500);
        } else { console.log('   ↷ ок, не го натискам.'); }
      }
    })();
  } else {
    await fillCurrent();
    // НЕ затваряме браузъра — пазим едно логване. Излизаме чисто (CDP връзката иначе държи процеса жив).
    process.exit(0);
  }
})().catch((e) => { console.error(e); process.exit(1); });
