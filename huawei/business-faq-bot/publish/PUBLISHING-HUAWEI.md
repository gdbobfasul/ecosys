# Публикуване в Huawei AppGallery — Pupikes FAQ Desk

_Автоматичен индекс (deploy-scripts/gen-publish-index.mjs). САМО за Huawei. За RuStore виж `PUBLISHING-RUSTORE.md`._

> 🤖 **Правило за бота:** попълва всички полета **видимо** (ти гледаш как ги въвежда), но **НЕ натиска** OK / Next / Save / Submit / „Продължи". На всяка страница спира — **ти преглеждаш данните и натискаш бутона сам**. Публикуване само с твое действие.

- **Huawei пакет:** `com.pupikes.businessfaqbot.hw`
- **Билд (APK/AAB):** `apk/huawei/release/Pupikes-FAQ-Desk-huawei-release.apk` (подписан; строи се от меню „билд/качване").
- **Портал:** [AppGallery Connect](https://developer.huawei.com/consumer/en/service/josp/agc/index.html) → My apps → **създай НОВО приложение**.

> ⚠️ **Нов пакет (Pupikes) — създай НОВ запис, не обновявай стария.**
> Пакетът е `com.pupikes.businessfaqbot.hw`. AppGallery **не позволява** смяна на пакета на съществуващ запис — ако качиш
> в стар запис с друг пакет, отказва с „_the name of the uploaded package is different…_". Затова:
> 1. **My apps → New app** и задай **Package name = `com.pupikes.businessfaqbot.hw`** (фиксира се веднъж — точно това).
> 2. Попълни данните по таблицата долу и качи APK-то в **новия** запис.
> 3. Ако е съществувал стар пакет — свали го от продажба СЛЕД одобрение на новия. Отзиви/инсталации **не се пренасят**.

### Документи в тази папка
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

---

## Форма поле-по-поле (Apps and atomic services → таб **Android** → бутон **Release**)

### 1. New app
| Поле | Стойност |
|---|---|
| Package type | APK (Android app) |
| Devices supported | Mobile phone |
| App name | `Pupikes FAQ Desk` |
| App category | **App** (selectbox само с App / News — за обикновено приложение избери **App**; „News" е специалният новинарски тип на Huawei) |
| Default language | English (UK) |
| Add to project | без отметка |

→ **OK** _(съдържателната категория „Business" се задава по-късно — на екрана Categorization/App information, не тук)_

### 2. App information (Release app → App information)
Горните полета са автоматични (само за четене): **Package type: APK · App ID: (Huawei го дава) · Devices supported: Mobile phone**.
| Поле | Стойност / източник |
|---|---|
| **Compatibility → Compatible devices** | отметни **Mobile phone** (Tablet — не) |
| Language | English (UK) — default |
| App name | `Pupikes FAQ Desk` |
| Brief introduction | `descriptions-languages.md` → English → **Brief** |
| Full introduction | `descriptions-languages.md` → English → **Full** |
| New features | `descriptions-languages.md` → English → **New features** |
| App icon | качи `icon-512.png` |

→ **Save** → **Next**

Другите езици: **Manage languages** → за всеки ред долу: Search → отметни точния етикет → **OK**; после копирай Brief/Full/New features от `descriptions-languages.md` (или `store-listing/<език>.txt`).

#### Manage languages — езиците за ТОВА приложение (14 наши → 17 записа в Huawei)
Правило: ботът добавя САМО езиците, на които приложението е **реално преведено** (проверка: `store-listing/<код>.txt` ≠ en.txt). Ако нашият превод покрива няколко регионални варианта (English UK/US, Portuguese PT/BR, Traditional Chinese TW/HK), ботът избира **всички** и попълва **същия** превод и **същото име** за всеки.
| Наш код | Наш език | Huawei етикет(и) — отметни ВСИЧКИ | App name (локализирано) |
|---|---|---|---|
| en | English | English (UK) _(по подр.)_ + **English (US)** | Pupikes FAQ Desk |
| bg | Български | **Bulgarian** | Pupikes FAQ Desk |
| ru | Русский | **Russian** | Pupikes FAQ Desk |
| uk | Українська | **Ukrainian** | Pupikes FAQ Desk |
| de | Deutsch | **German** | Pupikes FAQ Desk |
| fr | Français | **French (France)** | Pupikes FAQ Desk |
| es | Español | **Spanish (Spain)** | Pupikes FAQ Desk |
| es-MX | Español (MX) | **Spanish (Latin America)** | Pupikes FAQ Desk |
| it | Italiano | **Italian** | Pupikes FAQ Desk |
| pt | Português | **Portuguese (Portugal)** + **Portuguese (Brazil)** | Pupikes FAQ Desk |
| ar | العربية | **Arabic** | Pupikes FAQ Desk |
| hi | हिन्दी | **Hindi** | Pupikes FAQ Desk |
| ja | 日本語 | **Japanese** | Pupikes FAQ Desk |
| zh-Hant | 繁體中文 | **Traditional Chinese (Taiwan, China)** + **Traditional Chinese (Hong Kong, China)** | Pupikes FAQ Desk |

- **Описания/име по език:** Brief/Full/New features от `descriptions-languages.md` (по код); App name от `store-names.json` (по код, иначе марката).
- **Не се избират:** ky (няма в Huawei).
- Разминавания: `es`→Spanish (Spain), `es-MX`→Spanish (Latin America) (отделни); `zh-Hant`→Traditional Chinese (Taiwan/Hong Kong) — НЕ „Chinese (PRC)" (опростен); `ru`→Russian + Belarusian (ботът пропуска етикет, ако липсва в списъка на Huawei).

### 3. Visual assets (Icon + Screenshots + Promotion video)
| Актив | Стойност |
|---|---|
| Icon | `icon-512.png` (216×216 или 512×512, PNG ≤2 MB) |
| **Screenshots** (задължително) | екраните от `screenshots/` (поне 3) — налични 8. Препоръка: избор на език, интро, съгласие, начален екран |
| Introduction videos | по избор — пропусни |
| **Promotion video** | по избор: **интрото на Pupikes** (брандово лого) — ЕДНО общо видео за ВСИЧКИ приложения. Файл: `app-shared/promo-pupikes.mp4` (1200×900, 4:3, H.264 mp4). Прегенерира се с `node deploy-scripts/render-promo-intro.cjs` |

### 4. Categorization (Distribute → App information → Categorization → Category)
Изборът е дърво. Навигирай точно така (3-то ниво е определено от нас — потвърди в падащото меню):
| Ниво | Избери |
|---|---|
| 1 (тип) | **Apps** |
| 2 (категория) | **Business** |
| 3 (под-категория) | **Business** |

**Пълен път:** `Apps > Business > Business`

### 5. Service information
| Поле | Стойност |
|---|---|
| Provider / Developer | Dai Grup Ltd. |
| Website | **https://pupikes.com** |
| Support email | miroljubkalaydjiev177@gmail.com |

### 6. Privacy & Data (правило 7.1 / 7.2)
- **Privacy policy URL:** `https://selflearning.bot.nu/privacy/business-faq-bot/hw-privacy.html` (подава се като **адрес**, НЕ се качва HTML). Същата политика се отваря и ВЪТРЕ в апа (footer + екран за съгласие).
- **Data collection декларация** — по `app-profile.json`:
- **Известия (POST_NOTIFICATIONS)** — локални известия
- Мрежа: да — потоците са описани в политиката (декларирай ги и в Privacy Tags).
- Събиране на лични данни: **не** · Акаунт/вход: **не**.

### 7. New version (билд)
| Поле | Стойност |
|---|---|
| App package | Manage packages → качи `apk/huawei/release/Pupikes-FAQ-Desk-huawei-release.apk` |
| Монетизация | Платено — HUAWEI IAP (виж monetization.json) |

### 8. Преди подаване
Прегледай `analyse.hw` (вероятни причини за връщане) → **Submit for review**.

> Забележки: при континентален Китай трябва китайска версия на политиката + copyright сертификат. Регионите Тайван/Хонконг се именуват като част от Китай.

_Политика онлайн (Huawei): `https://selflearning.bot.nu/privacy/business-faq-bot/hw-privacy.html` — качва се на сървъра при билд/деплой (задължителния етап)._
