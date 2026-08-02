// Version: 1.0002
// gen-publish-index.mjs — за всяко приложение записва ДВА ОТДЕЛНИ файла (по един на платформа):
//   publish/PUBLISHING-HUAWEI.md   — само стъпките и документите за Huawei AppGallery
//   publish/PUBLISHING-RUSTORE.md  — само стъпките и документите за RuStore
// с връзки към локалните файлове и хостнатия URL на политиката за поверителност за тази платформа.
// Старият общ publish/PUBLISHING.md се ТРИЕ (двете платформи вече не са в един файл).
//
// Целта: при публикуване в дадена платформа отваряш САМО нейния файл и виждаш точно кой документ
// къде се прикача — без да се бъркат Huawei и RuStore.
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
function readAppNameCfg(file, fallback) {
  try { const j = JSON.parse(fs.readFileSync(file, 'utf8')); return j.appName || fallback; } catch (_) { return fallback; }
}
function readProfile(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return {}; }
}
// Категория от huawei.meta („Level-1 app category: News (Новини)" → „News"). Резерва, ако няма app-profile.
function readMetaCategory(metaFile) {
  try {
    const s = fs.readFileSync(metaFile, 'utf8');
    const m = s.match(/^Level-1 app category:\s*(.+?)\s*(?:\(|#|$)/m);
    if (m) return m[1].trim();
  } catch (_) {}
  return '';
}
// Кои езици са РЕАЛНО преведени за това приложение: store-listing/<код>.txt съществува и се
// различава от en.txt (en е базов и винаги е „преведен"). Ботът добавя САМО тези езици.
function translatedLangs(pub) {
  const set = new Set(['en']);
  const dir = path.join(pub, 'store-listing');
  let en = '';
  try { en = fs.readFileSync(path.join(dir, 'en.txt'), 'utf8').replace(/\r/g, ''); } catch (_) { return set; }
  let files = []; try { files = fs.readdirSync(dir); } catch (_) {}
  for (const f of files) {
    if (!f.endsWith('.txt')) continue; const code = f.slice(0, -4);
    if (code === 'en' || code.startsWith('_')) continue;
    try { const t = fs.readFileSync(path.join(dir, f), 'utf8').replace(/\r/g, ''); if (t.trim() && t !== en) set.add(code); } catch (_) {}
  }
  return set;
}
function readStoreNames(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return {}; } }
function has(dir, name) { return fs.existsSync(path.join(dir, name)); }
function countLang(dir, sub) {
  try { return fs.readdirSync(path.join(dir, sub)).length; } catch (_) { return 0; }
}
// Ред за таблица само ако файлът съществува.
function row(dir, file, label, forWhat) {
  return has(dir, file) ? `| ${label} | ${forWhat} | [\`${file}\`](./${file}) |` : '';
}

// Карта: нашият език (код + native) → ТОЧНИЯ етикет в Huawei „Manage languages" (Distribute →
// App information → Manage languages → Search). Еднаква за ВСИЧКИ приложения. English (UK) е
// езикът по подразбиране (вече „Localized") — НЕ се добавя пак; ботът добавя останалите 14.
// Внимание за разминаванията: Spanish(Spain) vs Spanish(Latin America); Traditional Chinese
// (Taiwan, China) — НЕ „Chinese (PRC)" (то е опростен); French (France); Portuguese (Portugal).
// Правило: ако НАШИЯТ превод (един код) покрива няколко регионални варианта на Huawei, ботът
// избира ВСИЧКИ тях и попълва СЪЩОТО описание за всеки (hw = масив). Испанският е изключение —
// имаме ОТДЕЛНИ преводи es/es-MX, всеки към своя вариант (не се дублират).
const HUAWEI_LANGS = [
  { code: 'en', native: 'English', hw: ['English (UK)', 'English (US)'], defaultLabel: 'English (UK)', note: 'English (UK) е по подразбиране (Localized); ботът добавя English (US) — общ превод покрива и двата' },
  { code: 'bg', native: 'Български', hw: ['Bulgarian'] },
  { code: 'ru', native: 'Русский', hw: ['Russian'] },
  { code: 'uk', native: 'Українська', hw: ['Ukrainian'] },
  { code: 'de', native: 'Deutsch', hw: ['German'] },
  { code: 'fr', native: 'Français', hw: ['French (France)'] },
  { code: 'es', native: 'Español', hw: ['Spanish (Spain)'] },
  { code: 'es-MX', native: 'Español (MX)', hw: ['Spanish (Latin America)'] },
  { code: 'it', native: 'Italiano', hw: ['Italian'] },
  { code: 'pt', native: 'Português', hw: ['Portuguese (Portugal)', 'Portuguese (Brazil)'], note: 'общ pt превод — ботът избира и двата, същото описание' },
  { code: 'ar', native: 'العربية', hw: ['Arabic'] },
  { code: 'hi', native: 'हिन्दी', hw: ['Hindi'] },
  { code: 'ja', native: '日本語', hw: ['Japanese'] },
  { code: 'ky', native: 'Кыргызча', hw: [], note: 'НЯМА в списъка на Huawei — ботът НЕ го избира (остава в приложението, но не и в магазинното описание)' },
  { code: 'zh-Hant', native: '繁體中文', hw: ['Traditional Chinese (Taiwan, China)', 'Traditional Chinese (Hong Kong, China)'], note: 'общ традиционен китайски — ботът избира и двата (Taiwan + Hong Kong), същото описание' }
];

// Категоризация в Huawei (Distribute → App information → Categorization). Дърво: Apps/Games →
// категория (2-ро ниво, ТОЧНИТЕ етикети от конзолата) → под-категория (3-то ниво — определено тук,
// защото не се вижда на екраните; ботът е човек-в-цикъла → потвърждаваш в падащото меню).
// Ключ = папката на приложението. Еднакво за двата магазина (RuStore ползва свой сходен избор).
// 2-ро ниво = точните етикети от живата конзола (екрани 11-13); 3-то ниво = реални под-категории
// от официалния каталог на Huawei AppGallery. Ботът е човек-в-цикъла → потвърждаваш в менюто.
const CATEGORY_MAP = {
  authenticator:                   { top: 'Apps', cat: 'Tools',            sub: 'Security' },
  'auto-sound-diagnostics':        { top: 'Apps', cat: 'Cars',             sub: 'Car Care' },
  'autoreply-bot':                 { top: 'Apps', cat: 'Tools',            sub: 'Tools' },
  'baby-monitor':                  { top: 'Apps', cat: 'Kids',             sub: 'Mom and Baby' },
  'business-faq-bot':              { top: 'Apps', cat: 'Business',          sub: 'Business' },
  'camera-watch':                  { top: 'Apps', cat: 'Tools',            sub: 'Security' },
  chat:                            { top: 'Apps', cat: 'Social',           sub: 'Chatting' },
  houselookbook:                   { top: 'Apps', cat: 'Lifestyle',        sub: 'House Refurbishment' },
  'market-pulse':                  { top: 'Apps', cat: 'Finance',          sub: 'Equity Funds' },
  'monitor-bot':                   { top: 'Apps', cat: 'Tools',            sub: 'Tools' },
  newslator:                       { top: 'Apps', cat: 'News & reading',   sub: 'News' },
  'price-watch-bot':               { top: 'Apps', cat: 'Shopping',         sub: 'Discounts' },
  'pupikes-doctor':                { top: 'Apps', cat: 'Sports & health',  sub: 'Healthcare' },
  'pupikes-medicines':             { top: 'Apps', cat: 'Sports & health',  sub: 'Healthcare' },
  'pupikes-toolkit-3drotate':      { top: 'Apps', cat: 'Photo & video',    sub: 'AV editors' },
  'pupikes-toolkit-ai-announcement':{ top: 'Apps', cat: 'Business',        sub: 'Efficiency' },
  'pupikes-toolkit-finance':       { top: 'Apps', cat: 'Finance',          sub: 'Equity Funds' },
  'pupikes-toolkit-passwords':     { top: 'Apps', cat: 'Tools',            sub: 'Security' },
  'pupikes-toolkit-pdf':           { top: 'Apps', cat: 'Business',          sub: 'Efficiency' },
  'pupikes-toolkit-pictures':      { top: 'Apps', cat: 'Photo & video',    sub: 'AV editors' },
  'pupikes-toolkit-qr':            { top: 'Apps', cat: 'Tools',            sub: 'Tools' },
  'pupikes-toolkit-scraper':       { top: 'Apps', cat: 'Tools',            sub: 'Tools' },
  'pupikes-toolkit-sound':         { top: 'Apps', cat: 'Photo & video',    sub: 'AV editors' },
  'pupikes-toolkit-text':          { top: 'Apps', cat: 'Tools',            sub: 'Tools' },
  'pupikes-toolkit-videos':        { top: 'Apps', cat: 'Photo & video',    sub: 'AV editors' },
  'routine-bot':                   { top: 'Apps', cat: 'Business',          sub: 'Efficiency' },
  'selflearning-friend':           { top: 'Apps', cat: 'Education',         sub: 'Learning' },
  'services-toolkit':              { top: 'Apps', cat: 'Tools',            sub: 'Tools' },
  // Игри (top = Games; cat = жанр; sub = под-жанр от каталога)
  'dodge-master':                  { top: 'Games', cat: 'Puzzle Games',    sub: 'Casual Games' },
  duel:                            { top: 'Games', cat: 'Action Games',    sub: 'Fighting' },
  'fps-hunter':                    { top: 'Games', cat: 'Action Games',    sub: 'Shooting' },
  hmm:                             { top: 'Games', cat: 'Adventure Games',  sub: 'Turn-Based Strategy' },
  'plane-shooter':                 { top: 'Games', cat: 'Action Games',    sub: 'Aircraft' },
  rustam:                          { top: 'Games', cat: 'Puzzle Games',    sub: 'Casual Games' },
  'titans-fight':                  { top: 'Games', cat: 'Action Games',    sub: 'Fighting' }
};

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
  const appName = readAppNameCfg(path.join(huaweiRoot, app, 'capacitor.config.json'), name);
  const profile = readProfile(path.join(pub, 'app-profile.json'));
  const catInfo = CATEGORY_MAP[app] || { top: 'Apps', cat: (profile.categoryHuawei || readMetaCategory(path.join(pub, 'huawei.meta')) || 'Tools'), sub: '' };
  const catPath = catInfo.top + ' > ' + catInfo.cat + (catInfo.sub ? ' > ' + catInfo.sub : '');
  const catHw = catInfo.cat;
  const isGameCat = catInfo.top === 'Games';
  const catRu = profile.categoryRustore || 'Инструменты';
  const priced = profile.pricing && /paid|one_time|subscription|iap/i.test(profile.pricing.type || '');
  const dh = profile.dataHandling || {};
  // Разрешения за декларацията (обосновка)
  const permLines = [];
  if (dh.microphone) permLines.push('- **Микрофон (RECORD_AUDIO)** — ' + (dh.notes ? 'виж app-profile.json' : 'по функцията на приложението'));
  if (dh.camera) permLines.push('- **Камера (CAMERA)** — по функцията на приложението');
  if (dh.location) permLines.push('- **Локация** — по избор, само при нужда');
  if (dh.notifications) permLines.push('- **Известия (POST_NOTIFICATIONS)** — локални известия');
  const permBlock = permLines.length ? permLines.join('\n') : '- Без чувствителни разрешения (без камера/микрофон/локация).';
  const releaseName = name.replace(/\s+/g, '-');
  // езици, реално преведени за ТОВА приложение + локализирани имена
  const trLangs = translatedLangs(pub);
  const storeNames = readStoreNames(path.join(pub, 'store-names.json'));
  // само нашите езици, които са (1) реално преведени и (2) имат етикет в Huawei
  const activeLangs = HUAWEI_LANGS.filter((l) => l.hw.length && trLangs.has(l.code));
  const hwEntryCount = activeLangs.reduce((n, l) => n + l.hw.length, 0);
  const langRows = activeLangs.map((l) => {
    const nm = storeNames[l.code] || storeNames._default || appName;
    const labels = l.hw.map((h) => h === l.defaultLabel ? h + ' _(по подр.)_' : '**' + h + '**').join(' + ');
    return `| ${l.code} | ${l.native} | ${labels} | ${nm} |`;
  }).join('\n');
  const skippedLangs = HUAWEI_LANGS.filter((l) => !l.hw.length || !trLangs.has(l.code))
    .map((l) => l.code + (!l.hw.length ? ' (няма в Huawei)' : ' (не е преведен)')).join(', ');

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

  // ── HUAWEI файл ──
  const mdHuawei = `# Публикуване в Huawei AppGallery — ${name}

_Автоматичен индекс (deploy-scripts/gen-publish-index.mjs). САМО за Huawei. За RuStore виж \`PUBLISHING-RUSTORE.md\`._

> 🤖 **Правило за бота:** попълва всички полета **видимо** (ти гледаш как ги въвежда), но **НЕ натиска** OK / Next / Save / Submit / „Продължи". На всяка страница спира — **ти преглеждаш данните и натискаш бутона сам**. Публикуване само с твое действие.

- **Huawei пакет:** \`${hwPkg}\`
- **Билд (APK/AAB):** \`apk/huawei/release/${name.replace(/\s+/g, '-')}-huawei-release.apk\` (подписан; строи се от меню „билд/качване").
- **Портал:** [AppGallery Connect](https://developer.huawei.com/consumer/en/service/josp/agc/index.html) → My apps → **създай НОВО приложение**.

> ⚠️ **Нов пакет (Pupikes) — създай НОВ запис, не обновявай стария.**
> Пакетът е \`${hwPkg}\`. AppGallery **не позволява** смяна на пакета на съществуващ запис — ако качиш
> в стар запис с друг пакет, отказва с „_the name of the uploaded package is different…_". Затова:
> 1. **My apps → New app** и задай **Package name = \`${hwPkg}\`** (фиксира се веднъж — точно това).
> 2. Попълни данните по таблицата долу и качи APK-то в **новия** запис.
> 3. Ако е съществувал стар пакет — свали го от продажба СЛЕД одобрение на новия. Отзиви/инсталации **не се пренасят**.

### Документи в тази папка
| Документ | За какво | Файл |
|---|---|---|
${huaweiRows}

---

## Форма поле-по-поле (Apps and atomic services → таб **Android** → бутон **Release**)

### 1. New app
| Поле | Стойност |
|---|---|
| Package type | APK (Android app) |
| Devices supported | Mobile phone |
| App name | \`${appName}\` |
| App category | **App** (selectbox само с App / News — за обикновено приложение избери **App**; „News" е специалният новинарски тип на Huawei) |
| Default language | English (UK) |
| Add to project | без отметка |

→ **OK** _(съдържателната категория „${catHw}" се задава по-късно — на екрана Categorization/App information, не тук)_

### 2. App information (Release app → App information)
Горните полета са автоматични (само за четене): **Package type: APK · App ID: (Huawei го дава) · Devices supported: Mobile phone**.
| Поле | Стойност / източник |
|---|---|
| **Compatibility → Compatible devices** | отметни **Mobile phone** (Tablet — не) |
| Language | English (UK) — default |
| App name | \`${appName}\` |
| Brief introduction | \`descriptions-languages.md\` → English → **Brief** |
| Full introduction | \`descriptions-languages.md\` → English → **Full** |
| New features | \`descriptions-languages.md\` → English → **New features** |
| App icon | качи \`icon-512.png\` |

→ **Save** → **Next**

Другите езици: **Manage languages** → за всеки ред долу: Search → отметни точния етикет → **OK**; после копирай Brief/Full/New features от \`descriptions-languages.md\` (или \`store-listing/<език>.txt\`).

#### Manage languages — езиците за ТОВА приложение (${activeLangs.length} наши → ${hwEntryCount} записа в Huawei)
Правило: ботът добавя САМО езиците, на които приложението е **реално преведено** (проверка: \`store-listing/<код>.txt\` ≠ en.txt). Ако нашият превод покрива няколко регионални варианта (English UK/US, Portuguese PT/BR, Traditional Chinese TW/HK), ботът избира **всички** и попълва **същия** превод и **същото име** за всеки.
| Наш код | Наш език | Huawei етикет(и) — отметни ВСИЧКИ | App name (локализирано) |
|---|---|---|---|
${langRows}

- **Описания/име по език:** Brief/Full/New features от \`descriptions-languages.md\` (по код); App name от \`store-names.json\` (по код, иначе марката).
- **Не се избират:** ${skippedLangs || '—'}.
- Разминавания: \`es\`→Spanish (Spain), \`es-MX\`→Spanish (Latin America) (отделни); \`zh-Hant\`→Traditional Chinese (Taiwan/Hong Kong) — НЕ „Chinese (PRC)" (опростен); \`ru\`→Russian + Belarusian (ботът пропуска етикет, ако липсва в списъка на Huawei).

### 3. Visual assets (Icon + Screenshots + Promotion video)
| Актив | Стойност |
|---|---|
| Icon | \`icon-512.png\` (216×216 или 512×512, PNG ≤2 MB) |
| **Screenshots** (задължително) | екраните от \`screenshots/\` (поне 3)${shots ? ` — налични ${shots}` : ' — ⚠ липсват'}. Препоръка: избор на език, интро, съгласие, начален екран |
| Introduction videos | по избор — пропусни |
| **Promotion video** | по избор: **интрото на Pupikes** (брандово лого) — ЕДНО общо видео за ВСИЧКИ приложения. Файл: \`app-shared/promo-pupikes.mp4\` (1200×900, 4:3, H.264 mp4). Прегенерира се с \`node deploy-scripts/render-promo-intro.cjs\` |

### 4. Categorization (Distribute → App information → Categorization → Category)
Изборът е дърво. Навигирай точно така (3-то ниво е определено от нас — потвърди в падащото меню):
| Ниво | Избери |
|---|---|
| 1 (тип) | **${catInfo.top}** |
| 2 (категория) | **${catInfo.cat}** |${catInfo.sub ? `\n| 3 (под-категория) | **${catInfo.sub}** |` : ''}

**Пълен път:** \`${catPath}\`${isGameCat ? '  _(игра — top ниво Games)_' : ''}

### 5. Service information
| Поле | Стойност |
|---|---|
| Provider / Developer | Dai Grup Ltd. |
| Website | **https://pupikes.com** |
| Support email | miroljubkalaydjiev177@gmail.com |

### 6. Privacy & Data (правило 7.1 / 7.2)
- **Privacy policy URL:** \`${hwUrl}\` (подава се като **адрес**, НЕ се качва HTML). Същата политика се отваря и ВЪТРЕ в апа (footer + екран за съгласие).
- **Data collection декларация** — по \`app-profile.json\`:
${permBlock}
${dh.network ? '- Мрежа: да — потоците са описани в политиката (декларирай ги и в Privacy Tags).' : '- Мрежа: не.'}
- Събиране на лични данни: **${dh.collectsPersonalData ? 'да' : 'не'}** · Акаунт/вход: **${dh.accountsOrLogin ? 'да' : 'не'}**${dh.accountsOrLogin ? ' → дай тестов акаунт' : ''}.

### 7. New version (билд)
| Поле | Стойност |
|---|---|
| App package | Manage packages → качи \`apk/huawei/release/${releaseName}-huawei-release.apk\` |
| Монетизация | ${priced ? 'Платено — HUAWEI IAP (виж monetization.json)' : 'Безплатно'} |

### 8. Преди подаване
Прегледай \`analyse.hw\` (вероятни причини за връщане) → **Submit for review**.

> Забележки: при континентален Китай трябва китайска версия на политиката + copyright сертификат. Регионите Тайван/Хонконг се именуват като част от Китай.

_Политика онлайн (Huawei): \`${hwUrl}\` — качва се на сървъра при билд/деплой (задължителния етап)._
`;

  // ── RUSTORE файл ──
  const mdRustore = `# Публикуване в RuStore — ${name}

_Автоматичен индекс (deploy-scripts/gen-publish-index.mjs). САМО за RuStore. За Huawei виж \`PUBLISHING-HUAWEI.md\`._

- **RuStore пакет:** \`${ruPkg}\`
- **Билд (APK/AAB):** \`apk/rustore/release/${name.replace(/\s+/g, '-')}-rustore-release.apk\` (подписан; строи се от меню „билд/качване").
- **Портал:** [RuStore Console](https://console.rustore.ru/) → **създай НОВО приложение**.

> ⚠️ **Нов пакет (Pupikes) — създай НОВО приложение, не обновявай старото.**
> Пакетът е \`${ruPkg}\`. RuStore, както Huawei, **не позволява** смяна на пакета на съществуващ запис.
> Създай **ново приложение** с **applicationId = \`${ruPkg}\`** и качи APK-то там. Ако е съществувал стар
> пакет — свали го след одобрение на новия; отзивите/инсталациите не се пренасят.

### Документи в тази папка
| Поле в конзолата | Източник | Файл |
|---|---|---|
${rustoreRows}

---

## Форма поле-по-поле (RuStore Console → **Новое приложение**)

### 1. Основни данни
| Поле | Стойност |
|---|---|
| applicationId | \`${ruPkg}\` |
| Название приложения | \`${appName}\` |
| Категория | ${catRu} |
| Язык интерфейса конзоли | Русский или English |

### 2. Описание (по език)
| Поле | Източник |
|---|---|
| Краткое описание | \`store-listing/ru.txt\` (и по език) / \`descriptions-languages.md\` → Brief |
| Полное описание | \`store-listing/ru.txt\` / \`descriptions-languages.md\` → Full |
| Что нового | \`descriptions-languages.md\` → New features |

### 3. Графика
| Поле | Стойност |
|---|---|
| Иконка | \`icon-512.png\` (512×512) |
| Скриншоты | \`screenshots/\` (1–10) ${shots ? `— налични ${shots}` : '— ⚠ липсват'} |

### 4. Разрешения и данни
- **Политика конфиденциальности (URL):** \`${ruUrl}\` (адрес; същата се отваря и в апа).
- Разрешения (обосновка за модерацията):
${permBlock}
${dh.network ? '- Сеть: да — только технические запросы, описаны в политике.' : '- Сеть: нет.'}
- Сбор персональных данных: **${dh.collectsPersonalData ? 'да' : 'нет'}** · Аккаунт/вход: **${dh.accountsOrLogin ? 'да' : 'нет'}**.
- 152-ФЗ: операторът на данните си **ти** (не RuStore); при данни на руски граждани важи локализация в Русия.

### 5. Монетизация
| Поле | Стойност |
|---|---|
| Модель | ${priced ? 'Платно — RuStore Pay SDK (виж monetization.json)' : 'Бесплатно'} |

### 6. Билд
| Поле | Стойност |
|---|---|
| APK/AAB | качи \`apk/rustore/release/${releaseName}-rustore-release.apk\` |

### 7. Преди подаване
Прегледай \`analyse.rustore\` → **Отправить на модерацию**.

_Политика онлайн (RuStore): \`${ruUrl}\` — качва се на сървъра при билд/деплой (задължителния етап)._
`;

  fs.writeFileSync(path.join(pub, 'PUBLISHING-HUAWEI.md'), mdHuawei);
  fs.writeFileSync(path.join(pub, 'PUBLISHING-RUSTORE.md'), mdRustore);
  // махни стария общ файл (двете платформи вече са разделени)
  try { fs.unlinkSync(path.join(pub, 'PUBLISHING.md')); } catch (_) {}
  written++;
  console.log('✓', app, '→ PUBLISHING-HUAWEI.md + PUBLISHING-RUSTORE.md');
}
console.log(`\nГотово: ${written} × 2 файла (Huawei + RuStore). Старите PUBLISHING.md са премахнати.`);
