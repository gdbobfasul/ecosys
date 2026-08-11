# История на модерацията — pupikes-toolkit-text (Huawei)

Този файл НЕ се трие. Пази реалните ревюта на модераторите (дословно) и как са отстранени — история на приложението и поука за бъдещи апове.

## 2026-08-11 — ревю от модерацията (дословно)

```
App review results：
1.When users access the privacy policy URL https://pupikes.app/privacy/pupikes-toolkit-text/hw-privacy.html you submitted in AppGallery Connect, the message "404 not found" is displayed, which does not comply with relevant regulations.
Modification suggestion: Provide a valid URL for your privacy policy.
For details, please refer to rule 7.1 of the AppGallery Review Guidelines at the following website: https://developer.huawei.com/consumer/en/doc/app/50104-07
2.Your app has a single feature, which affects user experience.
Modification suggestion: Submit an app with unique content and features to provide a better user experience.
For details, please refer to rule 4.1 of the AppGallery Review Guidelines at the following website:
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
Tests the compatibility, stability, performance, power cons
```

Отстранено:
- **7.1** — privacy страницата вече 200.
- **4.1** — reviewer note изброява многото инструменти (Текстови/Регистър и редове/Кодиране-декодиране/Генератори); описанието също ги изброява.

ПОУКА (техническа): описанието съдържаше специални Unicode знаци (математически bold 𝐁𝐨𝐥𝐝 + комбиниращи зачертаване/подчертаване) в редовете „Unicode стил" — Huawei ги отказва при Save на App info („special characters are not allowed"). Почистени (NFKC + махане на U+0300–036F) в descriptions-languages.md И store-listing/*.txt. Правило: описанията само с нормални знаци.

Подадено наново: **v1.0020** (2026-08-12) → Reviewing.
