// Version: 1.0171
// Portals — кой е админ/модератор се определя ИЗЦЯЛО от .env (не от базата).
// Вход тук е по USERNAME (за разлика от HLB/WNB, които са по имейл).
// username == PORTALS_ADMIN_USER → админ; ∈ PORTALS_MOD1..5_USER → модератор; иначе user.
// Seed-ва се от единната меню точка (server скрипт), НЕ при рестарт. Trim срещу интервали.

const norm = s => (s || '').trim().toLowerCase();

function adminUser() { return norm(process.env.PORTALS_ADMIN_USER); }
function modUsers() {
  return [1, 2, 3, 4, 5].map(i => norm(process.env['PORTALS_MOD' + i + '_USER'])).filter(Boolean);
}

function roleForUsername(username) {
  const u = norm(username);
  if (u && u === adminUser()) return 'admin';
  if (u && modUsers().includes(u)) return 'moderator';
  return 'user';
}

function envAccounts() {
  const list = [];
  const au = norm(process.env.PORTALS_ADMIN_USER), ap = String(process.env.PORTALS_ADMIN_PASS || '').trim();
  if (au && ap) list.push({ user: au, pass: ap, kind: 'admin' });
  for (let i = 1; i <= 5; i++) {
    const u = norm(process.env['PORTALS_MOD' + i + '_USER']), p = String(process.env['PORTALS_MOD' + i + '_PASS'] || '').trim();
    if (u && p) list.push({ user: u, pass: p, kind: 'moderator' });
  }
  return list;
}

module.exports = { roleForUsername, envAccounts };
