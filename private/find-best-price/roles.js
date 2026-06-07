// Version: 1.0193
// Find Best Price — роли от глобалния .env (като WhereNoBiz/HLB).
//   FBP_ADMIN_USER / FBP_ADMIN_PASS              → админ
//   FBP_MOD1..5_USER / FBP_MOD1..5_PASS          → модератори
// Правата НЕ са в базата — извеждат се от имейла спрямо .env.

function envAccounts() {
  const out = [];
  if (process.env.FBP_ADMIN_USER && process.env.FBP_ADMIN_PASS) {
    out.push({ email: process.env.FBP_ADMIN_USER.toLowerCase(), pass: process.env.FBP_ADMIN_PASS, kind: 'admin' });
  }
  for (let i = 1; i <= 5; i++) {
    const u = process.env['FBP_MOD' + i + '_USER'], p = process.env['FBP_MOD' + i + '_PASS'];
    if (u && p) out.push({ email: u.toLowerCase(), pass: p, kind: 'mod' });
  }
  return out;
}

function roleForEmail(email) {
  email = (email || '').toLowerCase();
  if (process.env.FBP_ADMIN_USER && email === process.env.FBP_ADMIN_USER.toLowerCase()) return 'admin';
  for (let i = 1; i <= 5; i++) {
    const u = process.env['FBP_MOD' + i + '_USER'];
    if (u && email === u.toLowerCase()) return 'moderator';
  }
  return 'user';
}

module.exports = { envAccounts, roleForEmail };
