-- KCY Portals — Game progress + advertising (НОВ файл, не пипа schema.sql)
-- Version: 1.0093

-- Прогрес: докъде е стигнал всеки потребител във всяка игра
CREATE TABLE IF NOT EXISTS portal_game_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    game_slug TEXT NOT NULL,
    best_level INTEGER NOT NULL DEFAULT 1,
    best_score INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, game_slug),
    FOREIGN KEY (user_id) REFERENCES portal_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_game_progress_user ON portal_game_progress(user_id);
