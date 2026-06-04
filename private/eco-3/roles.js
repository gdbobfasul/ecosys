// Version: 1.0172
// ECO-3 — кой е админ/модератор се определя от .env (ECO3_ADMIN_USER / ECO3_MOD1..5_USER).
// ECO-3 вече има СВОИ админи (таблица eco3_admins, попълнена от .env при създаване на
// базата — виж admins.js). Правата (роля) пак се решават live тук спрямо .env.
const norm = s => (s || '').trim().toLowerCase();

function adminUser() { return norm(process.env.ECO3_ADMIN_USER); }
function modUsers() {
  return [1, 2, 3, 4, 5].map(i => norm(process.env['ECO3_MOD' + i + '_USER'])).filter(Boolean);
}

function roleForUsername(username) {
  const u = norm(username);
  if (u && u === adminUser()) return 'admin';
  if (u && modUsers().includes(u)) return 'moderator';
  return 'user';
}
function isStaff(username) { return roleForUsername(username) !== 'user'; }

// Акаунтите (потребител + парола) от .env за попълване в eco3_admins.
// Пропуска празни (без потребител или без парола). Потребителят се пази нормализиран.
function envAccounts() {
  const trim = s => (s || '').trim();
  const out = [];
  const au = trim(process.env.ECO3_ADMIN_USER), ap = trim(process.env.ECO3_ADMIN_PASS);
  if (au && ap) out.push({ user: norm(au), pass: ap, kind: 'admin' });
  for (let i = 1; i <= 5; i++) {
    const u = trim(process.env['ECO3_MOD' + i + '_USER']);
    const p = trim(process.env['ECO3_MOD' + i + '_PASS']);
    if (u && p) out.push({ user: norm(u), pass: p, kind: 'moderator' });
  }
  return out;
}

module.exports = { roleForUsername, isStaff, envAccounts };
