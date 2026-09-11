# История на модерацията — pupikes-doctor (Huawei)

Този файл НЕ се трие. Пази реалните ревюта на модераторите (дословно) и как са отстранени — история на приложението и поука за бъдещи апове.

## 2026-09-09 — ревю от модерацията (дословно)

```
App review results：
Your app's main function cannot be used, affecting user experience.
Test details: Launch the APP-> Select symptoms/where it hurts/Photograph the problem-> Click on Analyze-> The analysis results displayed are the same regardless of which problem is selected.
Modification suggestion: Optimize your app to ensure it can be used in its release regions.
For details, please refer to rule 3.1 of the AppGallery Review Guidelines at the following website:
https://developer.huawei.com/consumer/en/doc/app/50104-03
[Test Environment]: Wi-Fi connection, Mate 30 Pro with EMUI 12.0.0, multilingual environment.
Consult
Release
Key metricsExpand
Develop your app Hide tasks
Auth Service
Auth Service
Helps you build a secure and reliable user authentication system for your app by simply integrating Auth Service capabilities into your app. There's no need to worry about cloud facilities and implementation. 
Auth Service
Test and release your app Hide tasks
Cloud Testing---Cloud Debugging---
Release
Cloud Testing
Tests the compatibility, stability, performance, power consumption, and security of your apps on mainstream Huawei mobile devices, and offers professional and detailed test reports to help boost app experience.
Cloud Testing
Analyze data Hide tasks
Distribution analysis
Distribution analysis
Collects and reveals how your app is distributed and used, enhancing your deci
```

## 2026-09-09 — ПОПРАВКА и пресъбмит (v1.0020)

- Поправка 3.1 (v1.0020): анализът зависи от област (карта на частите на тялото), вид болка, кога боли, сила, размер, текст (bg+en + превод) и снимка; показва само ясно водещите състояния → различни оплаквания = различни резултати. Подадено през PublishBot (--fix, sections [] + бележка).

## 2026-09-09 — v1.0021 (стенд за разпознаване)

- Завъртане-инвариантно сравнение (14 варианта), корпусът разширен с етикетирани тестови снимки (100 + завъртени) от стенда test-doctor.mjs --learn.

## 2026-09-10 — ревю от модерацията (дословно)

```
App review results：
Your app's main function cannot be used, affecting user experience.
Test details: Launch the App -> Select symptoms/where it hurts/Photograph the problem-> Click on Analyze-> The analysis results displayed are the same regardless of which problem is selected/which photo is taken.
Modification suggestion: Optimize your app to ensure it can be used in its release regions.
For details, please refer to rule 3.1 of the AppGallery Review Guidelines at the following website:
https://developer.huawei.com/consumer/en/doc/app/50104-03
[Test Environment]: Wi-Fi connection, Huawei P40 with EMUI 12.0.0, nove4e - P30 Lite with EMUI 12.0.0, multilingual environment.
Consult
Release
Key metricsExpand
Develop your app Hide tasks
Auth Service
Auth Service
Helps you build a secure and reliable user authentication system for your app by simply integrating Auth Service capabilities into your app. There's no need to worry about cloud facilities and implementation. 
Auth Service
Test and release your app Hide tasks
Cloud Testing---Cloud Debugging---
Release
Cloud Testing
Tests the compatibility, stability, performance, power consumption, and security of your apps on mainstream Huawei mobile devices, and offers professional and detailed test reports to help boost app experience.
Cloud Testing
Analyze data Hide tasks
Distribution analysis
Distribution analysis
Collects and reveals
```

## 2026-09-11 — ПОПРАВКА и пресъбмит (v1.0022)

- Причина за 3.1 („резултатът е един и същ / главната функция не може да се ползва"): 6 MB снимков корпус се парсваше наведнъж при първия анализ + съветите/причините бяха само на български и се превеждаха онлайн (в Китай MyMemory не отговаря → дълго чакане и тих провал).
- Поправка: корпусът се разделя при билд на 4 двоични части (част 0 = „първа помощ") и се зарежда лениво след първия екран с индикатор; анализът без снимка не го чака; при провал/малко памет сравнението се пропуска с бележка. Ясни съобщения за всяка грешка (нечетима снимка, библиотека, превод, примерен случай). Английски съвети и причини вградени (офлайн), превод en→език през MyMemory с relay резерв. „Примерни случаи" — 3 сценария (ожулено коляно, слънчево изгаряне, псориазис) със снимки от тестовия набор. Целият интерфейс на 15 езика (i18n-doc-more.js). Резултатът показва какво е намерила снимката.
- Описания 15 езика + бележка „How to test"; нови снимки. Подадено през PublishBot (--fix, sections [description] + бележка).

## 2026-09-11 — НЕВРОННО РАЗПОЗНАВАНЕ НА СНИМКАТА (v1.0023)

- Снимката = ВТОРИ глас: вграден невронен модел (MobileNetV3-Small, TensorFlow.js, float16 ~3 MB, в APK-то, без интернет) → 1024-мерен отпечатък → PCA 128 → косинус срещу библиотека от вграждания, пресметната при билд (корпус 16 651 + testsets/cond2 100+ проверени снимки на състояние + тестовите; `deploy-scripts/gen-doctor-embeddings.mjs` → `public/reference/emb/`) → топ-3 състояния с проценти („прилича на: …"). Въпросникът остава главен (вероятностите добавят до +4 точки). Без модел (≤ 1 GB, грешка, липсващ файл) — старият път по ръчни отпечатъци с честна бележка.
- Нови екрани/редове: статус „Невронен модел: зарежда се/готов/недостъпен" под бутона за снимка; ред „Снимка (невронен модел) — прилича на: X (62 %), Y (21 %), Z (9 %). Снимката е втори глас…" в резултата. Всички надписи на 15 езика.
- Стенд `test-doctor.mjs --emb` (нови, невидени снимки): виж паметта medikit-recognition-bench (числата преди/след).
- Описания 15 езика (Full + New features), store-listing, бележка „How to test". Огледано в rustore. Подадено през PublishBot (--fix, sections [description] + бележка).
- „Повече за това" (искане на собственика 11.09): във всяка карта — линкове на езика на интерфейса (Wikipedia на езика/en, MedlinePlus, NHS, MSD Manuals, gesund.bund.de за de), отварят се в системния браузър; без теглене, без бази с описания (вградените кратки данни за 25-те състояния остават). `src/doc/links.js`.
- Настройка ПО ИЗБОР „Свързване със сървъра на Pupikes" (изключена по подразбиране; `src/doc/medikit.js`, pupikes.app/api/medikit): веднъж на пускане GET /updates → нови отпечатъци в локалната библиотека (localStorage, таван 1500); „✓ Това беше X" → POST /learn само с числовия отпечатък (1024 числа) + състояние; GET /condition → линкове/резюме на езика (резерв: вградените линкове). Privacy: запис в deploy-scripts/gen-privacy.mjs (thirdParties).
