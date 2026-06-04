// Version: 1.0171
// House-Look-Book — кой е админ/модератор се определя ИЗЦЯЛО от .env (не от DB колона).
// Имейл на логнатия == HLB_ADMIN_USER → админ; ∈ HLB_MOD1..5_USER → модератор; иначе user.
// Компрометиран админ/модератор се сменя за 2 мин: редактираш .env + рестарт (seed-ът
// обновява паролите, правата идват оттук). Имейл и парола се ТРИМ-ват (срещу интервали в .env).

const norm = s => (s || '').trim().toLowerCase();

function adminEmail() { return norm(process.env.HLB_ADMIN_USER); }
function modEmails() {
  return [1, 2, 3, 4, 5].map(i => norm(process.env['HLB_MOD' + i + '_USER'])).filter(Boolean);
}

function roleForEmail(email) {
  const e = norm(email);
  if (e && e === adminEmail()) return 'admin';
  if (e && modEmails().includes(e)) return 'moderator';
  return 'user';
}

function envAccounts() {
  const list = [];
  const au = norm(process.env.HLB_ADMIN_USER), ap = String(process.env.HLB_ADMIN_PASS || '').trim();
  if (au && ap) list.push({ email: au, pass: ap, kind: 'admin' });
  for (let i = 1; i <= 5; i++) {
    const u = norm(process.env['HLB_MOD' + i + '_USER']), p = String(process.env['HLB_MOD' + i + '_PASS'] || '').trim();
    if (u && p) list.push({ email: u, pass: p, kind: 'moderator' });
  }
  return list;
}

module.exports = { roleForEmail, envAccounts };
