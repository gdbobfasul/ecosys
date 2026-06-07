// Version: 1.0193
// Find Best Price — middleware за достъп (сесия-базиран, по модела на WNB).

const { one } = require('../db');
const { roleForEmail } = require('../roles');

async function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'not_authenticated', message: 'Влез в профила си.' });
  }
  try {
    const user = await one('SELECT id, email, display_name, lang, is_banned FROM users WHERE id = $1', [req.session.userId]);
    if (!user) { req.session.destroy(() => {}); return res.status(401).json({ error: 'not_authenticated' }); }
    if (user.is_banned) return res.status(403).json({ error: 'banned', message: 'Акаунтът е блокиран.' });
    user.role = roleForEmail(user.email);
    req.user = user;
    next();
  } catch (e) { next(e); }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'forbidden', message: 'Нямаш права за това.' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
