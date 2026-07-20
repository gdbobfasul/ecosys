# Документи за публикуване — Pupikes FAQ Desk

_Автоматичен индекс (deploy-scripts/gen-publish-index.mjs). Отвори го при публикуване, за да знаеш кой документ къде се прикача._

- **Huawei пакет:** `com.kcy.businessfaqbot.hw`
- **RuStore пакет:** `com.kcy.businessfaqbot.rustore`
- **Билд (APK/AAB):** идва от `apk/business-faq-bot-{huawei,rustore}-debug.apk` след меню 57 (не е в тази папка).

---

## 🟥 Huawei AppGallery
Портал: **AppGallery Connect** → My apps → (създай/избери приложението).

| Документ | За какво | Файл |
|---|---|---|
| Основни данни | име, пакет, категория, поддръжка (Set basic app information) | [`huawei.meta`](./huawei.meta) |
| Форма — Android | таб **Android** → бутон Release: полетата ред по ред | [`form-android.md`](./form-android.md) |
| Форма — HarmonyOS | таб **HarmonyOS** → New app ID | [`form-harmonyos.md`](./form-harmonyos.md) |
| Описания по език | Manage languages → Brief / Full / New features (14 от 15 езика) | [`descriptions-languages.md`](./descriptions-languages.md) |
| Текстове по език | суровите описания за всеки език (15 файла) | [`store-listing/`](./store-listing/) |
| Privacy Tags данни | декларация какви данни се събират и с каква цел (Data collection) | [`app-profile.json`](./app-profile.json) |
| Монетизация | модел (free / paid / IAP); при платено — HUAWEI IAP | [`monetization.json`](./monetization.json) |
| Икона | 512×512 (и 216×216) | [`icon-512.png`](./icon-512.png) |
| Екранни снимки | поне 3; споделени + по език (8 папки/файла) | [`screenshots/`](./screenshots/) |
| **Политика за поверителност** | подава се като URL в AGC + показва се в апа (правило 7.1) | [`hw-privacy.html`](./hw-privacy.html) → `https://selflearning.bot.nu/privacy/business-faq-bot/hw-privacy.html` |
| ⚠️ Анализ за качване | слаби места и вероятни причини за връщане — прегледай ПРЕДИ подаване | [`analyse.hw`](./analyse.hw) |
| Проверка на име | опора при съмнение за марка/име (не е правен съвет) | [`ANALYSIS.md`](./ANALYSIS.md) |

> Забележки Huawei: политиката се подава като **URL** (не се качва HTML). При пускане в континентален Китай трябва и китайска версия. Регионите (Тайван/Хонконг) се именуват като част от Китай. Ако апът иска вход — дай тестов акаунт.

---

## 🟦 RuStore
Портал: **RuStore Console** (rustore.ru/developer). Няма отделен файл-форма — полетата се попълват директно в конзолата; източниците са:

| Поле в конзолата | Източник | Файл |
|---|---|---|
| Име / описание / категория | суровите текстове по език | [`store-listing/`](./store-listing/), [`descriptions-languages.md`](./descriptions-languages.md) |
| Икона | 512×512 | [`icon-512.png`](./icon-512.png) |
| Екранни снимки | 1–10; същите като за Huawei | [`screenshots/`](./screenshots/) |
| Разрешения (обосновка) | кои разрешения и защо — за декларацията в конзолата | [`app-profile.json`](./app-profile.json) |
| Монетизация | модел; при плащания — RuStore Pay SDK | [`monetization.json`](./monetization.json) |
| **Политика за поверителност (руски)** | подава се като URL в RuStore Console + в апа | [`rustore-privacy.html`](./rustore-privacy.html) → `https://selflearning.bot.nu/privacy/business-faq-bot/rustore-privacy.html` |
| ⚠️ Анализ за качване | слаби места и вероятни причини за връщане — прегледай ПРЕДИ подаване | [`analyse.rustore`](./analyse.rustore) |

> Забележки RuStore: интерфейсът трябва да е на руски или английски; операторът на данните в политиката си ти (не RuStore); при обработка на данни на руски граждани важи 152-FZ (локализация в Русия). Формат на билда: APK или AAB.

---

## Общи активи (важат и за двата магазина)
- Икони: `icon-216.png`, `icon-512.png`
- Екранни снимки: `screenshots/` (+ споделените `1-*.png`, `2-*.png`… в тази папка)
- Описания: `descriptions-languages.md`, `store-listing/*.txt`
- Профил на данните (за декларациите): `app-profile.json`
- Монетизация: `monetization.json`

_Политики онлайн: Huawei → `https://selflearning.bot.nu/privacy/business-faq-bot/hw-privacy.html` · RuStore → `https://selflearning.bot.nu/privacy/business-faq-bot/rustore-privacy.html` (качват се на сървъра чрез меню 08 — sync_privacy_pages)._
