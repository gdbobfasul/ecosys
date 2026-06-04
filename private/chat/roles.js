// Version: 1.0171
// Chat — кой е админ/модератор се определя ИЗЦЯЛО от .env (не от базата).
// Админ панелът е по USERNAME (таблица admin_users пази само паролата за вход).
// username == CHAT_ADMIN_USER → админ; ∈ CHAT_MOD1..5_USER → модератор; иначе user.
// Базата НЕ решава кой е админ — само пази credential-ите. Смяна в .env → старият
// отпада (проверката се проваля), новият става админ/модератор. Trim срещу интервали.

const norm = s => (s || '').trim().toLowerCase();

function adminUser() { return norm(process.env.CHAT_ADMIN_USER); }
function modUsers() {
  return [1, 2, 3, 4, 5].map(i => norm(process.env['CHAT_MOD' + i + '_USER'])).filter(Boolean);
}

function roleForUsername(username) {
  const u = norm(username);
  if (u && u === adminUser()) return 'admin';
  if (u && modUsers().includes(u)) return 'moderator';
  return 'user';
}
// Админ ИЛИ модератор (чатът няма отделна мод роля — третира и двете като staff).
function isStaff(username) { return roleForUsername(username) !== 'user'; }

function envAccounts() {
  const list = [];
  const au = norm(process.env.CHAT_ADMIN_USER), ap = String(process.env.CHAT_ADMIN_PASS || '').trim();
  if (au && ap) list.push({ user: au, pass: ap, kind: 'admin' });
  for (let i = 1; i <= 5; i++) {
    const u = norm(process.env['CHAT_MOD' + i + '_USER']), p = String(process.env['CHAT_MOD' + i + '_PASS'] || '').trim();
    if (u && p) list.push({ user: u, pass: p, kind: 'moderator' });
  }
  return list;
}

module.exports = { roleForUsername, isStaff, envAccounts };
