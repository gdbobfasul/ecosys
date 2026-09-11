# История на модерацията — monitor-bot (Site Monitor, Huawei)

Този файл НЕ се трие. Пази реалните ревюта на модераторите (дословно) и как са отстранени — история на приложението и поука за бъдещи апове.

## 2026-08-11 — ОТХВЪРЛЕНО (подадено v1.0019)

Ревю от модерацията (дословно):

```
App review results：
1.When users access the privacy policy URL "https://pupikes.app/privacy/monitor-bot/hw-privacy.html" you submitted in AppGallery Connect, the message "404 Not Found" is displayed, which does not comply with relevant regulations.
   Modification suggestion: Provide a valid URL for your privacy policy. (rule 7.1)
2.Your app's "Privacy/Terms" functions reports an error, affecting user experience.
   Test details: Launch the APP -> When clicking Privacy/Terms functions, an error message "404 Not found" is displayed.
   Modification suggestion: Optimize your app to ensure it can be used in its release regions. (rule 3.1)
```

Отстранено:
- **7.1 + 3.1** — правните страници качени на прод (вече HTTP 200: `hw-privacy.html` и `hw-terms.html`). Апът сочи точно тях, затова бутоните Privacy/Terms в апа работят.

Подадено наново: **v1.0020** (2026-08-12) → Reviewing.

Забележка (наша, техническа): при преподаването първо тръгна СТАРО APK (1.0019), защото качването на новото пропадна тихо и ботът избра стария пакет. Оправено с предпазител: подава само ако закаченият versionCode = билднатия. Cancel review → преподадено правилно 1.0020.

## 2026-08-15 — ревю от модерацията (дословно)

```
App review results：
The app icon you submitted is different from that displayed on users' mobile phones after the app is installed, which affects user experience.
Modification suggestion: Ensure that the app icon you submitted is the same as that displayed on users' mobile phones after the app is installed, and ensure this issue does not exist in other languages.
For details, please refer to rule 1.20 of the AppGallery Review Guidelines at the following website: https://developer.huawei.com/consumer/en/doc/app/50104-01
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
Cloud Testing
Analyze data Hide tasks
Distribution analysis
Distribution analysis
Collects and reveals how your app is distributed and use
```

## 2026-08-22 — нова икона (Стил A) + пресъбмит подготвен
- **1.20** — нова икона Стил A в конзолата (проверено) + ново APK + privacy 200. Чернова записана. Остава ръчно: Proof of copyright + Submit.

## 2026-09-04 — ревю от модерацията (дословно)

```
App review results：
1.The app icon you submitted (under Traditional Chinese (Hong Kong), Traditional Chinese (Taiwan), English (US)) is different from that displayed on users' mobile phones after the app is installed, which affects user experience.
Modification suggestion: Ensure that the app icon you submitted is the same as that displayed on users' mobile phones after the app is installed, and ensure this issue does not exist in other languages.
For details, please refer to rule 1.20 of the AppGallery Review Guidelines at the following website: https://developer.huawei.com/consumer/en/doc/app/50104-01
2.Your app offers only simple content, which affects user experience.
Modification suggestion: Enrich your app content/Submit an app with more features to provide a better user experience.
For details, please refer to rule 4.1 of the AppGallery Review Guidelines at the following website:
https://developer.huawei.com/consumer/en/doc/app/50104-04
[Test Environment]: Wi-Fi connection, Huawei P40 with EMUI 12.0.0, nove4e - P30 Lite with EMUI 12.0.0, multilingual environment.
Consult
Release
Key metricsExpand
Develop your app Hide tasks
Auth Service
Auth Service
Helps you build a secure and reliable user authentication system for your app by simply integrating Auth Service capabilities into your app. There's no need to worry about cloud facilities and implementation. 
Auth Service
T
```

## 2026-09-09 — ревю от модерацията (дословно)

```
App review results：
Your app offers only simple content, which affects user experience.
Modification suggestion: Enrich your app content/Submit an app with unique content and features to provide a better user experience.
For details, please refer to rule 4.1 of the AppGallery Review Guidelines at the following website:
https://developer.huawei.com/consumer/en/doc/app/50104-04
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
Distribution analysis
Distribution analysis
Collects and reveals how your app is distributed and used, enhancing your decision-making.
Distribution analysis
```

## 2026-09-09 — ПОПРАВКА и пресъбмит (v1.0028) — правило 4.1

Какво е направено по забележката „simple content":
- Нов екран „Инструменти" с 6 таба: Достъпност (история + време за отговор, графика), SSL (валидност на сертификата), Цена (следене с история), Промени (текстова разлика), Табло (общ статус + седмичен отчет за споделяне), Пренос (експорт/импорт JSON + шаблони Telegram/YouTube/Reddit/GitHub).
- Политика на трафика: всяка проверка е ЕДНОКРАТНА на пускане (при първо отваряне на таба / добавяне), после само пазени данни; „Провери сега" по желание.
- Нови снимки по табове (различни езици), описания на 14 езика с новите функции, бележка „For reviewer".
- Подадено през PublishBot (--fix, appinfo+description, HW_REPLACE_SHOTS=1).

## 2026-09-10 — ревю от модерацията (правило 4.1, пак)

Ботът-събирач не е записал дословния текст за monitor-bot (в `app-shared/moderation-huawei.json` няма запис; `hw-reasons-monitor-bot.log` е само заглавка). Смисълът по заданието на собственика от 11.09.2026: „Your app offers only simple content" — при ЧИСТА инсталация няма нито един следен сайт и всички екрани са празни, затова тестерът (Китай, P40/EMUI 12) не вижда функциите.

## 2026-09-11 — ПОПРАВКА и пресъбмит (v1.0029) — правило 4.1

- Нов ПЪРВИ екран „Общ преглед" (screens/home.js): табло с карти за всичките инструменти — Достъпност, SSL, Цени, Промени, RSS/JSON монитори, Ежедневни наблюдатели, Табло+седмичен отчет, Пренос+шаблони, Каталог, Нов монитор — с 1–2 реда живо съдържание от пазените данни; търсене във всички новини; последни събития; „За робота" се отваря оттук (лентата остава 7 бутона).
- Примерни данни при първо пускане (core/samples.js): 5 сайта (wikipedia.org, bbc.com, github.com, weather.com, example.org) с генерирана 14-дневна история — достъпност/време за отговор (56 точки), SSL валидност, 2 цени, 2 страници с промени, 4 ежедневни наблюдателя, 3 RSS монитора, дневник; всичко с етикет „пример", бутон „Махни примерите" (и „Върни примерите").
- Политиката на проверките е запазена: веднъж на пускане при отваряне на таба (вече паралелно), ежедневните по график, мониторите по интервал; relay резерв (pupikes.app) за емисии/сертификати при блокиран пряк достъп (Китай).
- Описания на 15 езика (Full + New features + store-listing), бележка „For reviewer" с „How to test" (12 стъпки), нови снимки (Общ преглед + инструменти + наблюдатели + табло). Подадено през PublishBot (--fix, sections [appinfo, description] + бележка, HW_REPLACE_SHOTS=1).
