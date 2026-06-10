// Version: 1.0172
// ECO-3 — СВОИ админи/модератори, попълвани от .env. Работи за ДВЕТЕ бази —
// превключва по ECO3_DB_TYPE (sqlite | postgresql), точно както сочат настройките в .env:
//   ECO3_DB_TYPE=postgresql → ECO3_PG_HOST/PORT/DATABASE/USER/PASSWORD
//   ECO3_DB_TYPE=sqlite      → ECO3_DB_PATH (database/eco3.db)
//
// seedAdminsAndMods() — създава/обновява акаунтите; вика се при СЪЗДАВАНЕ на базата
//   (точка 2 деплой и точка 49 обнови), НЕ при старт. Пряко: node admins.js
// verifyLogin() — ползва се от server.js за собствения админ вход на ECO-3.
// И двете са async (заради PostgreSQL); за SQLite просто връщат веднага.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'configs', '.env') });
const bcrypt = require('bcryptjs');
const { envAccounts, roleForUsername } = require('./roles');
const Q = require('./queries').admins;

const DB_TYPE = (process.env.ECO3_DB_TYPE || 'sqlite').toLowerCase();
const isPG = DB_TYPE === 'postgresql' || DB_TYPE === 'postgres' || DB_TYPE === 'pg';

// ─────────────── PostgreSQL ───────────────
function pgPool() {
  const { Pool } = require('pg');
  return new Pool({
    host: process.env.ECO3_PG_HOST || 'localhost',
    port: parseInt(process.env.ECO3_PG_PORT || '5432', 10),
    database: process.env.ECO3_PG_DATABASE || 'eco3_sys_db',
    user: process.env.ECO3_PG_USER || 'eco3_kcy_user',
    password: process.env.ECO3_PG_PASSWORD,
    max: 4, idleTimeoutMillis: 10000, connectionTimeoutMillis: 5000,
  });
}
async function pgEnsureTable(pool) {
  await pool.query(Q.ENSURE_TABLE);
}

// ─────────────── SQLite ───────────────
function sqliteDb() {
  const Database = require('better-sqlite3');
  let p = process.env.ECO3_DB_PATH || path.join(__dirname, 'database', 'eco3.db');
  if (!path.isAbsolute(p)) p = path.join(__dirname, p);
  const db = new Database(p);
  db.pragma('journal_mode = WAL');
  db.prepare(Q.ENSURE_TABLE).run();
  return db;
}

// Създава (ако няма) или обновява паролите на админите/модераторите от .env. Връща броя.
async function seedAdminsAndMods() {
  let n = 0;
  if (isPG) {
    const pool = pgPool();
    try {
      await pgEnsureTable(pool);
      for (const a of envAccounts()) {
        const hash = bcrypt.hashSync(a.pass, 10);
        await pool.query(Q.SEED_UPSERT, [a.user, hash]);
        n++;
      }
    } finally { await pool.end(); }
  } else {
    const db = sqliteDb();
    const sel = db.prepare(Q.SEED_SELECT);
    const upd = db.prepare(Q.SEED_UPDATE);
    const ins = db.prepare(Q.SEED_INSERT);
    for (const a of envAccounts()) {
      const hash = bcrypt.hashSync(a.pass, 10);
      if (sel.get(a.user)) upd.run(hash, a.user); else ins.run(hash, a.user);
      n++;
    }
    db.close();
  }
  return n;
}

// Проверка на вход срещу eco3_admins + .env ролята. Връща username при успех, иначе null.
async function verifyLogin(username, password) {
  const u = String(username || '').trim().toLowerCase();
  if (roleForUsername(u) === 'user') return null; // вече не е в .env → няма достъп
  if (isPG) {
    const pool = pgPool();
    try {
      await pgEnsureTable(pool);
      const { rows } = await pool.query(Q.LOGIN_SELECT, [u]);
      const row = rows[0];
      if (row && bcrypt.compareSync(String(password || ''), row.password_hash)) {
        await pool.query(Q.LOGIN_TOUCH, [row.username]);
        return row.username;
      }
      return null;
    } finally { await pool.end(); }
  } else {
    const db = sqliteDb();
    const row = db.prepare(Q.LOGIN_SELECT).get(u);
    let okUser = null;
    if (row && bcrypt.compareSync(String(password || ''), row.password_hash)) {
      db.prepare(Q.LOGIN_TOUCH).run(row.username);
      okUser = row.username;
    }
    db.close();
    return okUser;
  }
}

module.exports = { seedAdminsAndMods, verifyLogin, dbType: isPG ? 'postgresql' : 'sqlite' };

// Пряко пускане: node admins.js  → попълва и излиза (ползва се от точка 2 / точка 49).
if (require.main === module) {
  seedAdminsAndMods()
    .then(n => { console.log(`ECO-3 (${isPG ? 'postgresql' : 'sqlite'}): попълнени ${n} админ/модератор акаунта от .env`); process.exit(0); })
    .catch(e => { console.error('ECO-3 попълване на админи се провали:', e.message); process.exit(1); });
}
