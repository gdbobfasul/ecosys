# История на модерацията — services-toolkit (Huawei)

Този файл НЕ се трие. Пази реалните ревюта на модераторите (дословно) и как са отстранени — история на приложението и поука за бъдещи апове.

## 2026-09-08 — ревю от модерацията (дословно)

```
App review results：
1.Your app's "Crypto charts" function reports an error, affecting user experience.
Test details: Launch the APP-> When clicking "Crypto charts", an error message "Error loading the tool: i not a function" is displayed.
Modification suggestion: Optimize your app to ensure it can be used in its release regions.
For details, please refer to rule 3.1 of the AppGallery Review Guidelines at the following website:
https://developer.huawei.com/consumer/en/doc/app/50104-03
2.The app you submitted is a "Toolkit (All-in-one utility box)", which is similar to existing apps currently available on AppGallery. A large number of apps offering the same type of content or functionality may cause user confusion and negatively impact user experience.
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
Helps you build a secure and reliable user authentication system
```

### 2026-09-08 — ОТСТРАНЕНО (3.1 „Crypto charts: i is not a function" + 4.3 „подобен ап")
- Причина: в `src/tools/crypto-chart.js` локални променливи `tf` (табове) засенчваха импортираната `tf()` (превод с параметри) → рендерът гърмеше.
- Поправка (v1.0020): преименувани на fibTf/tfTabs (локална репродукция потвърди фикса); за 4.3 — бележка „For reviewer" с уникалните функции. Ново APK + повторно подаване.

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

## 2026-09-11 — ПОПРАВКА и пресъбмит (v1.0021) — ОБЕДИНЕНИЕ на семейството Toolkit
- Отговор на 4.3: Pupikes Toolkit е обединяващото приложение на цялото семейство Pupikes Toolkit (одобрените Toolkit Text и Toolkit Passwords + PDF, QR, Pictures, Videos, Finance, Scraper, 3D Rotate, AI Announcement, Sound). Пренесени са АКТУАЛНИТЕ версии на всички инструменти от под-аповете (55 инструмента) + core помощници (sealcrypto, announce-gen) + примерни данни; решетката е групирана в 10 раздела (Документи, Текст, Пароли и ключове, Снимки и видео, Звук, Финанси, QR кодове, Уеб, 3D, ИИ и текстове за бизнеса).
- Ново: „Вериги от инструменти" — изходът на един инструмент е вход на следващия; 6 готови вериги по ситуация + свои (лента „стъпка i от N" над всеки инструмент).
- Поправено: „Crypto charts" — локална променлива `t` засенчваше t() в панелите с история на BTC/ETH (TDZ грешка); i18n ключове на 15 езика без липси (програмна проверка), преименувани сблъскващи се ключове (pw_last/pw_notif_title → pgw_*, pp_hint → pwph_hint). Разрешения: + CAMERA, RECORD_AUDIO, MODIFY_AUDIO_SETTINGS (обяснени в бележката).
- Описания 15 езика (всички инструменти по групи) + store-listing; бележка „For reviewer" с „How to test"; нови снимки (решетка по раздели + инструменти на различни езици). Подадено през PublishBot (--fix, sections [description] + бележка).

## 2026-09-11 — пренесени нови функции от под-аповете (след подаването на v1.0021, НЕ е подавано)
- „Видео инструкция" (от Pupikes Toolkit Videos 1.0021): стъпки → видео урок MP4, GIF и лист за печат PDF/PNG; надписи на 15 езика, маркировки върху кадъра, глас (микрофон или синтез на реч), генерирана музика; примерна инструкция при първо отваряне. Нов инструмент в раздел „Снимки и видео". Huawei: пакет @capacitor-community/text-to-speech 5.1.0; RuStore: вграденият глас на WebView.
- „Снимки като доказателство" (от Pupikes Toolkit Pictures 1.0021): дела, отпечатък SHA-256, воден знак, дневник-верига, проверка с карта на разликите, подписан PDF доклад; примерно дело. Нов инструмент в раздел „Снимки и видео". Разрешения ACCESS_COARSE/FINE_LOCATION — само ако потребителят включи GPS.
- „Видео работилница": поправено „Кадър → снимка (JPG)" (увисваше в ffmpeg; кадърът се взима от вградения декодер).
- 57 инструмента; бележката „For reviewer" (+ стъпки 12–14), описанията и store-listing (15 езика) обновени. Снимките НЕ са регенерирани (отделна стъпка).
