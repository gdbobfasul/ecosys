# История на модерацията — authenticator (Huawei)

Този файл НЕ се трие. Пази реалните ревюта на модераторите (дословно) и как са отстранени — история на приложението и поука за бъдещи апове.

## 2026-08-11 — ОТХВЪРЛЕНО (подадено v1.0019)

Ревю от модерацията (дословно):

```
App review results：
1.When users access the privacy policy URL https://pupikes.app/privacy/authenticator/hw-privacy.html you submitted in AppGallery Connect, the message "404 Not found" is displayed, which does not comply with relevant regulations.
   Modification suggestion: Provide a valid URL for your privacy policy. (rule 7.1)
2.The icon of your app contains content and elements related to Samsung Security Policy Update app, which may cause confusion, misunderstanding, or inappropriate association among users.
   Modification suggestion: Provide authorization documents or modify the icon of your app. (rule 9.3)
[Test Environment]: Wi-Fi, Huawei P40 EMUI 12.0.0 / P30 Lite EMUI 12.0.0, multilingual.
```

Отстранено:
- **7.1** — privacy страницата качена на прод (вече HTTP 200: `/privacy/authenticator/hw-privacy.html`).
- **9.3** — иконата сменена: щит+отметка → **катинар** (в `gen-app-icons.mjs`: authenticator `shield`→`lock`; guess() auth също `lock`). Ребилд (нов launcher) + качена в App info + regenerated publish/icon-512/216.png.

ПОУКА: щит = сигурност = сблъсква се със Samsung Security Policy Update (9.3). За auth/security апове НЕ използвай щит — катинар/ключ.

Подадено наново: **v1.0020** (2026-08-12) → Reviewing.
