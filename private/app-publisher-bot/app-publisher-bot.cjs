#!/usr/bin/env node
// app-publisher-bot.cjs — AppPublisherBot: робот за подготовка на приложения за Huawei AppGallery.
// Прави: проверка на име (марка/патент/уебсайтове и ниши/AppGallery/App Store/Google Play),
// локализирани скрийншоти (15 езика), локализирано описание (15 езика) и скеле на huawei.meta.
//
// Употреба (от корена на репото):
//   node private/app-publisher-bot/app-publisher-bot.cjs name "<Име>" [Име2 ...]
//   node private/app-publisher-bot/app-publisher-bot.cjs screenshots huawei/<ап>
//   node private/app-publisher-bot/app-publisher-bot.cjs listing      huawei/<ап>
//   node private/app-publisher-bot/app-publisher-bot.cjs meta         huawei/<ап> [--force]
//   node private/app-publisher-bot/app-publisher-bot.cjs prep         huawei/<ап>   # listing+screenshots+meta
//
// Playwright се ползва от private/bug-bot/node_modules (общ с тест-робота).
const fs = require('fs');
const path = require('path');
const { nameCheck, toMarkdown } = require('./lib/name-check.cjs');
const { generateListing } = require('./lib/listing.cjs');
const { generateScreenshots } = require('./lib/screenshots.cjs');
const { generateMeta } = require('./lib/meta.cjs');
const { generateSummary } = require('./lib/summary.cjs');
const { generateNamesReport } = require('./lib/names-report.cjs');
const { generateForms } = require('./lib/forms.cjs');

function abs(p) { return path.isAbsolute(p) ? p : path.join(process.cwd(), p); }
const REPO = path.join(__dirname, '..', '..');

// Суровите доклади по име са работни данни на бота (НЕ в папката на приложението).
// Единственият консолидиран анализ отива в <ап>/publish/ANALYSIS.md (виж names-report).
const NAME_CHECKS_DIR = path.join(__dirname, 'name-checks');
async function cmdName(names) {
  if (!names.length) { console.error('Дай поне едно име: name "<Име>"'); process.exit(1); }
  const outDir = NAME_CHECKS_DIR;
  fs.mkdirSync(outDir, { recursive: true });
  for (const name of names) {
    console.log('\n=== Проверка на име: ' + name + ' ===');
    const r = await nameCheck(name);
    const md = toMarkdown(r);
    const file = path.join(outDir, name.replace(/[^a-zA-Z0-9._-]+/g, '_') + '.md');
    fs.writeFileSync(file, md, 'utf8');
    console.log('Риск: ' + r.risk + (r.riskWhy.length ? ' — ' + r.riskWhy.join('; ') : ''));
    if (r.appleExact.length) console.log('⚠️ Точно съвпадение в App Store: ' + r.appleExact.map((a) => a.name + ' (' + (a.seller || '?') + ')').join(', '));
    console.log('Доклад: ' + path.relative(REPO, file));
  }
}

async function cmdScreenshots(appDir) {
  const r = await generateScreenshots(abs(appDir));
  console.log('Скрийншоти: ' + r.total + ' (×' + r.langs + ' езика) → ' + path.relative(REPO, r.dir));
}
function cmdListing(appDir) {
  const r = generateListing(abs(appDir));
  console.log('Описания: ' + r.count + ' езика → ' + path.relative(REPO, r.dir));
}
function cmdMeta(appDir, force) {
  const r = generateMeta(abs(appDir), { force });
  console.log('huawei.meta: ' + (r.written ? 'записан' : 'пропуснат — ' + r.note) + ' (' + path.relative(REPO, r.path) + ')');
  if (r.huaweiSuffix) console.log('⚠️ Пакетът завършва на ".huawei" — запазено за joint-op игри. Виж бележката в meta.');
}
function cmdSummary(appDir) {
  const r = generateSummary(abs(appDir));
  console.log('Обобщение: ' + path.relative(REPO, r.path) + ' (скрийншоти: ' + r.screenshots + ', описания: ' + r.listings + ', имена в историята: ' + r.names + ')');
}

(async () => {
  const [cmd, ...rest] = process.argv.slice(2);
  try {
    if (cmd === 'name') await cmdName(rest);
    else if (cmd === 'screenshots') await cmdScreenshots(rest[0]);
    else if (cmd === 'listing') cmdListing(rest[0]);
    else if (cmd === 'meta') cmdMeta(rest[0], rest.includes('--force'));
    else if (cmd === 'names-report') {
      const appDir = abs(rest[0] || 'huawei/newslator');
      const outFile = path.join(appDir, 'publish', 'ANALYSIS.md');
      const r = await generateNamesReport(NAME_CHECKS_DIR, { outFile, appDir });
      console.log('Анализ (1 файл): ' + path.relative(REPO, r.path) + ' (' + r.count + ' имена' + (r.stale ? ', ' + r.stale + ' стари' : '') + ')');
    }
    else if (cmd === 'forms') {
      const r = await generateForms(abs(rest[0] || "huawei/newslator"));
      console.log('Форми: ' + path.relative(REPO, r.android) + ' + ' + path.relative(REPO, r.harmonyos) + ' (за „' + r.name + '", пакет ' + r.pkg + ')');
    }
    else if (cmd === 'prep') {
      const dir = rest[0];
      cmdListing(dir);
      await cmdScreenshots(dir);
      cmdMeta(dir, rest.includes('--force'));
    } else {
      console.log('Команди: name | screenshots | listing | meta | summary | names-report | prep\nПример: node private/app-publisher-bot/app-publisher-bot.cjs name "YouNews"');
    }
  } catch (e) { console.error('Грешка: ' + (e.message || e)); process.exit(1); }
})();
