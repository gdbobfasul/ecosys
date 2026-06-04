// Version: 1.0171
// WhereNoBiz — връзка с PostgreSQL.
// Чете WNB_PG_* от глобалния .env (private/configs/.env) — СЪЩИЯТ файл, който
// чете деплой скриптът 16-setup-app-databases.sh. .env е source of truth.
// БЕЗ SQLite — изцяло PostgreSQL (решение от brief-а).

const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const { COUNTRIES } = require('./data/countries');

require('dotenv').config({ path: path.join(__dirname, '..', 'configs', '.env') });

const pool = new Pool({
  host: process.env.WNB_PG_HOST || 'localhost',
  port: parseInt(process.env.WNB_PG_PORT || '5432', 10),
  database: process.env.WNB_PG_DATABASE || 'wherenobiz',
  user: process.env.WNB_PG_USER || 'wnb_app',
  password: process.env.WNB_PG_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => console.error('🐘 WNB pg pool грешка:', err.message));

async function q(sql, params = []) { return pool.query(sql, params); }
async function one(sql, params = []) { const r = await pool.query(sql, params); return r.rows[0]; }
async function all(sql, params = []) { const r = await pool.query(sql, params); return r.rows; }

// Прилага schema.sql (идемпотентно). На сървъра това го прави деплой скриптът.
async function applySchema() {
  const sql = fs.readFileSync(path.join(__dirname, 'database', 'schema.sql'), 'utf8');
  await pool.query(sql);
}

// Зарежда страните веднъж (ON CONFLICT DO NOTHING — безопасно при всеки старт).
async function seedCountries() {
  for (const c of COUNTRIES) {
    await pool.query(
      'INSERT INTO countries (code, name) VALUES ($1, $2) ON CONFLICT (code) DO NOTHING',
      [c.code, c.name]
    );
  }
}

// Seed/синхронизира админ + модератори от .env (виж roles.js). Идемпотентно:
// при всеки старт обновява паролите към тези в .env (компрометиран админ → смяна
// за 2 мин: редакция на .env + рестарт). Правата НЕ идват оттук, а от roles.js.
async function seedAdminsAndMods() {
  const bcrypt = require('bcryptjs');
  const { envAccounts } = require('./roles');
  for (const a of envAccounts()) {
    const hash = await bcrypt.hash(a.pass, 10);
    await pool.query(
      `INSERT INTO users (email, password_hash, display_name, is_subscribed)
       VALUES ($1, $2, $3, TRUE)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, is_banned = FALSE`,
      [a.email, hash, a.kind === 'admin' ? 'Admin' : 'Moderator']
    );
  }
}

async function checkHealth() {
  try { await pool.query('SELECT 1'); return { healthy: true }; }
  catch (e) { return { healthy: false, error: e.message }; }
}

module.exports = { pool, q, one, all, applySchema, seedCountries, seedAdminsAndMods, checkHealth };
