<!-- Version: 1.0172 -->
# START Меню — справочник на всички точки

Менюто се пуска от `deploy-scripts/00-menu.sh`. Всяка точка по-долу е описана накратко;
в края има **сравнения на близки точки**, които често се бъркат.

> Бележка за `.env`: **опции 2 и 4** качват `.env` на сървъра (презаписват стария).
> Опции 5, 43-49, 52 НЕ носят `.env` — четат този, който вече е на сървъра.

---

# 🚀 Сценарии (кои точки, в какъв ред)

## Нова инсталация (нов сървър / VM)
1. **1) Bootstrap нов сървър + deploy** — само при напълно нов VPS: SSH ключ, пакети. (Накрая може да предложи deploy — пропусни и мини на 2.)
2. **2) ПЪЛНА ИНСТАЛАЦИЯ** — едно действие прави **всичко**:
   - deploy (код + `.env`) → npm install **автоматично** → бази HLB/WNB → услуги (`kcy-chat`/`eco3`/`portals` + `kcy-hlb`/`kcy-wnb`) → токен монитори.
   - Пита само: **„Да кача и асети?"** (дефолт НЕ) и **„Drop Databases?"** (дефолт НЕ изтрива).
   - Админите/модераторите се попълват от `.env` при старта на всяко приложение.
3. **33) Setup domain / SSL** — nginx + Let's Encrypt (изисква DNS A-запис).

> Преди опция 2: попълни **локалния** `.env` — той пътува с deploy-а. Опцията иска SSH достъп (sudo за server-скриптовете; ако не е в sudoers → ще иска парола, опция **30** я маха).
> Токен мониторите се вдигат, но бездействат, докато не впишеш адреса на токена в `.env`.

## Деплой на натрупани промени (вече инсталиран сървър)
1. **4) Deploy проекта** — код + `.env` (всички админ блокове, токен конфиг). Ако има нови зависимости (напр. `ethers`) → на въпроса за npm modules отговори **`y`**.
2. **5) Прехвърли само СОРС** — рестарт на уеб услугите (`kcy-chat`/`eco3`/`portals`/`hlb`/`wnb`) с новия код.
3. **52) Token Monitor** — (при нужда) настрой/обнови мониторите.

> Само код-промяна (без `.env`/нови зависимости) = само **опция 5**.
> Смяна на админ/модератор в `.env` = **опция 4** (носи `.env`) → после рестарт на съответния апп (опция 5 или 45-49).
> Пълно пресъздаване от 0 (вкл. триене на базите) = **опция 2** с отговор **„да"** на „Drop Databases?".

---

## ━━━ DEPLOY ━━━
- **1) Bootstrap нов сървър + deploy** — еднократно при нов VPS/VM: генерира SSH ключ на Windows, копира го на сървъра, инсталира пакети, накрая предлага deploy.
- **2) ПЪЛНА ИНСТАЛАЦИЯ на нов сървър** — едно действие: deploy (код+`.env`) → npm install (**авто**) → бази → **всички** услуги (`chat`/`eco3`/`portals` + `hlb`/`wnb`) → токен монитори. Пита само: **асети?** и **Drop Databases?** (дефолт и на двете = НЕ). За нов сървър или пълно пресъздаване.
- **4) Deploy проекта** — архивира **целия** код, качва, активира на production. **Презаписва сървърния `.env`.** Пита target: vm / prod / custom. (npm install **пита**, дефолт Не; вдига само chat/eco3/portals.)
- **5) Прехвърли само СОРС (бърз)** — качва **само кода** (без assets/npm/`.env`), overlay + рестарт на node услугите.
- **6) Прехвърли само АСЕТИ** — качва само `public/assets` (видеа/картинки/css) към web root. Без рестарт.

## ━━━ DATABASES (локални) ━━━
- **7) Init Portal база данни** — създава `portals.db` (users, payments, scores, jobs). Идемпотентно.
- **8) Init ECO-3 база данни** — създава `eco3.db` за AI Studio (и auto при старт на eco-3).
- **9) Portal DB stats** — таблици + брой записи (read-only).
- **10) Chat DB migrations** — прилага pending миграции за chat базата.

