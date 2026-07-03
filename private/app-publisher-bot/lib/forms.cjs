// forms.cjs — генерира обяснителните файлове за попълване на формите в Huawei AppGallery Connect,
// по един за всяко издание: Android („New app") и HarmonyOS („New app ID"). Слага ги в
// <ап>/publish/forma-android.md и forma-harmonyos.md. Данните (име, пакет, категория) се четат
// от publish/huawei.meta и capacitor.config.json — така важи за КОЕ ДА Е приложение.
const fs = require('fs');
const path = require('path');
const { LANGS, LANG_NAME } = require('./listing.cjs');

// Кратко описание (Brief, до 25 знака) от първия ред на listing текста.
// Реже чисто: първо на запетая/точка (край на фраза), иначе на граница на дума без висящ
// предлог; при писмености без интервали (китайски/японски) просто до 25 знака.
function briefOf(text) {
  const full = (String(text || '').split('\n').map((l) => l.trim()).find(Boolean) || '');
  if (full.length <= 25) return full;
  const b = full.slice(0, 25);
  const punct = Math.max(
    b.lastIndexOf(','), b.lastIndexOf('.'), b.lastIndexOf('،'),
    b.lastIndexOf('，'), b.lastIndexOf('、'), b.lastIndexOf('।'), b.lastIndexOf('・')
  );
  if (punct >= 10) return b.slice(0, punct).trim();
  if (b.includes(' ')) {
    return b.slice(0, b.lastIndexOf(' ')).replace(/\s+\S{1,3}$/, '').trim();
  }
  return b; // без интервали (CJK) — до 25 знака
}

// Съответствие на нашите езикови кодове с имената на езиците в Huawei AppGallery.
// ky (кыргызки) НЕ съществува в AppGallery → не може да се добави.
const AG_LANG = {
  en: 'English (UK) — default', ar: 'Arabic', bg: 'Bulgarian', fr: 'French (France)', de: 'German',
  it: 'Italian', ja: 'Japanese', ru: 'Russian', 'zh-Hant': 'Traditional Chinese (Taiwan, China)',
  uk: 'Ukrainian', es: 'Spanish (Spain)', 'es-MX': 'Spanish (Latin America)', pt: 'Portuguese (Portugal)',
  hi: 'Hindi', ky: '— НЕ се поддържа в AppGallery (пропусни)'
};

// Превод en → език през MyMemory (същия преводач като на приложението).
const MM = { bg: 'bg', ru: 'ru', uk: 'uk', en: 'en', de: 'de', fr: 'fr', es: 'es', 'es-MX': 'es-MX', it: 'it', pt: 'pt', ar: 'ar', hi: 'hi', ja: 'ja', ky: 'ky', 'zh-Hant': 'zh-TW' };
async function tr(text, code) {
  if (code === 'en' || !text) return text;
  try {
    const lp = 'en|' + (MM[code] || code);
    const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text) + '&langpair=' + encodeURIComponent(lp) + '&de=ltd.dai.grup@gmail.com';
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 12000);
    const r = await fetch(url, { signal: ctl.signal }); clearTimeout(to);
    const j = await r.json();
    const o = j && j.responseData && j.responseData.translatedText;
    return (o && !/MYMEMORY WARNING|INVALID|QUERY LENGTH/i.test(o)) ? o : text;
  } catch (_) { return text; }
}
// „New features" (първо издание) на английски — превежда се за всеки език.
const NEW_FEATURES_EN = 'First release. Read world news from many countries, automatically translated into your language, and listen to the headlines read aloud.';

