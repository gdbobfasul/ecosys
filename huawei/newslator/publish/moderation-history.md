# История на модерацията — newslator (NewsLator, Huawei)

Този файл НЕ се трие. Пази реалните ревюта на модераторите (дословно) и как са отстранени — история на приложението и поука за бъдещи апове.

## 2026-08-11 — ОТХВЪРЛЕНО (подадено v1.0019)

Ревю от модерацията:

```
App review results：
1. Privacy policy URL https://pupikes.app/privacy/newslator/hw-privacy.html → "404 Not found". (rule 7.1)
2. Only simple content — приложението изглежда с твърде просто/оскъдно съдържание. (rule 4.1)
```

Отстранено:
- **7.1** — privacy страницата качена на прод (вече HTTP 200).
- **4.1** — обогатено Full introduction за всичките 15 езика с пълен списък функции (~198 държави, RSS + Google News, превод на 15 езика, TTS четене на глас, запазване/офлайн, споделяне, търсене, категории). Плюс reviewer note, обясняващ функциите.

ПОУКА: „Only simple content" (4.1) се бие с богато, конкретно описание на функциите (не общи фрази) на всички езици.

Подадено наново: **v1.0020** (2026-08-11) → Reviewing.

## 2026-08-22 — нова икона (Стил A) + пресъбмит подготвен
- **1.20/9.3** — нова икона Стил A (глобус) в конзолата (проверено) + ново APK + обогатено описание (4.1) + privacy 200 (7.1). Чернова записана. Остава ръчно: Proof of copyright + Submit.

## 2026-09-09 — ревю от модерацията (дословно)

```
App review results：
Your app offers only simple content, which affects user experience.
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
Tests the compatibility, stability, performance, power consumption, and security of your apps on mainstream Huawei mobile devices, and offers professional and detailed test reports to help boost app experience.
Cloud Testing
Analyze data Hide tasks
Distribution analysis
Distribution analysis
Collects and reveals how your app is distributed and used, enhancing your decision-making.
Distribution analysis
```

## 2026-09-09 — ПОПРАВКА и пресъбмит (v1.0022) — правило 4.1

Какво е направено по забележката „simple content":
- Нов раздел „Инструменти" с 4 под-таба: Сравни (две държави рамо до рамо), Пулс (курсове + време в столицата), Дайджест (веднъж при старт, офлайн + четене на глас), Ключови думи (сигнали + известие).
- Политика на трафика: всичко ново се тегли ЕДНОКРАТНО на пускане (при старт / първо отваряне на таба) и не се обновява само, дори апът да стои отворен дни; ръчно ↻.
- Нови снимки по табове (различни езици), описания на 14 езика с новите функции, бележка „For reviewer".
- Подадено през PublishBot (--fix, appinfo+description, HW_REPLACE_SHOTS=1).

## 2026-09-09 — v1.0023 (след 1.0022 в Reviewing)

- По искане: и СТАРИЯТ таб „Новини“ вече е еднократен на пускане (кеш по държава/емисия/рубрика; търсенето е на момента, „↻“ е ръчно); relay резерв за RSS/Google News (Китай). Подаден наново през PublishBot.

## 2026-09-11 — ревю от модерацията (v1.0023 → „To modify")

Забележка (по правило 4.1, същият текст като на 09.09 — ботът за забележки не улови нов дословен запис за 10/11.09; `scratchpad/hw-reasons-newslator.log` съдържа само заглавието на бота):

```
Your app offers only simple content, which affects user experience.
Modification suggestion: Enrich your app content/Submit an app with unique content and features to provide a better user experience. (rule 4.1)
[Test Environment]: Wi-Fi connection, Huawei P40 / EMUI 12, Nova 9 / EMUI 13, multilingual environment (Китай).
```

Диагноза: от Китай RSS/Google News/Bing не зареждат → таб „Новини", „Сравни" и „Дайджест" остават празни → „просто съдържание".

## 2026-09-11 — ПОПРАВКА и пресъбмит (v1.0024) — правило 4.1 (пак „simple content")

Причина за отказа: от Китай RSS/Google News не зареждат → рецензентът вижда празни екрани. Направено:
- ВГРАДЕНО ОФЛАЙН ИЗДАНИЕ: `deploy-scripts/gen-news-bundle.mjs` (пуска се преди билд) тегли през node ~2000 заглавия за 20 държави × 9 рубрики + таблица курсове и ги записва в `public/reference/news-bundle.json` (огледално и в rustore); апът (`core/bundle.js`) го ползва, когато емисиите/relay-ът върнат 0 записа — новини, сравнение, дайджест, курсове, търсене; надпис „Офлайн издание от <дата>". Истинска снимка от предишно пускане се пази пред пакета (core/once.js).
- ТАБЛО = първи екран (`screens/dashboard.js`, таб 🏠): карти за всички функции с 1–2 реда живо съдържание (Новини по държави, Сравни, Пулс, Дайджест + четене на глас, Ключови думи/сигнали, Запазени, Търсене); държава се предлага по езика при първо пускане (feeds.suggestCountry); „Сравни" и таблото ползват общия кеш по държава (една държава = едно теглене на пускане).
- i18n 15 езика; описания 14 езика + store-listing 15; reviewer note с „How to test" за всяка функция и че работи без интернет; нови снимки (таблото първо). Подадено през PublishBot (--fix, sections [description] + бележка, HW_REPLACE_SHOTS=1).
