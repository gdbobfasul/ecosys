# История на модерацията — baby-monitor (Baby Radar, Huawei)

Този файл НЕ се трие. Пази реалните ревюта на модераторите (дословно) и как са отстранени — история на приложението и поука за бъдещи апове.

## 2026-08-11 — ОТХВЪРЛЕНО (подадено v1.0019)

Ревю от модерацията (дословно):

```
App review results：
1.When users access the privacy policy URL "https://pupikes.app/privacy/baby-monitor/hw-privacy.html" you submitted in AppGallery Connect, the message "404 Not Found" is displayed, which does not comply with relevant regulations.
   Modification suggestion: Provide a valid URL for your privacy policy. (rule 7.1)
2. Test details: 1) Launch the APP -> When clicking Privacy/Terms functions, an error message "404 Not found" is displayed.
   Modification suggestion: Optimize your app to ensure it can be used in its release regions. (rule 3.1)
```

Отстранено:
- **7.1 + 3.1** — правните страници качени на прод (вече HTTP 200: `hw-privacy.html` и `hw-terms.html`). Апът сочи точно тях (legal.js: `PRIVACY_FILE=hw-privacy.html`, `TERMS_FILE=hw-terms.html`), затова и бутоните Privacy/Terms в апа вече работят във всички региони.

ПОУКА: 404 на правните страници бие едновременно 7.1 (store URL) и 3.1 (бутоните в апа). Правните страници ТРЯБВА да са качени преди подаване.

Подадено наново: **v1.0020** (2026-08-12) → Reviewing.
