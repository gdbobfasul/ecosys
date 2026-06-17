// Version: 1.0217
// Selflearning Friend — лек store (better-sqlite3, единствена база data/selflearning.db).
//
// ИЗОЛАЦИЯ НА ДАННИТЕ: всичко е namespace-нато по token (token = част от пътя).
// НЯМА user id-та, НЯМА телефони/контакти, НЯМА релации — само:
//   • queue    — PENDING entries за всеки token (каналът „Слушай", който телефонът тегли)
//   • snapshot — пълен knowledge snapshot за всеки token (export/pull от сървъра)
// (правило на собственика: нула крипто, нула контакти, нула tracking)

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

let _db = null;

function openDb() {
  if (_db) return _db;
  const dir = process.env.SELFLEARNING_DATA_DIR || path.join(__dirname, 'data');
  fs.mkdirSync(dir, { recursive: true });
  const db = new Database(path.join(dir, 'selflearning.db'));
  db.pragma('journal_mode = WAL');
  db.exec(`
    -- PENDING опашка: по една редица на entry, FIFO по id, namespace=token.
    CREATE TABLE IF NOT EXISTS queue (
      id     INTEGER PRIMARY KEY AUTOINCREMENT,
      token  TEXT NOT NULL,
      type    TEXT,
      key     TEXT,
      value   TEXT,
      keywords TEXT,           -- JSON масив (string) или прост текст
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_queue_token ON queue(token, id);

    -- Пълен knowledge snapshot (export-to-server) — една редица на token.
    CREATE TABLE IF NOT EXISTS snapshot (
      token      TEXT PRIMARY KEY,
      payload    TEXT NOT NULL,  -- суров JSON (целият snapshot, както го е пратил клиентът)
      updated_at INTEGER NOT NULL
    );

    -- Лек rate-limit брояч (плъзгащ прозорец на нивото на token).
    CREATE TABLE IF NOT EXISTS ratelimit (
      token       TEXT PRIMARY KEY,
      window_start INTEGER NOT NULL,
      count        INTEGER NOT NULL
    );
  `);
  _db = db;
  return db;
}

module.exports = { openDb };
