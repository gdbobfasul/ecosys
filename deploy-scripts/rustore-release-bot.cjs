// rustore-release-bot.cjs — попълва конзолата на RuStore (console.rustore.ru) ВИДИМО, като се закача
// за вече отворения ти браузър (debug порт 9222). Не натиска финалните бутони (Add/Save/Submit) —
// ти ги натискаш, след като прегледаш. Данните идват от publish/ на приложението (един източник).
//
// Режими (наравно):
//   <app> --loop        попълване в режим ENTER (ти отваряш екран, ENTER = попълни; „q“ = изход)
//   <app> --auto        авто-попълва и минава екраните сам (спира преди подаване)
//   <app> --auto --submit  като --auto, но натиска и „Submit for Moderation" на финала
//   <app> --insights    РАЗВИТИЕ: чете от конзолата рейтинг/мнения/инсталации/приходи (само чете, нищо не подава)
// При всяко пускане ботът събира и НОВИТЕ модераторски забележки (moderation-rustore.json) — отделно от --insights.
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
// ★ Console name е НЕИЗМЕНЯЕМО. Ако магазинното име се смени (напр. Authenticator → „Pupikes Auth & Passwords"),
//   списъкът трябва да се търси по СТАРОТО console name → rustore.json.consoleName (иначе ботът създава ДУБЛИКАТ).
const consoleName = (readJson(path.join(pub, 'rustore.json')).consoleName) || appName;

// Намери готовото RuStore RELEASE APK за това приложение (apk/rustore/release/<Име>-rustore-release.apk).
// Съпоставя по нормализирано име (без интервали/специални знаци), пробва марка/базово име/id на папката.
function findRustoreApk() {
  const dir = path.resolve('apk/rustore/release');
  const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const wants = [norm(baseName), norm(brand), norm(app)].filter(Boolean);
  try {
    const files = require('fs').readdirSync(dir).filter((f) => /\.apk$/i.test(f));
    // 1) ТОЧНО съвпадение на стема (Име-rustore-release.apk) — единственият безопасен път.
    for (const f of files) { const stem = norm(f.replace(/-rustore-release\.apk$/i, '')); if (wants.includes(stem)) return path.join(dir, f); }
    // 2) Хлабав резерв (substring) — САМО ако е ЕДНОЗНАЧЕН: точно ЕДИН файл пасва и то по
    //    достатъчно дълъг ключ (≥5 знака), за да не хване чуждо APK (напр. „fair“ → 2 файла).
    //    Ако е двусмислен или нищо не пасва → връщаме '' (по-добре явна грешка, отколкото чуждо APK
    //    в чужда регистрация). Виж искането: „2 различни приложения не трябва в една регистрация“.
    const longWants = wants.filter((w) => w.length >= 5);
    const hits = [];
    for (const f of files) { const nf = norm(f); if (longWants.some((w) => nf.includes(w))) hits.push(f); }
    if (hits.length === 1) return path.join(dir, hits[0]);
    if (hits.length > 1) { try { console.error('[APK] двусмислено съпоставяне за „' + (baseName || app) + '“ → ' + hits.join(', ') + ' — НЕ качвам (сложи точно име).'); } catch (_) {} }
  } catch (_) {}
  return '';
}
const apkPath = findRustoreApk();
let _apkUploaded = false; // ★ (07.10) APK се качва ТОЧНО ВЕДНЪЖ на run — иначе fillCurrent() при всяка итерация
//   пре-качваше същото APK → дубликати „A package with this name already exists" → „1 предупреждение".

