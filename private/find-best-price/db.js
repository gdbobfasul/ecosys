// Version: 1.0193
// Find Best Price per Country — връзка с PostgreSQL (като WhereNoBiz).
// Чете FBP_PG_* от глобалния .env (private/configs/.env). Изцяло PostgreSQL.

const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

require('dotenv').config({ path: path.join(__dirname, '..', 'configs', '.env') });

const pool = new Pool({
  host: process.env.FBP_PG_HOST || 'localhost',
  port: parseInt(process.env.FBP_PG_PORT || '5432', 10),
  database: process.env.FBP_PG_DATABASE || 'findbestprice',
  user: process.env.FBP_PG_USER || 'fbp_app',
  password: process.env.FBP_PG_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => console.error('🐘 FBP pg pool грешка:', err.message));

async function q(sql, params = []) { return pool.query(sql, params); }
async function one(sql, params = []) { const r = await pool.query(sql, params); return r.rows[0]; }
async function all(sql, params = []) { const r = await pool.query(sql, params); return r.rows; }

async function applySchema() {
  const sql = fs.readFileSync(path.join(__dirname, 'database', 'schema.sql'), 'utf8');
  await pool.query(sql);
}

// Seed/синхронизира админ + модератори от .env (роли в roles.js). Идемпотентно.
async function seedAdminsAndMods() {
  const bcrypt = require('bcryptjs');
  const { envAccounts } = require('./roles');
  for (const a of envAccounts()) {
    const hash = await bcrypt.hash(a.pass, 10);
    await pool.query(
      `INSERT INTO users (email, password_hash, display_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, is_banned = FALSE`,
      [a.email, hash, a.kind === 'admin' ? 'Admin' : 'Moderator']
    );
  }
}

async function checkHealth() {
  try { await pool.query('SELECT 1'); return { healthy: true }; }
  catch (e) { return { healthy: false, error: e.message }; }
}

module.exports = { pool, q, one, all, applySchema, seedAdminsAndMods, checkHealth };
