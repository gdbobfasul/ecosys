# ⚙️ Pupikes Дом — настройки и ключове (пълен справочник)

Всичко, което се конфигурира: променливи на средата, ключове, пароли, портове, домейни — и **къде**
се задава всяко. За push известията има отделен, подробен файл: **[FCM.md](FCM.md)**.

---

## Два слоя на конфигурация

| Слой | Файл | Кога | Кой чете |
|---|---|---|---|
| **Локален** (разработка/тест) | `private/pupikes-dom/.env` | пускаш локално (точка 94) | `src/config.cjs` директно |
| **Сървърен** (продукция) | `private/configs/.env` (глобалният) | деплой (точка 95 / точка 2) | скрипт `35-setup-pupikes-dom-service.sh` → подава към услугата |

На сървъра ключовете са с префикс **`PUPIKES_DOM_`** (изолирани от порталите), а скриптът ги „превежда"
към вътрешните имена, които приложението чете. Затова долу има две колони.

---

## 1) Основни настройки

| Вътрешно (local `.env`) | Сървърно (`PUPIKES_DOM_…`) | По подразбиране | За какво |
|---|---|---|---|
| `PORT` | `PUPIKES_DOM_PORT` | локално **8080** · сървър **3018** | порт на сървъра |
| `JWT_SECRET` | `PUPIKES_DOM_JWT_SECRET` | dev ключ / авто-генериран на сървъра | подписване на входа (JWT). На прода се генерира траен веднъж и се пази в `.env`. |
| `DATABASE_URL` | `PUPIKES_DOM_DATABASE_URL` | (празно → **SQLite**) | Postgres връзка. Празно = SQLite в `data/pupikes-dom.sqlite`. **Изолиран** от глобалния DATABASE_URL на порталите. |
| `SQLITE_FILE` | — | `data/pupikes-dom.sqlite` | път до SQLite файла (само локално/тест) |

## 2) Seed акаунти (център и админ при първо пускане)

Създават се автоматично при първо пускане, ако липсват. Паролите се **сменят в продукция**.

| Вътрешно | Сървърно | По подразбиране |
|---|---|---|
| `CENTER_EMAIL` | `PUPIKES_DOM_CENTER_EMAIL` | `center@pupikes.local` |
| `CENTER_PASS` | `PUPIKES_DOM_CENTER_PASS` | `bgmasters` |
| `ADMIN_EMAIL` | `PUPIKES_DOM_ADMIN_EMAIL` | `admin@pupikes.local` |
| `ADMIN_PASS` / `<ROLE>_PASS` | — | fallback към `CENTER_PASS` |

> Собственик/Специалист НЕ се seed-ват — регистрират се сами от своите приложения. Модератор/Админ се
> създават от Център (освен seed-натия админ).

## 3) Push известия (FCM) — вж. [FCM.md](FCM.md) за стъпките

| Вътрешно | Сървърно | Какво |
|---|---|---|
| `FCM_SA` | `PUPIKES_DOM_FCM_SA` | път до **service-account JSON** (модерен FCM HTTP v1, препоръчано) |
| `FCM_SERVER_KEY` | `PUPIKES_DOM_FCM_KEY` | легаси ключ (Google го спира — само ако проектът още го поддържа) |
| — | — | клиент: `apps/google-services.json` (включва push в APK при билд) |

Ред на избор в `src/push.cjs`: **v1 (FCM_SA) → легаси (FCM_SERVER_KEY) → само лог**. Без нищо — приложението
работи, просто без известия.

## 4) Билд на приложенията (обвивки)

Използва се от **точка 95 → приложения** (или `apps/build.cjs`):

| Настройка | Как | По подразбиране |
|---|---|---|
| домейн на сървъра | `--domain <домейн>` или env `PUPIKES_DOM_DOMAIN` или въпрос в менюто | `take.offbitch.com` (от `apps/roles.json`) |
| кои апаве | `--only apk` / `--only exe` / `--roles owner,tech,…` | всички |
| push в APK | слагаш `apps/google-services.json` | изключен ако липсва |

Ролите/пакетите са в **`apps/roles.json`**: owner/tech/mod/admin/center → `com.daigroup.pupikesdom.<role>`
(namespace еднакъв, applicationId различен). Обвивката зарежда роля-страницата от сървъра (`server.url`).

---

## Пример — сървърен `private/configs/.env` (продукция)

```ini
# Pupikes Дом
PUPIKES_DOM_PORT="3018"
# JWT се генерира сам, ако не го сложиш
PUPIKES_DOM_CENTER_EMAIL="center@твоя-домейн"
PUPIKES_DOM_CENTER_PASS="силна-парола"
PUPIKES_DOM_ADMIN_EMAIL="admin@твоя-домейн"
# Push (по избор): сложи service-account JSON на трайно място и дай пътя
PUPIKES_DOM_FCM_SA="/var/www/kcy-ecosystem/private/configs/pupikes-dom-fcm.json"
# Postgres вместо SQLite (по избор):
# PUPIKES_DOM_DATABASE_URL="postgres://user:pass@host:5432/pupikes_dom"
```

## Пример — локален `private/pupikes-dom/.env` (тест)

```ini
PORT=8080
CENTER_PASS=bgmasters
# FCM по избор локално:
# FCM_SA=./fcm-service-account.json
```

---

## Къде се задава какво (накратко)

- **Порт/база/пароли на прода** → `private/configs/.env` с `PUPIKES_DOM_*` → **точка 95 (само сървъра)**.
- **Push ключ (сървър)** → service-account JSON + `PUPIKES_DOM_FCM_SA` → **точка 95 (само сървъра)**.
- **Push в приложенията** → `apps/google-services.json` → **точка 95 (приложения)**.
- **Локален тест** → `private/pupikes-dom/.env` → **точка 94 → 1** (старт) / **4** (demo данни).

*⚠️ Тайните (`.env`, service-account JSON, `google-services.json`) са в `.gitignore` — не влизат в git.*
Свързано: [README.md](README.md), [FCM.md](FCM.md), [RULES.md](RULES.md).
