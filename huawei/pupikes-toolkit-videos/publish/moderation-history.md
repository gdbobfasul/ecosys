# История на модерацията — pupikes-toolkit-videos (Huawei)

Този файл НЕ се трие. Пази реалните ревюта на модераторите (дословно) и как са отстранени — история на приложението и поука за бъдещи апове.

## 2026-09-09 — ревю от модерацията (дословно)

```
App review results：
The app you submitted is a "Video converter" which is similar to existing apps currently available on AppGallery. A large number of apps offering the same type of content or functionality may cause user confusion and negatively impact user experience.
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
Analyze dat
```

## 2026-09-09 — ПОПРАВКА и пресъбмит (v1.0020)

- 4.3 → нови видео операции (изрязване, MP3, завъртане/огледало, скорост, без звук, 720p/480p, компресия, кадър→JPG, GIF по избор) v1.0020; описания 15 езика; бележка. Подадено през PublishBot (--fix, sections [description] + бележка).

## 2026-09-11 — ревю от модерацията (дословно)

```
App review results：
The app you submitted is a video editor/converter, which is similar to existing apps currently available on AppGallery. A large number of apps offering the same type of content or functionality may cause user confusion and negatively impact user experience.
Modification suggestion: We look forward to seeing further improvements in areas such as interaction design and feature depth, and to receiving an app with distinctive content and functionality that delivers a better user experience.
For details, please refer to rule 4.3 of the AppGallery Review Guidelines at the following website:
https://developer.huawei.com/consumer/en/doc/app/50104-04
```

## 2026-09-10 — НОВА СЪРЦЕВИНА (v1.0021)

- Концепция: „Видео инструкция от телефона" — клипове/снимки като стъпки → урок с глави, надписи на 15 езика, стрелки/кръгове/подчертаване, заглавен и финален екран, глас (микрофон или синтез на реч), генерирана музика → MP4, GIF и лист PDF/PNG; шаблони ремонт/рецепта/продукт/упражнение.
- Нови екрани: таб „Видео инструкция" (първи), редактор на отметки върху кадъра, преглед на урока, изнасяне MP4/GIF/PDF/PNG; досегашните операции са във втория таб „Видео инструменти".
- Описания 15 езика; бележка. Подадено през PublishBot (--fix, sections [description] + бележка).

## 2026-09-11 — ПОПРАВКА и пресъбмит (v1.0021)

- 4.3 („video editor/converter") → новата сърцевина по-горе; ясно маркирана примерна инструкция при първо пускане (с бутон за изтриване), за да се пробва всичко без собствени файлове.
- Поправено увисване на „Кадър → снимка (JPG)" в ffmpeg.wasm → кадърът се взима с <video> + canvas; ffmpeg резерва с -ss след -i, -update 1.
- Ново разрешение RECORD_AUDIO (само за гласовия коментар, иска се при натискане); бележка с раздел „How to test"; нови снимки.