// Пише отделен файл с Brief + Full + New features (локализирани) за поддържаните езици.
async function generateDescriptions(appDir, appName) {
  const pub = path.join(appDir, 'publish');
  const L = [];
  L.push('# ' + appName + ' — описание по език (Brief + Full + New features)');
  L.push('');
  L.push('_За AppGallery: **Manage languages** → добави език (по колоната „AppGallery език") → попълни **Brief introduction** (до 25 знака), **Full introduction** и **New features** от секцията за съответния език._');
  L.push('');
  L.push('> ⚠️ **ky (кыргызки) НЕ съществува в AppGallery** — пропусни го (14 от 15 се поддържат). Махни отметките от **Greek** и **Turkish**, ако са чекнати (нямаме преводи за тях).');
  L.push('');
  for (const code of LANGS) {
    // Пропускаме езици, които AppGallery НЕ поддържа (напр. кыргызки).
    if (!AG_LANG[code] || /НЕ се поддържа/.test(AG_LANG[code])) continue;
    const t = readSafe(path.join(pub, 'store-listing', code + '.txt')).trim();
    if (!t) continue;
    // eslint-disable-next-line no-await-in-loop
    const nf = await tr(NEW_FEATURES_EN, code);
    L.push('## ' + (LANG_NAME[code] || code) + ' (' + code + ') — AppGallery: **' + AG_LANG[code] + '**');
    L.push('**Brief introduction (до 25 знака):**');
    L.push('```');
    L.push(briefOf(t));
    L.push('```');
    L.push('**Full introduction:**');
    L.push('```');
    L.push(t);
    L.push('```');
    L.push('**New features (до 1000 знака):**');
    L.push('```');
    L.push(nf);
    L.push('```');
    L.push('');
  }
  const out = path.join(pub, 'descriptions-languages.md');
  fs.writeFileSync(out, L.join('\n'), 'utf8');
  return { path: out, count: LANGS.length };
}

function readSafe(p) { try { return fs.readFileSync(p, 'utf8'); } catch (_) { return ''; } }
function metaField(meta, label) {
  const m = meta.match(new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':\\s*(.+)'));
  return m ? m[1].split('#')[0].trim() : '';
}

const SUPPORT_EMAIL = 'dai.group.ltd.support@gmail.com';

