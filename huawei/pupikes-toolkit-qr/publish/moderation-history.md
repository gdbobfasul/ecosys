# История на модерацията — pupikes-toolkit-qr (Pupikes Toolkit QR, Huawei)

Този файл НЕ се трие. Пази реалните ревюта на модераторите (дословно) и как са отстранени — история на приложението и поука за бъдещи апове.

## 2026-08-11 — ОТХВЪРЛЕНО (подадено v1.0019)

Ревю от модерацията (дословно):

```
App review results：
1.When users access the privacy policy URL https://pupikes.app/privacy/pupikes-toolkit-qr/hw-privacy.html you submitted in AppGallery Connect, the message "404 not found" is displayed. (rule 7.1)
2.Your app has a single feature — приложението изглежда с една единствена функция. (rule 4.1)
```

Отстранено:
- **7.1** — privacy страницата качена на прод (вече HTTP 200).
- **4.1** — описанието изрично изброява 8-те инструмента (QR код, Моите QR кодове, Партиден, Стилизиран, Wi-Fi, Контакт/vCard, Събитие, Локация) + reviewer note със списъка. Приложението НЕ е с една функция.

ПОУКА: „single feature" (4.1) → изброявай явно всички инструменти/функции в описанието, не разчитай да ги открият сами.

Подадено наново: **v1.0020** (2026-08-11) → Reviewing.

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
- **1.20** — нова икона Стил A (QR в марков цвят на бяла плочка) в конзолата (проверено) + ново APK + описание 8 инструмента (4.1). Чернова записана. Остава ръчно: Proof of copyright + Submit.

## 2026-09-04 — ревю от модерацията (дословно)

```
App review results：
1.The app icon (under Traditional Chinese (Hong Kong), Traditional Chinese (Taiwan) and English (US)) you submitted is different from that displayed on users' mobile phones after the app is installed, which affects user experience.
Modification suggestion: Ensure that the app icon you submitted is the same as that displayed on users' mobile phones after the app is installed, and ensure this issue does not exist in other languages.
For details, please refer to rule 1.20 of the AppGallery Review Guidelines at the following website: https://developer.huawei.com/consumer/en/doc/app/50104-01
2.Your app's "Scan with Camera" function reports an error, affecting user experience.
Test details: Launch the APP-> QR Code-> Read-> Scan with camera-> "camera unavailable: Permission denied" is displayed
Modification suggestion: Optimize your app to ensure it can be used in its release regions.
For details, please refer to rule 3.1 of the AppGallery Review Guidelines at the following website:
https://developer.huawei.com/consumer/en/doc/app/50104-03
3.The app you submitted is a "QR toolkit ( Create, save and read QR codes)" , which is similar to existing apps currently available on AppGallery. A large number of apps offering the same type of content or functionality may cause user confusion and negatively impact user experience.
Modification suggestion: We look forward to s
```

## 2026-09-09 — ревю от модерацията (дословно)

```
App review results：
The app you submitted is a "QR Generator/QR reader", which is similar to existing apps currently available on AppGallery. A large number of apps offering the same type of content or functionality may cause user confusion and negatively impact user experience.
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
Ana
```

## 2026-09-09 — ПОПРАВКА и пресъбмит (v1.0025)

- 4.3 → нов инструмент „Плащане QR“ (SEPA/EPC, UPI, крипто URI, PayPal.me) v1.0025; описания; бележка. Подадено през PublishBot (--fix, sections [description] + бележка).

## 2026-09-11 — ревю от модерацията (дословно)

```
App review results：
The app you submitted is a "QR Generator/QR reader", which is similar to existing apps currently available on AppGallery. A large number of apps offering the same type of content or functionality may cause user confusion and negatively impact user experience.
Modification suggestion: We look forward to seeing further improvements in areas such as interaction design and feature depth, and to receiving an app with distinctive content and functionality that delivers a better user experience.
For details, please refer to rule 4.3 of the AppGallery Review Guidelines at the following website:
https://developer.huawei.com/consumer/en/doc/app/50104-04
```
_(4.3 повторно, след v1.0025 „Плащане QR"; текстът е същият като на 2026-09-09 — логът на събирача за 11.09 е празен.)_

## 2026-09-11 — ПОПРАВКА и пресъбмит (v1.0026)

- 4.3 (пак) → НОВА СЪРЦЕВИНА „QR етикети за дома и инвентара": всеки предмет/кутия/ключ/лекарство/документ получава QR етикет (код PQL-XXXXXX); печат на лист A4/Letter при 300 DPI (PNG или PDF, 25/35/50 мм); сканиране на етикет (камера/снимка/ръчен код) → карта на предмета (снимка, място/кутия, категория, срок, назаем при кого и докога, бележки). Нови екрани: Предмети (търсене, филтри, лента с предупреждения), Карта на предмет (+форма), Сканирай, Печат, Назаем (активни + история). Напомняния (LocalNotifications). Първи екран = Етикети; старите инструменти на „⊞ Всички инструменти". 6 примерни предмета при първо пускане (маркирани, с бутон за изтриване).
- Описания 15 езика (Brief/Full/New features + store-listing); reviewer note с „How to test"; нови снимки. Подадено през PublishBot (--fix, sections [description] + бележка).

## 2026-09-16 — ревю от модерацията (дословно)

```
App review results：
Your App has been approved.
[Test Environment]: Wi-Fi connection, Mate 30 Pro with EMUI 12.0.0, multilingual environment.
Update
Key metricsCollapse 
Last 7 days
Last 30 days
More metrics
New downloads
0
Industry ranking --
Compared with last period --
Details page CVR (client data)
--
Industry ranking --
Compared with last period --
In-App Purchases(EUR)
0.00
Industry ranking --
Compared with last period --
Overall rating
0
Industry ranking --
Compared with last period --
Crashes
--
Compared with last period 0%
Uninstalls
0
Industry ranking --
Compared with last period --
Analyze data Hide tasks
Distribution analysis
Distribution analysis
Collects and reveals how your app is distributed and used, enhancing your decision-making.
Distribution analysis
Promote products Hide tasks
Quality analysisCrashAPM
Quality analysis
Resolves problems with your app quickly by analyzing app installation failures, crashes, ANRs, and more.
Quality analysis
Engage users Hide tasks
App Messaging---Comments
App Messaging
Your app will be able to trigger messages in diverse formats based on specific user behavior, helping you engage with active users.
App Messaging
```
