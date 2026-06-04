// Version: 1.0171
// Token Monitor — отделна SQLite база за всеки токен (data/monitor_<key>.db).
// Пази: суровите трансфери (индекс), holders, аларми, админ credential-и, meta.
// Изцяло локална, само за четене на on-chain данни (без частни ключове в базата).
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

function openDb(key) {
  const dir = path.join(__dirname, 'data');
  fs.mkdirSync(dir, { recursive: true });
  const db = new Database(path.join(dir, `monitor_${key}.db`));
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);

    CREATE TABLE IF NOT EXISTS transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tx TEXT, block INTEGER, ts INTEGER,
      from_addr TEXT, to_addr TEXT, value TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_tr_block ON transfers(block);
    CREATE INDEX IF NOT EXISTS idx_tr_to ON transfers(to_addr);

    CREATE TABLE IF NOT EXISTS holders (
      addr TEXT PRIMARY KEY, balance TEXT NOT NULL DEFAULT '0',
      first_seen INTEGER, last_seen INTEGER
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER,
      level TEXT, kind TEXT, message TEXT, handled INTEGER NOT NULL DEFAULT 0
    );

    -- credential store за dashboard вход (кой е админ/мод → roles.js / .env)
    CREATE TABLE IF NOT EXISTS admins (
      username TEXT PRIMARY KEY, password_hash TEXT NOT NULL,
      last_login TEXT
    );
  `);
  return db;
}

module.exports = { openDb };