function androidForm(name, pkg, cat, fullIntro, brief, appBase) {
  return `# Попълване на ВСИЧКИ Android форми в Huawei AppGallery Connect — ${name}

Път: Apps and atomic services → таб **Android** → бутон **Release**. Формите се попълват ПОСЛЕДОВАТЕЛНО (стойностите за копиране са в блоковете).

---

## Форма 1 — диалог „New app"

| Поле | Стойност |
|---|---|
| **Package type** | **APK (Android app)** (НЕ „RPK (quick app)") |
| **Devices supported** | **Mobile phone** |
| **App name** | \`${name}\` |
| **App category** | **${cat}** |
| **Default language** | **English (UK)** |
| **Add to project** | без отметка |

→ **OK**

---

## Форма 2 — App information (Localization)

**Compatibility → Compatible devices:** ✅ **Mobile phone** (Tablet/Watch — не)
**Localization → Language:** English (UK) - default

**App name:**
\`\`\`
${name}
\`\`\`

**Brief introduction** (до 25 знака), **Full introduction** (до 8000 знака) и **New features** (до 1000 знака):
→ вземи ги от файла **\`publish/descriptions-languages.md\`** — там и трите са локализирани за
езиците, които AppGallery поддържа (без кыргызки). За English (UK, default) ползвай секцията
„English (en)"; другите се задават последователно през **Manage languages** от същия файл.

**Icon** (квадратна 512×512 PNG): качи \`publish/icon-512.png\` (същата икона като в APK-то).

---

## Форма 3 — Visual assets → Screenshots (задължително, 3–8 бр.)

Качи 8-те екрана от \`publish/\` (на РАЗЛИЧНИ езици — да се вижда, че има преводи), в реда:
\`1-language-picker.png\` · \`2-english.png\` · \`3-bulgarian.png\` · \`4-arabic.png\` (RTL) ·
\`5-hindi.png\` · \`6-japanese.png\` · \`7-chinese.png\` · \`8-german.png\`.
(Introduction/Promotion video — по избор.)

---

## Форма 4 — Categorization

**Category:**
\`\`\`
${cat}
\`\`\`

---

## Форма 5 — Service information

Provider / Developer name — вече попълнени (Dai Grup Ltd.).
**Website:** по избор — може да се остави празно.
Имейл за поддръжка (в раздела за контакти/поддръжка): \`${SUPPORT_EMAIL}\`

---

## Форма 6 — „New version - Draft" (версията + законовите полета)

**App version → App version:** натисни **Manage packages** → качи
\`apk/${appBase}-huawei-release.apk\` (release, подписан). Пакетът \`${pkg}\` идва от APK-то.
⚠️ Ако смениш държавите/регионите СЛЕД качване, Huawei иска **повторно качване на APK-то**
(съобщение „contract signing entity has changed … upload an app package again") — просто качи
пак СЪЩИЯ файл през Manage packages. Нормална стъпка, нищо по файла не се променя.

**Payment information → Payment type:** **Paid** — цена **1.00 USD**.
Стъпки: (1) приеми **Huawei Merchant Service Agreement** (линкът до „Paid") — задължително за
получаване на пари; (2) до **Price (tax included)** натисни **View and edit** → въведи базова цена
**1.00 USD** (Huawei авто-попълва другите валути) → **Save**; (3) **Submit** отново — грешката
„Edit and save the price" изчезва, щом цената е записана.
Забележки: Huawei удържа комисиона (~15%); настрой банкова сметка за изплащане (Finance/Payout).

**In-app purchases:** нищо не отмятай (приложението няма вътрешни покупки — цената е еднократна при сваляне).

**Privacy statement:**
| Поле | Стойност |
|---|---|
| **Privacy policy URL** (задължително) | \`https://selflearning.bot.nu/privacy/${appBase}/hw-privacy.html\` |
| **Data subject right URL** | остави празно (може да е същият адрес) |

**Privacy tags → Collect personal data:** **No** (приложението не събира лични данни — няма профили/вход, само локални настройки).

**AI function declaration → Generative AI service:** **Not involved**
(приложението само превежда и чете новини; няма генеративен ИИ).

**Copyright information → Proof of copyright:** ти сме собственик на кода — при поискване
качи документ/декларация от Dai Grup Ltd. (или екранна снимка на репозитория). Често не е
задължително за първо подаване — попълни ако системата го изисква.

**Filing information (китайско ICP/MIIT изискване) → РЕШЕНИЕ: махни континентален Китай от разпространението.**
Тази секция иска Filing entity + Organization code, проверени в китайското министерство (MIIT) —
т.е. РЕАЛНО китайско ICP разрешително + китайско юр. лице/организационен код. НЯМАМЕ такова.
Секцията е задължителна САМО защото континентален Китай е сред целевите пазари. Затова:
1. Иди в **Countries/Regions за разпространение** → **изключи „Chinese mainland" / China**.
2. Върни се на „Filing information" — щом Китай (mainland) не е целеви пазар, секцията вече НЕ е
   задължителна и грешката „One or more errors ... Filing information" изчезва.
⚠️ НЕ избирай „Standalone app" (значи БЕЗ мрежа, а ${name} ползва мрежа → пада на проверка) и НЕ
избирай „App server is in Chinese mainland". Приложението остава достъпно във всички ДРУГИ региони.
Таргетираме Тайван (zh-Hant, традиционен китайски), не континентален Китай (там е zh-CN, който нямаме).

**Family sharing:** **изключено** (не отмятай). Важи само за приложения в китайския
континентален пазар и при платено съдържание. ${name} е безплатно и без покупки → неприложимо.

**For reviewer:**
- **Sign-in required:** без отметка (няма вход в приложението).
- **Remarks** (инструкция за рецензента, копирай):
\`\`\`
No account or sign-in is required. On first launch, choose an interface language, then pick a country to read its latest news. The headlines are automatically translated into the selected language. Tap the speaker icon on a headline (or "Read all") to have it read aloud via the device's text-to-speech. You can change country and language anytime from the tabs.
\`\`\`

**Release → Release time:** **Immediately once approved**.

→ Горе вдясно **Save**, после **Submit**.

### Privacy policy URL — хостване (готово в кода)
Адресът е ПОСТОЯНЕН — не се сменя, докато приложението е активно в магазина.
Privacy страницата за Huawei е \`public/privacy/${appBase}/hw-privacy.html\` → при деплой отива в
\`/var/www/html/privacy/${appBase}/hw-privacy.html\` и се сервира на
**\`https://selflearning.bot.nu/privacy/${appBase}/hw-privacy.html\`** (nginx блокът \`/privacy/\` е
добавен в \`08-setup-domain.sh\`). За RuStore има отделна страница на
\`https://selflearning.bot.nu/privacy/${appBase}/ru-privacy.html\`. След деплой (опция 2/5 + опция 8
за домейните) адресът е публичен по HTTPS и се попълва в полето. НЕ ползваме offbitch.com (счупен).

---

## Всички поддържани езици
Кратко (Brief) и пълно (Full) описание за всеки език са в **\`publish/descriptions-languages.md\`**.
През **Manage languages** добавяш всеки език и попълваш от там, последователно. Снимките важат за всички езици.

## Двоичен файл (за качване)
\`apk/${appBase}-huawei-release.apk\` — **release, подписан** (не debug). Пакет \`${pkg}\`.
`;
}

