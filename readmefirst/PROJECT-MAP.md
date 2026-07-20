# Pupikes — карта на проекта (за Claude Code)

Това е monorepo на **Pupikes екосистема** — мрежа от свързани уеб-приложения: крипто токен (BRCH1/KCY1), мултисиг портфейл, анонимен чат, портал за платени услуги и игри. Текуща версия: **1.0138** (виж файла `00039.version` — той винаги държи най-високата версия).

**Език на проекта:** интерфейсът е многоезичен (9 езика), но кодовите коментари, документацията и админ панелите са на български. Основният разработчик пише на български.

---

## Архитектура накратко

Проектът е разделен на три основни слоя:

- **`public/`** — всичко, което се сервира към браузъра (frontend): HTML страници, клиентски JS, CSS, преводи, медийни файлове.
- **`private/`** — server-side код (Node.js бекенди, Solidity контракти, бази данни). НЕ се сервира публично.
- **`deploy-scripts/`** — bash + PowerShell скриптове за деплой към сървъра.

---

## `public/` — Frontend (това вижда потребителят)

### `public/index.html`
Главната входна страница на цялата екосистема — линкове към порталите (услуги, игри), токена, чата.

### `public/shared/` — Споделени ресурси между всички страници
- `shared/js/i18n.js` — **системата за преводи.** Глобален обект `KCY_I18N`. Поддържа 9 езика. Чете `data-i18n="ключ"` атрибути от HTML и ги заменя с превод от JSON. Метод `KCY_I18N.t('ключ')` се ползва в JS код. Език се пази в localStorage (`kcy-lang`).
- `shared/js/navigation.js` — общата навигация/хедър + език-дропдаун (`#kcy-lang-select`).
- `shared/js/config.js` — клиентска конфигурация.
- `shared/css/` — общи стилове (common.css).
- `shared/admin-status.html` — споделен админ статус компонент (български, не се превежда).

### `public/translations/` — Преводни файлове
9 JSON файла: `en.json` (по подразбиране), `bg.json`, `ru.json`, `zh-Hant.json`, `hi.json`, `ar.json` (RTL), `de.json`, `it.json`, `es.json`. Всеки съдържа **894 ключа**. Структура: плосък обект `{"ключ": "превод"}`. Ключовете са с префикси по област: `nav.` `common.` `home.` `login.` `reg.` `billing.` `games.` `cp.`(chat profile) `cs.`(chat search) `cpay.`(chat payment) `mm.`(matchmaking) `sig.`(signal) `dl.`(download) `g.`(games) `chat.` `password.` `crypto.` `charts.` `pdf.` `qr.` и т.н. + bulk ключове `r.0`–`r.143`.
**ВАЖНО:** Ако добавяш нов видим текст в HTML — слагай `data-i18n="ключ"` и добавяй ключа във ВСИЧКИТЕ 9 JSON файла.

### `public/portals/` — Портал за платени услуги и игри
Достъп зад регистрация + месечна такса ($5/€5 или crypto).
- `login.html`, `register.html`, `billing.html` — вход/регистрация/плащане (Stripe + crypto).
- `index-services.html` — списък с услугите.
- `index-games.html` — списък с игрите + класация.
- `admin.html` — админ панел (български, не се превежда).
- **`portals/services/`** — 12-те услуги (всяка е самостоятелен HTML + inline JS):
  `password.html` (генератор на пароли), `text.html` (текстови инструменти), `pdf.html` (PDF инструменти + подпис), `pdf-compress.html`, `image.html` (компресор), `crypto.html` (валутен конвертор), `ai-listing.html` (AI обяви — ползва Anthropic API), `calc.html` (калкулатор), `qr.html` (QR), `scraper.html` (web скрапер), `charts.html` (борсови графики — TradingView/Coinglass), `watch20.html` (ценови нотификации).
- **`portals/games/`** — 9 аркадни игри (canvas + JS) + споделени engine файлове:
  `game-engine.js`, `battle-engine.js`/`battle-engine-v2.js`, `battle-heroes.js`/`battle-heroes-v2.js`. Игрите: battle-duel, battle-team, battle-standalone, car-drift, car-race, hero-jump, hero-run, plane-dodge, plane-shoot.

### `public/chat/` — Анонимен чат (самостоятелно приложение)
- `chat/index.html` — landing страница на чата.
- `chat/public/` — екраните на чата: `index.html` (login + "как работи"), `chat.html` (основен прозорец), `profile.html`, `search.html` (търсене по разстояние/нужда), `matchmaking.html` (запознанства), `payment.html`, `signal.html` (подаване на сигнали), `download.html`/`download/`.
- `chat/admin/` — админ (български).
- `chat/assets/` — медия за чата.
Чатът има собствен език-дропдаун на login екрана (няма общата навигация).

