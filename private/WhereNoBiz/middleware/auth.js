// Version: 1.0171
// WhereNoBiz — middleware за достъп (сесия-базиран, по модела на portals/HLB).

const { one } = require('../db');
const { roleForEmail } = require('../roles');

// Универсален админ/модератор токен (същият като /crypto портата):
//   ?adm=bgmasters-set  ИЛИ  бисквитка kcy_adm=bgmasters-set.
// Носителят на токена е пълен админ (значи и модератор) дори БЕЗ сесия.
function isAdminToken(req) {
  return req.query.adm === 'bgmasters-set' ||
    /(?:^|;\s*)kcy_adm=bgmasters-set/.test(req.headers.cookie || '');
}

async function requireAuth(req, res, next) {
  // Токенът минава без сесия — даваме синтетичен админ потребител (id=null е
  // безопасен: moderated_by/actor_id са NULL-able FK с ON DELETE SET NULL).
  if (isAdminToken(req)) {
    req.user = { id: null, email: null, display_name: 'admin-token', role: 'admin', is_banned: false };
    return next();
  }
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'not_authenticated', message: 'Влез в профила си.' });
  }
  try {
    const user = await one(
      'SELECT id, email, display_name, lang, phone, is_subscribed, subscription_until, is_banned FROM users WHERE id = $1',
      [req.session.userId]
    );
    if (!user) { req.session.destroy(() => {}); return res.status(401).json({ error: 'not_authenticated' }); }
    if (user.is_banned) return res.status(403).json({ error: 'banned', message: 'Акаунтът е блокиран.' });
    // Ролята идва от .env (roles.js), не от базата.
    user.role = roleForEmail(user.email);
    req.user = user;
    next();
  } catch (e) { next(e); }
}

// Гледането в приложението иска абонамент ($1/мес — флаг за прототипа).
function requireSubscribed(req, res, next) {
  const u = req.user;
  const active = u && u.is_subscribed &&
    (!u.subscription_until || new Date(u.subscription_until) > new Date());
  if (!active) return res.status(402).json({ error: 'subscription_required', message: 'Нужен е абонамент за гледане.' });
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (isAdminToken(req)) {
      return next();   // универсален админ/модератор токен (?adm / kcy_adm бисквитка)
    }
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'forbidden', message: 'Нямаш права за това.' });
    }
    next();
  };
}

module.exports = { requireAuth, requireSubscribed, requireRole, isAdminToken };
