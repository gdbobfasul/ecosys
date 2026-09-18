# История на модерацията — market-pulse (Huawei)

Този файл НЕ се трие. Пази реалните ревюта на модераторите (дословно) и как са отстранени — история на приложението и поука за бъдещи апове.

## 2026-09-09 — ревю от модерацията (дословно)

```
App review results：
Your app's "Cryptocurrencies" function reports an error, affecting user experience.
Test details: Launch the APP-> Cryptocurrencies -> Select any crypto currency-> Click on "3yrs ago/ 5yrs ago"-> An error message "No data connection. Try again" is displayed.
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

- Поправка 3.1 (v1.0020): relay резерв (pupikes.app/api/relay) за Binance/CoinGecko/Yahoo — „3yrs/5yrs ago“ зареждат и от Китай. Подадено през PublishBot (--fix, sections [] + бележка).

## 2026-09-11 — ревю от модерацията (повторно, същата забележка 3.1)

Модераторът пак отказа по правило 3.1 със същата стъпка: Cryptocurrencies → избери монета → „3yrs ago / 5yrs ago / By date" → „No data connection. Try again" (тест от Китай — Binance/CoinGecko/Yahoo недостъпни; relay резервата от 1.0020 не е стигнала, защото самата многогодишна история се теглеше само на живо).

## 2026-09-11 — ПОПРАВКА и пресъбмит (v1.0021)

- ВГРАДЕНА 5-годишна дневна история за всички 66 инструмента (топ 50 крипто + злато/метали/индекси/имоти) в `public/reference/history/*.json` (~0.9 MB; генератор `deploy-scripts/gen-market-history.mjs` — Binance → CoinGecko резерва, Yahoo за останалите; пуска се при билд/ръчно).
- `core/analysis.js`: периодите „1/2/3/5 г. назад" и „по дата" се смятат първо от вградената история; живите данни (пряко → relay) само допълват последните дни; при недостъпна мрежа детайлът показва „📦 Вградена история до <дата>" вместо „няма връзка"; период преди началото на историята → честно „историята започва от <дата>".
- `core/net.js`: и текстовите заявки (Google News RSS) минават през relay резервата. Крипто списъкът 14 → 50 монети.
- Описания 15 езика (Full + New features + store-listing), reviewer note с „How to test" (стъпките на модератора), нови снимки. Подадено през PublishBot (--fix, sections [description] + бележка).

## 2026-09-16 — ревю от модерацията (дословно)

```
App review results：
Your app offers only one type of content, has a single feature or is developed from templates, which affects user experience.
Modification suggestion: Enrich your app content/Submit an app with unique content and features to provide a better user experience.
For details, please refer to rule 4.1 of the AppGallery Review Guidelines at the following website:
https://developer.huawei.com/consumer/en/doc/app/50104-04
【[Test Environment]: Wi-Fi connection, Nova 9 with EMUI 13 HMS, multilingual environment.】
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
