# Документи за публикуване — Pupikes Toolkit Text

_Автоматичен индекс (deploy-scripts/gen-publish-index.mjs). Отвори го при публикуване, за да знаеш кой документ къде се прикача._

- **Huawei пакет:** `com.pupikes.toolkittext.hw`
- **RuStore пакет:** `com.pupikes.toolkittext.rustore`
- **Билд (APK/AAB):** идва от `apk/pupikes-toolkit-text-{huawei,rustore}-debug.apk` след меню 57 (не е в тази папка).

---

## 🟥 Huawei AppGallery
Портал: **AppGallery Connect** → My apps → **създай НОВО приложение** (виж стъпката веднага отдолу).

> ⚠️ **Нов пакет (Pupikes) — създай НОВ запис, не обновявай стария.**
> Пакетът вече е `com.pupikes.toolkittext.hw` (сменен от стария `com.kcy.toolkittext.hw`). AppGallery **не позволява** смяна на
> пакета на съществуващ запис — ако качиш в стария, отказва с „_the name of the uploaded package is
> different from the existing package name com.kcy.toolkittext.hw_". Затова:
> 1. **My apps → New app** и задай **Package name = `com.pupikes.toolkittext.hw`** (фиксира се веднъж — трябва да е точно това).
> 2. Попълни данните по таблицата долу и качи APK-то в **новия** запис.
> 3. Ако старият `com.kcy.toolkittext.hw` е бил публикуван — свали го от продажба СЛЕД одобрение на новия.
>    Отзиви, инсталации и история **не се пренасят** между два различни пакета (магазините не поддържат това).

| Документ | За какво | Файл |
|---|---|---|
| Основни данни | име, пакет, категория, поддръжка (Set basic app information) | [`huawei.meta`](./huawei.meta) |
| Текстове по език | суровите описания за всеки език (15 файла) | [`store-listing/`](./store-listing/) |
| Монетизация | модел (free / paid / IAP); при платено — HUAWEI IAP | [`monetization.json`](./monetization.json) |
| Икона | 512×512 (и 216×216) | [`icon-512.png`](./icon-512.png) |
| Екранни снимки | поне 3; споделени + по език (8 папки/файла) | [`screenshots/`](./screenshots/) |
| **Политика за поверителност** | подава се като URL в AGC + показва се в апа (правило 7.1) | [`hw-privacy.html`](./hw-privacy.html) → `https://selflearning.bot.nu/privacy/pupikes-toolkit-text/hw-privacy.html` |
| ⚠️ Анализ за качване | слаби места и вероятни причини за връщане — прегледай ПРЕДИ подаване | [`analyse.hw`](./analyse.hw) |
| Проверка на име | опора при съмнение за марка/име (не е правен съвет) | [`ANALYSIS.md`](./ANALYSIS.md) |

> Забележки Huawei: политиката се подава като **URL** (не се качва HTML). При пускане в континентален Китай трябва и китайска версия. Регионите (Тайван/Хонконг) се именуват като част от Китай. Ако апът иска вход — дай тестов акаунт.

---

## 🟦 RuStore
Портал: **RuStore Console** (rustore.ru/developer). Няма отделен файл-форма — полетата се попълват директно в конзолата; източниците са:

> ⚠️ **Нов пакет (Pupikes) — създай НОВО приложение, не обновявай старото.**
> Пакетът вече е `com.pupikes.toolkittext.rustore` (сменен от стария `com.kcy.toolkittext.rustore`). RuStore, както и Huawei, **не позволява**
> смяна на пакета на съществуващ запис. Затова: създай **ново приложение** с
> **applicationId = `com.pupikes.toolkittext.rustore`** и качи APK-то там. Ако старият `com.kcy.toolkittext.rustore` е бил публикуван — свали
> го от продажба след одобрение на новия; отзивите/инсталациите не се пренасят.

| Поле в конзолата | Източник | Файл |
|---|---|---|
| Име / описание / категория | суровите текстове по език | [`store-listing/`](./store-listing/), [`descriptions-languages.md`](./descriptions-languages.md) |
| Икона | 512×512 | [`icon-512.png`](./icon-512.png) |
| Екранни снимки | 1–10; същите като за Huawei | [`screenshots/`](./screenshots/) |
| Монетизация | модел; при плащания — RuStore Pay SDK | [`monetization.json`](./monetization.json) |
| **Политика за поверителност (руски)** | подава се като URL в RuStore Console + в апа | [`rustore-privacy.html`](./rustore-privacy.html) → `https://selflearning.bot.nu/privacy/pupikes-toolkit-text/rustore-privacy.html` |
| ⚠️ Анализ за качване | слаби места и вероятни причини за връщане — прегледай ПРЕДИ подаване | [`analyse.rustore`](./analyse.rustore) |

> Забележки RuStore: интерфейсът трябва да е на руски или английски; операторът на данните в политиката си ти (не RuStore); при обработка на данни на руски граждани важи 152-FZ (локализация в Русия). Формат на билда: APK или AAB.

---

## Общи активи (важат и за двата магазина)
- Икони: `icon-216.png`, `icon-512.png`
- Екранни снимки: `screenshots/` (+ споделените `1-*.png`, `2-*.png`… в тази папка)
- Описания: `descriptions-languages.md`, `store-listing/*.txt`
- Профил на данните (за декларациите): `app-profile.json`
- Монетизация: `monetization.json`

_Политики онлайн: Huawei → `https://selflearning.bot.nu/privacy/pupikes-toolkit-text/hw-privacy.html` · RuStore → `https://selflearning.bot.nu/privacy/pupikes-toolkit-text/rustore-privacy.html` (качват се на сървъра чрез меню 08 — sync_privacy_pages)._
