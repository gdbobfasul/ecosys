# История на модерацията — authenticator (Huawei)

Този файл НЕ се трие. Пази реалните ревюта на модераторите (дословно) и как са отстранени — история на приложението и поука за бъдещи апове.

## 2026-08-11 — ОТХВЪРЛЕНО (подадено v1.0019)

Ревю от модерацията (дословно):

```
App review results：
1.When users access the privacy policy URL https://pupikes.app/privacy/authenticator/hw-privacy.html you submitted in AppGallery Connect, the message "404 Not found" is displayed, which does not comply with relevant regulations.
   Modification suggestion: Provide a valid URL for your privacy policy. (rule 7.1)
2.The icon of your app contains content and elements related to Samsung Security Policy Update app, which may cause confusion, misunderstanding, or inappropriate association among users.
   Modification suggestion: Provide authorization documents or modify the icon of your app. (rule 9.3)
[Test Environment]: Wi-Fi, Huawei P40 EMUI 12.0.0 / P30 Lite EMUI 12.0.0, multilingual.
```

Отстранено:
- **7.1** — privacy страницата качена на прод (вече HTTP 200: `/privacy/authenticator/hw-privacy.html`).
- **9.3** — иконата сменена: щит+отметка → **катинар** (в `gen-app-icons.mjs`: authenticator `shield`→`lock`; guess() auth също `lock`). Ребилд (нов launcher) + качена в App info + regenerated publish/icon-512/216.png.

ПОУКА: щит = сигурност = сблъсква се със Samsung Security Policy Update (9.3). За auth/security апове НЕ използвай щит — катинар/ключ.

Подадено наново: **v1.0020** (2026-08-12) → Reviewing.

## 2026-08-22 — нова икона (Стил A) + пресъбмит подготвен
- **9.3** (икона прилича на Samsung) + **1.20** — нова отличителна икона Стил A (катинар в марков цвят на бяла плочка); качена в конзолата (проверено пиксел-идентично) + ново APK. Чернова записана. Остава ръчно: Proof of copyright + Submit (open-testing валидации).

## 2026-09-04 — ревю от модерацията (дословно)

```
App review results：
The app you submitted is a "Vault APP", which is similar to existing apps currently available on AppGallery. A large number of apps offering the same type of content or functionality may cause user confusion and negatively impact user experience.
Modification suggestion: We look forward to seeing further improvements in areas such as interaction design and feature depth, and to receiving an app with distinctive content and functionality that delivers a better user experience.
For details, please refer to rule 4.3 of the AppGallery Review Guidelines at the following website:
https://developer.huawei.com/consumer/en/doc/app/50104-04
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
Analyze data Hid
```

## 2026-09-10 — ревю от модерацията (v1.0024)

Забележка 4.1 („приложението предлага една функция / шаблон"). Дословният текст не е прихванат от бота (`hw-reasons-authenticator.log` е празен) — записано по резюмето на собственика: апът е оценен като едно-функционален, макар че е съхранение на пароли + 2FA + конвертиране на ключове между приложения.

## 2026-09-11 — ПОПРАВКА и пресъбмит (v1.0025)

- 4.1 → нов трети главен таб „Защита": **Одит на сигурността** (пробив през HIBP k-анонимност веднъж на пускане, слаба/повторена парола, има ли 2FA за сайта, възраст → оценка 0–100 и план за действие), **Проверка на адрес** (фишинг офлайн: двойници на твоите сайтове, punycode, смесени азбуки, марка като поддомейн, IP/„@"/порт/HTTPS/злоупотребявани TLD), **Наследство** (шифрован пакет PBKDF2→AES-256-GCM с инструкции за доверен човек + отваряне/внасяне), карта „Конвертиране на ключове", броячи на сейфа, „Пробвай с пример"/„Махни примерите" (маркирани „Пример:").
- Описанието и бележката вече КАЗВАТ ясно, че сърцевината е пароли + 2FA + конвертиране на ключове (QR/Aegis/Google Authenticator/2FAS/Chrome-Firefox CSV, 32 портфейла). Описания 15 езика; бележка с „How to test" за всички функции; нови снимки (8 екрана). Подадено през PublishBot (--fix, sections [description] + бележка).
