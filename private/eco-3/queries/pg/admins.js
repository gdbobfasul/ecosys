// Version: 1.0001
// PostgreSQL заявки за admins.js (нативен PG: $n плейсхолдъри, now(), ON CONFLICT).
// created_at/last_login са истински TIMESTAMP в schema-pg.sql → now() (не to_char).
module.exports = {
  // Гарантира таблицата eco3_admins (id SERIAL, username, password_hash, created_at, last_login).
  ENSURE_TABLE: `CREATE TABLE IF NOT EXISTS eco3_admins (
    id            SERIAL PRIMARY KEY,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMP DEFAULT now(),
    last_login    TIMESTAMP
  )`,

  // seedAdminsAndMods — PG прави upsert с един INSERT ... ON CONFLICT.
  SEED_UPSERT:
    `INSERT INTO eco3_admins (username, password_hash) VALUES ($1, $2)
     ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
  // (SQLite вариантите по-долу не се ползват в PG пътя, държим имената за симетрия.)
  SEED_SELECT: 'SELECT id FROM eco3_admins WHERE username = $1',
  SEED_UPDATE: 'UPDATE eco3_admins SET password_hash = $1 WHERE username = $2',
  SEED_INSERT: 'INSERT INTO eco3_admins (username, password_hash) VALUES ($1, $2)',

  // verifyLogin — намери реда и обнови last_login при успех.
  LOGIN_SELECT: 'SELECT username, password_hash FROM eco3_admins WHERE username = $1',
  LOGIN_TOUCH:  'UPDATE eco3_admins SET last_login = now() WHERE username = $1',
};