### `public/token/`, `public/brch1/`, `public/multisig/` — Крипто части
- `token/index.html` + `token/admin/` + `token/website/` (документация) — KCY1 токен.
- `brch1/index.html` + `brch1/admin/` — BRCH1 токен (deflationary BEP-20, halving, anti-snipe).
- `multisig/` — мултисиг портфейл UI (`multisig-control.html`, `kcy1-website.html`).
**ВАЖНО:** Токен страниците и техническите описания (auto-mint, halving, permissionless и т.н.) СА на български и НЕ се превеждат — потребителят практически не ги вижда.

### `public/eco-3/` — ECO-3 AI Studio (React .jsx app).

### `public/assets/` — Медийни файлове (391MB!)
- `assets/animations/` — суровите green-screen анимации за battle игрите (VP9 .webm). **Тези НЕ се качват на сървъра** (изключени от деплой опции 3/4). Голям обем — не ги пипай освен ако не работиш конкретно по анимациите.
- `assets/mobile-chat/` — медия за мобилния чат.

---

## `private/` — Backend (Node.js + Solidity), НЕ публично

### `private/chat/` — Чат сървър (Express)
- `server.js` — входна точка.
- `routes/` — API endpoints: `auth.js`, `messages.js`, `friends.js`, `profile.js`, `search.js`, `matchmaking.js`, `payment.js`, `signals.js`, `help.js`, `admin.js`.
- `middleware/`, `database/`, `utils/`, `configs/`, `uploads/`.

### `private/portals/` — Портал сървър (Express)
- `server.js` + `routes/`: `auth.js`, `billing.js`, `games.js`, `services.js`, `portal_admin.js`, `portal_games.js`, `portal_services.js`.
- `services/` — backend за услугите: `anthropic.js` (AI обяви), `scraper.js` (web скрапер).
- `database/`, `middleware/`, `configs/`.

### `private/token/` — Solidity смарт-контракти (Hardhat)
- `contracts/` — `kcy-meme-1.sol`, `SimpleMultiSig.sol`, `MockKCY1Distribution.sol`, `Addresses.sol`.
- `scripts/`, `artifacts/`, `cache/`, `config/`, `hardhat.config.js`, `website/`, `admin/`.

### `private/multisig/` — Мултисиг контракти (Hardhat, TypeScript)
- `contracts/`, `scripts/`, `ignition/`, `hardhat.config.cjs`, `public/`.

### `private/eco-3/` — ECO-3 backend (`server.js` + `database/`).
### `private/mobile-chat/` — Мобилно чат приложение (544KB).
### `private/shared/`, `private/configs/`, `private/diag/`, `private/brch1/`.

---

## Конфигурация и инструменти (root)

- `package.json` / `package-lock.json` — зависимости (отразява версията 1.0138).
- `00039.version` — **файлът с версията** (винаги най-високата). Бъмп-вай при всяка промяна.
- `hardhat.config.js` — Hardhat за токен контрактите.
- `jest.config.js`, `jest.mobile.config.js`, `jest.setup.js` — тестове.
- `start` — shortcut, който пуска `deploy-scripts/00-menu.sh` (админ меню).

## `deploy-scripts/` — Деплой
- `00-menu.sh` — интерактивно меню (стартира се с `./start`).
- `01-bootstrap.sh` — първоначална настройка на сървъра.
- `04-deploy.sh` — деплой.
- `sync-source.sh` (опция 3 — синк на изходния код), `sync-assets.sh` (опция 4 — синк на медия).
- `server/`, `windows/`, `update-sudoers.sh`.
**Бележка:** суровите green анимации (`public/assets/animations/*.webm`) се изключват от синка — само Deploy ги качва.

## `tests/` — Тестове по модул
`tests/chat/`, `tests/portals/`, `tests/token/`, `tests/multisig/`, `tests/mobile-chat/`, `tests/database/`, `tests/deploy-scripts/`. Пускат се с `tests/run-all-tests.sh`.

## `docs/` — Документация (български)
Деплой ръководства, structure docs, version changelog-ове, install инструкции. Поддиректории по модул: `docs/chat/`, `docs/token/`, `docs/multisig/`, `docs/mobile-chat/`, `docs/eco-3/`, `docs/install/`. **Документацията НЕ се превежда.**

---

## Правила и конвенции (важни при работа)

1. **Версия:** при всяка промяна бъмп-вай версията в `00039.version` И в `package.json` (трябва да съвпадат, файлът държи най-високата).
2. **Преводи:** нов видим текст → `data-i18n` атрибут + ключ във всичките 9 JSON. JS-генериран текст → `KCY_I18N.t('ключ')`. НЕ се превеждат: админ страници, токен страници, документация, коментари в кода.
3. **Крипто адреси:** НИКОГА не пипай/триши крипто адреси в кода без изрична заявка.
4. **Не пипай** `public/assets/animations/` освен при конкретна работа по анимации (огромен обем, изключен от деплой).
5. **Структура:** frontend в `public/`, backend в `private/`. Не смесвай.
6. **Валидация:** HTML промените да минават проверка; JSON да е валиден (9-те файла трябва да имат еднакъв набор ключове).
