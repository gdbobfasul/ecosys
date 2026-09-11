# История на модерацията — pupikes-toolkit-scraper (Huawei)

Този файл НЕ се трие. Пази реалните ревюта на модераторите (дословно) и как са отстранени — история на приложението и поука за бъдещи апове.

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

## 2026-09-09 — ПОПРАВКА и пресъбмит (v1.0020)

- 4.1 → нов „Скрапер на устройството“ (адреси/DDG търсене през relay → имейли, телефони, връзки, H1–H3, тип, CSV) v1.0020; описания; бележка. Подадено през PublishBot (--fix, sections [description] + бележка).

## 2026-09-10 — ревю от модерацията (второ, пак 4.1)

Отказ отново по правило 4.1 („Your app offers only simple content… Enrich your app content/Submit an app with unique content and features"). Дословният текст не е записан от събирача (логът `hw-reasons-pupikes-toolkit-scraper.log` е празен — ботът спря на екрана на версията); забележката е същата като на 2026-09-09. Тестова среда: Китай, Huawei P40 / EMUI 12 и Nova 9 / EMUI 13 — при чиста инсталация апът е показвал 2 карти, едната изискваща сървър, без никакво съдържание.

## 2026-09-11 — ПОПРАВКА и пресъбмит (v1.0021)

- 4.1 (пак) → НОВА СЪРЦЕВИНА „Наблюдател на страници“ (първа карта): запазени цели (адрес + какво да следи: имейли/телефони/цени/заглавия), повторно сканиране по желание, история на всяко сканиране с ново/изчезнало/променено (цените по етикет), сравнение на произволни две сканирания, известие на телефона при промяна, износ CSV (история + текущи данни).
- Примерни данни при първо пускане: 2 примерни цели с история от 2 сканирания, маркирани „пример“, върху 2 вградени страници (`public/samples/demo-contact.html`, `demo-shop.html`) — сканират се и офлайн (Китай); бутон „Изтрий примерите“ / „Добави примерни цели“. Скраперът на устройството: „Пробвай с пример“ върху същите страници. Чужди страници: направо, при неуспех през relay.
- Описания 14 езика (Brief „Page watcher & scraper“ + Full + New features) + store-listing 15 файла; reviewer note с „How to test“ (7 стъпки); нови снимки; огледало в rustore. Подадено през PublishBot (--fix, sections [description] + бележка).
