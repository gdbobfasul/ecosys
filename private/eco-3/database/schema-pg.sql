-- ECO-3 AI Studio — PostgreSQL схема (огледало на schema.sql за ECO3_DB_TYPE=postgresql)
-- Version: 1.0172
-- Прилага се от server.js при ECO3_DB_TYPE=postgresql. SQLite остава в schema.sql.

CREATE TABLE IF NOT EXISTS eco3_uniqueness (
    id SERIAL PRIMARY KEY,
    date TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD'),
    title TEXT,
    source TEXT,
    link TEXT,
    session_id TEXT,
    created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_uniq_date ON eco3_uniqueness(date);
CREATE INDEX IF NOT EXISTS idx_uniq_session ON eco3_uniqueness(session_id, date);

CREATE TABLE IF NOT EXISTS eco3_search_history (
    id SERIAL PRIMARY KEY,
    topic TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('analytic','generative','curated')),
    language TEXT DEFAULT 'bg',
    budget_tier TEXT DEFAULT 'economy',
    duration_min INTEGER DEFAULT 10,
    audience TEXT DEFAULT 'adult',
    tone TEXT DEFAULT 'original',
    session_id TEXT,
    ip_address TEXT,
    created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hist_cat ON eco3_search_history(category);
CREATE INDEX IF NOT EXISTS idx_hist_session ON eco3_search_history(session_id);
CREATE INDEX IF NOT EXISTS idx_hist_date ON eco3_search_history(created_at);

CREATE TABLE IF NOT EXISTS eco3_results (
    id SERIAL PRIMARY KEY,
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
    created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_res_topic ON eco3_results(topic);
CREATE INDEX IF NOT EXISTS idx_res_cat ON eco3_results(category);
CREATE INDEX IF NOT EXISTS idx_res_resale ON eco3_results(is_resellable);

CREATE TABLE IF NOT EXISTS eco3_stats (
    id SERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    details TEXT,
    amount_eur REAL DEFAULT 0,
    created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stats_type ON eco3_stats(event_type);
CREATE INDEX IF NOT EXISTS idx_stats_date ON eco3_stats(created_at);

CREATE TABLE IF NOT EXISTS eco3_google_usage (
    date  TEXT PRIMARY KEY DEFAULT to_char(now(), 'YYYY-MM-DD'),
    calls INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS eco3_admins (
    id            SERIAL PRIMARY KEY,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMP DEFAULT now(),
    last_login    TIMESTAMP
);
