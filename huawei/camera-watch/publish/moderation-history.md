# История на модерацията — camera-watch (Huawei)

Този файл НЕ се трие. Пази реалните ревюта на модераторите (дословно) и как са отстранени — история на приложението и поука за бъдещи апове.

## 2026-09-09 — ревю от модерацията (дословно)

```
App review results：
The app you submitted is a camera, which is similar to existing apps currently available on AppGallery. A large number of apps offering the same type of content or functionality may cause user confusion and negatively impact user experience.
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
Cloud Tes
```

## 2026-09-09 — ПОПРАВКА и пресъбмит (v1.0020)

- 4.3 → табло с табове: хронология на събитията (миниатюра, час, сила на движението, филтър, преглед), зони за следене (мрежа 8×6 върху кадъра, изключените клетки не вдигат аларма), график по часове (нормален/тих/чувствителен), таймлапс (кадър на N секунди, лента, плейър, GIF със собствен кодер), статистика (графика по часове/дни, износ CSV), аларма на телефона (звук/светлинен сигнал/отлагане) v1.0020; описания 15 езика; бележка. Подадено през PublishBot (--fix, sections [description] + бележка).

## 2026-09-10 — НОВА СЪРЦЕВИНА (v1.0021)

- 4.3 → нова главна функция MotionSecurityHawk: наставник и пазач за този, който излиза сам (дете/възрастен), и за близкия, който го наблюдава — два телефона, сдвоени по код, шифрован канал през релея (/api/watch/msg, само памет до 24 ч.). Нови екрани: „Роля" (носещ/наблюдаващ + съгласие на екрана), „Носещ" (карта на пътя, бутон ПОМОЩ, гласов пазач със записи, датчик за падане, задача с наставления на глас, разрешена зона), „Наблюдаващ" (код за сдвояване, карта на следата + „отвори в карти", сигнали със запис и място, задача „рецепта", зона, гласово съобщение, „къде си?"). Старият страж на камерата е раздел „Камера". Нови разрешения: местоположение + микрофон (само роля „Носещ"). v1.0021; описания 15 езика; бележка. Подадено през PublishBot (--fix, sections [description] + бележка).

## 2026-09-16 — ревю от модерацията (дословно)

```
App review results：
Your app's Map of ma way and send a HELP signal functions cannot be used, affecting user experience.
Test details: 1.Open the app -> go to Hawk -> select a role "Wearer" or "Guardian" -> input the name and check the consent box -> click "Start" -> the "map of my way" is not displayed correctly. 2. When we click "Help" , there is no signal/alert on the second device.
Modification suggestion: Optimize your app to ensure it can be used in its release regions.
For details, please refer to rule 3.1 of the AppGallery Review Guidelines at the following website:
https://developer.huawei.com/consumer/en/doc/app/50104-03
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
A
```
