# Попълване на ВСИЧКИ Android форми в Huawei AppGallery Connect — NewsLator

Път: Apps and atomic services → таб **Android** → бутон **Release**. Формите се попълват ПОСЛЕДОВАТЕЛНО (стойностите за копиране са в блоковете).

---

## Форма 1 — диалог „New app"

| Поле | Стойност |
|---|---|
| **Package type** | **APK (Android app)** (НЕ „RPK (quick app)") |
| **Devices supported** | **Mobile phone** |
| **App name** | `NewsLator` |
| **App category** | **News (Новини)** |
| **Default language** | **English (UK)** |
| **Add to project** | без отметка |

→ **OK**

---

## Форма 2 — App information (Localization)

**Compatibility → Compatible devices:** ✅ **Mobile phone** (Tablet/Watch — не)
**Localization → Language:** English (UK) - default

**App name:**
```
NewsLator
```

**Brief introduction** (до 25 знака), **Full introduction** (до 8000 знака) и **New features** (до 1000 знака):
→ вземи ги от файла **`publish/descriptions-languages.md`** — там и трите са локализирани за
езиците, които AppGallery поддържа (без кыргызки). За English (UK, default) ползвай секцията
„English (en)"; другите се задават последователно през **Manage languages** от същия файл.

**Icon** (квадратна 512×512 PNG): качи `publish/icon-512.png` (същата икона като в APK-то).

---

## Форма 3 — Visual assets → Screenshots (задължително, 3–8 бр.)

Качи 8-те екрана от `publish/` (на РАЗЛИЧНИ езици — да се вижда, че има преводи), в реда:
`1-language-picker.png` · `2-english.png` · `3-bulgarian.png` · `4-arabic.png` (RTL) ·
`5-hindi.png` · `6-japanese.png` · `7-chinese.png` · `8-german.png`.
(Introduction/Promotion video — по избор.)

---

## Форма 4 — Categorization

**Category:**
```
News (Новини)
```

---

## Форма 5 — Service information

Provider / Developer name — вече попълнени (Dai Grup Ltd.).
**Website:** по избор — може да се остави празно.
Имейл за поддръжка (в раздела за контакти/поддръжка): `dai.group.ltd.support@gmail.com`

---

## Форма 6 — „New version - Draft" (версията + законовите полета)

**App version → App version:** натисни **Manage packages** → качи
`apk/newslator-huawei-release.apk` (release, подписан). Пакетът `com.kcy.newslator.hw` идва от APK-то.
⚠️ Ако смениш държавите/регионите СЛЕД качване, Huawei иска **повторно качване на APK-то**
(съобщение „contract signing entity has changed … upload an app package again") — просто качи
пак СЪЩИЯ файл през Manage packages. Нормална стъпка, нищо по файла не се променя.

**Payment information → Payment type:** **Paid** — цена **1.00 USD**.
Стъпки: (1) приеми **Huawei Merchant Service Agreement** (линкът до „Paid") — задължително за
получаване на пари; (2) до **Price (tax included)** натисни **View and edit** → въведи базова цена
**1.00 USD** (Huawei авто-попълва другите валути) → **Save**; (3) **Submit** отново — грешката
„Edit and save the price" изчезва, щом цената е записана.
Забележки: Huawei удържа комисиона (~15%); настрой банкова сметка за изплащане (Finance/Payout).

**In-app purchases:** нищо не отмятай (приложението няма вътрешни покупки — цената е еднократна при сваляне).

**Privacy statement:**
| Поле | Стойност |
|---|---|
| **Privacy policy URL** (задължително) | `https://selflearning.bot.nu/privacy/newslator/hw-privacy.html` |
| **Data subject right URL** | остави празно (може да е същият адрес) |

**Privacy tags → Collect personal data:** **No** (приложението не събира лични данни — няма профили/вход, само локални настройки).

**AI function declaration → Generative AI service:** **Not involved**
(приложението само превежда и чете новини; няма генеративен ИИ).

**Copyright information → Proof of copyright:** ти сме собственик на кода — при поискване
качи документ/декларация от Dai Grup Ltd. (или екранна снимка на репозитория). Често не е
задължително за първо подаване — попълни ако системата го изисква.

**Filing information (китайско ICP/MIIT изискване) → РЕШЕНИЕ: махни континентален Китай от разпространението.**
Тази секция иска Filing entity + Organization code, проверени в китайското министерство (MIIT) —
т.е. РЕАЛНО китайско ICP разрешително + китайско юр. лице/организационен код. НЯМАМЕ такова.
Секцията е задължителна САМО защото континентален Китай е сред целевите пазари. Затова:
1. Иди в **Countries/Regions за разпространение** → **изключи „Chinese mainland" / China**.
2. Върни се на „Filing information" — щом Китай (mainland) не е целеви пазар, секцията вече НЕ е
   задължителна и грешката „One or more errors ... Filing information" изчезва.
⚠️ НЕ избирай „Standalone app" (значи БЕЗ мрежа, а NewsLator ползва мрежа → пада на проверка) и НЕ
избирай „App server is in Chinese mainland". Приложението остава достъпно във всички ДРУГИ региони.
Таргетираме Тайван (zh-Hant, традиционен китайски), не континентален Китай (там е zh-CN, който нямаме).

**Family sharing:** **изключено** (не отмятай). Важи само за приложения в китайския
континентален пазар и при платено съдържание. NewsLator е безплатно и без покупки → неприложимо.

**For reviewer:**
- **Sign-in required:** без отметка (няма вход в приложението).
- **Remarks** (инструкция за рецензента, копирай):
```
No account or sign-in is required. On first launch, choose an interface language, then pick a country to read its latest news. The headlines are automatically translated into the selected language. Tap the speaker icon on a headline (or "Read all") to have it read aloud via the device's text-to-speech. You can change country and language anytime from the tabs.
```

**Release → Release time:** **Immediately once approved**.

→ Горе вдясно **Save**, после **Submit**.

### Privacy policy URL — хостване (готово в кода)
Адресът е ПОСТОЯНЕН — не се сменя, докато приложението е активно в магазина.
Privacy страницата за Huawei е `public/privacy/newslator/hw-privacy.html` → при деплой отива в
`/var/www/html/privacy/newslator/hw-privacy.html` и се сервира на
**`https://selflearning.bot.nu/privacy/newslator/hw-privacy.html`** (nginx блокът `/privacy/` е добавен
в `08-setup-domain.sh`). За RuStore има отделна страница на
`https://selflearning.bot.nu/privacy/newslator/ru-privacy.html`. След деплой (опция 2/5 + опция 8 за
домейните) адресът е публичен по HTTPS и се попълва в полето. НЕ ползваме offbitch.com (счупен).

---

## Всички поддържани езици
Кратко (Brief) и пълно (Full) описание за всеки език са в **`publish/descriptions-languages.md`**.
През **Manage languages** добавяш всеки език и попълваш от там, последователно. Снимките важат за всички езици.

## Двоичен файл (за качване)
`apk/newslator-huawei-release.apk` — **release, подписан** (не debug). Пакет `com.kcy.newslator.hw`.
