# Android форма — aip1-reunite

Път: **Apps and atomic services → таб Android → бутон Release.** Попълвай по реда отдолу.

> Името на приложението е единственото поле, което зависи от избора ти — навсякъде долу „App name" = името на приложението (източник: `capacitor.config.json` → `appName`). Останалото не се мени при смяна на име.

## 1. New app
| Поле | Попълни |
|---|---|
| Package type | APK (Android app) |
| Devices supported | Mobile phone |
| App name | името на приложението (източник: `capacitor.config.json` → `appName`) |
| App category | Lifestyle |
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
| Category | Lifestyle |

## 5. Service information
| Поле | Попълни |
|---|---|
| Provider / Developer | Dai Grup Ltd. (вече попълнено) |
| Website | празно |
| Support email | miroljubkalaydjiev177@gmail.com |

## 6. New version
| Поле | Попълни |
|---|---|
| App package | Manage packages → качи `apk/aip1-reunite-huawei-release.apk` |
| Payment type | **Paid** — цена **50.00 USD**. Приеми Merchant Service Agreement, въведи цената през „View and edit", Save. Махни **Russia** и **Belarus** от държавите. |
| In-app purchases | нищо |
| Privacy policy URL | `https://selflearning.bot.nu/privacy/aip1-reunite/hw-privacy.html` |
| Data subject right URL | празно |
| Collect personal data | **No** |
| Generative AI service | **Involved** |
| Filing information | махни **Chinese mainland** от Countries/Regions → секцията изчезва |
| Copyright proof | празно (попълни само ако системата поиска) |
| Family sharing | изключено |
| Countries/Regions | Всички освен **Chinese mainland**, **Russia**, **Belarus** |
| Sign-in required | без отметка (няма вход) |
| Release time | Immediately once approved |

**For reviewer → Remarks** (копирай):
```
No account or sign-in is required and internet is optional. On first launch pick one of 15 languages and continue past the intro and the policy screen. Fill in a lost or found post (type, category, title, description, place, date) and submit it to see the most likely matches with a similarity score against the sample posts; browse and filter lost vs found by category. This works fully offline with built-in on-device matching and demo data. To try the optional AI-assisted match explanation, open the gear/settings and enter your own AI proxy endpoint or Anthropic API key (stored only on the device); text is sent to that provider only when you explicitly request an explanation. All posts are stored locally and can be cleared. Note: this build includes a 4-day trial; after 4 days it asks for a code word to continue — the code word is "кокошка" (kokoshka).
```

→ **Save** → **Submit**.

---
APK за качване: `apk/aip1-reunite-huawei-release.apk` (release, подписан). Пакет: `com.pupikes.aip1reunite.hw`.
Privacy е хостнат на `https://selflearning.bot.nu/privacy/aip1-reunite/hw-privacy.html` (RuStore: `.../ru-privacy.html`) — публичен след деплой.
