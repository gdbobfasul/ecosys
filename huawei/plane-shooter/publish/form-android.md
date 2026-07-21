# Android форма — plane-shooter

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
| App package | Manage packages → качи `apk/plane-shooter-huawei-release.apk` |
| Payment type | **Free**. |
| In-app purchases | нищо |
| Privacy policy URL | `https://selflearning.bot.nu/privacy/plane-shooter/hw-privacy.html` |
| Data subject right URL | празно |
| Collect personal data | **No** |
| Generative AI service | **Not involved** |
| Filing information | махни **Chinese mainland** от Countries/Regions → секцията изчезва |
| Copyright proof | празно (попълни само ако системата поиска) |
| Family sharing | изключено |
| Countries/Regions | Всички освен **Chinese mainland** |
| Sign-in required | без отметка (няма вход) |
| Release time | Immediately once approved |

**For reviewer → Remarks** (копирай):
```
No account, login or internet connection is needed. Launch the app, pick a language on first run, and tap Start to play. Control the plane to shoot enemies and progress through the 10 levels. Everything runs offline on the device. This app is FREE and contains cross-promotion ads for our own other apps (house ads) shown at start, mid-session and game over; each ad is closeable. Note: this build asks for the code word "кокошка" (kokoshka) after 4 days of use.
```

→ **Save** → **Submit**.

---
APK за качване: `apk/plane-shooter-huawei-release.apk` (release, подписан). Пакет: `com.pupikes.planeshooter.hw`.
Privacy е хостнат на `https://selflearning.bot.nu/privacy/plane-shooter/hw-privacy.html` (RuStore: `.../ru-privacy.html`) — публичен след деплой.
