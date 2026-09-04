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
