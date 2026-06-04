// Version: 1.0172
// ECO-3 DB адаптер — ЕДИН интерфейс за SQLite И PostgreSQL (превключва по ECO3_DB_TYPE).
//
//   ECO3_DB_TYPE=sqlite      → better-sqlite3 (ECO3_DB_PATH, по подразбиране database/eco3.db)
//   ECO3_DB_TYPE=postgresql  → pg Pool (ECO3_PG_HOST/PORT/DATABASE/USER/PASSWORD)
//
// SQLite пътят е НЕПРОМЕНЕН (синхронен better-sqlite3) → старото поведение се пази 1:1.
// PG пътят е async обвивка. В server.js всички db извиквания са с `await`:
//   • за PG await изчаква заявката;
//   • за SQLite await е прозрачен (await върху синхронна стойност връща стойността).
// Така ДВЕТЕ работят с един и същ код.
const path = require('path');
const fs = require('fs');

const DB_TYPE = (process.env.ECO3_DB_TYPE || 'sqlite').toLowerCase();
const IS_PG = DB_TYPE === 'postgresql' || DB_TYPE === 'postgres' || DB_TYPE === 'pg';

// Превръща SQLite SQL към PostgreSQL в движение: ? → $1.. ; функции за дати ; AUTOINCREMENT.
function toPg(sql) {
  let i = 0;
  let s = String(sql).replace(/\?/g, () => `$${++i}`);
  s = s
    .replace(/datetime\('now',\s*'-\s*(\d+)\s+hours?'\)/gi, "(now() - interval '$1 hours')")
    .replace(/datetime\('now',\s*'-\s*(\d+)\s+days?'\)/gi, "(now() - interval '$1 days')")
    .replace(/datetime\('now'\)/gi, 'now()')
    .replace(/date\('now'\)/gi, "to_char(now(), 'YYYY-MM-DD')")
    .replace(/INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY')
    .replace(/\bAUTOINCREMENT\b/gi, '');
  return s;
}

// ─────────────── SQLite (непроменено поведение) ───────────────
function createSqlite() {
  const Database = require('better-sqlite3');
  let p = process.env.ECO3_DB_PATH || path.join(__dirname, 'database', 'eco3.db');
  if (!path.isAbsolute(p)) p = path.join(__dirname, p);
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const sdb = new Database(p);
  sdb.pragma('journal_mode = WAL');
  sdb.pragma('foreign_keys = ON');
  return {
    type: 'sqlite',
    path: p,
    raw: sdb,
    exec: (sql) => sdb.exec(sql),
    prepare: (sql) => sdb.prepare(sql),  // .get/.run/.all са синхронни — await ги пропуска прозрачно
    tableNames: () => sdb.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(r => r.name),
    close: () => sdb.close(),
  };
}

// ─────────────── PostgreSQL (async обвивка, същия интерфейс) ───────────────
function createPg() {
  const { Pool } = require('pg');
  const pool = new Pool({
    host: process.env.ECO3_PG_HOST || 'localhost',
    port: parseInt(process.env.ECO3_PG_PORT || '5432', 10),
    database: process.env.ECO3_PG_DATABASE || 'eco3_sys_db',
    user: process.env.ECO3_PG_USER || 'eco3_kcy_user',
    password: process.env.ECO3_PG_PASSWORD,
    max: 10, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000,
  });
  pool.on('error', (e) => console.error('🐘 eco3 pg pool грешка:', e.message));
  return {
    type: 'postgresql',
    path: process.env.ECO3_PG_DATABASE || 'eco3_sys_db',
    pool,
    exec: async (sql) => { await pool.query(toPg(sql)); },
    prepare: (sql) => {
      const q = toPg(sql);
      return {
        run: async (...p) => {
          // За обикновен INSERT добавяме RETURNING id (за lastInsertRowid като SQLite).
          let qq = q;
          const plainInsert = /^\s*insert\s+into/i.test(qq) && !/returning/i.test(qq) && !/on\s+conflict/i.test(qq);
          if (plainInsert) qq = qq.replace(/;?\s*$/, '') + ' RETURNING id';
          try {
            const r = await pool.query(qq, p);
            return { changes: r.rowCount, lastInsertRowid: r.rows[0] && r.rows[0].id };
          } catch (e) {
            if (qq !== q) { const r = await pool.query(q, p); return { changes: r.rowCount }; } // таблица без "id"
            throw e;
          }
        },
        get: async (...p) => { const r = await pool.query(q, p); return r.rows[0]; },
        all: async (...p) => { const r = await pool.query(q, p); return r.rows; },
      };
    },
    tableNames: async () => {
      const r = await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
      return r.rows.map(x => x.tablename);
    },
    close: async () => { await pool.end(); },
  };
}

function createDb() { return IS_PG ? createPg() : createSqlite(); }

module.exports = { createDb, IS_PG, DB_TYPE: IS_PG ? 'postgresql' : 'sqlite', toPg };
