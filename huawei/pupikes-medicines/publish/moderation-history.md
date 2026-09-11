# История на модерацията — pupikes-medicines (Huawei)

Този файл НЕ се трие. Пази реалните ревюта на модераторите (дословно) и как са отстранени — история на приложението и поука за бъдещи апове.

## 2026-09-09 — ревю от модерацията (дословно)

```
App review results：
1.Your app's main function runs incorrectly, affecting user experience.
Test details: Scan the medicine package -> it does not list the main ingredients.
Modification suggestion: Optimize your app to ensure it can be used in its release regions.
For details, please refer to rule 3.1 of the AppGallery Review Guidelines at the following website:
https://developer.huawei.com/consumer/en/doc/app/50104-03
2.Your app offers only simple content, which affects user experience.
Modification suggestion: Enrich your app content/Submit an app with unique content and features to provide a better user experience.
For details, please refer to rule 4.1 of the AppGallery Review Guidelines at the following website:
https://developer.huawei.com/consumer/en/doc/app/50104-04
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
Tests the compatibility, stability, performance, power consumption, and security
```

## 2026-09-09 — ПОПРАВКА и пресъбмит (v1.0020)

- Поправка 3.1 (v1.0020): „Основни съставки“ винаги се показват (допълване от openFDA / описанието / генеричното име; иначе „—“). Бележка и за 4.1 (OCR 8 завъртания, офлайн база, листовка на 15 езика, рискови съставки, инструменти).

## 2026-09-09 — v1.0021 (стенд за разпознаване)

- Deskew (ъгъл на надписите → завъртане до 0°), OCR пакет по езика (15), подсказки от дребния текст на 15 езика (форма/път/за кого/сила/тип), кандидати по лекарствен суфикс, офлайн-първо търсене, научени имена от тестовия стенд (100 снимки + завъртени).

## 2026-09-09 — v1.0022 (изравняване v2, подготвено; 1.0021 е в Reviewing)

- Стендът показа, че старият метод (проекция на всички тъмни пиксели) връща 0° при реални 15°. Нов детектор: ориентация на ръбовете (Собел, хистограма по модул 90°) + фино донастройване по проекция на ръбовете → ъгълът се засича на ±0,3° (15,56° и 95,3°). Резултат на стенда: 30 картинки на 15,56°: 6/30 → 14/30; на 95,3°: 13/30 (при 24/99 неизравнени). Подава се при следващото обновяване или при отказ на 1.0021.

## 2026-09-10/11 — ревю от модерацията (дословно, повторно 3.1 + 4.1)

```
1.Your app's main function runs incorrectly, affecting user experience.
Test details: Scan the medicine package -> it does not list the main ingredients or any coherent, useful information.
Modification suggestion: Optimize your app to ensure it can be used in its release regions. (rule 3.1)
2.Your app offers only simple content, which affects user experience. (rule 4.1)
[Test Environment]: Wi-Fi connection, Huawei P40 with EMUI 12.0.0, nove4e - P30 Lite with EMUI 12.0.0, multilingual environment.
```

## 2026-09-11 — ПОПРАВКА и пресъбмит (v1.0023)

- 3.1: OCR-ът вече е ВГРАДЕН в апа (tesseract.js + модели eng/bul/rus/chi_sim/chi_tra в public/ocr, ~10 MB) — сканирането работи без интернет (тестерите са в Китай; CDN-ът падаше → нищо не се разчиташе). НИКОГА празен резултат: карта с разчетения текст, кандидати за име с едно докосване (от вградената база), тип от дребния текст, „Търси по това име". Вградена база ~580 най-чести лекарства (Wikidata INN + етикети/синоними на 15 езика вкл. китайски/руски/латински + openFDA съставки/показания; `deploy-scripts/gen-med-db.mjs` → `public/reference/med-db.json`), търсене с толеранс (Левенщайн, транслитерация, CJK подниз). Relay резерв за openFDA/MyMemory. „Пробвай с примерна опаковка" — 3 реални снимки от стенда (amoxicillin, aspirin, diclofenac).
- 4.1: три нови таба — Взаимодействия (2 лекарства, таблица 80+ правила по 42 групи, тежест + причина, 15 езика), Дозировка (калкулатор ОТС по тегло/възраст: парацетамол, ибупрофен, аспирин, цетиризин, лоратадин, лоперамид, ОРС; ml/таблетки), График за прием (местни известия с дневно повторение, дневник приет/неприет). i18n-med пълен за 15 езика (преди bg/ru/en).
- Описания 15 езика + store-listing; бележка с „How to test"; нови снимки (7 екрана × 15 езика). Подадено през PublishBot (--fix, sections [description] + бележка). Огледано в rustore.

## 2026-09-11 — НОВ ЕТАП НА РАЗПОЗНАВАНЕТО (v1.0024, след подаването на 1.0023)

