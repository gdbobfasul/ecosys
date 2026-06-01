// House-Look-Book — връзка с PostgreSQL.
// Чете HLB_PG_* от глобалния .env (private/configs/.env) — СЪЩИЯТ файл, който
// чете и деплой скриптът 16-setup-app-databases.sh. .env е source of truth:
// базата и потребителят се създават от скрипта точно с тези стойности.
//
// БЕЗ SQLite — това приложение е изцяло на PostgreSQL (решение от brief-а).

const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

// Глобалният .env е два нива нагоре: private/configs/.env
require('dotenv').config({ path: path.join(__dirname, '..', 'configs', '.env') });

const pool = new Pool({
  host: process.env.HLB_PG_HOST || 'localhost',
  port: parseInt(process.env.HLB_PG_PORT || '5432', 10),
  database: process.env.HLB_PG_DATABASE || 'houselookbook',
  user: process.env.HLB_PG_USER || 'hlb_app',
  password: process.env.HLB_PG_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('🐘 HLB pg pool грешка:', err.message);
});

// Кратки помощници — тънка обвивка над pool.query.
//   q(sql, params)    → пълен резултат (rows, rowCount)
//   one(sql, params)  → първият ред или undefined
//   all(sql, params)  → масив с редове
async function q(sql, params = []) {
  return pool.query(sql, params);
}
async function one(sql, params = []) {
  const r = await pool.query(sql, params);
  return r.rows[0];
}
async function all(sql, params = []) {
  const r = await pool.query(sql, params);
  return r.rows;
}

// Прилага schema.sql (идемпотентно — CREATE TABLE IF NOT EXISTS).
// На сървъра това вече го прави деплой скриптът; тук е удобство за dev/localhost.
async function applySchema() {
  const schemaPath = path.join(__dirname, 'database', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(sql);
}

async function checkHealth() {
  try {
    await pool.query('SELECT 1');
    return { healthy: true };
  } catch (e) {
    return { healthy: false, error: e.message };
  }
}

module.exports = { pool, q, one, all, applySchema, checkHealth };
