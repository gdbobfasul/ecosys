---
name: kcy-authenticator
description: Ново приложение KCY Authenticator (2FA като Aegis/Google Auth) — мобилно rustore/huawei + уеб в Portal Services
metadata:
  type: project
---

Ново приложение **KCY Authenticator** — двуфакторни кодове, изградено по молба „едно към едно с Aegis / като Google Authenticator". Папка `authenticator`, appId `com.kcy.authenticator.{rustore|huawei}`.

**Обхват (потвърден от потребителя):** TOTP (RFC 6238) + HOTP (RFC 4226) + Steam Guard; **шифриран сейф** (AES-GCM + PBKDF2 210k, master парола) + **биометрия**; търсене/редакция/изтриване; импорт/експорт `.json`; авто-заключване. **15 езика** с екран за избор в началото, **дефолт руски**.

**Добавяне на акаунт — 4 начина** (по молба): (1) камера + jsQR, (2) **качване на файл с QR** (декодиране през jsQR), (3) ръчно, (4) поставяне на `otpauth://` линк.
**Export all (QR):** генерира по една QR картинка (PNG) за всеки акаунт и ги сваля в един **.zip** (`core/zip.js` — собствен store-ZIP с CRC32, без библиотека; `core/qrexport.js` ползва npm `qrcode`; уеб ползва vendor `qrcode.min.js`). ZIP-ът е валидиран (PowerShell Expand-Archive).
**Откриване на дубликати** (`core/dups.js` + `screens/dups.js`): групи по ЕДНАКВА ТАЙНА и по ПОДОБНИ ИМЕНА (Левенщайн ≥80% / съдържане); екран с отметки (по подразбиране всички ОСВЕН първия) и триене на избраните.

**Aegis импорт/експорт РЕАЛНО поправени (2026-06-28, APK 1.0251).** Потребителят пак каза „не импортва от Aegis, и експортът не работи". Node тест ДОКАЗА, че криптото (scrypt+AES-GCM `decryptAegisExport`) е 100% вярно (декриптира с вярна парола, отказва грешна, разпознава криптиран) → вината е във **файловото I/O на телефона**, НЕ логиката. Две истински причини: (1) **експортът ползваше `<a download>`, който Android WebView ИГНОРИРА тихо** → нищо не се сваляше; (2) **импортът имаше `accept=".json"`, който Android типизира като octet-stream и КРИЕ Aegis файла** в пикъра. Поправки: добавени `@capacitor/filesystem` + `@capacitor/share` (инсталирани в двата апа); нов `core/filesave.js saveFile()` — на телефона пише в кеша + отваря Споделяне (запази/изпрати), браузър пада към `<a download>`; `exporter.js`/`qrexport.js` минаха през него (async); импортните `<input type=file>` → `accept='*/*'`. Виж [[capacitorhttp-no-abortcontroller]] (друг Capacitor капан) и [[kcy-build-icon-injection]] (build прави cap sync всеки път → регистрира новите плъгини).

**Три цели, всички ПОСТРОЕНИ и ПРОВЕРЕНИ:**
- `rustore/authenticator/` и `huawei/authenticator/` — Vite билд минава (40 модула); само `src/theme.js` се различава между магазините. OTP логиката е тествана срещу официалните RFC 6238 вектори (287082 / 94287082 / 07081804 / 65353130 ✓).
- Уеб: `public/portals/services/authenticator.html` (самостоятелна, същата логика inline, собствен 15-езичен i18n) + регистрирана в `private/portals/routes/portal_services.js` (slug `authenticator`). OTP също RFC-проверен.

**Биометрия:** през Capacitor плъгини `@aparajita/capacitor-biometric-auth` + `@aparajita/capacitor-secure-storage` (паролата в Android Keystore), заредени ПРЕДПАЗЛИВО (динамичен import в try/catch) → деградира тихо до само-парола, ако липсват. npm install резолюва чисто.

Файлове: `src/core/{base32,otp,vault,storage,biometric,i18n,languages}.js`, `src/screens/{language,setup,unlock,list,add,edit,settings}.js`, `src/ui/{dom,styles}.js`, `src/main.js`, `theme.js`.

ОСТАВА: добавяне в `deploy-scripts/build-mobile-apps.sh` (APPS списък + версия) и в менюто за билд/деплой. Виж [[kcy-app-i18n-language-picker]] за общия езиков модел.
