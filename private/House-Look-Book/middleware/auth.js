// House-Look-Book — middleware за достъп.
// Сесия-базиран (express-session), по модела на portals. Без крипто, без JWT.

const { one } = require('../db');

// Изисква логнат потребител. Зарежда го от базата (за роля/бан/абонамент).
async function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'not_authenticated', message: 'Влез в профила си.' });
  }
  try {
    const user = await one(
      'SELECT id, email, display_name, lang, role, is_subscribed, subscription_until, is_banned FROM users WHERE id = $1',
      [req.session.userId]
    );
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: 'not_authenticated' });
    }
    if (user.is_banned) {
      return res.status(403).json({ error: 'banned', message: 'Акаунтът е блокиран.' });
    }
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
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'forbidden', message: 'Нямаш права за това.' });
    }
    next();
  };
}

module.exports = { requireAuth, requireSubscribed, requireRole };
