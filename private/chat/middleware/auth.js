// Version: 1.0056
function authenticate(db) {
  return (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const session = db.prepare(`
      SELECT user_id FROM sessions 
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

    req.adminUser = adminSession.username;
    next();
  };
}

module.exports = { 
  authenticate, 
  authenticateAdmin,
  authenticateToken: authenticate  // Alias for backward compatibility
};
