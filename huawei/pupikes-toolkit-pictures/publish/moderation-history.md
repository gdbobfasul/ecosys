# История на модерацията — pupikes-toolkit-pictures (Huawei)

Този файл НЕ се трие. Пази реалните ревюта на модераторите (дословно) и как са отстранени — история на приложението и поука за бъдещи апове.

## 2026-09-09 — ревю от модерацията (дословно)

```
App review results：
The app you submitted is a "Shrink pictures (image compressor)" which is similar to existing apps currently available on AppGallery. A large number of apps offering the same type of content or functionality may cause user confusion and negatively impact user experience.
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
Cloud
```

## 2026-09-09 — ПОПРАВКА и пресъбмит (v1.0020)

- 4.3 → инструменти за снимки (завъртане/огледало, изрязване по пропорция, точен размер, 8 филтъра, пакетна обработка, EXIF махане) v1.0020; описания; бележка. Подадено през PublishBot (--fix, sections [description] + бележка).

## 2026-09-11 — НОВА СЪРЦЕВИНА (v1.0021)

- 4.3 („Shrink pictures… similar to existing apps") → НОВА СЪРЦЕВИНА „Снимки като доказателство": дела (наем, кола, доставка, ремонт, показания на уреди, застрахователна щета) със снимки преди/след/щета/уред; SHA-256 отпечатък на оригинала, видим воден знак (дата, час, място по избор, отпечатък, № в дневника), дневник-верига (всеки запис носи отпечатъка на предишния — промяна/изтриване се вижда), проверка „променяна ли е" с карта на разликите, подписан PDF протокол (подписи с пръст, страници на canvas за всички писмености, отпечатъците и като текст).
- Нови екрани: Дела · Дело · Снимка с воден знак · Проверка (+„Пробвай с пример") · Дневник · PDF протокол · Настройки (GPS по избор). Първи екран = доказателствата; компресията/филтрите/изрязването/пакетът/EXIF махането са на „⊞ Всички инструменти". Примерно дело с 5 генерирани снимки при първо пускане (маркирано, с бутон за изтриване). Разрешения: ACCESS_COARSE/FINE_LOCATION (само ако потребителят включи GPS); камерата през системното приложение.
- Описания 15 езика (Brief/Full/New features + store-listing); бележка с „How to test"; нови снимки. Подадено през PublishBot (--fix, sections [description] + бележка).
