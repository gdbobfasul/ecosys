// Version: 1.0001
// Token Monitor — попълване на админи/модератори от .env за ЕДИН токен (key аргумент).
// Идемпотентен ъпсърт по потребителско име в таблицата admins на monitor_<key>.db:
//   • съществува → ОБНОВЯВА паролата от .env;  • липсва → СЪЗДАВА го с паролата от .env.
// openDb(KEY) създава базата + таблиците ако липсват → покрива и „база още няма".
// Вика се при подготовката (деплой, скрипт 31), НЕ при старт. Пряко: node admins.js <token|brch1|multisig>
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'configs', '.env') });
const bcrypt = require('bcryptjs');
const { envAccounts } = require('./roles');
const { openDb } = require('./db');

function seedAdminsAndMods(key) {
  const KEY = String(key || process.argv[2] || process.env.TOKEN_KEY || 'token').toLowerCase();
  const db = openDb(KEY); // създава monitor_<key>.db + таблиците (admins) ако липсват
  let n = 0;
  for (const a of envAccounts(KEY)) {
    const hash = bcrypt.hashSync(a.pass, 10);
    const ex = db.prepare('SELECT username FROM admins WHERE username=?').get(a.user);
    if (ex) db.prepare('UPDATE admins SET password_hash=? WHERE username=?').run(hash, a.user);
    else db.prepare('INSERT INTO admins (username,password_hash) VALUES (?,?)').run(a.user, hash);
    n++;
  }
  if (db && db.close) db.close();
  return { key: KEY, n };
}

module.exports = { seedAdminsAndMods };

if (require.main === module) {
  try { const r = seedAdminsAndMods(); console.log(`Token Monitor [${r.key}]: попълнени ${r.n} админ/модератор акаунта от .env`); process.exit(0); }
  catch (e) { console.error('Token Monitor попълване на админи се провали:', e.message); process.exit(1); }
}
