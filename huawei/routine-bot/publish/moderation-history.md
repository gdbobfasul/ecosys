# История на модерацията — routine-bot (Huawei)

Този файл НЕ се трие. Пази реалните ревюта на модераторите (дословно) и как са отстранени — история на приложението и поука за бъдещи апове.

## 2026-09-09 — ревю от модерацията (дословно)

```
App review results：
The app you submitted is a "Routine Planner", which is similar to existing apps currently available on AppGallery. A large number of apps offering the same type of content or functionality may cause user confusion and negatively impact user experience.
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
Analyze da
```

## 2026-09-09 — ПОПРАВКА и пресъбмит (v1.0022)

- 4.3 → „Навици и серии“ (готово за днес, серии, 7/30 дни %, седмична решетка, .ics/текст) v1.0022; описания; бележка. Подадено през PublishBot (--fix, sections [description] + бележка).

## 2026-09-10 — НОВА СЪРЦЕВИНА (v1.0023)

- Концепция: „Денят на семейството“ — общ ден за няколко души на едно устройство (дете / родител / баба-дядо): задачи с точки и одобрение от родител, напомняния с гласа на родителя, класация, награди, общ календар; първи екран след старта (старият робот е в таб „Табло“).
- Нови екрани: Днес (табло „кой какво е свършил“ + чакащи одобрение + днешните събития), Задачи, Награди (седмична класация, размяна на точки, история), Календар (14 дни), Хора и гласове (членове, запис на фрази до 10 с, родителски PIN, обмен код/файл). Примерни данни при първо пускане — маркирани, с бутон за изтриване. Мисълта в брифинга вече е на езика на интерфейса (беше само на български).
- Описания 15 езика; бележка (с „How to test“). Подадено през PublishBot (--fix, sections [description] + бележка).
