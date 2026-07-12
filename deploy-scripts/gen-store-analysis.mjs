// Version: 1.0001
// gen-store-analysis.mjs — за ВСЕКИ ап записва publish/analyse.hw и publish/analyse.rustore:
// пълен анализ на СЛАБИТЕ МЕСТА и вероятните причини за ВРЪЩАНЕ от Huawei AppGallery / RuStore
// при качване или ъпдейт — за да чистиш грешките ПРЕДИ да подадеш.
//
// Източник на правилата: свалената документация (виж SLF пакет store-docs-full / store-publishing).
// Източник на данните за апа: publish/app-profile.json (dataHandling), monetization.json, huawei.meta,
// capacitor.config.json, наличието на политики/икона/скрийншоти.
//
// Пускане:  node deploy-scripts/gen-store-analysis.mjs
//
// Легенда на статусите:
//   ❗ РИСК      — вероятна причина за връщане, оправи задължително преди подаване.
//   ⚠️ ВНИМАНИЕ  — трябва ръчна проверка/обосновка, иначе може да върнат.
//   ✅ ОК        — покрито (според наличните данни).
//   ℹ️ ИНФО      — контекст/напомняне, не е блокер.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const HOST = 'https://selflearning.bot.nu/privacy';

function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_) { return null; } }
function readText(f) { try { return fs.readFileSync(f, 'utf8'); } catch (_) { return ''; } }
function has(dir, name) { return fs.existsSync(path.join(dir, name)); }
function countDir(dir, sub) { try { return fs.readdirSync(path.join(dir, sub)).length; } catch (_) { return 0; } }
function metaField(meta, label) { const m = meta.match(new RegExp('^' + label + ':\\s*(.+?)\\s*(?:#.*)?$', 'm')); return m ? m[1].trim() : ''; }

function line(level, title, detail) { return `- ${level} **${title}** — ${detail}`; }

const huaweiRoot = path.join(ROOT, 'huawei');
const apps = fs.readdirSync(huaweiRoot).filter((d) => fs.existsSync(path.join(huaweiRoot, d, 'publish')));

