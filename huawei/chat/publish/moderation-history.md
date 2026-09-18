# История на модерацията — chat (Huawei)

> **➤ ПОСЛЕДНА КАЧЕНА ВЕРСИЯ: v1.0020 — подадена 2026-09-08 (в модерация).**

## 2026-09-10 — ревю от модерацията (дословно)

```
App review results：
The app you submitted is similar to existing apps currently available on AppGallery. A large number of apps offering the same type of content or functionality may cause user confusion and negatively impact user experience.
Modification suggestion: We look forward to seeing further improvements in areas such as interaction design and feature depth, and to receiving an app with distinctive content and functionality that delivers a better user experience.
For details, please refer to rule 4.3 of the AppGallery Review Guidelines at the following website:
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
Distribution analys
```

## 2026-09-10 — ПОПРАВКА и пресъбмит (v1.0021) — 4.3
Апът е обвивка към живия сайт (my.girl.place) — кодът не е пипан; сменени са само текстовете. Магазинното описание (Brief „Помощ и услуги наблизо", Full, New features) на 14 езика + store-listing на 15 езика вече описва цялата платформа: бутон ПОМОЩ (спешна заявка към проверени лекар/болница/линейка/полиция наблизо), търсачки наблизо по предлагано/нужда (11 категории, ~86 услуги), проверени професионалисти със значка, сигнали за случки, задачи „живи ръце на място"/„истина ли е" с награда и спорове, половинка (сватосване), чат в реално време.
Бележка за модератора: не е messaging app, а платформа за помощ и услуги наблизо; 7-те функции с екран/бутон и как се тества (безплатна регистрация телефон+парола, без SMS). Подадено през PublishBot (--fix, sections [description] + бележка).

## 2026-09-11 — снимки и тестов акаунт (v1.0021, преди пресъбмит)
Нови магазинни снимки от живия сайт (publish.config.json: remoteBase + семена на сесията, екрани Помощ/Търсене/Задачи/Половинка/Сигнали/Проверка/Чат на 15 езика).
Създаден тестов акаунт с предплатен абонамент (publish/test-account.md) и примерни данни (контакт, съобщения, 5 задачи, критерии/покана, заявка за верификация) — бележката за модератора вече дава акаунта, защото нов акаунт не може да влезе без платен абонамент.
capacitor.config.json: allowNavigation допълнен (*.girl.place, pupikes.app/*.pupikes.*, *.stripe.com).

## 2026-09-16 — ревю от модерацията (дословно)

```
App review results：
1.Your app does not provide a test account and password, so we cannot review your app functions and content.
Modification suggestion: Provide a valid test account and password in the "For reviewer" area when submitting your app. The test account will be used by the reviewer to review functions including sign-in, viewing, and purchase.
For details, please refer to rule 1.21 of the AppGallery Review Guidelines at the following website: https://developer.huawei.com/consumer/en/doc/app/50104-01
2.Your app's "Pay by card" function cannot be used, affecting user experience.
Test details: Try to register an account-> When clicking "Pay by card" function , there is no response received.
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
```
