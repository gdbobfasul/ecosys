# Huawei AppGallery — Форма за релийз на версия (екрани 17–24)

Пълните полета на страницата **„Version information → Draft"** (след App information). Стойностите
са от **newslator** като пример; per-app данните (цена, privacy URL, AI) идват от файловете.
Ботът: `deploy-scripts/huawei-release-bot.cjs <app> --loop` (меню точка 90). Попълва ВИДИМО, финалните
бутони (Save/Submit) ги натиска потребителят.

- **Принцип:** ботът избира радио/чекбокс/полета; ти качваш файловете (APK, copyright) и натискаш Save/Submit.
- **Данни:** цена = `app-shared/promo-catalog.json` (полето след „лапата"); privacy = `https://selflearning.bot.nu/privacy/<app>/hw-privacy.html`.

---

## Екран 17 — Country/Region for release
- **AppGallery:** ● **Selected countries/regions** (не „All").
- Избери **All** (всички), после **МАХНИ**: ✗ **Chinese mainland** (иска китайски лиценз), ✗ **Belarus**, ✗ **Russia** (санкции). Ако се появят: Iran / North Korea / Syria / Cuba / Crimea — също махни.
- Резултат: ~198 избрани (всички без China/Belarus/Russia).
- ⚠ Ботът прави: Selected → отмята „All" → разотмята China/Belarus/Russia.

## Екран 18 — Open testing + App version
- **Use testing version:** ● **No**.
- **App version:** качва се APK през **Manage packages** (екран 19). `apk/huawei/release/<Име>-huawei-release.apk`.

## Екран 19 — Manage packages (попъп)
- Бутон **Upload** → избери APK → появява се в списъка → **Select**. (Качването на файла е РЪЧНО.)

## Екран 20 — Payment information
- **Payment type:** ● **Paid** (иска Merchant Service + подписан Merchant Service Agreement).
- **Default currency:** **Kyrgyzstan (USD)**.
- **Price (tax included):** бутон **View and edit** → екран 24 (App price).

## Екран 21 — In-app purchases + Privacy statement
- **In-app purchase items:** нищо не се отмята (нямаме IAP).
- **Privacy policy URL** * : `https://selflearning.bot.nu/privacy/<app>/hw-privacy.html`.
- **Data subject right URL:** същия URL.

## Екран 22 — Privacy tags + AI + Copyright
- **Collect personal data:** ● **No** (не събираме лични данни).
- **Generative AI service:** ● **Not involved** (newslator = превод, не генеративен AI). Апове с ГЕНЕРАТИВЕН AI (напр. `pupikes-toolkit-ai-announcement`) → **Involved**.
- **Proof of copyright:** качва се файл РЪЧНО (ако Huawei го изисква).

## Екран 23 — For reviewer + Release
- **Sign-in required:** ☐ не се отмята (нашите апове нямат вход/акаунт).
- **Remarks:** по избор (напр. „No account/login required. No personal data collected.").
- **Release time:** ● **Immediately once approved** (авто-релийз след одобрение).

## Екран 24 — App price (от „View and edit")
- **Default currency:** **Kyrgyzstan (USD)**.
- **Default price (tax included):** **цената от каталога** (newslator: **1.3 USD** — от `promo-catalog.json`, полето след „лапата").
- Избери **All**, после **МАХНИ China/Belarus/Russia** и тук (ценовите държави).
- Бутон **Convert prices** (конвертира в локални валути) → после **Save**.

---

## Кое прави ботът автоматично (екрани 17–24)
| Екран | Ботът прави | Ти правиш |
|-------|-------------|-----------|
| 17 Country/Region | Selected + All + маха China/Belarus/Russia | — |
| 18 Open testing | „No" | качваш APK (19) |
| 19 Manage packages | — | Upload APK → Select |
| 20 Payment | Paid + валута USD | — |
| 21 Privacy | Privacy/Data URL | — |
| 22 Privacy tags/AI | Collect=No, AI по апа | Proof of copyright (файл) |
| 23 Reviewer/Release | Sign-in изкл., Release=Immediately | — |
| 24 App price | цена (USD) + All + маха China/Belarus/Russia + Convert | натискаш Save |
| финал | — | **Save / Submit** |

## За другите приложения
Стойностите се параметризират: **цена** от `promo-catalog.json` (per app), **privacy URL** по шаблона с `<app>`,
**AI** = „Not involved" освен за `GENERATIVE_AI` списъка в бота. China/Belarus/Russia се махат за всички.
Ботът чете app-а от аргумента → сменяш само името в точка 90.
