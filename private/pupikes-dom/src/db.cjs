/* Единен слой за база: Postgres (DATABASE_URL) в продукция; SQLite локално за разработка.
 * Еднаква схема и еднакъв интерфейс query(sql, params) → {rows}. SQL се пише в Postgres стил
 * ($1,$2,…); за SQLite се превежда автоматично. */
'use strict';
const cfg = require('./config.cjs');

const isPg = !!cfg.DATABASE_URL;
let pool = null, sdb = null;

if (isPg) {
  const { Pool } = require('pg');
  pool = new Pool({ connectionString: cfg.DATABASE_URL });
} else {
  const Database = require('better-sqlite3');
  sdb = new Database(cfg.SQLITE_FILE);
  sdb.pragma('journal_mode = WAL');
  sdb.pragma('foreign_keys = ON');
}

/* --- заявки --- */
async function query(sql, params = []) {
  if (isPg) { const r = await pool.query(sql, params); return { rows: r.rows, rowCount: r.rowCount }; }
  // SQLite: $n → ?, по реда на появяване; булеви → 0/1; undefined → null
  const order = [];
  const tsql = sql.replace(/\$(\d+)/g, (_m, n) => { order.push(Number(n) - 1); return '?'; });
  const args = order.map(i => coerce(params[i]));
  const stmt = sdb.prepare(tsql);
  if (/^\s*(select|with)/i.test(sql) || /returning/i.test(sql)) return { rows: stmt.all(...args) };
  const info = stmt.run(...args);
  return { rows: [], rowCount: info.changes };
}
function coerce(v) { if (v === true) return 1; if (v === false) return 0; if (v === undefined) return null; return v; }

async function one(sql, params) { const r = await query(sql, params); return r.rows[0] || null; }

