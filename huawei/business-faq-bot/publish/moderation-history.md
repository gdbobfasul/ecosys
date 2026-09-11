# История на модерацията — business-faq-bot (Huawei)

Този файл НЕ се трие. Пази реалните ревюта на модераторите (дословно) и как са отстранени — история на приложението и поука за бъдещи апове.

## 2026-09-08 — ревю от модерацията (дословно)

```
App review results：
Your app's "Test console" function reports an error, affecting user experience.
Test details: Launch the APP-> Dashboard-> Test console->Input Test question-> Click on "Test" button-> Fallback error appears.
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

### 2026-09-08 — ОТСТРАНЕНО (3.1 „Test console → Fallback error")
- Причина: не е грешка — отговорът при липса на съвпадение беше етикетиран „[fallback]" и модераторът го прочете като error.
- Поправка (v1.0020): етикетът стана „handoff to a person" (15 езика) в тест-конзолата, демо-чата и статистиката; бележка „For reviewer". Ново APK + повторно подаване.

## 2026-09-10 — ревю от модерацията (дословно)

```
App review results：
Your app's "Test console" function does not workan error, affecting user experience.
Test details: Launch the APP-> Dashboard-> Test console->Input Test question-> Click on "Test" button-> Fallback error appears.
Modification suggestion: Optimize your app to ensure it can be used in its release regions.
For details, please refer to rule 3.1 of the AppGallery Review Guidelines at the following website:
https://developer.huawei.com/consumer/en/doc/app/50104-03
【[Test Environment]: Wi-Fi connection, Nova 9 with EMUI 13 HMS, multilingual environment.】
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

## 2026-09-11 — ПОПРАВКА и пресъбмит (v1.0021)

- 3.1 „Test console → Fallback error" (пак): коренът беше, че примерната база имаше само 3 правила на български → английски тестов въпрос никога не удряше правило и модераторът получаваше „предаване на човек", което четеше като грешка.
- v1.0021: примерна база знания при първо пускане — 15 типични въпроса (работно време, адрес, цени, доставка, срок, връщане, плащане, гаранция, контакт, час, паркинг, отстъпки, наличност, празници, поздрави) на езика на интерфейса (15 езика), маркирани „пример", бутони „Махни примерите"/„Зареди примерите"; търсене с толеранс (нормализация, частични думи/обща основа, синоними, печатни грешки — Левенщайн); „предаване на човек" е нормален отговор в чат-балонче с неутрален (син) етикет, брои се в статистиката като „Към човек"; тест-конзолата с примерни въпроси („Опитай:") и въпрос/отговор като чат.
- Описания 15 езика (Full + New features + Brief) + store-listing; бележка „For reviewer" с „How to test" (What are your opening hours? → отговор). Подадено през PublishBot (--fix, sections [description] + бележка).
