<!-- Version: 1.0 -->
# 🗄️ Бази данни по проект — ЕДИНСТВЕН каноничен източник

> Това е **единственото** място, където се описва кой проект на каква база данни
> работи. Ако намериш същата информация на друго място в `docs/`, тя трябва да
> сочи насам (а не да дублира таблицата). Обновено: 2026-06-11.

Легенда за „Режим":
- **двоен** — приложението има отделни нативни заявки за PostgreSQL и за SQLite
  (`queries/pg/*` и `queries/sqlite/*`), избира се по app-префиксиран `.env` ключ,
  БЕЗ runtime преводач.
- **само PostgreSQL** — нативни `$1,$2`, `ON CONFLICT`, `RETURNING` (по замисъл).
- **само SQLite** — `better-sqlite3` (по замисъл, няма PG вариант).

## Таблица: проект → база данни

| Проект | Порт | База данни | Режим | `.env` ключ за избор | Връзка/файл |
|---|---|---|---|---|---|
| **Chat (AMS Chat)** | 3000 | PostgreSQL **или** SQLite | **двоен** | `CHAT_DB_TYPE` (`postgresql`/`sqlite`) | `CHAT_PG_*`, `CHAT_SQLITE_DB_FILE` |
| **Eco-3** (AI студио) | 3001 | PostgreSQL **или** SQLite | **двоен** | `ECO3_DB_TYPE` (`postgresql`/`sqlite`) | `ECO3_PG_*`, `ECO3_DB_PATH` |
| **Find-Best-Price (FBP)** | 3012 | PostgreSQL | само PostgreSQL | — | `FBP_PG_*` |
| **House-Look-Book (HLB)** | 3010 | PostgreSQL | само PostgreSQL | — | `HLB_PG_*` |
| **WhereNoBiz (WNB)** | 3011 | PostgreSQL | само PostgreSQL | — | `WNB_PG_*` |
| **Portals** (услуги+игри) | 3002 | SQLite | само SQLite | — | `PORTALS_DB_PATH` |
| **Token-Monitor** ×3 | 3020 / 3021 / 3022 | SQLite (отделна база за всеки токен) | само SQLite | — | `TOKEN_MONITOR_PORT` / `BRCH1_MONITOR_PORT` / `MULTISIG_MONITOR_PORT` |

## Проекти БЕЗ база данни

Нямат БД — нищо за конфигуриране по този ред:

- **robot** — Playwright/RPA тестов робот (взаимодейства с другите приложения).
- **token-creator** — ethers.js деплой CLI.
- **brch1**, **multisig**, **token** — Hardhat смарт-контракти на блокчейн.
- **mobile-chat**, **mobile-find-best-price** — React Native клиенти (без вътрешен сървър/БД; ползват API на съответния backend).

## Правила (важни)

1. **БЕЗ runtime преводач.** Никакъв `pgify`/`toPg`/автоматична замяна `?`→`$n`. Всяка
   заявка е написана явно за своя диалект в `queries/pg/*` или `queries/sqlite/*`.
   (Потребителят изрично забрани преводача.)
2. **`.env` ключовете са app-префиксирани** — `CHAT_DB_TYPE`, `ECO3_DB_TYPE`,
   `FBP_PG_*` и т.н. НИКОГА генерични (`DB_TYPE`, `SQLITE_DB_FILE`).
3. **Portals и Token-Monitor остават само SQLite** — по решение на потребителя
   (2026-06-11). Да НЕ се предлага миграция към двоен диалект.
4. Диалектни разлики (за справка при писане на нови заявки):
   - дата „сега": SQLite `datetime('now')` → PG `now()` или `to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')` (когато колоната е TEXT).
   - плейсхолдъри: SQLite `?` → PG `$1,$2,…`.
   - `INSERT OR IGNORE` → `ON CONFLICT … DO NOTHING`.
   - `GROUP_CONCAT` → `string_agg`.
   - `lastInsertRowid` → `RETURNING id`.

## По-подробна документация (механизъм, не таблица)

- Chat двоен режим / fallback / setup: `docs/chat/CHAT-DATABASE-DUAL.md`,
  `docs/chat/DATABASE-SETUP-IMPROVEMENTS.md`.
- Eco-3 спецификация: `docs/eco-3/ECO3-SPEC.md`.
- Деплой на базите (скрипт `07-setup-database.sh`): `docs/DEPLOY-SCRIPTS-README.md`.