## ━━━ SMART CONTRACTS ━━━
- **11) Compile contracts** — Solidity → ABI + bytecode в `artifacts/` (всички / KCY / BRCH1).
- **12) Deploy KCY token (mainnet)** — деплой на KCY-meme-1 на BSC Mainnet. ⚠ реален BNB за gas, изисква `DEPLOY` confirm.
- **13) Deploy Multi-Sig (mainnet)** — деплой на Multi-Sig wallet на BSC Mainnet. ⚠ реален BNB. Адресът се записва в production `.env`.
- **14) Deploy BRCH1 token** — деплой на BeRicH 1. testnet = безплатно / mainnet = реален BNB. Пита коя мрежа.
- **15) Verify BRCH1 on BscScan** — качва source code за публична проверка.

## ━━━ TESTS ━━━
- **16) Run tests** — jest unit тестове (all / token / multisig / chat / mobile / portals / portals smoke).

## ━━━ SERVICES (локален dev) ━━━
- **17) Start chat service** — chat backend локално :3000 (prod node или dev nodemon).
- **18) Start eco-3 service** — ECO-3 backend локално :3001 (prod / dev).
- **19) Start all services** — chat + eco-3 паралелно (background).

## ━━━ EXPORT / BACKUP ━━━
- **20) Archive проекта** — `tar.gz` в `$HOME` (без node_modules/artifacts/cache).
- **21) SQLite DB → SQL dump** — `portal.db` + `eco3.db` → `.sql` в `$HOME/kcy-db-backup/`.
- **22) Portal users → CSV** — `portal_users` → CSV в `$HOME`.
- **23) Backup .env file** — копие на `.env` в `$HOME` с timestamp (perms 600).

## ━━━ CONFIG / MAINTENANCE ━━━
- **24) Show ENV-EXAMPLE** — показва `docs/ENV-EXAMPLE.env` (шаблон).
- **25) Edit .deploy-targets** — nano за deploy targets (prod/vm/custom).
- **26) Edit local .env** — nano за `private/configs/.env`.
- **27) Promote ENV-EXAMPLE → .env** — копира шаблона в `.env` (за първа настройка).
- **28) npm install (ЛОКАЛНО)** — `npm install --legacy-peer-deps` на **твоята машина** (за локален dev/тест, опции 16-19). **За СЪРВЪРА** node_modules се градят при опция **2** (пълна инсталация — авто) или опция **4** (пита, отговор `y`), НЕ с тази точка.
- **29) Clean caches** — ⚠ трие node_modules/artifacts/cache (после трябва npm install).

## ━━━ REMOTE COMMANDS (показват SSH команда) ━━━
- **30) Update sudoers на сървъра** — SSH cmd за update на sudoers (limited sudo за deploy user).
- **31) Setup wizard (.env)** — SSH cmd за интерактивна `.env` конфигурация на сървъра.
- **32) Setup / Reset database** — SSH cmd за DB setup. ⚠ с reset трие ВСИЧКИ production данни.
- **33) Setup domain / SSL** — SSH cmd за nginx + Let's Encrypt (изисква DNS A-запис).
- **34) Service status** — SSH cmd за `systemctl status kcy-chat kcy-eco3 nginx`.
- **35) View live logs** — SSH cmd за `journalctl -u ... -f`.

## ━━━ FAILOVER (VPS ↔ VM) ━━━
- **36) Setup Tailscale VPN** — инсталира Tailscale (VPS или VM) — нужно за failover.
- **37) Setup failover proxy (VPS)** — превръща nginx на VPS в reverse proxy към VM (VM primary, VPS поема при срив). Изисква Tailscale на двете.

## ━━━ INFO ━━━
- **40) Status & info** — версия, Node/npm, OS, deploy targets, локални DB файлове, дали node_modules е инсталиран.

## ━━━ НОВИ ПРИЛОЖЕНИЯ — УСЛУГИ (systemd+nginx, първа настройка) ━━━
- **43) HLB УСЛУГА** — systemd `kcy-hlb` (:3010) + nginx `/houselookbook/`, `/api/hlb/` + рестарт.
- **44) WNB УСЛУГА** — systemd `kcy-wnb` (:3011) + nginx `/wherenobiz/`, `/api/wnb/` + рестарт.

