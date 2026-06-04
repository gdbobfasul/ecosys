// Version: 1.0171
// Token Monitor — кой е админ/модератор се определя от .env (за всеки токен поотделно).
// Вход в dashboard-а = USERNAME. <TOKEN>_ADMIN_USER → админ; <TOKEN>_MOD1..5_USER → модератор.
// Базата пази само паролите (credential); ролята идва от .env. Trim срещу интервали.
const norm = s => (s || '').trim().toLowerCase();
const P = key => String(key || '').toUpperCase();

function adminUser(key) { return norm(process.env[`${P(key)}_ADMIN_USER`]); }
function modUsers(key) {
  return [1, 2, 3, 4, 5].map(i => norm(process.env[`${P(key)}_MOD${i}_USER`])).filter(Boolean);
}

function roleForUsername(key, username) {
  const u = norm(username);
  if (u && u === adminUser(key)) return 'admin';
  if (u && modUsers(key).includes(u)) return 'moderator';
  return 'user';
}

function envAccounts(key) {
  const list = [];
  const au = adminUser(key), ap = String(process.env[`${P(key)}_ADMIN_PASS`] || '').trim();
  if (au && ap) list.push({ user: au, pass: ap, kind: 'admin' });
  for (let i = 1; i <= 5; i++) {
    const u = norm(process.env[`${P(key)}_MOD${i}_USER`]), p = String(process.env[`${P(key)}_MOD${i}_PASS`] || '').trim();
    if (u && p) list.push({ user: u, pass: p, kind: 'moderator' });
  }
  return list;
}

module.exports = { roleForUsername, envAccounts };
