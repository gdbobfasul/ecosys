// Version: 1.0001
// SQLite заявки за admins.js (нативен SQLite: ? плейсхолдъри, datetime('now')).
module.exports = {
  // Гарантира таблицата eco3_admins.
  ENSURE_TABLE: `CREATE TABLE IF NOT EXISTS eco3_admins (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TEXT DEFAULT (datetime('now')),
    last_login    TEXT
  )`,

  // (PG-само upsert; държим името за симетрия — в SQLite пътя не се ползва.)
  SEED_UPSERT:
    `INSERT INTO eco3_admins (username, password_hash) VALUES (?, ?)
     ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash`,
  // seedAdminsAndMods — SQLite прави select → update/insert.
  SEED_SELECT: 'SELECT id FROM eco3_admins WHERE username = ?',
  SEED_UPDATE: 'UPDATE eco3_admins SET password_hash = ? WHERE username = ?',
  SEED_INSERT: 'INSERT INTO eco3_admins (username, password_hash) VALUES (?, ?)',

  // verifyLogin — намери реда и обнови last_login при успех.
  LOGIN_SELECT: 'SELECT username, password_hash FROM eco3_admins WHERE username = ?',
  LOGIN_TOUCH:  "UPDATE eco3_admins SET last_login = datetime('now') WHERE username = ?",
};
