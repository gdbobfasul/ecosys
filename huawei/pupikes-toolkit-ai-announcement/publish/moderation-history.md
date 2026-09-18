# История на модерацията — pupikes-toolkit-ai-announcement (Huawei)

Този файл НЕ се трие. Пази реалните ревюта на модераторите (дословно) и как са отстранени — история на приложението и поука за бъдещи апове.

## 2026-09-10 — ревю от модерацията (дословно)

```
App review results：
1.Your app's main function reports an error, affecting user experience.
Test details: Launch App >> Fill in request >> Generate >> Connection error message pops up.
Modification suggestion: Optimize your app to ensure it can be used in its release regions.
For details, please refer to rule 3.1 of the AppGallery Review Guidelines at the following website:
https://developer.huawei.com/consumer/en/doc/app/50104-03
2.Your app offers only one type of content, has a single feature or is developed from templates, which affects user experience.
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
Tests the compatibility, stability, performance,
```

## 2026-09-11 — ПОПРАВКА и пресъбмит (v1.0020)

- 3.1 „Connection error" → генерирането вече е на три стъпала: пряко → през Pupikes relay (allowlist text.pollinations.ai) → ВГРАДЕН офлайн генератор по шаблони (8 типа × 4 тона × 15 езика, с полетата на потребителя); никога грешка без резултат; без AbortController (Promise.race). Старият AI генератор (напиши/обобщи/преведи/обясни) — същата верига.
- 4.1 „една функция" → нова сърцевина „Кампании с известия" (първа карта): тип × тон × език(ци) → известие → кампания с канал (копирай/сподели/SMS/имейл), дата и час, повторение (еднократно/ден/седмица/месец) с напомняне през LocalNotifications, история на изпращанията и статистика (по канал/тип/език); 3 примерни кампании при първо пускане (маркирани „Пример", с изтриване).
- Описания 15 езика (Brief „Кампании с известия", Full, New features) + store-listing; reviewer note с „How to test"; нови снимки. Подадено през PublishBot (--fix, sections [description] + бележка).

## 2026-09-18 — ревю от модерацията (дословно)

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
