// forms.cjs — генерира обяснителните файлове за попълване на формите в Huawei AppGallery Connect,
// по един за всяко издание: Android („New app") и HarmonyOS („New app ID"). Слага ги в
// <ап>/publish/form-android.md и form-harmonyos.md. Данните (име, пакет, категория) се четат
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
async function generateDescriptions(appDir, appName, newFeaturesEn) {
  const NF_EN = newFeaturesEn || NEW_FEATURES_EN;
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
    const nf = await tr(NF_EN, code);
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

function androidForm(opts) {
  const { name, pkg, cat, appBase } = opts;
  const isGame = !!opts.isGame;
  const network = opts.network !== false;
  const collects = !!opts.collectsPersonalData;
  const accounts = !!opts.accountsOrLogin;
  const genAI = !!opts.generativeAI;
  const pricing = opts.pricing || { type: 'Paid', price: '1.00 USD' };
  const paid = /paid/i.test(pricing.type);
  const remarks = (opts.reviewerRemarksEn || '').trim();

  // Плащане — Paid (с Merchant agreement + цена + бележка за Русия/Беларус) или Free.
  const paymentBlock = paid
    ? `**Paid** — цена **${pricing.price}**. Приеми Merchant Service Agreement, въведи цената през „View and edit", Save. Махни **Russia** и **Belarus** от държавите.`
    : `**Free**.`;

  const collectBlock = collects ? '**Yes**' : '**No**';
  const aiBlock = genAI ? '**Involved**' : '**Not involved**';
  const countriesLine = 'Всички освен **Chinese mainland**' + (paid ? ', **Russia**, **Belarus**' : '');
  const filingNet = ''; // без обяснения — решението е в реда „Filing information" по-долу
  const gameNote = isGame ? '**Category = Games** → Huawei иска възрастов рейтинг (IARC въпросник). Попълни честно.\n\n' : '';

  const signInLine = accounts ? 'отметни (има вход)' : 'без отметка (няма вход)';
  const reviewerNote = paid
    ? 'Note: this build includes a 4-day trial; after 4 days it asks for a code word to continue — the code word is "кокошка" (kokoshka).'
    : 'Note: this build asks for the code word "кокошка" (kokoshka) after 4 days of use.';
  const privacyUrl = `https://selflearning.bot.nu/privacy/${appBase}/hw-privacy.html`;
  // Името е НЕЗАВИСИМО поле (може да се смени по всяко време) → placeholder, не се пише твърдо тук.
  const NAME_FIELD = 'името на приложението (източник: `capacitor.config.json` → `appName`)';

  return `# Android форма — ${appBase}

Път: **Apps and atomic services → таб Android → бутон Release.** Попълвай по реда отдолу.

> Името на приложението е единственото поле, което зависи от избора ти — навсякъде долу „App name" = ${NAME_FIELD}. Останалото не се мени при смяна на име.

${gameNote}## 1. New app
| Поле | Попълни |
|---|---|
| Package type | APK (Android app) |
| Devices supported | Mobile phone |
| App name | ${NAME_FIELD} |
| App category | ${cat} |
| Default language | English (UK) |
| Add to project | без отметка |

→ OK

## 2. App information
| Поле | Попълни |
|---|---|
| Compatible devices | само Mobile phone |
| Language | English (UK) - default |
| App name | ${NAME_FIELD} |
| Brief introduction | descriptions-languages.md → English → Brief |
| Full introduction | descriptions-languages.md → English → Full |
| New features | descriptions-languages.md → English → New features |
| Icon | качи \`publish/icon-512.png\` |

Другите езици: **Manage languages** → добави език → копирай от \`descriptions-languages.md\`.

## 3. Screenshots
Качи 8-те .png от \`publish/\` (различни езици): \`1-language-picker.png\`, \`2-english.png\`, \`3-bulgarian.png\`, \`4-arabic.png\`, \`5-hindi.png\`, \`6-japanese.png\`, \`7-chinese.png\`, \`8-german.png\`.

## 4. Categorization
| Поле | Попълни |
|---|---|
| Category | ${cat} |

## 5. Service information
| Поле | Попълни |
|---|---|
| Provider / Developer | Dai Grup Ltd. (вече попълнено) |
| Website | празно |
| Support email | ${SUPPORT_EMAIL} |

## 6. New version
| Поле | Попълни |
|---|---|
| App package | Manage packages → качи \`apk/${appBase}-huawei-release.apk\` |
| Payment type | ${paymentBlock} |
| In-app purchases | нищо |
| Privacy policy URL | \`${privacyUrl}\` |
| Data subject right URL | празно |
| Collect personal data | ${collectBlock} |
| Generative AI service | ${aiBlock} |
| Filing information | махни **Chinese mainland** от Countries/Regions → секцията изчезва |
| Copyright proof | празно (попълни само ако системата поиска) |
| Family sharing | изключено |
| Countries/Regions | ${countriesLine} |
| Sign-in required | ${signInLine} |
| Release time | Immediately once approved |

**For reviewer → Remarks** (копирай):
\`\`\`
${remarks ? remarks + ' ' : ''}${reviewerNote}
\`\`\`

→ **Save** → **Submit**.

---
APK за качване: \`apk/${appBase}-huawei-release.apk\` (release, подписан). Пакет: \`${pkg}\`.
Privacy е хостнат на \`${privacyUrl}\` (RuStore: \`.../ru-privacy.html\`) — публичен след деплой.
`;
}

function harmonyForm(name, pkg, cat, appBase) {
  const bundle = pkg.replace(/\.(hw|huawei|HUAWEI|rustore)$/, '');
  const NAME_FIELD = 'името на приложението (източник: `capacitor.config.json` → `appName`)';
  return `# HarmonyOS форма — ${appBase || bundle}

Път: **Apps and atomic services → таб HarmonyOS → New app ID.**

## New app ID
| Поле | Попълни |
|---|---|
| App type | HarmonyOS app |
| App name | ${NAME_FIELD} |
| App package name | ${bundle} |
| Level-1 app category | ${cat} |

→ Next

Останалите форми (описания, икона, снимки, цена, privacy, държави) — **същите стойности като \`form-android.md\`**.

| Поле | Попълни |
|---|---|
| Support email | ${SUPPORT_EMAIL} |
| Описания | \`publish/descriptions-languages.md\` |
| Снимки | \`publish/screenshots/\` |
| Категория | ${cat} |

⚠️ HarmonyOS иска отделен билд (HAP през DevEco Studio), не Android APK. Състояние: чака DevEco Studio.
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
  // Профил на приложението (данни/цена/категория) — от publish/app-profile.json (пише го драйверът).
  let profile = {}; try { profile = JSON.parse(readSafe(path.join(pub, 'app-profile.json')) || '{}'); } catch (_) {}
  const dh = profile.dataHandling || {};
  const opts = {
    name, pkg, cat, appBase,
    isGame: !!profile.isGame,
    network: dh.network !== false,
    collectsPersonalData: !!dh.collectsPersonalData,
    accountsOrLogin: !!dh.accountsOrLogin,
    generativeAI: !!profile.generativeAI,
    pricing: profile.pricing || { type: 'Paid', price: '1.00 USD' },
    reviewerRemarksEn: profile.reviewerRemarksEn || ''
  };
  const aPath = path.join(pub, 'form-android.md');
  const hPath = path.join(pub, 'form-harmonyos.md');
  fs.writeFileSync(aPath, androidForm(opts), 'utf8');
  fs.writeFileSync(hPath, harmonyForm(name, pkg, cat, appBase), 'utf8');
  const desc = await generateDescriptions(appDir, name, profile.newFeaturesEn);
  return { android: aPath, harmonyos: hPath, descriptions: desc.path, name, pkg };
}

module.exports = { generateForms };