## ━━━ ПО ПРИЛОЖЕНИЕ — обнови (база + админи/модератори от .env + рестарт) ━━━
Всяка точка е **самостоятелна** — пипа само своето приложение (база + неговите админи/модератори от `.env` при старта му + рестарт на услугата му). Изпълнява `30-update-app.sh <app>`.
- **45) House-Look-Book — обнови** (база + админи + рестарт `kcy-hlb`).
- **46) WhereNoBiz — обнови** (база + админи + рестарт `kcy-wnb`).
- **47) Portals — обнови** (рестарт `kcy-portals` → схема + админи при старта).
- **48) Chat — обнови** (рестарт `kcy-chat` → попълва `admin_users` от `.env`).
- **49) ECO-3 — обнови** (рестарт `kcy-eco3`; админ = portals потребител, без попълване).

## ━━━ ОПАСНИ (двойно потвърждение) ━━━
- **50) Disable SSH password auth** — ⚠ само ключ за SSH. Само за сървъри с recovery console, НЕ за локалната VM.
- **51) Toggle kcy-admin sudo** — ⚠ добавя/маха kcy-admin от sudo групата. Двойно потвърждение.

## ━━━ ТОКЕН МОНИТОРИ (read-only индексатор/аналитика/аларми) ━━━
- **52) Token Monitor — настрой услуга (избери токен)** — вдига `kcy-tokmon-<токен>` (индексатор + dashboard + аларми) + nginx `/tokmon/<токен>/`. Подменю: token / brch1 / multisig / **ВСИЧКИ (Enter)**. Чете on-chain, БЕЗ ключове. Изисква `npm install` (ethers — опция 28). Бездейства, докато не впишеш адреса след деплой.

## ━━━ СВОБОДНИ НОМЕРА ━━━
**5, 6, 38, 39, 41, 42** → показват се като „СВОБОДЕН" (резервирани, незаети).
> Бел.: 38/39 (опасните) се преместиха на 50/51; 41/42 (HLB/WNB база) — функцията им сега е в „по приложение" 45/46.

---

# Сравнения на близки точки

## 4 / 5 / 6 — трите начина за качване на сървъра (а **2** = всичко наведнъж)
| | **4** Deploy | **5** Само СОРС | **6** Само АСЕТИ |
|---|---|---|---|
| Качва | целия проект | само кода | само `public/assets` |
| `.env` | **ДА** (презаписва) | не | не |
| npm / node_modules | пита (дефолт Не) | не | не |
| Рестарт на услугите | chat/eco3/portals | да | **не** |
| Кога | смяна на `.env`, структурни промени | ежедневни код промени | смяна на видеа/картинки/css |

> **2) ПЪЛНА ИНСТАЛАЦИЯ** = опция 4 + асети (по избор) + npm **авто** + бази (по избор Drop) + HLB/WNB услуги + токен монитори, наведнъж. За нов сървър / пълно пресъздаване.

## 45/46 (обнови) ↔ 43/44 (услуга) — HLB/WNB: различен слой
Не са „едното работа, другото само рестарт" — различен **слой**.

| | **45 / 46** (обнови) | **43 / 44** (УСЛУГА — първа настройка) |
|---|---|---|
| Слой | PostgreSQL база + рестарт | systemd услуга + nginx |
| Какво прави | обновява базата/схемата + **попълва админ/модератори от `.env`** (при старта) + рестарт | създава/обновява systemd unit-а (порт, права, ExecStartPre) + nginx маршрутите |
| Кога | смяна на админ/модератор в `.env`, обновяване | ПЪРВА настройка на услугата или промяна на unit-а/nginx |

> 45/43 = House-Look-Book (`kcy-hlb`) · 46/44 = WhereNoBiz (`kcy-wnb`).
> **Нов апп** = първо УСЛУГА (43/44, веднъж), после „обнови" (45/46) при нужда. **Само код** = опция 5.
> Всяко приложение само попълва своите админи/модератори при старта си (виж 45-49).

## 17 / 18 / 19 — локален старт на услуги (dev)
| | **17** | **18** | **19** |
|---|---|---|---|
| Стартира | chat :3000 | eco-3 :3001 | chat + eco-3 заедно |
| Режим | prod / dev (nodemon) | prod / dev | background |

## 12 / 13 / 14 — деплой на контракти (BSC)
| | **12** KCY token | **13** Multi-Sig | **14** BRCH1 token |
|---|---|---|---|
| Какво | KCY-meme-1 token | Multi-Sig wallet | BeRicH 1 token |
| Мрежа | mainnet | mainnet | пита: testnet / mainnet |
| Реален BNB | ⚠ да | ⚠ да | само на mainnet |
| Confirm | `DEPLOY` | `DEPLOY` | — |
