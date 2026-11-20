# 🔔 Pupikes Дом — push известия (FCM)

Как телефонните приложения получават **известия със звук**, дори когато са затворени. Използва се
**Firebase Cloud Messaging (FCM)** — безплатната услуга на Google за Android.

Нужни са **две неща** (взимат се веднъж, безплатно):

| Къде | Файл | За какво |
|---|---|---|
| **В приложенията** (клиент) | `google-services.json` | свързва APK-то с твоя Google проект |
| **На сървъра** | service-account JSON | с него сървърът ПРАЩА известията (модерен FCM HTTP v1) |

Приложенията и сървърът работят и **без** тези файлове — просто няма известия. Щом ги сложиш, push тръгва.

---

## 1) Създай Firebase проект (≈5 мин)

1. Отвори **https://console.firebase.google.com** (с твой Google акаунт) → **Add project** → име напр. „Pupikes Dom".
2. Може да изключиш Google Analytics (не е нужен).

## 2) Клиентската част — `google-services.json`

1. В проекта → **Add app → Android**.
2. Добави **всичките пакети на ролите** (по един Android app на пакет, в СЪЩИЯ проект):
   - `com.daigroup.pupikesdom.owner`
   - `com.daigroup.pupikesdom.tech`
   - `com.daigroup.pupikesdom.mod`
   - `com.daigroup.pupikesdom.admin`
   - `com.daigroup.pupikesdom.center`
3. Свали **`google-services.json`** (той съдържа всички добавени пакети) и го сложи тук:
   ```
   private/pupikes-dom/apps/google-services.json
   ```
4. Билдни приложенията през **старт-меню точка 95 → „само приложенията"** (или „Всичко").
   Билдът сам открива файла и **включва push** в APK-тата (добавя плъгина + Google services plugin).
   Без файла → прави чист APK без известия.

## 3) Сървърната част — service-account ключ

1. Firebase конзола → ⚙ **Project settings → Service accounts → Generate new private key** → сваля се JSON.
2. Сложи го на сървъра на трайно място (НЕ се трие при деплой), напр.:
   ```
   /var/www/kcy-ecosystem/private/configs/pupikes-dom-fcm.json
   ```
3. В глобалния `.env` (`private/configs/.env`) добави пътя:
   ```
   PUPIKES_DOM_FCM_SA="/var/www/kcy-ecosystem/private/configs/pupikes-dom-fcm.json"
   ```
4. Пусни **старт-меню точка 95 → „само сървъра"** (или точка 2). Услугата `kcy-pupikes-dom` ще
   чете ключа и ще праща реални известия.

> Алтернатива за локален тест: сложи файла като `private/pupikes-dom/fcm-service-account.json` —
> сървърът го открива автоматично (виж `src/config.cjs` → `FCM_SA`).

---

## Как работи (технически)

- **Клиент** (`web/app.js` → `registerPush`): в нативната обвивка иска разрешение, регистрира се за push
  през `@capacitor/push-notifications`, взима FCM токен и го праща на сървъра (`POST /api/device`).
  В браузър или без Firebase → тихо не прави нищо (приложението работи).
- **Сървър** (`src/push.cjs` → `sendToUsers`): праща при нов/насочен сигнал. Ред на избор:
  1. **FCM HTTP v1** (ако `FCM_SA` сочи към валиден service-account JSON) — препоръчано.
  2. **Легаси** (ако има `FCM_SERVER_KEY`) — Google го спира, само ако проектът още го поддържа.
  3. **Само лог** (ако няма нищо).
- Звукът (`emergency` / `problem`) върви в payload-а — еднакъв за сървъра и клиентите.

## Проверка

- Сървърният лог показва `[push v1] …` при грешка или тихо изпраща при успех; без ключ пише
  `[push] (без FCM ключ/акаунт) …`.
- На реален телефон: инсталирай APK-то, влез, и подай сигнал от друг акаунт → трябва да дойде известие.

*⚠️ Пази ключовете: `google-services.json` и service-account JSON НЕ се качват в git.*