function harmonyForm(name, pkg, cat) {
  const bundle = pkg.replace(/\.(hw|huawei|HUAWEI|rustore)$/, '');
  return `# Форма „New app ID" (HarmonyOS) в Huawei AppGallery Connect — попълване за ${name}

**Път:** Apps and atomic services → таб **HarmonyOS** → **New app ID**.
(За Android виж \`forma-android.md\`.)

## Попълване

| Поле | Какво да избереш / въведеш |
|---|---|
| **App type** | **HarmonyOS app** (НЕ „Atomic service") |
| **App name** | \`${name}\` |
| **App package name** | \`${bundle}\` (HarmonyOS bundle name) |
| **Level-1 app category** | **${cat}** (НЕ „Game") |

Натисни **Next**. Бележката за суфикс \`.huawei\`/\`.HUAWEI\` важи само за joint-operations игри.

## ⚠️ HarmonyOS иска ОТДЕЛЕН билд (HAP), не Android APK
Прави се с **DevEco Studio + HarmonyOS SDK**. Тъй като приложението е уеб (HTML/JS),
HarmonyOS изданието е тънка **ArkTS обвивка**, зареждаща \`dist/\` в **Web компонент (ArkWeb)**.
Състояние: чака DevEco Studio.

## Общи данни
- Имейл за поддръжка: \`${SUPPORT_EMAIL}\`
- Описания: \`publish/store-listing/<език>.txt\` · Снимки: \`publish/screenshots/\` · Категория: ${cat}
`;
}

async function generateForms(appDir) {
  const pub = path.join(appDir, 'publish');
  fs.mkdirSync(pub, { recursive: true });
  const meta = readSafe(path.join(pub, 'huawei.meta'));
  let cap = {}; try { cap = JSON.parse(readSafe(path.join(appDir, 'capacitor.config.json'))); } catch (_) {}
  const name = metaField(meta, 'App name') || cap.appName || path.basename(appDir);
  const pkg = metaField(meta, 'App package name') || cap.appId || '';
  const cat = metaField(meta, 'Level-1 app category') || 'App';
  const appBase = path.basename(appDir);
  // Пълно и кратко описание — от английския store-listing (така важи за КОЕ ДА Е приложение).
  const enListing = readSafe(path.join(pub, 'store-listing', 'en.txt')).trim();
  let brief = (enListing.split('\n').map((l) => l.trim()).find(Boolean) || name);
  // Brief introduction — предпочита се до 25 знака; режем по граница на дума, без висяща пунктуация.
  if (brief.length > 25) brief = brief.slice(0, 25).replace(/[\s,;:.\-]+\S*$/, '').replace(/[\s,;:.\-]+$/, '').trim();
  const fullIntro = enListing || name;
  const aPath = path.join(pub, 'forma-android.md');
  const hPath = path.join(pub, 'forma-harmonyos.md');
  fs.writeFileSync(aPath, androidForm(name, pkg, cat, fullIntro, brief, appBase), 'utf8');
  fs.writeFileSync(hPath, harmonyForm(name, pkg, cat), 'utf8');
  const desc = await generateDescriptions(appDir, name);
  return { android: aPath, harmonyos: hPath, descriptions: desc.path, name, pkg };
}

module.exports = { generateForms };
