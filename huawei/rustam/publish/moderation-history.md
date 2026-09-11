# История на модерацията — rustam (Huawei)

Този файл НЕ се трие. Пази реалните ревюта на модераторите (дословно) и как са отстранени — история на приложението и поука за бъдещи апове.

## 2026-09-08 — ревю от модерацията (дословно)

```
App review results：
Your game has been found to collect personal information, but you have not stated this through the privacy tag configuration.
Modification suggestion: Complete the privacy tag configuration based on whether your app collects personal information and the purpose of using the collected personal information.
For details, please refer to the AppGallery Privacy Tag Service Description at the following website: https://developer.huawei.com/consumer/en/doc/privacy-label
Test Environment: Wi-Fi connection, EMUI 12.0(P40), EMUI 11.0(Mate 20 Pro), Multilingual settings.
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

### 2026-09-08 — ОТСТРАНЕНО (privacy tags)
- Причина: Huawei засича „събиране на лична информация" (локални игрови настройки/прогрес + незадължителен анонимен доклад), а Privacy tags бяха „No".
- Поправка: Privacy tags = **Yes**, сценарий „App functionality", елементи: Game statistics, App settings, Text information (`publish/app-profile.json` → `privacyTagsHuawei`; ботът ги попълва сам). Бележка „For reviewer" добавена. Подадено отново (Reviewing).
