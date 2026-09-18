# История на модерацията — price-watch-bot (Huawei)

Този файл НЕ се трие. Пази реалните ревюта на модераторите (дословно) и как са отстранени — история на приложението и поука за бъдещи апове.

## 2026-08-11 — ревю от модерацията (дословно)

```
App review results：
1.Your app contains the cryptocurrency information (price, rates) content that does not match the age rating. The current rating fails to accurately represent the suitable age group for the app, making it harder for users to find apps appropriate for their age.
Modification suggestion: Complete the age rating questionnaire based on the app functions and content. If the age rating result in the questionnaire does not meet the review requirements, you can select the applicable age rating 18+ from the expected age rating section of the questionnaire. Alternatively, delete the content that does not match the age rating.
For details, please refer to rule 1.10 of the AppGallery Review Guidelines at the following website: https://developer.huawei.com/consumer/en/doc/app/50104-01
For details about the Age Rating Questionnaire FAQs, please visit the following website: https://developer.huawei.com/consumer/en/doc/app/50142
2.When users access the privacy policy URL https://pupikes.app/privacy/authenticator/hw-privacy.html you submitted in AppGallery Connect, the message "404 Not found" is displayed, which does not comply with relevant regulations.
Modification suggestion: Provide a valid URL for your privacy policy.
For details, please refer to rule 7.1 of the AppGallery Review Guidelines at the following website: https://developer.huawei.com/consumer/en/doc/app/50104
```

Отстранено:
- **1.10** — рейтингът вдигнат на 18+ (крипто/курсове съдържание); чрез „expected age rating" в въпросника (content-ratings.json expectedAge:"18+").
- **7.1** — предният privacy URL сочеше ЧУЖД ап (authenticator); ботът пълни правилния price-watch-bot/hw-privacy.html (200).

Подадено наново: **v1.0020** (2026-08-12) → Reviewing.

## 2026-08-22 — нова икона (Стил A) + пресъбмит подготвен
- **1.10/1.20** — нова икона Стил A в конзолата (проверено) + ново APK + рейтинг 18+ (крипто). Чернова записана. Остава ръчно: Proof of copyright + Submit.

## 2026-09-04 — ревю от модерацията (дословно)

```
App review results：
1.Your app has a single feature, which affects user experience.
Modification suggestion: Enrich your app content/Submit an app with unique content and features to provide a better user experience.
For details, please refer to rule 4.1 of the AppGallery Review Guidelines at the following website:
https://developer.huawei.com/consumer/en/doc/app/50104-04
2.The app icon you submitted (under Traditional Chinese (Hong Kong), Traditional Chinese (Taiwan), English (US)) is different from that displayed on users' mobile phones after the app is installed, which affects user experience.
Modification suggestion: Ensure that the app icon you submitted is the same as that displayed on users' mobile phones after the app is installed, and ensure this issue does not exist in other languages.
For details, please refer to rule 1.20 of the AppGallery Review Guidelines at the following website: https://developer.huawei.com/consumer/en/doc/app/50104-01
[Test Environment]: Wi-Fi connection, Huawei P40 with EMUI 12.0.0, nove4e - P30 Lite with EMUI
Consult
Release
Key metricsExpand
Develop your app Hide tasks
Auth Service
Auth Service
Helps you build a secure and reliable user authentication system for your app by simply integrating Auth Service capabilities into your app. There's no need to worry about cloud facilities and implementation. 
Auth Service
Test and release your app H
```

## 2026-09-09 — ревю от модерацията (дословно)

```
App review results：
Your app's some functions reports an error, affecting user experience.
Test details: Launch the APP-> Top menu-> Click on "World/ Commod./macro/Forex"-> No data (check Connection) is displayed.
Modification suggestion: Optimize your app to ensure it can be used in its release regions.
For details, please refer to rule 3.1 of the AppGallery Review Guidelines at the following website:
https://developer.huawei.com/consumer/en/doc/app/50104-03
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
Analyze data Hide tasks
Distribution analysis
Distribution analysis
Collects and reveals how your app is distributed and used, enhancing your decision-making.
Distribution analysis
```

## 2026-09-09 — ПОПРАВКА и пресъбмит (v1.0026)

- Поправка 3.1 (v1.0026): relay резерв (pupikes.app/api/relay) за Yahoo/Binance — World/Commod./Macro/Forex зареждат и от Китай. Подадено през PublishBot (--fix, sections [] + бележка).

## 2026-09-11 — ревю от модерацията (дословно)

```
App review results：
Different modules in your app report an error, affecting user experience.
Test details: Different modules such as Forex, World or Macro report no connection.
Modification suggestion: Optimize your app to ensure it can be used in its release regions.
For details, please refer to rule 3.1 of the AppGallery Review Guidelines at the following website:
https://developer.huawei.com/consumer/en/doc/app/50104-03
```

## 2026-09-11 — ПОПРАВКА и пресъбмит (v1.0027)

- Вграден снимков пакет (като Market Pulse 1.0021): `deploy-scripts/gen-pricewatch-snapshot.mjs` при билд тегли котировките на Борси/Суровини/Макро/Валути/Акции (42 символа), 18 фючърса, RSI, Fear & Greed (+12 месеца), крипто индекси, топ 100, тренд, цени за наблюденията + дневна история до 5 г. за 60 символа → `public/reference/` (0,8 MB).
- Всеки пазарен таб ПЪРВО показва пакета с надпис „Данни към <дата> (вграден пакет)", живите данни (пряко → relay, паралелно) само го обновяват; „No data (check connection)" вече няма като краен резултат. Ред → графика 1 м/6 м/1 г/5 г; „Наблюдение" пада към пакета без известие по стара цена.
- smoke-tabs при блокирана мрежа: всички табове с данни; описания 15 езика (New features), бележка „How to test", нови снимки. Подадено през PublishBot (--fix, sections [description] + бележка).

## 2026-09-18 — ревю от модерацията (дословно)

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
