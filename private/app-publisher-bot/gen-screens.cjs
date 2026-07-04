#!/usr/bin/env node
// gen-screens.cjs — генерира локализирани снимки за всяко приложение с publish.config.json и ги
// ПОДБИРА в 8-те именувани файла, които формата очаква (езиков избор + главен екран на 7 езика).
// Употреба:  node gen-screens.cjs [app1 app2 ...]   (без аргументи → всички huawei апове с конфиг, без newslator)
const fs = require('fs');
const path = require('path');
const { generateScreenshots } = require('./lib/screenshots.cjs');

const REPO = path.join(__dirname, '..', '..');
// 7-те езика за снимките (както newslator) + езиковия избор = 8 файла.
const SHOT_LANGS = ['en', 'bg', 'ar', 'hi', 'ja', 'zh-Hant', 'de'];
// Съответствие език → именуван файл (номерата съвпадат с form-android.md).
const NAMED = {
  en: '2-english.png', bg: '3-bulgarian.png', ar: '4-arabic.png',
  hi: '5-hindi.png', ja: '6-japanese.png', 'zh-Hant': '7-chinese.png', de: '8-german.png'
};

function curate(appDir) {
  const shots = path.join(appDir, 'publish', 'screenshots');
  const pub = path.join(appDir, 'publish');
  let n = 0;
  // 1 — езиков избор (sharedShot се пише в корена на screenshots/).
  const picker = path.join(shots, '1-language-picker.png');
  if (fs.existsSync(picker)) { fs.copyFileSync(picker, path.join(pub, '1-language-picker.png')); n++; }
  // 2..8 — главният екран на всеки език.
  for (const lang of SHOT_LANGS) {
    const src = path.join(shots, lang, 'main.png');
    if (fs.existsSync(src)) { fs.copyFileSync(src, path.join(pub, NAMED[lang])); n++; }
  }
  return n;
}

(async () => {
  const args = process.argv.slice(2);
  let apps = args.length ? args.map((a) => a.replace(/^huawei\//, ''))
    : fs.readdirSync(path.join(REPO, 'huawei')).filter((a) =>
        a !== 'newslator' && fs.existsSync(path.join(REPO, 'huawei', a, 'publish', 'publish.config.json')));
  console.log('Приложения за снимки: ' + apps.join(', '));
  for (const a of apps) {
    const appDir = path.join(REPO, 'huawei', a);
    if (!fs.existsSync(path.join(appDir, 'publish', 'publish.config.json'))) { console.log('  ⏭ ' + a + ' — няма publish.config.json'); continue; }
    try {
      // eslint-disable-next-line no-await-in-loop
      const r = await generateScreenshots(appDir, { langs: SHOT_LANGS });
      const named = curate(appDir);
      console.log(`  ✓ ${a} — ${r.total} снимки, ${named}/8 именувани файла`);
    } catch (e) {
      console.log(`  ✗ ${a} — ${e.message}`);
    }
  }
  console.log('Готово.');
})();