// ★ УНИКАЛНО ИМЕ per версия (24.09): RuStore отказва APK, чието ФАЙЛОВО ИМЕ вече е ползвано в друга
//   версия на апа („A package with this name already exists. Rename the package.") — дори при нов
//   versionCode. Затова качваме КОПИЕ на APK-то с versionCode в името → всяка версия = уникален файл.
const uploadApkPath = (() => {
  if (!apkPath) return '';
  try {
    const gradle = fs.readFileSync(path.resolve('rustore', app, 'android', 'app', 'build.gradle'), 'utf8');
    const vc = (gradle.match(/versionCode\s+(\d+)/) || [])[1];
    if (!vc) return apkPath;
    const base = path.basename(apkPath).replace(/-rustore-release\.apk$/i, '');
    const uniq = path.join(path.dirname(apkPath), base + '-vc' + vc + '-rustore-release.apk');
    if (uniq === apkPath) return apkPath;
    try { fs.copyFileSync(apkPath, uniq); } catch (_) { return apkPath; }
    return uniq;
  } catch (_) { return apkPath; }
})();

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
        const news = ((b.match(/\*\*New features[^\n]*\*\*[\s\S]*?```\n([\s\S]*?)\n```/) || [])[1] || '').trim();
        if (full) return { brief, full, news };
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
    if (full) return { brief, full, news: '' };
  } catch (_) {}
  return { brief: '', full: '', news: '' };
}
const RU = ruDesc();
// (13.09.2026) RuStore отказва „остатъци от html-верстка“ в описанието → маха всякакви HTML тагове от Short/Full.
const _stripHtml = (x) => (x || '').replace(/<\/?[A-Za-z][^>]*>/g, '');
RU.brief = _stripHtml(RU.brief); RU.full = _stripHtml(RU.full); RU.news = _stripHtml(RU.news || '');
// „Что нового" (release notes): ако липсва изрично → кратко описание на промените (RuStore отхвърля празно/шаблонно поле)
if (!RU.news || RU.news.length < 15) RU.news = 'Обновление: улучшена локализация на русский язык, исправления интерфейса и стабильности. ' + (RU.brief || '');
// per-app RuStore данни (тип/категория/възраст/цена в рубли)
const rustoreCfg = readJson(path.join(pub, 'rustore.json')) || {};
// Монетизация при СЪЗДАВАНЕ (НЕОБРАТИМА в RuStore!). model:"free" → FREE (безплатните „Lite" демо
// апове); всичко друго → PAID (платените). rustore.json.monetization може да го надпише изрично.
const _monet = readJson(path.join(pub, 'monetization.json')) || {};
const isFreeApp = (rustoreCfg.monetization === 'FREE') || (rustoreCfg.monetization !== 'PAID' && String(_monet.model || '').toLowerCase() === 'free');
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

  // ── РЕЖИМ „РАЗВИТИЕ" (--insights): чета от конзолата как се развива апът — рейтинг, мнения на
  // потребители, инсталации, приходи/плащания/продажби — РАЗЛИЧНО от модераторските коментари.
  // Само чете (нищо не въвежда/подава). Записва в app-shared/rustore-insights.json + publish/insights.md.
  if (process.argv.includes('--insights')) {
    try {
      const { collectInsights } = require('./lib/insights.cjs');
      // Обхват: KCY_INSIGHTS_APPS (интервал/запетая) = едно/няколко/всички; иначе само подаденото.
      const scope = (process.env.KCY_INSIGHTS_APPS || '').split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
      const apps = scope.length ? scope : [app];
      console.log('\n   РЕЖИМ РАЗВИТИЕ (RuStore): чета рейтинг/мнения/инсталации/приходи за ' + apps.length + ' приложение(я)…\n');
      const r = await collectInsights({ browser, app, appName, apps });
      if (!r.ok) { console.log('  ✗ ' + (r.error || 'не успях да прочета конзолата')); process.exit(0); }
      console.log('   Общо приложения в конзолата (преглед): ' + (r.overviewCount || 0) + '\n');
      const show = (t, arr) => { console.log('     ' + t + ':'); if (!arr || !arr.length) console.log('       —'); else arr.slice(0, 6).forEach((x) => console.log('       • ' + String(x).slice(0, 140))); };
      for (const res of (r.results || [])) {
        const rec = res.rec || {};
        console.log('  ── ' + res.appName + (rec.id ? ' (id ' + rec.id + ')' : ' — НЕ е намерено в списъка') + ' ──');
        show('Статус', rec.status);
        show('Рейтинг / оценки', rec.rating);
        show('Мнения на потребители', rec.reviews);
        show('Инсталации / сваляния', rec.installs);
        show('Приходи / плащания / продажби', rec.money);
        console.log('');
      }
      console.log('   📄 Записах: app-shared/rustore-insights.json + по един publish/insights.md на приложение.');
    } catch (e) { console.log('  ✗ Режим „развитие" пропаднал: ' + (e.message || e)); }
    process.exit(0);
  }

  // ── РЕЖИМ „РЕФЪНД" (--refund): връща конкретна покупка на купувача (SBP/карта) през конзолата.
  // Аргументи: KCY_REFUND_ID = конзолен app id (или се взима от app-shared/rustore-app-ids.json по слъг),
  //            KCY_REFUND_INVOICE = номер на инвойса за връщане. БЕЗ --confirm → само показва потвърждението.
  // Поток (проверен на Pupikes LB): /apps/<id>/payments → клик на инвойса → детайл → бутон „Refund"
  // (ТОЧЕН текст, не филтъра „Refund date") → модал „Refund payment on invoice №…?" → бутон „Refund".
  if (process.argv.includes('--refund')) {
    try {
      const idsMap = (readJson(path.resolve('app-shared/rustore-app-ids.json')) || {}).ids || {};
      const appId = process.env.KCY_REFUND_ID || idsMap[app];
      const invoice = process.env.KCY_REFUND_INVOICE || '';
      const doConfirm = process.argv.includes('--confirm');
      if (!appId) { console.log('  ✗ Няма app id (KCY_REFUND_ID или в rustore-app-ids.json за „' + app + '").'); process.exit(1); }
      if (!invoice) { console.log('  ✗ Няма KCY_REFUND_INVOICE (номер на инвойса за връщане).'); process.exit(1); }
      const p = rsPage();
      try { await p.goto('https://console.rustore.ru/apps/' + appId + '/payments', { waitUntil: 'networkidle', timeout: 30000 }); } catch (_) {}
      await sleep(3000);
      const inv = p.locator('text=' + invoice).first();
      if (!(await inv.count().catch(() => 0))) { console.log('  ✗ Не намерих инвойс ' + invoice + ' на страницата с плащания.'); process.exit(1); }
      await inv.click({ timeout: 5000 }).catch(() => {});
      await sleep(2500);
      let rb = p.locator('button:text-is("Refund"), [role="button"]:text-is("Refund")').first();
      if (!(await rb.count().catch(() => 0))) rb = p.getByRole('button', { name: /^Refund$/ }).first();
      if (!(await rb.count().catch(() => 0))) { console.log('  ✗ Не намерих ТОЧЕН бутон „Refund" в детайла на инвойса (не рискувам).'); process.exit(1); }
      await rb.click({ timeout: 5000 }).catch((e) => console.log('  клик Refund: ' + e.message));
      await sleep(2000);
      const dlg = await p.evaluate(() => { const m = document.querySelector('[role="dialog"],[class*="modal" i]'); return m ? (m.innerText || '').replace(/\s+/g, ' ').slice(0, 300) : ''; }).catch(() => '');
      console.log('  Потвърждение: ' + (dlg || '(няма модал)'));
      if (!doConfirm) { console.log('  ↷ БЕЗ --confirm: показах модала, НЕ финализирах. Прегледай и пусни пак с --confirm.'); process.exit(0); }
      let done = false;
      for (const sel of ['button:text-is("Refund")', 'button:has-text("Confirm")', 'button:has-text("Вернуть")', 'button:has-text("Подтвердить")']) {
        const b = p.locator(sel).last();
        if (await b.count().catch(() => 0)) { const t = (await b.innerText().catch(() => '')); if (!/cancel|отмен/i.test(t)) { await b.click({ timeout: 5000 }).catch(() => {}); done = true; break; } }
      }
      await sleep(2500);
      const ok = await p.evaluate(() => /Refunded|Refunding|Возвра/i.test(document.body.innerText || '')).catch(() => false);
      console.log(done && ok ? ('  ✅ РЕФЪНД направен за инвойс ' + invoice + ' (статус Refunded/Refunding).') : ('  ↷ Кликнах, но не потвърдих статус Refunded — провери ръчно.'));
    } catch (e) { console.log('  ✗ Режим „рефънд" пропадна: ' + (e.message || e)); }
    process.exit(0);
  }

  // ── РЕЖИМ „СТАТУСИ" (--status): чета целия списък apps → пиша на диска име→статус→версия +
  // засичам ПОВТАРЯЩИ СЕ откази (ап с известна модераторска причина, който пак е „не публикуван").
  // Само чете. Резултат: app-shared/rustore-status.json + docs/publish/MODERATION-STATUS.md.
  if (process.argv.includes('--status')) {
    try {
      const p = rsPage();
      try { await p.goto('https://console.rustore.ru/apps', { waitUntil: 'networkidle', timeout: 30000 }); } catch (_) {}
      try { await p.waitForTimeout(3500); } catch (_) {}
      const txt = await p.evaluate(() => document.body.innerText).catch(() => '');
      const L = txt.split('\n').map((s) => s.trim()).filter(Boolean);
      const rows = [];
      for (let i = 0; i < L.length; i++) {
        if (/^DaiGrup LTD\.?$/i.test(L[i])) {
          const name = L[i - 2] || '?';
          const ver = /^\d/.test(L[i + 1] || '') ? L[i + 1] : '';
          const status = L[i + 3] || '';
          rows.push({ name, status, version: ver });
        }
      }
      // модераторски причини (ако вече са събрани) → за засичане на повтарящи се откази
      let mod = {}; try { mod = (require(path.resolve('app-shared/moderation-rustore.json')).apps) || {}; } catch (_) {}
      const outJson = { store: 'rustore', _note: 'Автоматично от бота (--status). Не редактирай ръчно.', at: new Date().toISOString(), apps: rows };
      fs.writeFileSync(path.resolve('app-shared/rustore-status.json'), JSON.stringify(outJson, null, 2));
      const notPub = rows.filter((r) => /Not published|moderation|Rejected/i.test(r.status));
      let md = '# RuStore — статус на модерацията (автоматично от бота)\n\n_Обновено: ' + outJson.at + '_\n\n';
      md += 'Общо: ' + rows.length + ' · Публикувани: ' + (rows.length - notPub.length) + ' · НЕ публикувани: ' + notPub.length + '\n\n';
      md += '## НЕ публикувани (чакат фикс/подаване)\n\n';
      for (const r of notPub) md += '- **' + r.name + '** — ' + r.status + (r.version ? (' (v' + r.version + ')') : '') + '\n';
      md += '\n## Публикувани\n\n';
      for (const r of rows.filter((x) => !notPub.includes(x))) md += '- ' + r.name + ' — v' + r.version + '\n';
      try { fs.mkdirSync(path.resolve('docs/publish'), { recursive: true }); } catch (_) {}
      fs.writeFileSync(path.resolve('docs/publish/MODERATION-STATUS.md'), md);
      console.log('\n   РЕЖИМ СТАТУСИ (RuStore): ' + rows.length + ' апа · ' + notPub.length + ' НЕ публикувани.');
      console.log('   📄 Записах: app-shared/rustore-status.json + docs/publish/MODERATION-STATUS.md');
      notPub.forEach((r) => console.log('     • ' + r.name + '  →  ' + r.status));
    } catch (e) { console.log('  ✗ Режим „статуси" пропадна: ' + (e.message || e)); }
    process.exit(0);
  }

  // ── РЕЖИМ „ПРИЧИНИ" (--reasons): за всеки ОТХВЪРЛЕН ап отварям версията и чета „Moderator's
  // comment" (истинската причина). Записвам на диска. Само чете. (Причината НЕ е в списъка — тя е
  // на страницата на версията, в съседен елемент под етикета „Moderator's comment".)
  if (process.argv.includes('--reasons')) {
    try {
      const p = rsPage();
      try { await p.goto('https://console.rustore.ru/apps', { waitUntil: 'networkidle', timeout: 30000 }); } catch (_) {}
      try { await p.waitForTimeout(3000); } catch (_) {}
      const list = await p.evaluate(() => {
        const out = [];
        document.querySelectorAll('a[href*="/apps/"]').forEach((a) => {
          const m = (a.getAttribute('href') || '').match(/\/apps\/(\d+)/);
          const t = (a.innerText || '').replace(/\s+/g, ' ').trim();
          if (m) out.push({ id: m[1], row: t });
        });
        return out;
      }).catch(() => []);
      // само НЕ публикуваните
      const seen = new Set();
      const rejected = list.filter((r) => /Not published|moderation|Rejected/i.test(r.row) && !seen.has(r.id) && seen.add(r.id));
      const scope = (process.env.KCY_REASONS_APPS || '').split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
      const results = [];
      for (const r of rejected) {
        const name = (r.row.split(' ... ')[0] || r.row).replace(/\s+DaiGrup.*$/, '').trim();
        if (scope.length && !scope.some((s) => name.toLowerCase().includes(s.toLowerCase()))) continue;
        try { await p.goto('https://console.rustore.ru/apps/' + r.id + '/versions', { waitUntil: 'networkidle', timeout: 25000 }); } catch (_) {}
        try { await p.waitForTimeout(2200); } catch (_) {}
        const rows = await p.$$('text=Moderation not passed');
        if (rows.length) { try { await rows[0].click({ timeout: 4000 }); } catch (_) {} try { await p.waitForTimeout(3000); } catch (_) {} }
        const comment = await p.evaluate(() => {
          const all = Array.from(document.querySelectorAll('*'));
          for (const el of all) {
            const t = (el.innerText || '').trim();
            if (/^Moderator.?s comment$|Комментарий модератора/i.test(t) && el.children.length <= 2) {
              let sib = el.nextElementSibling, acc = '';
              while (sib && acc.length < 700) { acc += ' ' + (sib.innerText || ''); sib = sib.nextElementSibling; }
              if (!acc.trim() && el.parentElement) acc = el.parentElement.innerText || '';
              return acc.replace(/\s+/g, ' ').replace(/^Moderator.?s comment/i, '').trim().slice(0, 700);
            }
          }
          return '';
        }).catch(() => '');
        results.push({ name, id: r.id, url: p.url(), comment });
        console.log('  • ' + name + ' → ' + (comment ? comment.slice(0, 160) : '(няма коментар на страницата)'));
      }
      const out = { store: 'rustore', at: new Date().toISOString(), _note: 'Автоматично от бота (--reasons) — Moderator\'s comment от страницата на версията.', apps: results };
      fs.writeFileSync(path.resolve('app-shared/rustore-reasons.json'), JSON.stringify(out, null, 2));
      let md = '# RuStore — причини за отказ (Moderator\'s comment, извлечени автоматично)\n\n_Обновено: ' + out.at + '_\n\n';
      for (const r of results) md += '### ' + r.name + '\n\n> ' + (r.comment || '(празно)') + '\n\n' + r.url + '\n\n';
      try { fs.mkdirSync(path.resolve('docs/publish'), { recursive: true }); } catch (_) {}
      fs.writeFileSync(path.resolve('docs/publish/MODERATION-REASONS-LIVE.md'), md);
      console.log('\n   📄 Записах: app-shared/rustore-reasons.json + docs/publish/MODERATION-REASONS-LIVE.md (' + results.length + ' апа)');
    } catch (e) { console.log('  ✗ Режим „причини" пропадна: ' + (e.message || e)); }
    process.exit(0);
  }

  // ── ЗАБЕЛЕЖКИ ОТ МОДЕРАЦИЯТА: чета отворената конзола (през твоята сесия) и записвам НОВИТЕ ──
  // → app-shared/moderation-rustore.json. После ги показвам, за да ги СЪОБРАЗЯВАШ. Само реалното
  // от платформата — не пълни с външни данни.
  try {
    const { collectModeration } = require('./lib/moderation.cjs');
    const mod = await collectModeration({ browser, store: 'rustore', app });
    if (mod.added) console.log('📋 Събрах ' + mod.added + ' нови забележки от модерацията (общо ' + mod.total + ') → app-shared/moderation-rustore.json');
    else console.log('📋 Няма нови забележки от модерацията (записани: ' + mod.total + ').');
    if (mod.total) {
      console.log('   Забележки за „' + app + '" — СЪОБРАЗЯВАЙ ги, докато попълваш:');
      mod.notes.forEach((n, i) => console.log('     ' + (i + 1) + '. [' + (n.seenAt || '?') + '] ' + String(n.text).slice(0, 200)));
    }
  } catch (e) { console.log('  (събирачът на забележки прескочен: ' + (e.message || e) + ')'); }

  // ── БЕЗОПАСНОСТ: навигирай до ПРАВИЛНИЯ ап по записан id (app-shared/rustore-app-ids.json), за да
  // НЕ работи ботът по грешен таб (случи се: кацна на Seasongate вместо market-pulse-lite). Ако сме в
  // --auto/--submit и id е известно → отваряме /versions/add на ТОЗИ ап. Без id → предупреждение.
  try {
    const idsMap = (readJson(path.resolve('app-shared/rustore-app-ids.json')) || {}).ids || {};
    const appId = idsMap[app];
    if (appId && (process.argv.includes('--auto') || process.argv.includes('--submit'))) {
      const p = rsPage();
      let cur = ''; try { cur = p.url(); } catch (_) {}
      if (!cur.includes('/apps/' + appId + '/')) {
        console.log('→ Навигирам до ПРАВИЛНИЯ ап „' + app + '" (id ' + appId + ') → /versions/add');
        await p.goto('https://console.rustore.ru/apps/' + appId + '/versions/add', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
        await sleep(2500);
      } else console.log('✓ Вече на правилния ап (id ' + appId + ')');
    } else if (!appId && (process.argv.includes('--auto') || process.argv.includes('--submit'))) {
      console.log('⚠ Няма записан id за „' + app + '" в app-shared/rustore-app-ids.json — ползвам текущия таб; ПРОВЕРИ да е верният ап!');
    }
  } catch (e) { console.log('(навигация по id прескочена: ' + (e.message || e) + ')'); }

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
      // Монетизацията е НЕОБРАТИМА: безплатните „Lite" демо → FREE; платените → PAID (по monetization.json).
      let okMonet, monetHuman;
      if (isFreeApp) {
        monetHuman = 'Free';
        okMonet = await pickRadioByLabel('monetizationType', 'FREE', 'Free');
        log(okMonet ? '✓ Монетизация: FREE (безплатно демо) — НЕОБРАТИМО' : '⚠ monetizationType — НЕ маркирах Free, направи го РЪЧНО (иначе остава Paid — необратимо!)');
      } else {
        monetHuman = 'Paid';
        okMonet = await pickRadioByLabel('monetizationType', 'PAID', 'Paid');
        log(okMonet ? '✓ Монетизация: Paid (продажба на самото приложение) — НЕОБРАТИМО' : '⚠ monetizationType — НЕ успях да маркирам Paid, направи го РЪЧНО (иначе остава Free — необратимо!)');
      }
      await nameInput.fill(''); await nameInput.fill(consoleName);
      log('✓ Console name ← ' + consoleName + ' (неизменяемо)');
      // ★ АВТО (09.09.2026, по искане „всичко бота"): ако монетизацията е потвърдена → натиска „Add" сам; иначе спира.
      if (process.argv.includes('--auto') && okMonet) {
        const addBtn = page.locator('button:has-text("Add"), button:has-text("Добавить")').filter({ hasNotText: /Add an app/ }).last();
        if (await addBtn.count().catch(() => 0)) { await addBtn.click({ timeout: 4000 }).catch(() => {}); await sleep(4000); log('✓ АВТО: натиснах „Add" → приложението е създадено (Universal / ' + monetHuman + ').'); return 'navigated'; }
      }
      log('■ Прегледай (монетизация = ' + monetHuman + '!) и натисни „Add“ сам, за да създадеш приложението.');
      return;
    }

    // ── Екран: Upload app version → стъпка „Media files" (икона + скрийншоти) ──
    if (await page.locator('input[name="screens"]').count().catch(() => 0)) {
      console.log('Екран: Upload app version — Media files');
      if (iconPath) {
        await page.locator('input[name="icon"]').first().setInputFiles(iconPath).then(() => log('✓ Икона качена: ' + path.basename(iconPath))).catch(() => log('↷ икона — качи ръчно'));
        await sleep(3000);
      } else log('↷ няма икона в publish/');
      // ★ ФИКС (17.09): ако вече има качени скрийншоти (стари language-picker) → ИЗЧИСТИ ги и качи НОВИТЕ
      //   функционални. Иначе „вече качени" ги пропускаше → RuStore пак отказва за некоректни скрийншоти.
      const shotsPresent = await page.locator('text=/[1-9]\\d*\\s*\\/\\s*10/').count().catch(() => 0);
      if (shotsPresent > 0 && shotPaths.length) {
        let cleared = 0;
        for (let k = 0; k < 15; k++) {
          const removed = await page.evaluate(() => {
            // бутон/икона за махане на КАЧЕН скрийншот (× / кошче) — в превю-плочките на медия зоната
            const cand = [...document.querySelectorAll('button, [role="button"], svg, i, span, [class*="delete" i], [class*="remove" i], [class*="close" i], [class*="trash" i]')]
              .filter(e => e.offsetParent !== null);
            const rm = cand.find(e => {
              const s = ((e.className || '') + ' ' + (e.getAttribute && (e.getAttribute('aria-label') || '') || '') + ' ' + (e.textContent || '')).toString();
              if (!/delete|remove|close|trash|удал|очист|×|✕|✖|🗑/i.test(s)) return false;
              // близо до изображение/превю (в медия зоната, не глобален close)
              return !!e.closest('[class*="screen" i],[class*="preview" i],[class*="media" i],[class*="image" i],[class*="thumb" i],[class*="upload" i]');
            });
            if (rm) { rm.click(); return true; }
            return false;
          }).catch(() => false);
          if (!removed) break;
          cleared++; await sleep(700);
        }
        log(cleared ? ('✓ Изчистих ' + cleared + ' стари скрийншота → качвам новите') : '↷ не намерих бутон за махане — качвам новите ДО старите (виж ръчно)');
        await page.locator('input[name="screens"]').first().setInputFiles(shotPaths).then(() => log('✓ Скрийншоти качени (' + shotPaths.length + ')')).catch(() => log('↷ скрийншоти — качи ръчно'));
        await sleep(4500);
      } else if (shotPaths.length) {
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
      else if (_apkUploaded) { log('↷ APK вече е качен този run — НЕ качвам пак (без дубликати).'); }
      else {
        _apkUploaded = true;
        // ★ ФИКС (16.09): изчисти СТАРИ/ГРЕШНИ качени APK-та (замърсяване с чужд APK, или стар versionCode),
        //   после ВИНАГИ качи НОВИЯ (по-висок versionCode). Иначе „already" пропускаше → оставаше старият APK
        //   → RuStore отказваше „The Version Code must be greater than the previous version".
        // ★ ФИКС (07.10 по искане): ВИНАГИ остава САМО ЕДНА версия. Чистя в ЦИКЪЛ — „Clear all" + индивидуални
        //   × докато не остане НИКАКЪВ стар качен APK; чак тогава качвам новия.
        let _clearedN = 0;
        for (let _c = 0; _c < 8; _c++) {
          const _clearBtn = page.locator('button:has-text("Clear all"), span:has-text("Clear all"), text=/Clear all|Очистить все/i').first();
          if (await _clearBtn.count().catch(() => 0)) { await _clearBtn.click({ force: true, timeout: 3000 }).catch(() => {}); await sleep(1500); _clearedN++; }
          // индивидуално махане на остатъчни .apk плочки (× / кошче в реда на файла)
          const _rm = await page.evaluate(() => {
            const rows = [...document.querySelectorAll('li,tr,div,span')].filter((e) => /\.apk\b/i.test(e.textContent || '') && (e.textContent || '').replace(/\s+/g, ' ').trim().length < 140);
            for (const r of rows) { const btn = r.querySelector('button,[role="button"],[class*="delete" i],[class*="remove" i],[class*="close" i],[class*="trash" i],svg,i'); if (btn && btn.offsetParent !== null) { btn.click(); return true; } }
            return false;
          }).catch(() => false);
          if (_rm) { _clearedN++; await sleep(1200); }
          const _still = await page.locator('text=/\\.apk\\b/i').count().catch(() => 0);
          if (_still === 0 && !_rm) break; // чисто
        }
        if (_clearedN) log('✓ Изчистих старите качени APK (' + _clearedN + ' действия) — ще остане само новата версия.');
        {
          // ★ ГОЛЕМИ APK (>45MB, напр. Ring Clash 182MB / Field Battle 201MB): Playwright през CDP отказва
          //   setInputFiles („larger than 50Mb"). Заобикаляме с директен CDP DOM.setFileInputFiles по nodeId —
          //   Chrome чете файла от диска сам (без лимит) и изстрелва change.
          let _big = false; try { _big = fs.statSync(uploadApkPath).size > 45 * 1024 * 1024; } catch (_) {}
          if (_big) {
            try {
              const cdp = await page.context().newCDPSession(page);
              try {
                const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
                let found = null;
                const walk = (n) => { if (found || !n) return; if (n.nodeName === 'INPUT' && n.attributes) { const o = {}; for (let i = 0; i < n.attributes.length; i += 2) o[n.attributes[i]] = n.attributes[i + 1]; if ((o.type || '').toLowerCase() === 'file' && /storageUploads/.test(o.name || '')) { found = n; return; } } for (const c of (n.children || [])) walk(c); if (n.contentDocument) walk(n.contentDocument); if (n.shadowRoots) n.shadowRoots.forEach(walk); };
                walk(root);
                if (found) { await cdp.send('DOM.setFileInputFiles', { files: [uploadApkPath], nodeId: found.nodeId }); log('✓ Подадох ГОЛЯМ APK през CDP: ' + path.basename(uploadApkPath)); }
                else log('↷ CDP: не намерих input storageUploads');
              } finally { await cdp.detach().catch(() => {}); }
            } catch (e) { log('↷ CDP качване неуспешно: ' + e.message); }
          } else {
            await fileInput.setInputFiles(uploadApkPath).then(() => log('✓ Подадох APK: ' + path.basename(uploadApkPath))).catch((e) => log('↷ качване неуспешно: ' + e.message));
          }
          // ЧАКАЙ реалното потвърждение „Uploaded/Загружено" (до 12 мин за големи файлове), а не фиксирани
          // секунди — така съобщението е вярно и „Continue" е готов. Иначе изглежда „файлът не е качен".
          log('⏳ изчаквам обработката на файла (до 12 мин)…');
          let done = false, sawUploading = false;
          for (let i = 0; i < 480; i++) {
            // „Uploaded/Загружено" = готово. (БЕЗ детекция за „грешка" — беше фалшиво-позитивна и
            // прекъсваше рано, макар качването да успяваше след няколко секунди.)
            const ok = await page.locator('text=/Uploaded|Загружено/i').count().catch(() => 0);
            if (ok) { done = true; break; }
            // ★ ФИКС (16.09): RuStore невинаги показва думата „Uploaded" — керай се по ИНДИКАТОРА за качване.
            //   Щом „Uploading/Загрузка/Wait for the file" се появи и после ИЗЧЕЗНЕ (или го няма след ~45с) →
            //   качването е приключило. Иначе ботът чакаше 12 мин напразно → предупреждение → отказ от Submit.
            const uploading = await page.locator('text=/Uploading|Загрузка|Wait for the file to finish/i').count().catch(() => 0);
            if (uploading) sawUploading = true;
            else if (i >= 30) { done = true; break; }   // ~45с без индикатор за качване → приемам за готово
            await sleep(1500);
          }
          if (done) log('✓ APK е качен (потвърдено „Uploaded" или изчезнал индикатор за качване).');
          else log('↷ още не виждам „Uploaded" — файлът вероятно още се обработва; изчакай малко и виж екрана, после ENTER пак.');
        }
      }
      // „Что нового" (release notes) — RuStore ОТХВЪРЛЯ празно/шаблонно поле (група „что нового").
      // Точен селектор по ИМЕ (езиково-независим; конзолата е на английски → текст-селектори падаха).
      // ВАЖНО: полето понякога се ренднира със закъснение след качването на APK → ИЗЧАКВАМЕ го.
      if (RU.news) {
        const wn = page.locator('textarea[name="whatsNew"]').first();
        try { await wn.waitFor({ state: 'visible', timeout: 12000 }); } catch (_) {}
        let filled = false;
        for (let a = 0; a < 3 && !filled; a++) {
          if (await wn.count().catch(() => 0)) {
            await wn.fill(RU.news.slice(0, 4000)).then(() => { filled = true; }).catch(() => {});
            if (filled) { const v = await wn.inputValue().catch(() => ''); if (!v || v.length < 5) filled = false; }
          }
          if (!filled) await sleep(2500);
        }
        log(filled ? ('✓ Что нового (whatsNew) ← ' + RU.news.slice(0, 60)) : '↷ whatsNew — полето не се появи (провери ръчно)');
      }
      // Коментар за модератора — точно поле name="moderInfo" (не се бърка с whatsNew).
      const comment = moderatorComment();
      const cta = page.locator('textarea[name="moderInfo"]').first();
      if (await cta.count().catch(() => 0)) await cta.fill(comment).then(() => log('✓ Коментар за модератора (moderInfo) ← ' + comment)).catch(() => log('↷ moderInfo — не попълних'));
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
      // Новата конзола (нов собственик от 03.08.2026) ползва react-select с ТЪРСЕНЕ: клик → пиши →
      // избери опция (руски надписи). Старият xpath-подход не работеше. Категорията „Main" стартира
      // с „Category not selected" (нова версия). Опциите зависят от Type (Game/Application) — Type се
      // избира ПРЕДИ това. Пробва: клик по тригера → ArrowDown → пиши текста → клик по опцията / Enter.
      // react-select с ТЪРСЕНЕ е ИНТЕРМИТЕНТЕН (понякога не се закача) → ПОВТАРЯЙ до потвърждение
      // на скритото поле (verifyName). До 4 опита. verifyName: скрито input име (mainCategory/ageLegal);
      // verifyExact: очаквана стойност (за възраст „0+"); за категория проверяваме само НЕ-празно.
      // КЛЮЧОВО (13.08): react-select показва ЦЕЛИЯ списък при отваряне — НЕ пиши (писането прави race,
      // затова падаше). Само отвори → клик по точната опция (role=option, започваща с текста; надписът
      // има суфикс „ Icon Done 20"). Писането остава само като резерва. Проверка по скритото поле.
      const pickSelect = async (label, triggerLoc, optionText, verifyName, verifyExact) => {
        const val = async () => { try { return (await page.locator('[name="' + verifyName + '"]').inputValue()) || ''; } catch (_) { return ''; } };
        const good = (v) => verifyExact ? (v === verifyExact) : (!!v && v !== 'null');
        const optLoc = () => page.locator('.react-select__option, [role="option"]').filter({ hasText: new RegExp('^' + esc(optionText) + '(\\s|$)') }).first();
        for (let attempt = 1; attempt <= 5; attempt++) {
          if (good(await val())) { log('✓ ' + label + ' ← ' + optionText + (attempt > 1 ? ' (опит ' + attempt + ')' : '')); return true; }
          try {
            await triggerLoc.scrollIntoViewIfNeeded().catch(() => {});
            await triggerLoc.click({ timeout: 4000 }); await sleep(900);
            // 1) чист клик по опцията от целия списък (без писане) — надеждният път
            let opt = optLoc();
            if (await opt.count().catch(() => 0)) {
              await opt.scrollIntoViewIfNeeded().catch(() => {});
              await opt.hover().catch(() => {}); await sleep(150);
              await opt.click({ timeout: 3000, force: true }).catch(() => {});
            } else {
              // 2) резерва: писане филтрира списъка, после клик/Enter
              await page.keyboard.type(optionText.slice(0, 14), { delay: 45 }); await sleep(1000);
              opt = optLoc();
              if (await opt.count().catch(() => 0)) { await opt.hover().catch(() => {}); await sleep(150); await opt.click({ timeout: 3000, force: true }).catch(() => {}); }
              else await page.keyboard.press('Enter').catch(() => {});
            }
            await sleep(900);
          } catch (e) { await page.keyboard.press('Escape').catch(() => {}); }
        }
        const ok = good(await val());
        log(ok ? '✓ ' + label + ' ← ' + optionText : '↷ ' + label + ' (' + optionText + ') — НЕ се закачи след 5 опита — избери ръчно');
        return ok;
      };
      // Категория „Main": тригер = САМИЯТ контрол (testid). ВАЖНО (13.08): по-рано клякахме първо по
      // ТЕКСТА „Category not selected" — span, който НЕ отваря менюто надеждно → падаше. Контролът отваря
      // целия списък и pickSelect клика точната опция без писане.
      const catTrigger = page.locator('[data-testid=mainCategorySelect]').first();
      const selectDropdown = async (labelText, optionText) => {
        if (!optionText) return;
        await pickSelect(labelText, catTrigger, optionText, 'mainCategory', null);
      };
      // Име (публично), Тип, Цена
      await fillByName('appName', baseName);
      // Type: Application(MAIN) е по подразбиране; Game(GAMES) иска изричен избор (иначе категорията
      // показва APP-категории, не игрови → „Category not selected" + предупреждение). Клик по етикета,
      // после проверка (както при rustam ръчно).
      {
        const val = appType === 'Game' ? 'GAMES' : 'MAIN';
        const radio = page.locator('input[type="radio"][name="appTypeOption"][value="' + val + '"]');
        const lbl = page.locator('label').filter({ has: radio }).first();
        if (await lbl.count().catch(() => 0)) await lbl.click({ force: true }).catch(() => {});
        else await radio.check({ force: true }).catch(() => {});
        await sleep(600);
        const ok = await radio.isChecked().catch(() => false);
        log(ok ? '✓ Type ← ' + appType : '↷ Type — избери ръчно (' + appType + ')');
      }
      await fillByName('priceValue', priceRub);
      // Категория (Main): react-select с търсене; зависи от Type (избран горе).
      await selectDropdown('Main', catMain);
      // Възраст (ЗАДЪЛЖИТЕЛНО! НЕ е 0+ по подразбиране — празно → предупреждение „Warning" на Info и
      // подаването пада). Контролът е react-select с testid=ageLegalSelect; избираме по стойност.
      if (ageR) {
        const ageTrigger = page.locator('[data-testid=ageLegalSelect]').first();
        await pickSelect('Age', ageTrigger, ageR, 'ageLegal', ageR);
      }
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
        // Помощник: добавя ЕДИН таг (клавиатура + клик по опцията) и връща дали е наличен след това.
        // БЕЗ Backspace (той трие чип при празно поле). Escape затваря менюто без да пипа избраните.
        const addOne = async (tag) => {
          try {
            await tcontrol.scrollIntoViewIfNeeded().catch(() => {});
            await tcontrol.click({ timeout: 3000 }); await sleep(450);
            await page.keyboard.type(tag, { delay: 25 });
            await sleep(900);
            const topt = page.locator('.react-select__option').filter({ hasText: new RegExp('^' + esc(tag) + '$', 'i') }).first();
            if (await topt.count().catch(() => 0)) { await topt.click({ timeout: 2500 }).catch(() => {}); await sleep(450); }
            await page.keyboard.press('Escape').catch(() => {});
          } catch (_) {}
          const have = (await chips()).map((t) => t.replace(/\s+/g, ' ').trim().toLowerCase());
          return have.includes(tag.toLowerCase());
        };
        // Таговете са ПО ИЗБОР (не блокират подаването) → best-effort 1 пас, за да не бавим/зациклим
        // на нестабилния react-select. Каквото се закачи — добре; липсващите НЕ са грешка.
        try {
          const have0 = (await chips()).map((t) => t.replace(/\s+/g, ' ').trim().toLowerCase());
          const missing = tags.filter((t) => !have0.includes(t.toLowerCase()));
          for (const tag of missing) {
            const ok = await addOne(tag);
            log(ok ? '✓ таг ← ' + tag : '↷ таг „' + tag + '" — прескачам (по избор)');
          }
          const finalChips = (await chips()).map((t) => t.replace(/\s+/g, ' ').trim());
          log('✓ тагове (по избор): ' + finalChips.length + '/' + tags.length + (finalChips.length ? ' — ' + finalChips.join(', ') : ''));
        } catch (e) { log('↷ тагове прескочени (по избор): ' + String(e.message || e).split('\n')[0]); }
      }
      log('■ Прегледай всичко (цена ' + (priceRub || '?') + '₽, категория, възраст, тагове) и натисни „Continue" сам. (Не пазя чернова — ти преглеждаш и публикуваш.)');
      return;
    }

    // ── Екран: страница на приложението (/apps/<id>) → „Upload the version" за първата версия ──
    if (/\/apps\/\d+\/?$/.test(url)) {
      const upBtn = page.locator('button:has-text("Upload the version"), a:has-text("Upload the version"), button:has-text("Загрузить версию")').first();
      if (await upBtn.count().catch(() => 0)) {
        console.log('Екран: страница на приложението → отварям „Upload the version"');
        await upBtn.click({ timeout: 4000 }).catch(() => log('↷ не намерих „Upload the version" — натисни го ръчно'));
        await sleep(2500);
        log('✓ Отворих съветника за качване на версия → продължавам автоматично с APK-то…');
        return 'navigated';
      }
      // ★ НОВА конзола (от 03.08.2026, нов собственик): страницата на апа има „Upload ▾ → Version" (падащо меню),
      //   а не бутон „Upload the version". Най-надеждно: отиваме ДИРЕКТНО на съветника /apps/<id>/versions/add.
      const mId = url.match(/\/apps\/(\d+)/);
      if (mId) {
        console.log('Екран: страница на приложението (нова конзола) → отварям съветника /versions/add директно');
        await page.goto('https://console.rustore.ru/apps/' + mId[1] + '/versions/add', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
        await sleep(5000);
        return 'navigated';
      }
    }

    // ── Екран: списък с версии (/versions) → отвори формата за качване ──
    if (/\/versions\/?$/.test(url)) {
      const upBtn = page.locator('button:has-text("Upload the version"), a:has-text("Upload the version")').first();
      if (await upBtn.count().catch(() => 0)) {
        console.log('Екран: версии → отварям „Upload the version"');
        await upBtn.click({ timeout: 4000 }).catch(() => log('↷ не намерих бутона — натисни го ръчно'));
        await sleep(2500);
        log('✓ Отворих формата за качване → продължавам автоматично с APK-то…');
        return 'navigated';
      }
      const mId = url.match(/\/apps\/(\d+)/);
      if (mId) {   // нова конзола → директно на съветника
        console.log('Екран: версии (нова конзола) → отварям /versions/add директно');
        await page.goto('https://console.rustore.ru/apps/' + mId[1] + '/versions/add', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
        await sleep(5000);
        return 'navigated';
      }
    }

    // ── Екран: списък с приложения → отвори нашето (по console name) ИЛИ отвори „Add an app" за ново ──
    if (/\/apps\/?$/.test(url)) {
      const row = page.locator('text=' + JSON.stringify(consoleName)).first();
      if (await row.count().catch(() => 0)) {
        console.log('Екран: списък с приложения → отварям „' + consoleName + '"');
        await row.click({ timeout: 4000 }).catch(() => log('↷ не можах да кликна приложението — отвори го ръчно'));
        await sleep(2500);
        log('✓ Отворих приложението → продължавам автоматично…');
        return 'navigated';
      }
      // Няма такъв ред → приложението още не съществува → отвори формата „Add an app".
      const addBtn = page.locator('button:has-text("Add an app"), a:has-text("Add an app"), button:has-text("Создать"), a:has-text("Создать")').first();
      if (await addBtn.count().catch(() => 0)) {
        console.log('Екран: списък → „' + consoleName + '" още не съществува → отварям „Add an app"');
        await addBtn.click({ timeout: 4000 }).catch(() => log('↷ не намерих „Add an app" — натисни го ръчно'));
        await sleep(2500);
        log('✓ Отворих формата за ново приложение → попълвам автоматично (Universal / ' + (isFreeApp ? 'Free' : 'Paid') + ' / име)…');
        return 'navigated';
      }
    }

    // ── Екран: последна стъпка на съветника „Publishing version" (Settings) — нищо за попълване:
    // „Automatically (right after approval)" е по подразбиране. НЕ навигираме; бутонът „Submit for
    // Moderation" се натиска от advance-логиката. (Без този клон падаше в „App page" → диалог „save?".)
    if (/\/versions\//.test(url) && (await page.locator('text=/Publishing version|Submit for Moderation/i').count().catch(() => 0))) {
      console.log('Екран: Publishing version (Settings) — „Automatically" по подразбиране, нищо за попълване.');
      return;
    }

    // ── Екран: приложението е отворено, но не на „App page" → отиди на „App page" (root) ──
    // ВАЖНО: НЕ пипай докато си във версийния съветник (/versions/…) — там „App page" линкът води до
    // диалог „save changes?", който покрива бутоните.
    const mId = url.match(/\/apps\/(\d+)/);
    if (mId && !/\/apps\/\d+\/?$/.test(url) && !/\/versions\//.test(url)) {
      const appPageLink = page.locator('a[href$="/apps/' + mId[1] + '"]').first();
      if (await appPageLink.count().catch(() => 0)) {
        console.log('Екран: отивам на „App page" (описание/снимки)');
        await appPageLink.click({ timeout: 4000 }).catch(() => log('↷ не намерих линка „App page" — кликни го ръчно вляво'));
        await sleep(2500);
        log('✓ На „App page" → продължавам автоматично…');
        return 'navigated';
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
    // Приоритет: първо истинските „напред"/финал бутони; „Add"/„Select" НАКРАЯ (само ако няма друг).
    const labels = ['Submit for Moderation', 'Continue', 'Save changes', 'Save', 'Confirm', 'OK', 'Add', 'Select'];
    const btns = page.locator('button:visible');
    const n = await btns.count().catch(() => 0);
    for (const lb of labels) {
      for (let i = 0; i < n; i++) {
        const btn = btns.nth(i);
        const txt = ((await btn.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
        if (txt.toLowerCase() !== lb.toLowerCase()) continue;   // ТОЧНО съвпадение (не „Add an app"/„Select files")
        // Пропусни бутони-миниатюри (скрийншот/икона със снимка) — да не се бъркат с „напред".
        if (await btn.locator('img').count().catch(() => 0)) continue;
        const disabled = await btn.isDisabled().catch(() => false);
        if (!disabled) return { loc: btn, label: lb };
      }
    }
    return null;
  }

  // --auto = авто-напред БЕЗ ENTER (аз оркестрирам целия поток за отхвърлените апове, по искане на
  // потребителя „ти правиш всичко"). --submit = авто-натискане и на финалния „Submit for Moderation".
  // Без --submit авто-режимът СПИРА на финалната стъпка (за да проверя APK+скрийншоти преди подаване).
  const AUTO = process.argv.includes('--auto');
  const SUBMIT = process.argv.includes('--submit');
  const loop = process.argv.includes('--loop') || AUTO;
  if (loop) {
    if (AUTO) console.log('\n   РЕЖИМ АВТО (RuStore)' + (SUBMIT ? ' + SUBMIT' : ' — спира преди подаване') + ': сам попълвам и минавам екраните.\n');
    else console.log('\n   РЕЖИМ ENTER (RuStore): отвори екран, натисни ENTER да го попълня. После питам за бутона за напред. „q“ = изход.\n');
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
      let noBtnTries = 0;
      for (;;) {
        // АВТО-ПОПЪЛВАНЕ БЕЗ ENTER (до 6 стъпки навигация/зареждане): ботът разпознава екрана и го попълва.
        //  • fillCurrent върне 'navigated' (кликнал е бутон/линк, който ОТВАРЯ форма) → изчакай и попълни
        //    новоотворения екран, БЕЗ да чакаш ENTER (иначе показва „готов", а формата е празна).
        //  • няма бутон за напред (форма още зарежда/обработва) → изчакай и опитай пак.
        //  • има бутон за напред → спри и питай за напред.
        let btn = null;
        for (let step = 0; step < 6; step++) {
          let status;
          try { status = await fillCurrent(); } catch (e) { console.log('грешка: ' + e.message); }
          if (status === 'navigated') { await sleep(3000); continue; }   // отвори форма → попълни новия екран
          try { btn = await advanceButton(); } catch (e) { console.log('   (проверка на бутон: ' + e.message + ')'); }
          if (btn) break;
          await sleep(2500);   // форма още зарежда → авто-попълни пак
        }
        if (!btn) {
          if (AUTO) {
            noBtnTries++;
            if (noBtnTries >= 4) { console.log('   ⛔ АВТО: няма бутон за напред след 4 опита — спирам (провери екрана ръчно).'); try { rl.close(); } catch (_) {} process.exit(0); }
            console.log('   ⏳ АВТО: чакам бутон за напред (опит ' + noBtnTries + '/4)…'); await sleep(4000); continue;
          }
          const r = await question('   ⚠ Няма активен бутон за напред след няколко опита (провери екрана). ENTER = пробвай пак · q = изход: ');
          if (r === null || r.trim().toLowerCase() === 'q') { try { rl.close(); } catch (_) {} process.exit(0); }
          continue;
        }
        noBtnTries = 0;
        const pressNow = async () => {
          // ВАЖНО: качването на икона/скрийншот отваря full-screen preview overlay
          // (data-testid=modalPagePortal-fullScreenPreview-id), който ПРЕХВАЩА кликовете върху „Continue"
          // → ботът забива. Затваряме го (Escape) преди всяко натискане.
          const page2 = rsPage();
          try { if (await page2.locator('[data-testid=modalPagePortal-fullScreenPreview-id]').count().catch(() => 0)) { await page2.keyboard.press('Escape').catch(() => {}); await sleep(500); } } catch (_) {}
          await btn.loc.scrollIntoViewIfNeeded().catch(() => {});
          await btn.loc.click({ timeout: 6000 }).then(() => console.log('   ✓ натиснах „' + btn.label + '" → минавам нататък')).catch((e) => console.log('   ↷ не можах да натисна: ' + e.message.split('\n')[0]));
          await sleep(3500); // изчакай новия екран; после цикълът авто-попълва
        };
        // Финалната стъпка вече също е с ENTER (по желание на потребителя) — само с ясен надпис.
        const isFinal = btn.label.toLowerCase() === 'submit for moderation';
        // ── АВТО режим: сам натискам напред; на финала подавам само при --submit ──
        if (AUTO) {
          if (isFinal) {
            // ГАРД: не подавай, ако някоя стъпка има „Warning triangle" (непълна — напр. празна възраст).
            // (13.09.2026) Ако предупреждението е само защото ГОЛЯМО APK още се качва („Uploading“/„Wait for the file to finish“),
            // изчакай до 10 мин да завърши и провери пак — иначе ботът отказваше да подаде, докато файлът още се обработва.
            let warns = await rsPage().locator('i[class*="Warning_triangle" i]').count().catch(() => 0);
            if (warns > 0) {
              // ★ ФИКС (16.09): предупреждението често е само защото RuStore ОЩЕ обработва APK-то сървърно
              //   (не показва „Uploaded" навреме). Изчакай до ~7 мин да се изчисти — иначе ботът отказваше
              //   финалния Submit и апът оставаше ОТКАЗАН, макар всичко да е попълнено (руски описания вкл.).
              console.log('   ⏳ АВТО: има ' + warns + ' предупреждение(я) — проверявам дали е APK-обработка или реален проблем…');
              // ★ ФИКС (07.10): чакай ДЪЛГО само ако РЕАЛНО тече обработка/качване. Иначе (напр. „package already
              //   exists" / празно поле) предупреждението НЯМА да изчезне с чакане → спри рано и диагностицирай.
              for (let _w = 0; _w < 42 && warns > 0; _w++) {
                const processing = await rsPage().locator('text=/Uploading|Загрузк|Wait for the file|Processing|Обработк/i').count().catch(() => 0);
                if (!processing && _w >= 3) break; // ~30с без индикатор за обработка → проблемът е реален, не чакане
                await sleep(10000);
                warns = await rsPage().locator('i[class*="Warning_triangle" i]').count().catch(() => 0);
              }
            }
            if (warns > 0) {
              // ★ ДИАГНОСТИКА (07.10): кликни светещата стъпка и дъмпни празните/задължителни полета.
              const _pg = rsPage();
              // кликни клик-уемия предшественик на warning-триъгълника (навигира към проблемната стъпка)
              await _pg.evaluate(() => { const ic = document.querySelector('i[class*="Warning_triangle" i],[class*="Warning_triangle" i]'); if (!ic) return; let n = ic; for (let d = 0; d < 6 && n; d++) { if (n.tagName === 'A' || n.tagName === 'BUTTON' || n.getAttribute('role') === 'button' || /step|tab/i.test('' + (n.className && n.className.baseVal !== undefined ? n.className.baseVal : n.className))) { n.click(); return; } n = n.parentElement; } }).catch(() => {});
              await sleep(2500);
              const diag = await _pg.evaluate(() => {
                const clean = (s) => (s || '').replace(/\s+/g, ' ').replace(/Icon [A-Za-z ]+\d+/g, '').trim();
                const out = [];
                for (const ic of document.querySelectorAll('[class*="Warning_triangle" i]')) { let n = ic.parentElement, name = '', depth = 0; while (n && depth < 7) { const tx = clean(n.innerText); if (tx && tx.length > 2 && tx.length < 70) { name = tx; break; } n = n.parentElement; depth++; } out.push(name || '(?)'); }
                // празни/задължителни полета в текущия изглед
                const fields = [];
                for (const f of document.querySelectorAll('label,[class*="field" i],[class*="form-item" i],[class*="FormItem" i]')) {
                  const lbl = clean(f.innerText).slice(0, 50); if (!lbl) continue;
                  const inp = f.querySelector('input,select,textarea,[class*="select" i]');
                  const val = inp ? (inp.value || inp.textContent || '').trim() : '';
                  const req = /\*|required|обязательн|выберите|select|choose/i.test(f.innerText || '') || (f.querySelector('[class*="error" i],[class*="required" i]'));
                  if (req || (!val && inp)) fields.push(lbl + (val ? '=' + val.slice(0, 20) : ' [ПРАЗНО]'));
                }
                const main = clean((document.querySelector('main') || document.body).innerText).slice(0, 300);
                return { hits: [...new Set(out)].slice(0, 4), fields: [...new Set(fields)].slice(0, 12), main };
              }).catch(() => ({ hits: [], fields: [], main: '' }));
              console.log('   ⛔ АВТО: ' + warns + ' предупреждение(я) — НЕ подавам. ДИАГНОСТИКА:');
              console.log('      ПОЛЕТА (празни/задължителни): ' + JSON.stringify(diag.fields));
              console.log('      ТЕКСТ на стъпката: ' + diag.main);
              for (const h of diag.hits) console.log('      ⚠ непълно: „' + h + '"');
              try { rl.close(); } catch (_) {} process.exit(0);
            }
            console.log('   ✓ АВТО: няма предупреждения — подавам.');
            if (!SUBMIT) {
              console.log('   ⏸ АВТО: стигнах „Submit for Moderation", всички стъпки ✓ — СПИРАМ (без --submit).');
              try { rl.close(); } catch (_) {} process.exit(0);
            }
          }
          console.log('   ▶ АВТО: натискам „' + btn.label + '"…');
          await pressNow();
          if (isFinal) {
            // ★ ФИКС (03.10): след „Submit for Moderation" RuStore често показва ПОТВЪРЖДАВАЩ модал.
            //   Ако не го натиснем, версията НЕ се финализира и се губи (списъкът остава със старата).
            await sleep(1800);
            const pgC = rsPage();
            let confirmedModal = false;
            for (let k = 0; k < 3; k++) {
              const hit = await pgC.evaluate(() => {
                const dlg = [...document.querySelectorAll('[role=dialog],[class*="modal" i]')].find((d) => d.offsetParent !== null && /modera|подтверд|отправ|submit|sure|уверены/i.test(d.innerText || ''));
                if (!dlg) return false;
                const re = /^(Submit for Moderation|Submit|Отправить|Отправить на модерацию|Confirm|Подтвердить|Опубликовать|Да|Yes)$/i;
                const btns = [...dlg.querySelectorAll('button')].filter((b) => b.offsetParent !== null && !b.disabled);
                const b = btns.find((x) => re.test((x.innerText || '').trim())) || btns.find((x) => !/cancel|отмен|назад|close/i.test((x.innerText || '').trim()));
                if (b) { b.click(); return true; }
                return false;
              }).catch(() => false);
              if (hit) { confirmedModal = true; console.log('   ✓ потвърдих модала за подаване.'); await sleep(2500); break; }
              await sleep(1200);
            }
            // ПРОВЕРКА (03.10 ФИКС срещу лъжлив успех): отварям версийния СПИСЪК и търся ИЗРИЧНО статус
            //   „Waiting for moderation/На модерации/На проверке" — това НЕ съвпада с „Moderation not passed"
            //   (старият бъг okVer хващаше думата „moderation" и в отхвърлената версия → лъжливо „подадено").
            await sleep(2500);
            let okVer = false;
            try {
              const mId = (pgC.url().match(/apps\/(\d+)/) || [])[1];
              if (mId) { await pgC.goto('https://console.rustore.ru/apps/' + mId + '/versions', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}); await sleep(5000); }
              okVer = await pgC.evaluate(() => {
                const el = document.querySelector('main') || document.body; const t = el ? el.innerText : '';
                // НОВО подаване → най-горната версия е „Waiting". Търсим ИЗРИЧНО waiting-статуса (не „not passed").
                return /Waiting for moderation|На модерации|На проверке|На модерацию/i.test(t);
              }).catch(() => false);
            } catch (_) {}
            console.log(okVer ? '\n   🎉 АВТО: ПОТВЪРДЕНО подадено за модерация (видях „Waiting for moderation" във версийния списък).' : '\n   ⚠ АВТО: натиснах „Submit for Moderation"' + (confirmedModal ? '+модал' : '') + ', но във версийния списък НЯМА „Waiting for moderation" — версията НЕ е подадена. Пусни пак (често минава на 2-ри опит).');
            try { rl.close(); } catch (_) {} process.exit(okVer ? 0 : 3);
          }
          continue;
        }
        const q = isFinal
          ? '   🚀 ПОСЛЕДНА СТЪПКА — всичко е попълнено. ENTER (или y/да) = ПОДАЙ за модерация („Submit for Moderation") · n = не · q = изход: '
          : '   ✅ Екранът е попълнен. Бутон „' + btn.label + '" → ENTER (или y/да) = продължи · n = не · q = изход: ';
        const yn = await question(q);
        if (yn === null) { try { rl.close(); } catch (_) {} process.exit(0); }
        const v = yn.trim().toLowerCase();
        if (v === 'q') { try { rl.close(); } catch (_) {} process.exit(0); }
        if (v === '' || /^(да|d|y|yes|д)$/i.test(v)) {
          await pressNow();
          // След ФИНАЛНОТО подаване за модерация → излизаме (връщаме се в стартовото меню), не оставаме активни.
          if (isFinal) { console.log('\n   🎉 Подадено за модерация. Излизам — обратно в менюто.'); try { rl.close(); } catch (_) {} process.exit(0); }
        }
        else { const z = await question('   ↷ не натискам. ENTER когато си готов (или q = изход): '); if (z !== null && z.trim().toLowerCase() === 'q') { try { rl.close(); } catch (_) {} process.exit(0); } }
      }
    })();
  } else {
    await fillCurrent();
    // НЕ затваряме браузъра — пазим едно логване. Излизаме чисто (CDP връзката иначе държи процеса жив).
    process.exit(0);
  }
})().catch((e) => { console.error(e); process.exit(1); });
