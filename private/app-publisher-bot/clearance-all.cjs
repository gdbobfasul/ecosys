#!/usr/bin/env node
// clearance-all.cjs — проверка на името (марки/магазини/домейни/ниши) за ВСЯКО huawei приложение.
// Пише per-app доклад в huawei/<ап>/publish/ANALYSIS.md (има приложение → в неговата папка,
// правило на потребителя). НЕ преименува. НЕ пише в папката на бота.
const fs = require('fs');
const path = require('path');
const { nameCheck, toMarkdown } = require('./lib/name-check.cjs');

const REPO = path.join(__dirname, '..', '..');

function appNameOf(appBase) {
  try { return JSON.parse(fs.readFileSync(path.join(REPO, 'huawei', appBase, 'capacitor.config.json'), 'utf8')).appName || appBase; }
  catch (_) { return appBase; }
}

(async () => {
  const args = process.argv.slice(2);
  const apps = (!args.length || args[0] === 'all')
    ? fs.readdirSync(path.join(REPO, 'huawei')).filter((a) => fs.existsSync(path.join(REPO, 'huawei', a, 'capacitor.config.json')))
    : args;
  const summary = [];
  for (const appBase of apps) {
    const name = appNameOf(appBase);
    try {
      // eslint-disable-next-line no-await-in-loop
      const r = await nameCheck(name);
      const md = toMarkdown(r);
      const pub = path.join(REPO, 'huawei', appBase, 'publish');
      fs.mkdirSync(pub, { recursive: true });
      fs.writeFileSync(path.join(pub, 'ANALYSIS.md'), md, 'utf8');
      const line = '✅ ' + appBase + '  „' + name + '" → ' + r.risk + (r.riskWhy && r.riskWhy.length ? ' (' + r.riskWhy.join('; ') + ')' : '');
      console.log(line);
      summary.push({ appBase, name, risk: r.risk });
    } catch (e) {
      console.error('❌ ' + appBase + ' „' + name + '": ' + (e.message || e));
      summary.push({ appBase, name, risk: 'ГРЕШКА' });
    }
  }
  console.log('\n=== Обобщение по риск ===');
  for (const s of summary) console.log('  ' + s.risk.padEnd(8) + '  ' + s.appBase + '  („' + s.name + '")');
})();
