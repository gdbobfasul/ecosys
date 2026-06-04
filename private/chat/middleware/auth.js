// Version: 1.0171
const { isStaff } = require('../roles');

function authenticate(db) {
  return (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const session = db.prepare(`
      SELECT user_id, device_type FROM sessions 
      WHERE token = ? AND expires_at > datetime('now')
    `).get(token);
    
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Get user details
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.userId = user.id;
    req.user = user;
    // CLIENT_TYPE на сесията — 'web' или 'mobile'. Закача се тук веднъж,
    // достъпно е във ВСЕКИ route като req.clientType. Логовете го ползват
    // за да решат в кой файл да пишат (chat-web-* / chat-mobile-*).
    req.clientType = (session.device_type === 'mobile') ? 'mobile' : 'web';
    next();
  };
}

function authenticateAdmin(db) {
  return (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Admin authentication required' });
    }

    // Simple admin token check (in production, use proper sessions)
    const adminSession = db.prepare('SELECT username FROM admin_users WHERE password_hash = ?').get(token);

    if (!adminSession) {
      return res.status(401).json({ error: 'Admin authentication failed' });
    }

    // Авторитетът е .env (roles.js): username-ът трябва да е в CHAT_ADMIN_USER / CHAT_MOD1..5.
    if (!isStaff(adminSession.username)) {
      return res.status(403).json({ error: 'Not authorized (not in .env admin/moderator list)' });
    }

    req.adminUser = adminSession.username;
    next();
  };
}

module.exports = { 
  authenticate, 
  authenticateAdmin,
  authenticateToken: authenticate  // Alias for backward compatibility
};
