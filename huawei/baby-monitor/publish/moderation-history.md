# История на модерацията — baby-monitor (Baby Radar, Huawei)

Този файл НЕ се трие. Пази реалните ревюта на модераторите (дословно) и как са отстранени — история на приложението и поука за бъдещи апове.

## 2026-08-11 — ОТХВЪРЛЕНО (подадено v1.0019)

Ревю от модерацията (дословно):

```
App review results：
1.When users access the privacy policy URL "https://pupikes.app/privacy/baby-monitor/hw-privacy.html" you submitted in AppGallery Connect, the message "404 Not Found" is displayed, which does not comply with relevant regulations.
   Modification suggestion: Provide a valid URL for your privacy policy. (rule 7.1)
2. Test details: 1) Launch the APP -> When clicking Privacy/Terms functions, an error message "404 Not found" is displayed.
   Modification suggestion: Optimize your app to ensure it can be used in its release regions. (rule 3.1)
```

Отстранено:
- **7.1 + 3.1** — правните страници качени на прод (вече HTTP 200: `hw-privacy.html` и `hw-terms.html`). Апът сочи точно тях (legal.js: `PRIVACY_FILE=hw-privacy.html`, `TERMS_FILE=hw-terms.html`), затова и бутоните Privacy/Terms в апа вече работят във всички региони.

ПОУКА: 404 на правните страници бие едновременно 7.1 (store URL) и 3.1 (бутоните в апа). Правните страници ТРЯБВА да са качени преди подаване.

Подадено наново: **v1.0020** (2026-08-12) → Reviewing.

## 2026-08-15 — ревю от модерацията (дословно)

```
App review results：
The app icon you submitted is different from that displayed on users' mobile phones after the app is installed, which affects user experience.
Modification suggestion: Ensure that the app icon you submitted is the same as that displayed on users' mobile phones after the app is installed, and ensure this issue does not exist in other languages.
For details, please refer to rule 1.20 of the AppGallery Review Guidelines at the following website: https://developer.huawei.com/consumer/en/doc/app/50104-01
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
Collects and reveals how your app is distributed and used, enhancing your decision-ma
```

## 2026-08-22 — нова икона (Стил A) + пресъбмит подготвен
- **1.20** — нова икона Стил A в конзолата (проверено) + ново APK + поправен превод (safety banner). Чернова записана. Остава ръчно: Proof of copyright + Submit (batch: APK-guard спря авто-Submit).

## 2026-09-04 — ревю от модерацията (дословно)

```
App review results：
The app icon you submitted (under Traditional Chinese (Hong Kong), Traditional Chinese (Taiwan), English (US)) is different from that displayed on users' mobile phones after the app is installed, which affects user experience.
Modification suggestion: Ensure that the app icon you submitted is the same as that displayed on users' mobile phones after the app is installed, and ensure this issue does not exist in other languages.
For details, please refer to rule 1.20 of the AppGallery Review Guidelines at the following website: https://developer.huawei.com/consumer/en/doc/app/50104-01
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
Distrib
```

## 2026-09-09 — ревю от модерацията (дословно)

```
App review results：
The app you submitted is a baby tracking app, which is similar to existing apps currently available on AppGallery. A large number of apps offering the same type of content or functionality may cause user confusion and negatively impact user experience.
Modification suggestion: We look forward to seeing further improvements in areas such as interaction design and feature depth, and to receiving an app with distinctive content and functionality that delivers a better user experience.
For details, please refer to rule 4.3 of the AppGallery Review Guidelines at the following website:
https://developer.huawei.com/consumer/en/doc/app/50104-04
[Test Environment]: Wi -Fi connection, Mate30 Pro with EMUI 12.0.0, P30 Lite with EMUI 9.1.0, multilingual environment.
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
Tests the compatibility, stability, performance, power consumption, and security of your apps on mainstream Huawei mobile devices, and offers professional and detailed test reports to help boost app experience
```

## 2026-09-09 — ПОПРАВКА и пресъбмит (v1.0026)

- 4.3 → нов таб „Грижа" с 6 инструмента (график на шума от микрофона с маркери; приспивни звуци с WebAudio + таймер; нощна лампа; дневник хранене/сън/пелени + дневен отчет със споделяне; растеж тегло/ръст върху СЗО коридор с графика; календар на ваксините с отметка „направена") v1.0026; описания 15 езика; бележка. Подадено през PublishBot (--fix, sections [description] + бележка).

## 2026-09-10 — НОВА СЪРЦЕВИНА (v1.0027)

- 4.3 → „BabySecuritySitter": бебе-детегледачка на два телефона (дете до 3 г.) — телефонът при детето пее, говори с гласа на мама/тати (записи), приспива по сценарий с намаляваща сила, после пази съня през микрофона и при плач веднага буди телефона на родителя; родителят вижда състоянието, получава силен сигнал + снимка, „говори" с бутоните на записаните фрази и чете дневника на нощта. Нови екрани: първи екран „Кой телефон е този?" (роля), таб „Детегледачка" в роля „при детето" (ключ, живо табло, фрази, сценарий, реакции, затъмнен екран) и в роля „родител" (състояние, сигнал със „Спри", говори/песен/шум/снимка/сценарий/тишина, последна снимка, дневник на нощта). Описания 15 езика; бележка. Подадено през PublishBot (--fix, sections [description] + бележка).

## 2026-09-13 — ПРЕДСТАВЯНЕ ВОДИ С УНИКАЛНОТО (4.3, без нов билд)

Модераторът пак вижда апа като „baby tracking app" (4.3), защото ИМЕТО, първата снимка и първият ред на описанието още водеха с генеричния вид, макар уникалната сърцевина (BabySecuritySitter) вече да я има. Без пипане на кода/версията и без нов билд — само представянето:
- **Име:** нов store-names.json — локализирано App name води с уникалния хук „гласът на мама" (_default „Pupikes: mum's voice sitter"), всяко под 30 знака (ботът реже над 30).
- **Описание:** първият параграф на пълното описание пренареден да води с уникалната функция (генеричният „базиран на камера асистент" става втори) на 14 езика — в descriptions-languages.md и store-listing/*.txt.
- **Бележка до модератора:** абзац най-отгоре „This is NOT a generic baby monitor… The main feature is BabySecuritySitter…".
- **Снимки:** вече водят с уникалния екран — publish.config.json screens[] започва със sitter-child/sitter-phrases/sitter-scenario (BabySecuritySitter), затова снимките НЕ са пипани.
- Не подадено — подготвено за подаване (аз ще подам).
