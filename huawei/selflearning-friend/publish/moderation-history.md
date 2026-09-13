# История на модерацията — selflearning-friend (Huawei)

Този файл НЕ се трие. Пази реалните ревюта на модераторите (дословно) и как са отстранени — история на приложението и поука за бъдещи апове.

## 2026-09-09 — ревю от модерацията (дословно)

```
App review results：
The app you submitted is an AI chat app, which is similar to existing apps currently available on AppGallery. A large number of apps offering the same type of content or functionality may cause user confusion and negatively impact user experience.
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
Tests the compatibility, stability, performance, power consumption, and security of your apps on mainstream Huawei mobile devices, and offers professional and detailed test reports to help boost app experience.
Clo
```

## 2026-09-09 — ПОПРАВКА и пресъбмит (v1.0035)

- 4.3 → нов раздел „Учене“: Викторина по наученото (точки, серии), Напредък (табло + графика 14 дни), Дневник на ученето (по дни, източник, „Забрави“), Учи ме (урок → повтаря на свои думи → запомня), Речник на моите думи (обяснения, които научава) v1.0035; описания 15 езика; бележка. Подадено през PublishBot (--fix, sections [description] + бележка).

## 2026-09-10 — НОВА СЪРЦЕВИНА (v1.0036)

- 4.3 → Pupikes LB става най-съкровеният приятел: знае живота ти и те съветва от него, всичко на устройството. Нови главни екрани: „Съветник“ (първи екран: питай какво да купиш/научиш/продадеш/направиш → „за/против/факти“ с източник на всяка точка, история на решенията + обратна връзка „как мина“, „За теб“), „Спътник“ (Автобиография — времева линия, Работен опит, Житейски опит; дата, хора, поука, оценка, търсене, хората в живота ти), „Нотариус“ (Завещание, Сделки, Признания; отделен ПИН, AES-GCM шифроване, самозаключване, шифрован износ/внос, разрешение за Съветника). Съветникът се вика и от чата („посъветвай ме…“, „да купя ли…“). Старите функции остават табове.
- описания 15 езика (Brief = „Най-съкровеният приятел“ по език); бележка. Подадено през PublishBot (--fix, sections [description] + бележка).

## 2026-09-13 — ПРЕДСТАВЯНЕ ВОДИ С УНИКАЛНОТО (4.3, без нов билд)

Модераторът пак вижда апа като „AI chat app" (4.3), защото ИМЕТО, първата снимка и първият ред на описанието още водеха с генеричния вид, макар уникалната сърцевина (Съветник + Спътник + Нотариус) вече да я има. Без пипане на кода/версията и без нов билд — само представянето:
- **Име:** нов store-names.json — локализирано App name води с „съветник и нотариус" (_default „Pupikes: advisor & notary"), всяко под 30 знака (ботът реже над 30).
- **Описание:** първият параграф на пълното описание пренареден да води с уникалната функция (генеричният текст става втори) на 14 езика — в descriptions-languages.md и store-listing/*.txt.
- **Бележка до модератора:** абзац най-отгоре „This is NOT a generic AI chat app… The main feature is a companion that knows your life… Advisor / Companion / Notary…".
- **Снимки:** вече водят с уникалния екран — publish.config.json screens[] започва с advisor-ask/advisor-history/companion-* , затова снимките НЕ са пипани.
- Не подадено — подготвено за подаване (аз ще подам).
