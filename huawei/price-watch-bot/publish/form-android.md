# Android форма — price-watch-bot

Път: **Apps and atomic services → таб Android → бутон Release.** Попълвай по реда отдолу.

> Името на приложението е единственото поле, което зависи от избора ти — навсякъде долу „App name" = името на приложението (източник: `capacitor.config.json` → `appName`). Останалото не се мени при смяна на име.

## 1. New app
| Поле | Попълни |
|---|---|
| Package type | APK (Android app) |
| Devices supported | Mobile phone |
| App name | името на приложението (източник: `capacitor.config.json` → `appName`) |
| App category | Tools |
| Default language | English (UK) |
| Add to project | без отметка |

→ OK

## 2. App information
| Поле | Попълни |
|---|---|
| Compatible devices | само Mobile phone |
| Language | English (UK) - default |
| App name | името на приложението (източник: `capacitor.config.json` → `appName`) |
| Brief introduction | descriptions-languages.md → English → Brief |
| Full introduction | descriptions-languages.md → English → Full |
| New features | descriptions-languages.md → English → New features |
| Icon | качи `publish/icon-512.png` |

Другите езици: **Manage languages** → добави език → копирай от `descriptions-languages.md`.

## 3. Screenshots
Качи 8-те .png от `publish/` (различни езици): `1-language-picker.png`, `2-english.png`, `3-bulgarian.png`, `4-arabic.png`, `5-hindi.png`, `6-japanese.png`, `7-chinese.png`, `8-german.png`.

## 4. Categorization
| Поле | Попълни |
|---|---|
| Category | Tools |

## 5. Service information
| Поле | Попълни |
|---|---|
| Provider / Developer | Dai Grup Ltd. (вече попълнено) |
| Website | празно |
| Support email | dai.group.ltd.support@gmail.com |

## 6. New version
| Поле | Попълни |
|---|---|
| App package | Manage packages → качи `apk/price-watch-bot-huawei-release.apk` |
| Payment type | **Paid** — цена **1.00 USD**. Приеми Merchant Service Agreement, въведи цената през „View and edit", Save. Махни **Russia** и **Belarus** от държавите. |
| In-app purchases | нищо |
| Privacy policy URL | `https://selflearning.bot.nu/privacy/price-watch-bot/hw-privacy.html` |
| Data subject right URL | празно |
| Collect personal data | **No** |
| Generative AI service | **Not involved** |
| Filing information | махни **Chinese mainland** от Countries/Regions → секцията изчезва |
| Copyright proof | празно (попълни само ако системата поиска) |
| Family sharing | изключено |
| Countries/Regions | Всички освен **Chinese mainland**, **Russia**, **Belarus** |
| Sign-in required | без отметка (няма вход) |
| Release time | Immediately once approved |

**For reviewer → Remarks** (копирай):
```
No account or login is required. On first launch choose a language and activate the robot, then grant notifications and add a watch by picking a crypto or currency, a threshold and a direction. Internet is only used to read public exchange rates. Use 'Check now' to test; when a threshold is crossed a local notification is shown. The app only monitors prices; it does not buy, sell or hold assets. Note: this build includes a 4-day trial; after 4 days it asks for a code word to continue — the code word is "кокошка" (kokoshka).
```

→ **Save** → **Submit**.

---
APK за качване: `apk/price-watch-bot-huawei-release.apk` (release, подписан). Пакет: `com.kcy.pricewatchbot.hw`.
Privacy е хостнат на `https://selflearning.bot.nu/privacy/price-watch-bot/hw-privacy.html` (RuStore: `.../ru-privacy.html`) — публичен след деплой.
