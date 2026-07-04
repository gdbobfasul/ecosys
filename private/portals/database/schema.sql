-- KCY Portals — Database Schema
-- Version: 1.0094
-- Engine: SQLite (better-sqlite3)

-- ═══════════════════════════════════════════
-- 1. Users
-- Първият user в таблицата е "admin" по смисъл — пряко в код проверяваме id=1
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS portal_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    stripe_paid_total_usd REAL NOT NULL DEFAULT 0,
    crypto_paid_btc REAL NOT NULL DEFAULT 0,
    crypto_paid_eth REAL NOT NULL DEFAULT 0,
    crypto_paid_bnb REAL NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_portal_users_username ON portal_users(username);

-- ═══════════════════════════════════════════
-- 2. Monthly Payments
-- Един запис на user×месец = платено за този месец
-- month формат: YYYY-MM (напр. '2026-04')
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS portal_monthly_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    month TEXT NOT NULL,
    method TEXT NOT NULL CHECK(method IN ('stripe','btc','eth','bnb','admin_grant')),
    amount REAL NOT NULL,
    tx_reference TEXT,
    paid_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, month),
    FOREIGN KEY (user_id) REFERENCES portal_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_portal_mp_user_month ON portal_monthly_payments(user_id, month);

-- ═══════════════════════════════════════════
-- 3. Game Scores (по желание — записва резултати)
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS portal_game_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    game_slug TEXT NOT NULL,
    score INTEGER NOT NULL,
    level INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES portal_users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_portal_scores_game ON portal_game_scores(game_slug);
CREATE INDEX IF NOT EXISTS idx_portal_scores_user ON portal_game_scores(user_id);

-- ═══════════════════════════════════════════
-- 4. Service Jobs (AI listing + scraper — история)
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS portal_service_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    service TEXT NOT NULL,
    input_json TEXT NOT NULL,
    output_text TEXT,
    status TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('running','done','error','timeout')),
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    finished_at TEXT,
    FOREIGN KEY (user_id) REFERENCES portal_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_portal_jobs_user ON portal_service_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_portal_jobs_service ON portal_service_jobs(service);

-- ═══════════════════════════════════════════
-- 5. Watch20 — предпочитания на услугата "Наблюдавай 20 валути"
-- Пазят се per акаунт (не в браузъра/localStorage), за да следват потребителя
-- между устройства. Един ред = един от 20-те слота; sel е "FIAT:USD"/"CRYPTO:BTC".
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS portal_watch_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    slot_index INTEGER NOT NULL,          -- 0..19
    sel TEXT,                             -- "FIAT:USD" / "CRYPTO:BTC", NULL = празен слот
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, slot_index),
    FOREIGN KEY (user_id) REFERENCES portal_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_portal_watch_slots_user ON portal_watch_slots(user_id);

-- Алерти (ценови прагове) — много на слот. threshold = стойността за известие.
CREATE TABLE IF NOT EXISTS portal_watch_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    slot_index INTEGER NOT NULL,          -- 0..19
    threshold REAL NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES portal_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_portal_watch_alerts_user ON portal_watch_alerts(user_id);

-- ═══════════════════════════════════════════
-- 7. Bug reports (докладвани грешки от потребители)
-- 1 запис на потребител (UNIQUE user_id) — може да се редактира.
-- Само заглавие + текст; БЕЗ снимки.
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS portal_bug_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,                      -- NULL = анонимен доклад от мобилно приложение (без вход)
    app TEXT,                             -- от кое приложение идва (напр. „authenticator"); NULL = порталът
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    fixed INTEGER NOT NULL DEFAULT 0,     -- 0 = неоправена, 1 = оправена (маркира се от админ/модератор)
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES portal_users(id) ON DELETE CASCADE
);
-- 1 доклад на ЛОГНАТ потребител (частичен UNIQUE); анонимните (user_id IS NULL) са неограничени.
CREATE UNIQUE INDEX IF NOT EXISTS ux_portal_bug_user ON portal_bug_reports(user_id) WHERE user_id IS NOT NULL;
