// Version: 1.0001
// gen-publish-index.mjs — за всяко приложение записва publish/PUBLISHING.md:
// индекс на ВСИЧКИ документи за публикуване, разделен по платформа (Huawei AppGallery и RuStore),
// с връзки към локалните файлове и хостнатите URL на политиките за поверителност.
//
// Целта: при публикуване отваряш този файл в папката /publish/ на приложението и виждаш точно
// кой документ къде се прикача.
//
// Пускане:  node deploy-scripts/gen-publish-index.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const HOST = 'https://selflearning.bot.nu/privacy';

function readAppId(file) {
  try {
    const j = JSON.parse(fs.readFileSync(file, 'utf8'));
    return j.appId || '';
  } catch (_) { return ''; }
}
function readAppName(metaFile, fallback) {
  try {
    const s = fs.readFileSync(metaFile, 'utf8');
    const m = s.match(/^App name:\s*(.+?)\s*(?:#.*)?$/m);
    if (m) return m[1].trim();
  } catch (_) {}
  return fallback;
}
function has(dir, name) { return fs.existsSync(path.join(dir, name)); }
function countLang(dir, sub) {
  try { return fs.readdirSync(path.join(dir, sub)).length; } catch (_) { return 0; }
}
// Ред за таблица само ако файлът съществува.
function row(dir, file, label, forWhat) {
  return has(dir, file) ? `| ${label} | ${forWhat} | [\`${file}\`](./${file}) |` : '';
}

const huaweiRoot = path.join(ROOT, 'huawei');
const apps = fs.readdirSync(huaweiRoot).filter((d) => fs.existsSync(path.join(huaweiRoot, d, 'publish')));

let written = 0;
for (const app of apps) {
  const pub = path.join(huaweiRoot, app, 'publish');
  const hwPkg = readAppId(path.join(huaweiRoot, app, 'capacitor.config.json')) || `com.pupikes.${app.replace(/-/g, '')}.hw`;
  const ruPkg = readAppId(path.join(ROOT, 'rustore', app, 'capacitor.config.json')) || `com.pupikes.${app.replace(/-/g, '')}.rustore`;
  // Старият (KCY) пакет = същият край, само доставчикът е сменен pupikes→kcy. При апове, които
  // НЯКОГА са били в магазина под това име, магазинът пази стария пакет и отказва новия (виж стъпката).
  const oldHwPkg = hwPkg.replace('com.pupikes.', 'com.kcy.');
  const oldRuPkg = ruPkg.replace('com.pupikes.', 'com.kcy.');
  const name = readAppName(path.join(pub, 'huawei.meta'), app);

  // Кой е файлът с RuStore политиката (новите апове = rustore-privacy.html; newslator = ru-privacy.html).
  const ruPrivacyFile = has(pub, 'rustore-privacy.html') ? 'rustore-privacy.html'
    : (has(pub, 'ru-privacy.html') ? 'ru-privacy.html' : 'rustore-privacy.html');

  const hwUrl = `${HOST}/${app}/hw-privacy.html`;
  const ruUrl = `${HOST}/${app}/${ruPrivacyFile}`;

  const shots = countLang(pub, 'screenshots');
  const listings = countLang(pub, 'store-listing');

  const huaweiRows = [
    row(pub, 'huawei.meta', 'Основни данни', 'име, пакет, категория, поддръжка (Set basic app information)'),
    row(pub, 'form-android.md', 'Форма — Android', 'таб **Android** → бутон Release: полетата ред по ред'),
    row(pub, 'form-harmonyos.md', 'Форма — HarmonyOS', 'таб **HarmonyOS** → New app ID'),
    row(pub, 'descriptions-languages.md', 'Описания по език', 'Manage languages → Brief / Full / New features (14 от 15 езика)'),
    has(pub, 'store-listing') ? `| Текстове по език | суровите описания за всеки език (${listings} файла) | [\`store-listing/\`](./store-listing/) |` : '',
    row(pub, 'app-profile.json', 'Privacy Tags данни', 'декларация какви данни се събират и с каква цел (Data collection)'),
    row(pub, 'monetization.json', 'Монетизация', 'модел (free / paid / IAP); при платено — HUAWEI IAP'),
    has(pub, 'icon-512.png') ? `| Икона | 512×512 (и 216×216) | [\`icon-512.png\`](./icon-512.png) |` : '',
    shots ? `| Екранни снимки | поне 3; споделени + по език (${shots} папки/файла) | [\`screenshots/\`](./screenshots/) |` : '',
    has(pub, 'hw-privacy.html') ? `| **Политика за поверителност** | подава се като URL в AGC + показва се в апа (правило 7.1) | [\`hw-privacy.html\`](./hw-privacy.html) → \`${hwUrl}\` |` : '',
    row(pub, 'analyse.hw', '⚠️ Анализ за качване', 'слаби места и вероятни причини за връщане — прегледай ПРЕДИ подаване'),
    row(pub, 'ANALYSIS.md', 'Проверка на име', 'опора при съмнение за марка/име (не е правен съвет)')
  ].filter(Boolean).join('\n');

  const rustoreRows = [
    has(pub, 'store-listing') ? `| Име / описание / категория | суровите текстове по език | [\`store-listing/\`](./store-listing/), [\`descriptions-languages.md\`](./descriptions-languages.md) |` : '',
    has(pub, 'icon-512.png') ? `| Икона | 512×512 | [\`icon-512.png\`](./icon-512.png) |` : '',
    shots ? `| Екранни снимки | 1–10; същите като за Huawei | [\`screenshots/\`](./screenshots/) |` : '',
    row(pub, 'app-profile.json', 'Разрешения (обосновка)', 'кои разрешения и защо — за декларацията в конзолата'),
    row(pub, 'monetization.json', 'Монетизация', 'модел; при плащания — RuStore Pay SDK'),
    has(pub, ruPrivacyFile) ? `| **Политика за поверителност (руски)** | подава се като URL в RuStore Console + в апа | [\`${ruPrivacyFile}\`](./${ruPrivacyFile}) → \`${ruUrl}\` |` : '',
    row(pub, 'analyse.rustore', '⚠️ Анализ за качване', 'слаби места и вероятни причини за връщане — прегледай ПРЕДИ подаване')
  ].filter(Boolean).join('\n');

  const md = `# Документи за публикуване — ${name}

_Автоматичен индекс (deploy-scripts/gen-publish-index.mjs). Отвори го при публикуване, за да знаеш кой документ къде се прикача._

- **Huawei пакет:** \`${hwPkg}\`
- **RuStore пакет:** \`${ruPkg}\`
- **Билд (APK/AAB):** идва от \`apk/${app}-{huawei,rustore}-debug.apk\` след меню 57 (не е в тази папка).

---

## 🟥 Huawei AppGallery
Портал: **AppGallery Connect** → My apps → **създай НОВО приложение** (виж стъпката веднага отдолу).

> ⚠️ **Нов пакет (Pupikes) — създай НОВ запис, не обновявай стария.**
> Пакетът вече е \`${hwPkg}\` (сменен от стария \`${oldHwPkg}\`). AppGallery **не позволява** смяна на
> пакета на съществуващ запис — ако качиш в стария, отказва с „_the name of the uploaded package is
> different from the existing package name ${oldHwPkg}_". Затова:
> 1. **My apps → New app** и задай **Package name = \`${hwPkg}\`** (фиксира се веднъж — трябва да е точно това).
> 2. Попълни данните по таблицата долу и качи APK-то в **новия** запис.
> 3. Ако старият \`${oldHwPkg}\` е бил публикуван — свали го от продажба СЛЕД одобрение на новия.
>    Отзиви, инсталации и история **не се пренасят** между два различни пакета (магазините не поддържат това).

| Документ | За какво | Файл |
|---|---|---|
${huaweiRows}

> Забележки Huawei: политиката се подава като **URL** (не се качва HTML). При пускане в континентален Китай трябва и китайска версия. Регионите (Тайван/Хонконг) се именуват като част от Китай. Ако апът иска вход — дай тестов акаунт.

---

## 🟦 RuStore
Портал: **RuStore Console** (rustore.ru/developer). Няма отделен файл-форма — полетата се попълват директно в конзолата; източниците са:

> ⚠️ **Нов пакет (Pupikes) — създай НОВО приложение, не обновявай старото.**
> Пакетът вече е \`${ruPkg}\` (сменен от стария \`${oldRuPkg}\`). RuStore, както и Huawei, **не позволява**
> смяна на пакета на съществуващ запис. Затова: създай **ново приложение** с
> **applicationId = \`${ruPkg}\`** и качи APK-то там. Ако старият \`${oldRuPkg}\` е бил публикуван — свали
> го от продажба след одобрение на новия; отзивите/инсталациите не се пренасят.

| Поле в конзолата | Източник | Файл |
|---|---|---|
${rustoreRows}

> Забележки RuStore: интерфейсът трябва да е на руски или английски; операторът на данните в политиката си ти (не RuStore); при обработка на данни на руски граждани важи 152-FZ (локализация в Русия). Формат на билда: APK или AAB.

---

## Общи активи (важат и за двата магазина)
- Икони: \`icon-216.png\`, \`icon-512.png\`
- Екранни снимки: \`screenshots/\` (+ споделените \`1-*.png\`, \`2-*.png\`… в тази папка)
- Описания: \`descriptions-languages.md\`, \`store-listing/*.txt\`
- Профил на данните (за декларациите): \`app-profile.json\`
- Монетизация: \`monetization.json\`

_Политики онлайн: Huawei → \`${hwUrl}\` · RuStore → \`${ruUrl}\` (качват се на сървъра чрез меню 08 — sync_privacy_pages)._
`;

  fs.writeFileSync(path.join(pub, 'PUBLISHING.md'), md);
  written++;
  console.log('✓', app, '→ publish/PUBLISHING.md');
}
console.log(`\nГотово: ${written} индекса PUBLISHING.md.`);
