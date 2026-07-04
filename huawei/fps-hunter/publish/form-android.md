# Android форма — fps-hunter

Път: **Apps and atomic services → таб Android → бутон Release.** Попълвай по реда отдолу.

> Името на приложението е единственото поле, което зависи от избора ти — навсякъде долу „App name" = името на приложението (източник: `capacitor.config.json` → `appName`). Останалото не се мени при смяна на име.

**Category = Games** → Huawei иска възрастов рейтинг (IARC въпросник). Попълни честно.

## 1. New app
| Поле | Попълни |
|---|---|
| Package type | APK (Android app) |
| Devices supported | Mobile phone |
| App name | името на приложението (източник: `capacitor.config.json` → `appName`) |
| App category | Games |
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
| Category | Games |

## 5. Service information
| Поле | Попълни |
|---|---|
| Provider / Developer | Dai Grup Ltd. (вече попълнено) |
| Website | празно |
| Support email | dai.group.ltd.support@gmail.com |

## 6. New version
| Поле | Попълни |
|---|---|
| App package | Manage packages → качи `apk/fps-hunter-huawei-release.apk` |
| Payment type | **Paid** — цена **1.00 USD**. Приеми Merchant Service Agreement, въведи цената през „View and edit", Save. Махни **Russia** и **Belarus** от държавите. |
| In-app purchases | нищо |
| Privacy policy URL | `https://selflearning.bot.nu/privacy/fps-hunter/hw-privacy.html` |
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
Launch the app; on first run pick a language and tap Start, then choose a starting level and press START. On phone use the left joystick to move, drag on the right side to aim, and tap the FIRE button to shoot the targets. No account, login, or internet connection is needed; an optional name for the local top-10 is the only input. Note: this build includes a 4-day trial; after 4 days it asks for a code word to continue — the code word is "кокошка" (kokoshka).
```

→ **Save** → **Submit**.

---
APK за качване: `apk/fps-hunter-huawei-release.apk` (release, подписан). Пакет: `com.kcy.fpshunter.hw`.
Privacy е хостнат на `https://selflearning.bot.nu/privacy/fps-hunter/hw-privacy.html` (RuStore: `.../ru-privacy.html`) — публичен след деплой.
