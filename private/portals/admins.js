// Version: 1.0001
// Portals — попълване на админи/модератори от .env в SQLite таблицата portal_users.
// Идемпотентен ъпсърт по потребителско име:
//   • съществува (по username) → ОБНОВЯВА паролата от .env;
//   • липсва → СЪЗДАВА го с паролата от .env.
// Вика се при ПОДГОТОВКАТА на базата по време на деплой (скрипт 05), НЕ при старт. Пряко: node admins.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'configs', '.env') });
const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const { envAccounts } = require('./roles');

function openDb() {
  const DB_PATH = process.env.PORTALS_DB_PATH || path.join(__dirname, 'database', 'portals.db');
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  // увери се, че таблиците съществуват (portal_users) — ако базата е току-що създадена
  try { db.exec(fs.readFileSync(path.join(__dirname, 'database', 'schema.sql'), 'utf8')); } catch (e) { /* схемата може вече да е приложена */ }
  return db;
}

function seedAdminsAndMods() {
  const db = openDb();
  const sel = db.prepare('SELECT id FROM portal_users WHERE username = ?');
  const upd = db.prepare('UPDATE portal_users SET password_hash = ? WHERE username = ?');
  const ins = db.prepare('INSERT INTO portal_users (username, password_hash) VALUES (?, ?)');
  let n = 0;
  for (const a of envAccounts()) {
    const hash = bcrypt.hashSync(a.pass, 10);
    if (sel.get(a.user)) upd.run(hash, a.user); else ins.run(a.user, hash);
    n++;
  }
  db.close();
  return n;
}

module.exports = { seedAdminsAndMods };

if (require.main === module) {
  try { const n = seedAdminsAndMods(); console.log(`Portals: попълнени ${n} админ/модератор акаунта от .env`); process.exit(0); }
  catch (e) { console.error('Portals попълване на админи се провали:', e.message); process.exit(1); }
}
