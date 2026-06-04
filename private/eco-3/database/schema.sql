-- ECO-3 AI Studio — Database Schema
-- Version: 1.0172
-- Engine: SQLite (better-sqlite3)

-- ═══════════════════════════════════════════
-- 1. Uniqueness Tracker
-- Пази до N резултата на ден за уникалност
-- Нулира се в 00:00 UTC
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS eco3_uniqueness (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL DEFAULT (date('now')),
    title TEXT,
    source TEXT,
    link TEXT,
    session_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_uniq_date ON eco3_uniqueness(date);
CREATE INDEX IF NOT EXISTS idx_uniq_session ON eco3_uniqueness(session_id, date);

-- ═══════════════════════════════════════════
-- 2. Search History
-- Всяко търсене се записва тук
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS eco3_search_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('analytic','generative','curated')),
    language TEXT DEFAULT 'bg',
    budget_tier TEXT DEFAULT 'economy',
    duration_min INTEGER DEFAULT 10,
    audience TEXT DEFAULT 'adult',
    tone TEXT DEFAULT 'original',
    session_id TEXT,
    ip_address TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_hist_cat ON eco3_search_history(category);
CREATE INDEX IF NOT EXISTS idx_hist_session ON eco3_search_history(session_id);
CREATE INDEX IF NOT EXISTS idx_hist_date ON eco3_search_history(created_at);

-- ═══════════════════════════════════════════
-- 3. Results Store (за кеширане и препродажба)
-- Пази текстови резултати за бързо зареждане
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS eco3_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic TEXT NOT NULL,
    category TEXT NOT NULL,
    director_output TEXT,
    architect_output TEXT,
    executor_output TEXT,
    language TEXT DEFAULT 'bg',
    budget_tier TEXT DEFAULT 'economy',
    duration_min INTEGER DEFAULT 10,
    audience TEXT DEFAULT 'adult',
    tone TEXT DEFAULT 'original',
    session_id TEXT,
    is_resellable INTEGER DEFAULT 1,
    resale_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_res_topic ON eco3_results(topic);
CREATE INDEX IF NOT EXISTS idx_res_cat ON eco3_results(category);
CREATE INDEX IF NOT EXISTS idx_res_resale ON eco3_results(is_resellable);

-- ═══════════════════════════════════════════
-- 4. Admin Stats
-- Брояч за заявки и приходи
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS eco3_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    details TEXT,
    amount_eur REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_stats_type ON eco3_stats(event_type);
CREATE INDEX IF NOT EXISTS idx_stats_date ON eco3_stats(created_at);

-- ═══════════════════════════════════════════
-- 5. Google Search дневен брояч
-- Реалните търсения минават през Google Custom Search (безплатно под 100/ден).
-- Пазим брой повиквания на ден, за да спрем под безплатния таван (без такси).
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS eco3_google_usage (
    date  TEXT PRIMARY KEY DEFAULT (date('now')),
    calls INTEGER NOT NULL DEFAULT 0
);

-- ═══════════════════════════════════════════
-- 6. Админи / модератори (СВОИ за ECO-3)
-- Попълват се от .env (ECO3_ADMIN_USER/PASS, ECO3_MOD1..5_USER/PASS) при СЪЗДАВАНЕ
-- на базата (точка 2 деплой и точка 49 обнови) — НЕ при старт на услугата.
-- Кой има права се решава live от roles.js спрямо .env; тук пазим само паролите.
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS eco3_admins (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TEXT DEFAULT (datetime('now')),
    last_login    TEXT
);
