# История на модерацията — pupikes-toolkit-sound (Huawei)

Този файл НЕ се трие. Пази реалните ревюта на модераторите (дословно) и как са отстранени — история на приложението и поука за бъдещи апове.

## 2026-09-10 — ревю от модерацията (дословно)

```
App review results：
The app you submitted is a audio formats editor , which is similar to existing apps currently available on AppGallery. A large number of apps offering the same type of content or functionality may cause user confusion and negatively impact user experience.
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
Tests the compatibility, stability, performance, power consumption, and security of your apps on mainstream Huawei mobile devices, and offers professional and detailed test reports to help boost app experi
```

## 2026-09-11 — ПОПРАВКА и пресъбмит (v1.0020)

- 4.3 → нова сърцевина „Студио за звук и глас": модулатори и модификатори на звук и глас (10 готови гласови модулатора с едно докосване — робот, бурундук, дълбок глас, телефон, радио, зала, пещера, хор, извънземен, изчисти шума; 21 отделни ефекта с плъзгачи — височина без смяна на темпото (фазов вокодер), темпо без смяна на височината, скорост, вибрато, тремоло, хор, ехо, реверб (импулсна конволюция), еквалайзер, спектрално шумопотискане, реверс, изрязване, fade, сила, нормализация, моно), верига от ефекти с отмяна/нулиране, преглед преди/след (вълнови форми + прослушване), запис от микрофона (PCM на устройството, до 5 мин), вграден синтезиран пример (маркиран „пример") при първо отваряне, запис/споделяне като WAV/MP3/OGG/M4A. Старият конвертор остава като второстепенен таб. Двигателят е отделен чист модул `src/tools/sound-fx.js` (WebAudio + собствени алгоритми), споделим с Pupikes Toolkit.
- Нови разрешения RECORD_AUDIO + MODIFY_AUDIO_SETTINGS (само за „Запис"); описания 15 езика; бележка с „How to test"; нови снимки. Подадено през PublishBot (--fix, sections [description] + бележка).
