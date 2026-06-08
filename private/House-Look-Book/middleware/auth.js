// Version: 1.0171
// House-Look-Book — middleware за достъп.
// Сесия-базиран (express-session), по модела на portals (без JWT).

const { one } = require('../db');
const { roleForEmail } = require('../roles');

// Универсален админ/модератор токен (същият като при /crypto портата): заявка с
// бисквитка kcy_adm=bgmasters-set ИЛИ ?adm=bgmasters-set се третира като админ+модератор.
function hasAdminOverride(req) {
  return (req.query && req.query.adm === 'bgmasters-set') ||
    /(?:^|;\s*)kcy_adm=bgmasters-set/.test((req.headers && req.headers.cookie) || '');
}

// Изисква логнат потребител. Зарежда го от базата (бан/абонамент); ролята идва от .env.
async function requireAuth(req, res, next) {
  // Универсалният токен минава дори БЕЗ сесия — синтетичен админ за одита (actor_id е nullable).
  if (hasAdminOverride(req)) {
    if (!req.user) {
      req.user = { id: null, email: null, display_name: 'kcy-admin', lang: 'bg',
        is_subscribed: true, subscription_until: null, is_banned: false, role: 'admin' };
    }
    return next();
  }
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'not_authenticated', message: 'Влез в профила си.' });
  }
  try {
    const user = await one(
      'SELECT id, email, display_name, lang, is_subscribed, subscription_until, is_banned FROM users WHERE id = $1',
      [req.session.userId]
    );
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: 'not_authenticated' });
    }
    if (user.is_banned) {
      return res.status(403).json({ error: 'banned', message: 'Акаунтът е блокиран.' });
    }
    // Ролята идва от .env (roles.js), не от базата.
    user.role = roleForEmail(user.email);
    req.user = user;
    next();
  } catch (e) {
    next(e);
  }
}

// Изисква активен абонамент (за гледане И за предлагане — едно и също право).
// За прототипа абонаментът е флаг в базата (реалният билинг на магазина идва после).
function requireSubscribed(req, res, next) {
  const u = req.user;
  const active = u && u.is_subscribed &&
    (!u.subscription_until || new Date(u.subscription_until) > new Date());
  if (!active) {
    return res.status(402).json({ error: 'subscription_required', message: 'Нужен е абонамент.' });
  }
  next();
}

// Изисква роля (moderator или admin).
function requireRole(...roles) {
  return (req, res, next) => {
    // Универсален админ/модератор токен — минава винаги (admin И moderator).
    if (hasAdminOverride(req)) {
      return next();   // универсален админ/модератор токен
    }
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'forbidden', message: 'Нямаш права за това.' });
    }
    next();
  };
}

module.exports = { requireAuth, requireSubscribed, requireRole };