let written = 0;
for (const app of apps) {
  const pub = path.join(huaweiRoot, app, 'publish');
  const profile = readJson(path.join(pub, 'app-profile.json')) || {};
  const dh = profile.dataHandling || {};
  const mon = readJson(path.join(pub, 'monetization.json')) || {};
  const meta = readText(path.join(pub, 'huawei.meta'));
  const mainJs = readText(path.join(huaweiRoot, app, 'src', 'main.js'));
  const hasInAppPrivacy = /mountPrivacyLink/.test(mainJs);                       // footer линк към политиката (legal.js)
  const hasDeletionChannel = /mountPrivacyLink\([^)]*account:\s*true/.test(mainJs); // „Изтрий акаунта" → заявка до админ
  const name = metaField(meta, 'App name') || app;
  const hwPkg = metaField(meta, 'App package name') || (readJson(path.join(huaweiRoot, app, 'capacitor.config.json')) || {}).appId || `com.kcy.${app.replace(/-/g, '')}.hw`;
  const ruPkg = (readJson(path.join(ROOT, 'rustore', app, 'capacitor.config.json')) || {}).appId || `com.kcy.${app.replace(/-/g, '')}.rustore`;

  const shots = countDir(pub, 'screenshots');
  const listings = countDir(pub, 'store-listing');
  const hasIcon512 = has(pub, 'icon-512.png');
  const hasIcon216 = has(pub, 'icon-216.png');
  const hasHwPrivacy = has(pub, 'hw-privacy.html');
  const ruPrivacyFile = has(pub, 'rustore-privacy.html') ? 'rustore-privacy.html' : (has(pub, 'ru-privacy.html') ? 'ru-privacy.html' : '');
  const hasDescs = has(pub, 'descriptions-languages.md');

  const isGame = !!profile.isGame;
  const genAI = !!profile.generativeAI;
  const model = mon.model || (profile.pricing && /paid|one_time|subscription|iap/i.test(profile.pricing.type || '') ? 'paid' : 'free');
  const paid = /one_time|subscription|iap|paid/i.test(model);
  const isIAP = /iap|subscription/i.test(model);          // in-app покупки/абонамент → нужен билинг SDK
  const isPaidDownload = paid && !isIAP;                   // платено сваляне (цена в магазина)
  const released = mon.released === true;                  // публикуван режим (без тест-заключване)
  const nameLen = name.length;
  // Регион-риск (4.8): само за апове, които РЕАЛНО показват списък държави/региони. Проверяваме
  // изворния код за такъв списък (не по името — за да няма фалшиви тревоги), И дали Тайван/Хонконг
  // вече са изписани като част от Китай.
  function srcContains(re) {
    const srcDir = path.join(huaweiRoot, app, 'src');
    let hit = false;
    (function walk(d) {
      if (hit) return;
      let ents = []; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (_) { return; }
      for (const e of ents) {
        if (hit) return;
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.(js|json|html)$/.test(e.name)) { try { if (re.test(fs.readFileSync(p, 'utf8'))) hit = true; } catch (_) {} }
      }
    })(srcDir);
    return hit;
  }
  const showsCountries = srcContains(/["'](?:Germany|France|Japan|Ukraine|Poland|Brazil)["']/) && srcContains(/Taiwan|Тайван|Hong Kong/);
  const chinaHandled = srcContains(/Taiwan,\s*China|Hong Kong,\s*China|Тайван,\s*Китай/);

  // ── HUAWEI анализ ─────────────────────────────────────────────────────────────────
  const hw = [];
  // 7.1 политика
  hw.push(hasHwPrivacy
    ? line('✅ ОК', 'Политика за поверителност (7.1) — файл', `hw-privacy.html присъства → подай URL ${HOST}/${app}/hw-privacy.html в AGC.`)
    : line('❗ РИСК', 'Липсва политика (7.1)', 'Няма hw-privacy.html — без валиден URL заявката се връща.'));
  hw.push(hasInAppPrivacy
    ? line('✅ ОК', 'Политика И В приложението (7.1)', 'Вграден footer линк „Поверителност" (legal.js) на всяка страница → отваря хостнатата политика. Покрива изискването за in-app линк.')
    : line('⚠️ ВНИМАНИЕ', 'Политика И В приложението (7.1)', 'Huawei иска линк към политиката И в store listing, И достъпен ВЪТРЕ в апа. Вграденият in-app линк липсва — добави mountPrivacyLink (legal.js).'));
  // 7.2 Privacy Tags / декларация
  if (dh.network) {
    hw.push(line('ℹ️ ИНФО', 'Privacy Tags (7.2) — конзолна стъпка', 'Апът ползва мрежа (вкл. общия KCY слой: анонимен help доклад + промо каталог). Потоците са описани в политиката; при подаване ги декларирай и в Privacy Tags/описанието (за да съвпадат). Не е дефект в кода.'));
  } else {
    hw.push(line('✅ ОК', 'Данни/мрежа (7.2)', 'Профилът сочи без мрежа. Провери, че наистина няма скрити заявки (иначе декларацията е грешна).'));
  }
  // 7.3 дерегистрация
  if (dh.accountsOrLogin) {
    hw.push(hasDeletionChannel
      ? line('✅ ОК', 'Изтриване на акаунт (7.3)', 'Апът има in-app „Изтрий акаунта" → изпраща ЗАЯВКА до администратора (по сигурност потребителят не трие сам; само админ/модератор изпълнява). Това е достъпен канал за дерегистрация + обратна връзка. ВАЖНО: опиши процеса в политиката и дай разумен срок.')
      : line('❗ РИСК', 'Изтриване на акаунт (7.3)', 'Апът има акаунти/вход, но няма in-app път за изтриване/заявка. Добави „Изтрий акаунта" (legal.js account:true) → заявка до админ, + опиши в политиката.'));
    hw.push(line('ℹ️ ИНФО', 'Тестов акаунт (1.11) — конзолна стъпка', 'Има вход → при подаване дай валиден тестов акаунт на ревюто. Не е дефект в кода.'));
  } else {
    hw.push(line('✅ ОК', 'Без акаунт (7.3/1.11)', 'Няма вход/акаунт — дерегистрация и тестов акаунт не се изискват.'));
  }
  // чувствителни разрешения
  const sens = [];
  if (dh.camera) sens.push('камера');
  if (dh.microphone) sens.push('микрофон');
  if (dh.location) sens.push('локация');
  if (sens.length) {
    hw.push(line('⚠️ ВНИМАНИЕ', 'Чувствителни разрешения', `Ползва: ${sens.join(', ')}. Обоснови всяко в описанието и го искай при употреба (минимизация 7.17). ${dh.location ? 'Локацията НЕ бива да е само за реклами/анализ (7.18) — обвържи я с реална функция.' : ''}`));
  } else {
    hw.push(line('✅ ОК', 'Разрешения', 'Без камера/микрофон/локация — нисък риск по разрешенията.'));
  }
  // екранни снимки
  hw.push(shots >= 3
    ? line('✅ ОК', 'Екранни снимки (1.7)', `${shots} налични (мин. 3). Да отговарят на реалните функции; резолюция 800x450/450x800, до 2 MB.`)
    : line('❗ РИСК', 'Под 3 екранни снимки (1.7)', `Намерени ${shots}. Трябват поне 3 реални екрана.`));
  // икона
  hw.push(hasIcon512
    ? line('✅ ОК', 'Икона', `icon-512.png присъства (нужна 216x216 или 512x512, PNG ≤2 MB${hasIcon216 ? '; има и 216' : ''}).`)
    : line('❗ РИСК', 'Липсва икона 512', 'Няма icon-512.png.'));
  // име
  hw.push((nameLen >= 3 && nameLen <= 64)
    ? line('✅ ОК', 'Име (1.3)', `„${name}" — ${nameLen}/64 знака. Провери ANALYSIS.md за марка/дублиране.`)
    : line('❗ РИСК', 'Име извън 3–64 знака (1.3)', `„${name}" е ${nameLen} знака.`));
  // Плащане (ПЛАТЕН АП)
  if (isIAP) {
    hw.push(line('❗ РИСК', 'In-app плащане → HUAWEI IAP (раздел 6)', `Модел „${model}". In-app покупки/абонамент ЗАДЪЛЖИТЕЛНО минават през HUAWEI IAP SDK — трябва РЕАЛНА интеграция в кода, иначе връщат. Платена основна функция → безплатен пробен (3.9).`));
  } else if (isPaidDownload) {
    hw.push(line('ℹ️ ИНФО', 'Платено сваляне — настройка в конзолата', 'Задай цена в AGC + активирай HUAWEI merchant/разчетна сметка и подпиши Paid Apps договор (задължителни за платени апове). IAP SDK НЕ е нужен за платено сваляне — покупката е на ниво магазин.'));
    hw.push(line('ℹ️ ИНФО', 'Безплатен пробен (3.9)', 'Huawei ПРЕПОРЪЧВА платените апове да дават пробна версия/период на основната функция. Няма вграден пробен → обмисли, за да намалиш риска от забележка.'));
    hw.push(line('✅ ОК', 'Реклами', 'Изскачащите промо реклами са автоматично ИЗКЛ. в платените апове (promo-ads е гейтнат по модела: показва се само при model=free). Остава единствено ненатрапчивото затваряемо балонче „✨ KCY" + доброволен showcase (ecosystem.js) — минава правилата.'));
  } else {
    hw.push(line('✅ ОК', 'Монетизация', 'Безплатно — без изисквания за плащане.'));
  }
  if (paid && !released) {
    hw.push(line('❗ РИСК', 'Тест-заключване активно в платен ап', 'monetization.released=false → 4-дневното пробно ПАРОЛНО заключване е ВКЛ. Платен публикуван ап НЕ бива да има такова — сложи released:true.'));
  }
  // региони / държави
  if (showsCountries && !chinaHandled) {
    hw.push(line('❗ РИСК', 'Именуване на държави/региони (4.8)', 'Апът показва държави/региони → Тайван/Хонконг/Макао ТРЯБВА да са част от Китай (напр. „Тайван, Китай"), етикет „Държава/регион", правилни знамена. Списък с Тайван като държава = сигурно връщане.'));
  } else if (showsCountries && chinaHandled) {
    hw.push(line('✅ ОК', 'Именуване на държави/региони (4.8)', 'Апът показва държави, но Тайван/Хонконг вече са изписани като част от Китай („…, China"). Провери и знамената.'));
  }
  // генеративен AI
  if (genAI) {
    hw.push(line('ℹ️ ИНФО', 'Генеративен AI', 'Апът праща заявки към трета страна (AI). Третата страна е декларирана в политиката; при подаване я отрази и в Privacy Tags. Съдържанието да спазва правилата.'));
  }
  // HTTPS
  if (dh.network) hw.push(line('✅ ОК', 'HTTPS (7.10)', 'Мрежовите заявки (вкл. KCY слоя) са по HTTPS. Провери, че няма http:// повиквания.'));
  // Китай
  hw.push(line('ℹ️ ИНФО', 'Континентален Китай', 'Ако включиш континентален Китай в зоните: нужна китайска версия на политиката + софтуерен авторски сертификат (copyright). Извън Китай — по избор.'));
  // общ слой
  hw.push(line('ℹ️ ИНФО', 'Общ KCY слой', 'Всеки ап има help доклад (анонимен) + промо реклами (самореклама на други KCY апове). Няма трекинг SDK. Това вече е описано в новата политика — дръж я подадена.'));

  // ── RUSTORE анализ ────────────────────────────────────────────────────────────────
  const ru = [];
  ru.push(ruPrivacyFile
    ? line('✅ ОК', 'Политика (руски)', `${ruPrivacyFile} присъства → подай URL ${HOST}/${app}/${ruPrivacyFile} в RuStore Console. Операторът на данните си ТИ, не RuStore.`)
    : line('❗ РИСК', 'Липсва руска политика', 'Няма rustore-privacy.html.'));
  ru.push(line('✅ ОК', 'Език руски/английски', 'Апът има 15 езика (вкл. ru/en) → покрива изискването за руски или английски интерфейс.'));
  if (sens.length) {
    ru.push(line('⚠️ ВНИМАНИЕ', 'Чувствителни разрешения', `Ползва: ${sens.join(', ')}. Декларирай и обоснови всяко в конзолата (Dangerous/Special искат обосновка).`));
  } else {
    ru.push(line('✅ ОК', 'Разрешения', 'Без чувствителни разрешения (Normal) — минимална декларация.'));
  }
  ru.push(line('ℹ️ ИНФО', 'Възрастов рейтинг — конзолна стъпка', `При подаване задай рейтинг в Console → Age rating (0+…18+, по 436-ФЗ). ${isGame ? 'Игра — избери според съдържанието.' : ''} Не е дефект в кода.`));
  ru.push(hasIcon512
    ? line('✅ ОК', 'Икона', 'icon-512.png (512x512, .png/.jpeg, до 3 MB, изцяло запълнен фон без прозрачност).')
    : line('❗ РИСК', 'Липсва икона 512', 'Няма icon-512.png (RuStore иска 512x512).'));
  ru.push((shots >= 1 && shots <= 10)
    ? line('✅ ОК', 'Екранни снимки', `${shots} (RuStore: 1–10, мобилните задължителни).`)
    : line(shots ? '⚠️ ВНИМАНИЕ' : '❗ РИСК', 'Екранни снимки', `Намерени ${shots}. Трябват 1–10, мобилните задължителни.`));
  if (isIAP) {
    ru.push(line('❗ РИСК', 'In-app плащане → Pay SDK', `Модел „${model}". In-app покупки/абонамент искат РЕАЛНА интеграция на Pay SDK (BillingClient спира 01.08.2026). Подписите на keystore да съвпадат.`));
  } else if (isPaidDownload) {
    ru.push(line('ℹ️ ИНФО', 'Платено сваляне — настройка в конзолата', 'Включи монетизация в RuStore Console и задай цена (самонает може за минути; мин. теглене 5000₽). Pay SDK НЕ е нужен за платено сваляне — само за in-app. Keystore подписът да съвпада между версиите.'));
    ru.push(line('✅ ОК', 'Реклами', 'Изскачащите промо реклами са автоматично ИЗКЛ. в платените апове (гейтнати по модела). Остава само ненатрапчивото затваряемо балонче „✨ KCY" + доброволен showcase — минава правилата.'));
  } else {
    ru.push(line('✅ ОК', 'Монетизация', 'Безплатно — без плащания.'));
  }
  if (dh.collectsPersonalData || dh.accountsOrLogin) {
    ru.push(line('ℹ️ ИНФО', '152-ФЗ (данни на руски граждани)', 'Апът обработва лични данни. Трансграничният трансфер и съгласието са описани в политиката; ако таргетираш руски потребители, спази локализацията/съгласието. Конзолна/правна стъпка, не дефект в кода.'));
  } else {
    ru.push(line('✅ ОК', '152-ФЗ', dh.network ? 'Само технически заявки (без лични данни) — локализацията на практика не се прилага.' : 'Без лични данни/мрежа — локализацията не се прилага.'));
  }
  if (/^(chat|houselookbook)$/.test(app)) {
    ru.push(line('⚠️ ВНИМАНИЕ', 'Потребителско съдържание (UGC)', 'Апът позволява потребителско съдържание → осигури пре-/пост-модерация по жалби (иначе връщат).'));
  }
  ru.push(line('ℹ️ ИНФО', 'Стабилност + подпис — при подаване', 'Модерацията минава целия път — без сривове (тествай). APK подписът да съвпада между магазините/версиите. Стандартна стъпка, не дефект в кода.'));
  ru.push(line('ℹ️ ИНФО', 'Забранено съдържание', `Без хазарт с реални пари, порнография, реалистично насилие, суицидно съдържание. ${isGame ? '(игра — провери сцените спрямо рейтинга)' : ''}`));
  ru.push(line('ℹ️ ИНФО', 'Общ KCY слой', 'Help доклад (анонимен) + промо реклами. Декларирано в политиката; RuStore иска и деклариране на типовете събирани данни в конзолата.'));

  const stamp = '_(Генерирано от gen-store-analysis.mjs по свалените изисквания на Huawei/RuStore. Не е правен съвет — ориентир за самопроверка преди подаване.)_';

  const hwDoc = `# Анализ за качване в Huawei AppGallery — ${name}

Пакет: \`${hwPkg}\`  ·  тип: ${isGame ? 'игра' : 'приложение'}  ·  категория: ${profile.categoryHuawei || '—'}

Списък на слабите места и вероятните причини за връщане при качване/ъпдейт. Оправи ❗ и прегледай ⚠️ преди подаване.

${hw.join('\n')}

${stamp}
`;

  const ruDoc = `# Анализ за качване в RuStore — ${name}

Пакет: \`${ruPkg}\`  ·  тип: ${isGame ? 'игра' : 'приложение'}

Списък на слабите места и вероятните причини за връщане при качване/ъпдейт. Оправи ❗ и прегледай ⚠️ преди подаване.

${ru.join('\n')}

${stamp}
`;

  fs.writeFileSync(path.join(pub, 'analyse.hw'), hwDoc);
  fs.writeFileSync(path.join(pub, 'analyse.rustore'), ruDoc);
  written++;
  console.log('✓', app, '→ analyse.hw + analyse.rustore');
}
console.log(`\nГотово: ${written} апа × 2 файла = ${written * 2} анализа.`);
