# История на модерацията — pupikes-toolkit-finance (Huawei)

Този файл НЕ се трие. Пази реалните ревюта на модераторите (дословно) и как са отстранени — история на приложението и поука за бъдещи апове.

## 2026-09-09 — ревю от модерацията (дословно)

```
App review results：
The app you submitted is a financial tracker, which is similar to existing apps currently available on AppGallery. A large number of apps offering the same type of content or functionality may cause user confusion and negatively impact user experience.
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

## 2026-09-09 — ПОПРАВКА и пресъбмит (v1.0020)

- 4.3 → нови инструменти „Личен бюджет" (пликове с месечен лимит и предупреждение, абонаменти с календар 30 дни, отчети по категория/месец с графика + CSV, нетна стойност с история) и „Финансов планировчик" (кредит/ипотека с погасителен план и надплащане, цел за спестяване със сложна лихва, дългове „снежна топка"/„лавина" със сравнение) v1.0020; описания 15 езика; бележка. Подадено през PublishBot (--fix, sections [description] + бележка).

## 2026-09-10 — НОВА СЪРЦЕВИНА (v1.0021)

- 4.3 → нова главна функция „Стойност в живот" (първи екран след старта): моментен анализатор, който превръща цената на стока в работни часове/дни, заплати, дни от живота, нощи сън, дял от оставащия работен живот и от имуществото — по профил на човека (доход, работно време, отпуск, сън, семейство/издръжка, разходи, кредити, имущество, цели). Екрани: Анализатор (цена ръчно или от снимка на етикет/обява, вариант „на кредит", ефект върху целите и запаса, присъда лека/средна/тежка), Профил (данни + внос от „Личен бюджет" и „Планировчик"), Времето ми (оставащ живот срещу парите, запас без работа, сценарии „работя до…"/„спирам след N г."/„+ покупка" с графика на платно), История. Старите инструменти остават като карти под него. Описания 15 езика; бележка. Подадено през PublishBot (--fix, sections [description] + бележка).

## 2026-09-13 — ПРЕДСТАВЯНЕ ВОДИ С УНИКАЛНОТО (4.3, без нов билд)

Модераторът пак вижда апа като „financial tracker" (4.3), защото ИМЕТО, първата снимка и първият ред на описанието още водеха с генеричния вид, макар уникалната сърцевина (Стойност в живот) вече да я има. Без пипане на кода/версията и без нов билд — само представянето:
- **Име:** нов store-names.json — локализирано App name води с „цена в часове живот" (_default „Pupikes: cost in life-time"), всяко под 30 знака (ботът реже над 30).
- **Описание:** първият параграф на пълното описание пренареден да води с уникалната функция „Стойност в живот" (генеричният „bundles the money tools" става втори) на 14 езика — в descriptions-languages.md и store-listing/*.txt.
- **Бележка до модератора:** абзац най-отгоре „This is NOT a generic finance or budget tracker… The main feature is COST IN LIFE…".
- **Снимки:** вече водят с уникалния екран — publish.config.json screens[] започва с life-analyzer/life-analyzer-top/life-profile/life-time, затова снимките НЕ са пипани.
- Не подадено — подготвено за подаване (аз ще подам).
