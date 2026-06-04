// Version: 1.0171
// ECO-3 — кой е админ/модератор се определя ИЗЦЯЛО от .env (не от база).
// eco3 НЯМА своя потребителска база — ползва portals сесията (споделен логин).
// Затова НЯМА seed: админът/модераторите са portals потребители, чийто USERNAME
// съвпада с ECO3_ADMIN_USER / ECO3_MOD1..5_USER. Проверката е по session.username.
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

module.exports = { roleForUsername, isStaff };