- БАРКОД ПЪРВО, на устройството: EAN-13/EAN-8/UPC-A/E, DataMatrix (GS1 AI 01) и QR се четат от снимката с @zxing/library (чист JS, отделен лениво зареждан чънк ~120 KB gz). GTIN → вграден регистър `public/reference/gtin-db.json` (2,4 MB: ~100 000 продукта от openFDA NDC Directory — търговско | генерично име; NDC-производни UPC „3 + NDC10 + контролна" по префикс на продукта + 26 800 изрични UPC; delta/base36 запис, двоично търсене) → пълна карта по генеричното/търговското име; липсва → онлайн openFDA ndc.json по UPC (пряко/relay) → иначе OCR, а кодът се показва в картата. Генератор `deploy-scripts/gen-gtin-db.mjs` (кеш private/medikit-harvester/wd-cache/gtin/). Четвърта примерна опаковка с истински UPC (Claritin) — минава без OCR.
- ГОЛЯМ РЕЧНИК `public/reference/drug-names.json` (≤2 MB: ~16 300 вещества от Wikidata INN/ATC/DrugBank + етикети/синоними на 20 езика + ~13 500 търговски имена от openFDA → ~70 000 имена), `med/names.js` търсене с толеранс по кошове; в lookup.js след med-db: INN в med-db → пълна карта, иначе кратка карта „речник". Генератор `deploy-scripts/gen-drug-names.mjs`.
- OCR: „точен" модел tessdata_best само за eng (`public/ocr/lang-best`, 12,8 MB) за чистия латински пас; адаптивна бинаризация + ×2 увеличение на първия етап, Otsu като последен резерв; вертикален CJK (psm 5) при zh/ja интерфейс или CJK текст. Стенд EN 0° първите 60: преди 22/60 (36,7 %) → след 23/60 (38,3 %), 0 загубени; успехите ~3 s.
- i18n-med: 7 нови ключа × 15 езика (баркод етап/ред/регистър/подсказка/източници). Описания 15 езика + store-listing (нов абзац + New features 1.0024); бележка с „How to test" (баркод стъпка). Огледано в rustore (src, public, package.json). Не е подадено — чака решение след текущия преглед на 1.0023.
- ВТОРА РЕДАКЦИЯ 1.0024 (същия ден, искане на собственика за компактност + линкове + сървър): (а) `med/links.js` — раздел „Листовка и информация" в картата: линкове по езика на интерфейса (Wikipedia по локалното име от med-db, DailyMed/FDA по NDC при баркод, EMA, национални справочници bg framar / ru vidal+rlsnet / uk compendium / de Gelbe Liste / fr base-donnees-publique / es CIMA / it Torrinomedica / pt Infomed / ar Webteb+Altibbi / hi 1mg / ja KEGG+PMDA / zh-Hant HK Drug Office / ky руските), само адреси, отварят се в системния браузър; (б) tessdata_best МАХНАТ (−12,8 MB), речникът свит до латиница ≤1 MB + не-латиница за bg/ru/uk/ar/hi/ja/zh (общо 1,5 MB, ~48 600 имена; „неизвестните" вещества без статии/INN/марка са махнати); med-db (709 KB) и gtin-db (2,5 MB) остават; (в) `med/sync.js` — настройка по избор „Свързване със сървъра на Pupikes" (изключена по подразбиране): GET /api/medikit/drug (име/GTIN) преди openFDA, POST /learn при потвърдено разпознаване/избран кандидат, GET /updates веднъж на пускане → малък локален допълнителен индекс (localStorage); MEDIKIT_BASE → pupikes.app/medikit с резерв стария адрес; privacy: запис pupikes.app/api/medikit в gen-privacy.mjs. Размер на dist: 1.0023 ≈ 32,4 MB → 1.0024 36,9 MB (+2,5 регистър, +1,5 речник, +0,5 баркод декодер). Стенд EN 0° 60: 1.0023 22/60 → 1.0024: виж medikit-recognition-bench.md. 7 нови ключа + 5 (links/sync) × 15 езика; описания/store-listing/бележка обновени.
- ТРЕТА РЕДАКЦИЯ 1.0024 (11.09, довършване): старото „офлайн ядро" `public/reference/meds-db.json` (~8100 продукта от openFDA, 14 MB) е ИЗВАДЕНО от апа (huawei + rustore) — основните ~580 остават вградени (med-db), имената — в речника (1,5 MB), редките се търсят онлайн в шардовете `pupikes.app/medikit/meds/<буква>.json` (първо точният шард, после сървърът при включена настройка, после openFDA); `gen-medikit-server-data.mjs` вече не пише в апа (WRITE_APP_BUNDLE=1 за старото), `gen-med-db.mjs` чете мастера `private/medikit-harvester/meds-db.full.json`. Размер на dist: 36,9 MB → 22,6 MB. Настройката „Свързване със сървъра": /learn праща `app:'medicines'`, делтата от /updates се слива по формата на сървъра (gtin/name/inn), научените записи се ползват само при включена настройка; нов надпис „пълната база на Pupikes (онлайн)" × 15 езика. Проверено с мок (локален server.js на 3015 + шардовете): изключено = 0 заявки; включено = /updates веднъж на пускане, /drug за непознато, POST /learn за баркод и за име. Стенд EN 0° 60: 1.0023 22/60 → 1.0024 24/60 (40 %), 0 загубени. smoke-tabs en/bg/ar/zh-Hant 44/0. Бележката (How to test т. 8) обновена. Сървърът и шардовете ТРЯБВА да са деплойнати преди подаването.
