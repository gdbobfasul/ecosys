# История на модерацията — autoreply-bot (Huawei)

Този файл НЕ се трие. Пази реалните ревюта на модераторите (дословно) и как са отстранени — история на приложението и поука за бъдещи апове.

## 2026-09-09 — ревю от модерацията (дословно)

```
App review results：
The app you submitted is a Auto Answer Messager, which is similar to existing apps currently available on AppGallery. A large number of apps offering the same type of content or functionality may cause user confusion and negatively impact user experience.
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
Tests the compatibility, stability, performance, power consumption, and security of your apps on mainstream Huawei mobile devices, and offers professional and detailed test reports to help boost app experie
```

## 2026-09-09 — ПОПРАВКА и пресъбмит (v1.0020)

- 4.3 → тихи часове + режим „отпуска" с дата „до", библиотека шаблони по категории (работа/отпуска/шофиране/среща/спешно) с променливи, групи контакти / VIP (отделен отговор или без авто-отговор), ограничение „веднъж на N часа на подател" + отлагане, екран „Статистика" (по дни с графика, канали, правила, податели) + износ CSV, тест „симулирай входящо" (кое правило/какъв отговор/защо), под-табове в „Правила" v1.0020; описания 15 езика; бележка. Подадено през PublishBot (--fix, sections [description] + бележка).

## 2026-09-10 — НОВА СЪРЦЕВИНА (v1.0021)

- Концепция „Pupikes Auto Answer & Guardian": апът отговаря вместо теб И следи ТЕБ — при N часа без активност първо пита „Добре ли си?", без отговор M минути известява близките с последно състояние (активност, батерия, местоположение по избор, кой е писал спешно).
- Нови екрани/раздели: „Пазител" (първи таб: статус, N/M, часове за сън, близки, тест „симулирай мълчание", преглед на сигнала, опашка за ръчно изпращане, дневник на проверките), „Делегат за спешни" (ключови думи/VIP → препращане + „Ще ви отговори <име>"), „Отговор на езика на подателя" (разпознаване на устройството + шаблон на този език / превод веднъж с кеш); карта „Пазител" на таблото; тестът в „Правила" показва делегат и разпознат език.
- Разрешения: местоположение (само при включване от потребителя) + вибрация — в android-permissions.txt.
- описания 15 езика; бележка. Подадено през PublishBot (--fix, sections [description] + бележка).
