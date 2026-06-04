// Version: 1.0171
// WhereNoBiz — кой е админ/модератор се определя ИЗЦЯЛО от .env (не от DB колона).
// Правило: ако имейлът на логнатия потребител == WNB_ADMIN_USER → админ;
// ако е сред WNB_MOD1..5_USER → модератор; иначе обикновен потребител.
// Така ако някой админ бъде компрометиран, смяната става за 2 минути: редактираш
// .env и рестартираш услугата (seed-ът обновява паролите, а правата идват от .env).
// Стойностите се четат ВЪТРЕ във функциите, за да са винаги текущи (след dotenv).

const norm = s => (s || '').trim().toLowerCase();

function adminEmail() { return norm(process.env.WNB_ADMIN_USER); }
function modEmails() {
  return [1, 2, 3, 4, 5].map(i => norm(process.env['WNB_MOD' + i + '_USER'])).filter(Boolean);
}

// Роля по имейл: 'admin' | 'moderator' | 'user'
function roleForEmail(email) {
  const e = norm(email);
  if (e && e === adminEmail()) return 'admin';
  if (e && modEmails().includes(e)) return 'moderator';
  return 'user';
}

// Всички админ/мод акаунти от .env (за seed в базата).
// Имейлът и паролата се ТРИМ-ват — за да не счупи случаен интервал в .env
// (напр. `WNB_ADMIN_PASS= парола`) логина.
function envAccounts() {
  const list = [];
  const au = norm(process.env.WNB_ADMIN_USER), ap = String(process.env.WNB_ADMIN_PASS || '').trim();
  if (au && ap) list.push({ email: au, pass: ap, kind: 'admin' });
  for (let i = 1; i <= 5; i++) {
    const u = norm(process.env['WNB_MOD' + i + '_USER']), p = String(process.env['WNB_MOD' + i + '_PASS'] || '').trim();
    if (u && p) list.push({ email: u, pass: p, kind: 'moderator' });
  }
  return list;
}

module.exports = { roleForEmail, envAccounts };