/* --- схема (еднаква за двата драйвера) --- */
async function init() {
  const PK = isPg ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
  const TS = isPg ? 'TIMESTAMPTZ' : 'TEXT';
  const B = 'INTEGER';   // флагове 0/1 — еднакво в Postgres и SQLite (без булеви кастове)
  const stmts = [
    `CREATE TABLE IF NOT EXISTS users(
      id ${PK}, role TEXT NOT NULL, email TEXT UNIQUE NOT NULL, username TEXT, name TEXT,
      phone TEXT, password_hash TEXT NOT NULL, approved ${B} DEFAULT 0, flagged ${B} DEFAULT 0,
      moderator_id INTEGER, created_at ${TS})`,
    `CREATE TABLE IF NOT EXISTS tech_profiles(
      user_id INTEGER PRIMARY KEY, main_address TEXT, main_lat REAL, main_lng REAL, skills TEXT, trade TEXT,
      visit_fee REAL DEFAULT 0, rank INTEGER DEFAULT 1, rank_changed_period TEXT)`,
    `CREATE TABLE IF NOT EXISTS tech_addresses(
      id ${PK}, user_id INTEGER NOT NULL, label TEXT, address TEXT, lat REAL, lng REAL)`,
    `CREATE TABLE IF NOT EXISTS properties(
      id ${PK}, owner_id INTEGER NOT NULL, name TEXT, size TEXT, address TEXT, lat REAL, lng REAL, flagged ${B} DEFAULT 0, created_at ${TS})`,
    `CREATE TABLE IF NOT EXISTS equipment(
      id ${PK}, property_id INTEGER NOT NULL, kind TEXT, label TEXT, count INTEGER DEFAULT 1, note TEXT)`,
    `CREATE TABLE IF NOT EXISTS signals(
      id ${PK}, property_id INTEGER NOT NULL, owner_id INTEGER NOT NULL, type TEXT NOT NULL,
      trade TEXT, description TEXT, status TEXT NOT NULL DEFAULT 'open', created_at ${TS},
      accepted_by INTEGER, accepted_at ${TS}, eta_minutes INTEGER, resolved_at ${TS},
      transport_cost REAL, materials_cost REAL, materials_by_tech ${B} DEFAULT 0,
      cost_status TEXT, cost_mode TEXT, cost_note TEXT, cost_submitted_at ${TS})`,
    `CREATE TABLE IF NOT EXISTS signal_declines(
      signal_id INTEGER NOT NULL, tech_id INTEGER NOT NULL, PRIMARY KEY(signal_id, tech_id))`,
    `CREATE TABLE IF NOT EXISTS signal_candidates(
      signal_id INTEGER NOT NULL, tech_id INTEGER NOT NULL, eta_minutes INTEGER, created_at ${TS},
      PRIMARY KEY(signal_id, tech_id))`,
    `CREATE TABLE IF NOT EXISTS contracts(
      id ${PK}, user_id INTEGER NOT NULL, seq INTEGER, file_path TEXT, orig_name TEXT, uploaded_at ${TS},
      approved ${B} DEFAULT 0, approved_at ${TS}, approved_by INTEGER)`,
    `CREATE TABLE IF NOT EXISTS qrcodes(
      id ${PK}, slot INTEGER UNIQUE, image_path TEXT, label TEXT, active ${B} DEFAULT 1, updated_at ${TS})`,
    `CREATE TABLE IF NOT EXISTS payments(
      id ${PK}, owner_id INTEGER NOT NULL, kind TEXT NOT NULL, qr_slot INTEGER, period TEXT,
      proof_path TEXT, proof_type TEXT, amount TEXT, note TEXT, created_at ${TS},
      verified ${B} DEFAULT 0, verified_at ${TS}, verified_by INTEGER, locked ${B} DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS settings(skey TEXT PRIMARY KEY, svalue TEXT)`,
    `CREATE TABLE IF NOT EXISTS fee_requests(
      id ${PK}, tech_id INTEGER NOT NULL, requested_by INTEGER, requester_role TEXT, amount REAL,
      reason TEXT, status TEXT DEFAULT 'pending', created_at ${TS}, decided_at ${TS}, decided_by INTEGER)`,
    `CREATE TABLE IF NOT EXISTS devices(
      id ${PK}, user_id INTEGER NOT NULL, push_token TEXT, platform TEXT, created_at ${TS})`,
  ];
  for (const s of stmts) await query(s);
  // миграции за вече съществуващи бази (новите колони) — грешка „дубликат" се пренебрегва
  const alters = [
    `ALTER TABLE users ADD COLUMN flagged ${B} DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN moderator_id INTEGER`,
    `ALTER TABLE tech_profiles ADD COLUMN trade TEXT`,
    `ALTER TABLE tech_profiles ADD COLUMN visit_fee REAL DEFAULT 0`,
    `ALTER TABLE tech_profiles ADD COLUMN rank INTEGER DEFAULT 1`,
    `ALTER TABLE tech_profiles ADD COLUMN rank_changed_period TEXT`,
    `ALTER TABLE properties ADD COLUMN flagged ${B} DEFAULT 0`,
    `ALTER TABLE signals ADD COLUMN trade TEXT`,
    `ALTER TABLE signals ADD COLUMN transport_cost REAL`,
    `ALTER TABLE signals ADD COLUMN materials_cost REAL`,
    `ALTER TABLE signals ADD COLUMN materials_by_tech ${B} DEFAULT 0`,
    `ALTER TABLE signals ADD COLUMN cost_status TEXT`,
    `ALTER TABLE signals ADD COLUMN cost_mode TEXT`,
    `ALTER TABLE signals ADD COLUMN cost_note TEXT`,
    `ALTER TABLE signals ADD COLUMN cost_submitted_at ${TS}`,
    `ALTER TABLE contracts ADD COLUMN approved ${B} DEFAULT 0`,
    `ALTER TABLE contracts ADD COLUMN approved_at ${TS}`,
    `ALTER TABLE contracts ADD COLUMN approved_by INTEGER`,
    `ALTER TABLE payments ADD COLUMN period TEXT`,
  ];
  for (const a of alters) { try { await query(a); } catch {} }
}

module.exports = { query, one, init, isPg };
