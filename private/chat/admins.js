// Version: 1.0001
// Chat — попълване на админи/модератори от .env. Работи за ДВЕТЕ бази (превключва по
// CHAT_DB_TYPE, точно както целият chat). Чатът пази паролите в таблица admin_users
// (кой е админ/модератор → roles.js по .env).
//
// seedAdminsAndMods() — идемпотентен ъпсърт по потребителско име:
//   • ако акаунтът съществува (по username) → ОБНОВЯВА паролата от .env (ресет след .env промяна);
//   • ако липсва → СЪЗДАВА го с паролата от .env.
// Вика се при СЪЗДАВАНЕ/ПОДГОТОВКА на базата по време на деплой (скрипт 07), НЕ при старт
// на услугата. Пряко: `node admins.js`.
//
// dotenv се зарежда ПРЕДИ utils/database.js и queries, защото те четат CHAT_DB_TYPE при require.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'configs', '.env') });

const { initializeDatabase, getDatabase } = require('./utils/database');
const { envAccounts } = require('./roles');
const { hashPassword } = require('./utils/password');
const Q = require('./queries').server;

async function seedAdminsAndMods() {
  initializeDatabase();
  const db = getDatabase();
  let n = 0;
  for (const a of envAccounts()) {
    const hash = await hashPassword(a.pass);
    const ex = await db.prepare(Q.ADMIN_FIND_BY_USERNAME).get(a.user);
    if (ex) await db.prepare(Q.ADMIN_UPDATE_PASSWORD).run(hash, a.user);
    else await db.prepare(Q.ADMIN_INSERT).run(a.user, hash);
    n++;
  }
  try { if (db && db.close) await db.close(); } catch (e) { /* SQLite close е синхронен */ }
  return n;
}

module.exports = { seedAdminsAndMods };

// Пряко пускане: node admins.js → попълва и излиза (ползва се от деплой скрипт 07).
if (require.main === module) {
  const fs = require('fs');
  const ENVF = path.join(__dirname, '..', 'configs', '.env');
  try { fs.accessSync(ENVF, fs.constants.R_OK); }
  catch (e) { console.error(`Chat: НЕ МОГА да чета ${ENVF} (права/собственик?). Дай достъп на потребителя, който пуска това.`); process.exit(1); }
  seedAdminsAndMods()
    .then(n => {
      if (n === 0) { console.error('Chat: попълнени 0 акаунта — CHAT_ADMIN_USER/PASS липсват или .env е празен за тоя потребител.'); process.exit(1); }
      console.log(`Chat: попълнени ${n} админ/модератор акаунта от .env`); process.exit(0);
    })
    .catch(e => { console.error('Chat попълване на админи се провали:', e.message); process.exit(1); });
}
