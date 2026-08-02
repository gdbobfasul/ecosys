# Публикуване в RuStore — Pupikes Field Battle

_Автоматичен индекс (deploy-scripts/gen-publish-index.mjs). САМО за RuStore. За Huawei виж `PUBLISHING-HUAWEI.md`._

- **RuStore пакет:** `com.pupikes.hmm.rustore`
- **Билд (APK/AAB):** `apk/rustore/release/Pupikes-Field-Battle-rustore-release.apk` (подписан; строи се от меню „билд/качване").
- **Портал:** [RuStore Console](https://console.rustore.ru/) → **създай НОВО приложение**.

> ⚠️ **Нов пакет (Pupikes) — създай НОВО приложение, не обновявай старото.**
> Пакетът е `com.pupikes.hmm.rustore`. RuStore, както Huawei, **не позволява** смяна на пакета на съществуващ запис.
> Създай **ново приложение** с **applicationId = `com.pupikes.hmm.rustore`** и качи APK-то там. Ако е съществувал стар
> пакет — свали го след одобрение на новия; отзивите/инсталациите не се пренасят.

### Документи в тази папка
| Поле в конзолата | Източник | Файл |
|---|---|---|
| Име / описание / категория | суровите текстове по език | [`store-listing/`](./store-listing/), [`descriptions-languages.md`](./descriptions-languages.md) |
| Икона | 512×512 | [`icon-512.png`](./icon-512.png) |
| Екранни снимки | 1–10; същите като за Huawei | [`screenshots/`](./screenshots/) |
| Разрешения (обосновка) | кои разрешения и защо — за декларацията в конзолата | [`app-profile.json`](./app-profile.json) |
| Монетизация | модел; при плащания — RuStore Pay SDK | [`monetization.json`](./monetization.json) |
| **Политика за поверителност (руски)** | подава се като URL в RuStore Console + в апа | [`rustore-privacy.html`](./rustore-privacy.html) → `https://selflearning.bot.nu/privacy/hmm/rustore-privacy.html` |
| ⚠️ Анализ за качване | слаби места и вероятни причини за връщане — прегледай ПРЕДИ подаване | [`analyse.rustore`](./analyse.rustore) |

---

## Форма поле-по-поле (RuStore Console → **Новое приложение**)

### 1. Основни данни
| Поле | Стойност |
|---|---|
| applicationId | `com.pupikes.hmm.rustore` |
| Название приложения | `Pupikes Field Battle` |
| Категория | Инструменты |
| Язык интерфейса конзоли | Русский или English |

### 2. Описание (по език)
| Поле | Източник |
|---|---|
| Краткое описание | `store-listing/ru.txt` (и по език) / `descriptions-languages.md` → Brief |
| Полное описание | `store-listing/ru.txt` / `descriptions-languages.md` → Full |
| Что нового | `descriptions-languages.md` → New features |

### 3. Графика
| Поле | Стойност |
|---|---|
| Иконка | `icon-512.png` (512×512) |
| Скриншоты | `screenshots/` (1–10) — налични 8 |

### 4. Разрешения и данни
- **Политика конфиденциальности (URL):** `https://selflearning.bot.nu/privacy/hmm/rustore-privacy.html` (адрес; същата се отваря и в апа).
- Разрешения (обосновка за модерацията):
- Без чувствителни разрешения (без камера/микрофон/локация).
- Сеть: нет.
- Сбор персональных данных: **нет** · Аккаунт/вход: **нет**.
- 152-ФЗ: операторът на данните си **ти** (не RuStore); при данни на руски граждани важи локализация в Русия.

### 5. Монетизация
| Поле | Стойност |
|---|---|
| Модель | Платно — RuStore Pay SDK (виж monetization.json) |

### 6. Билд
| Поле | Стойност |
|---|---|
| APK/AAB | качи `apk/rustore/release/Pupikes-Field-Battle-rustore-release.apk` |

### 7. Преди подаване
Прегледай `analyse.rustore` → **Отправить на модерацию**.

_Политика онлайн (RuStore): `https://selflearning.bot.nu/privacy/hmm/rustore-privacy.html` — качва се на сървъра при билд/деплой (задължителния етап)._
