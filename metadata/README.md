# /metadata — метаданни за магазините на всички приложения от Pupikes екосистемата

Тази папка съдържа по един файл `<app>.yaml` за **всяко** приложение, готов за регистрация в магазините. Полетата покриват изискванията на:

- **Google Play** (Play Console) — title (≤30), short description (≤80), full description (≤4000), категория, Content Rating (IARC), Data safety, разрешения, политика за поверителност.
- **RUStore** — наименование, кратко/пълно описание, категория, възрастов рейтинг, разрешения.
- **Huawei AppGallery** — app name, intro (≤80), description (≤8000), категория, age rating.
- **Apple App Store** (ако се добави iOS) — name (≤30), subtitle (≤30), keywords (≤100), description, privacy.

> Локализираните листинги (title/short/full) се водят на **15-те езика на екосистемата** (същите като интерфейса). За компактност тук държим основните (ru/en/bg) + ключовите магазинни полета; пълните 15 локала се генерират от същия преводен слой на приложението.

## Схема на `<app>.yaml`

```yaml
id:            # машинно име (папка)
name:          # показвано име
folders:       # пътища в репото
stores:        # където се публикува
package:       # appId per магазин
category:      # категория (по магазин при разлика)
content_rating: # IARC/възраст
pricing:       # free / paid
contains_ads:  # true/false
in_app_purchases: # true/false (+ описание)
default_language: ru
supported_languages: [bg, ru, uk, en, de, fr, es, es-MX, it, pt, ar, hi, ja, ky, zh-Hant]
privacy_policy:  # URL
support_email:   ltd.dai.grup@gmail.com
website:         # URL
listings:        # title/short/full по локал
permissions:     # разрешение + обосновка
data_safety:     # какви данни, шифровани ли са, споделят ли се, изтриваеми ли са
assets:          # изисквания за икона/снимки/feature graphic
keywords:        # за App Store / търсене
```

## Принципи (важат за цялата екосистема)
- **Нула криптовалутни плащания** в публичните приложения (одитът е чист). Плащания само през магазин (IAP) или Stripe, където е приложимо.
- Игрите и инструментите работят **офлайн-първо**, без Google Mobile Services (за RUStore/Huawei).
- Където приложение пази чувствителни данни, те се **шифроват локално** и **не се споделят** с трети страни.
