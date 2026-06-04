// Version: 1.0172
// ECO-3 — СВОИ админи/модератори, попълвани от .env в eco3.db (таблица eco3_admins).
//
// seedAdminsAndMods() се вика при СЪЗДАВАНЕ/обновяване на базата:
//   • точка 2 (пълна инсталация) — веднага след като базата е готова
//   • точка 49 (ECO-3 — обнови) — преди рестарт
// НЕ се вика при старт на услугата. Извиква се самостоятелно:
//   cd private/eco-3 && node -e "require('./admins').seedAdminsAndMods()"
//
// verifyLogin() се ползва от server.js за собствения админ вход на ECO-3.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'configs', '.env') });
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const { envAccounts, roleForUsername } = require('./roles');

function openDb() {
  let p = process.env.ECO3_DB_PATH || path.join(__dirname, 'database', 'eco3.db');
  if (!path.isAbsolute(p)) p = path.join(__dirname, p);
  const db = new Database(p);
  db.pragma('journal_mode = WAL');
  // Гаранция, че таблицата я има (ако се вика преди да е приложена схемата).
  db.prepare(`CREATE TABLE IF NOT EXISTS eco3_admins (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TEXT DEFAULT (datetime('now')),
    last_login    TEXT
  )`).run();
  return db;
}

// Създава (ако няма) или обновява паролите на админите/модераторите от .env. Връща броя.
function seedAdminsAndMods() {
  const db = openDb();
  const sel = db.prepare('SELECT id FROM eco3_admins WHERE username = ?');
  const upd = db.prepare('UPDATE eco3_admins SET password_hash = ? WHERE username = ?');
  const ins = db.prepare('INSERT INTO eco3_admins (username, password_hash) VALUES (?, ?)');
  let n = 0;
  for (const a of envAccounts()) {
    const hash = bcrypt.hashSync(a.pass, 10);
    if (sel.get(a.user)) upd.run(hash, a.user); else ins.run(hash, a.user);
    n++;
  }
  db.close();
  return n;
}

// Проверка на вход срещу eco3_admins + .env ролята. Връща username при успех, иначе null.
function verifyLogin(username, password) {
  const u = String(username || '').trim().toLowerCase();
  if (roleForUsername(u) === 'user') return null; // вече не е в .env → няма достъп
  const db = openDb();
  const row = db.prepare('SELECT username, password_hash FROM eco3_admins WHERE username = ?').get(u);
  let okUser = null;
  if (row && bcrypt.compareSync(String(password || ''), row.password_hash)) {
    db.prepare("UPDATE eco3_admins SET last_login = datetime('now') WHERE username = ?").run(row.username);
    okUser = row.username;
  }
  db.close();
  return okUser;
}

module.exports = { seedAdminsAndMods, verifyLogin, openDb };

// Позволява и пряко пускане: node admins.js  → попълва и излиза.
if (require.main === module) {
  try { console.log(`ECO-3: попълнени ${seedAdminsAndMods()} админ/модератор акаунта от .env`); process.exit(0); }
  catch (e) { console.error('ECO-3 попълване на админи се провали:', e.message); process.exit(1); }
}
