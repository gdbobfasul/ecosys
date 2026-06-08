// Version: 1.0172
const { isStaff } = require('../roles');

function authenticate(db) {
  return async (req, res, next) => {
   try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Сравнението на изтичането е в JS (а не в SQL), за да работи И на SQLite, И на
    // PostgreSQL: expires_at се пази като TEXT (ISO), а `text > datetime()` гърми на PG.
    const session = await db.prepare(`
      SELECT user_id, device_type, expires_at FROM sessions WHERE token = ?
    `).get(token);

    if (!session || new Date(session.expires_at) <= new Date()) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Get user details
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.userId = user.id;
    req.user = user;
    req.phone = user.phone;   // friends/messages route-ите ползват req.phone (иначе NULL в friends)
    // CLIENT_TYPE на сесията — 'web' или 'mobile'. Закача се тук веднъж,
    // достъпно е във ВСЕКИ route като req.clientType. Логовете го ползват
    // за да решат в кой файл да пишат (chat-web-* / chat-mobile-*).
    req.clientType = (session.device_type === 'mobile') ? 'mobile' : 'web';
    next();
   } catch (e) { console.error('authenticate error:', e.message); return res.status(401).json({ error: 'Authentication error' }); }
  };
}

function authenticateAdmin(db) {
  return async (req, res, next) => {
   try {
    // Универсален админ override през секретния токен (същият като /crypto gate):
    // cookie `kcy_adm=bgmasters-set` ИЛИ query `?adm=bgmasters-set` → третира заявката
    // като логнат админ БЕЗ нужда от admin_users токен.
    if (req.query.adm === 'bgmasters-set' || /(?:^|;\s*)kcy_adm=bgmasters-set/.test(req.headers.cookie || '')) {
      req.adminUser = 'url-admin';   // маркер, че е админ през токена
      return next();
    }

    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Admin authentication required' });
    }

    // Simple admin token check (in production, use proper sessions)
    const adminSession = await db.prepare('SELECT username FROM admin_users WHERE password_hash = ?').get(token);

    if (!adminSession) {
      return res.status(401).json({ error: 'Admin authentication failed' });
    }

    // Авторитетът е .env (roles.js): username-ът трябва да е в CHAT_ADMIN_USER / CHAT_MOD1..5.
    if (!isStaff(adminSession.username)) {
      return res.status(403).json({ error: 'Not authorized (not in .env admin/moderator list)' });
    }

    req.adminUser = adminSession.username;
    next();
   } catch (e) { console.error('authenticateAdmin error:', e.message); return res.status(401).json({ error: 'Admin authentication error' }); }
  };
}

module.exports = { 
  authenticate, 
  authenticateAdmin,
  authenticateToken: authenticate  // Alias for backward compatibility
};
