// Version: 1.0001
// SQLite заявки за middleware/auth.js (нативен SQLite: ? плейсхолдъри).
module.exports = {
  SESSION_FIND_BY_TOKEN:   'SELECT user_id, device_type, expires_at FROM sessions WHERE token = ?',
  USER_FIND_BY_ID:         'SELECT * FROM users WHERE id = ?',
  ADMIN_FIND_BY_PASSWORD:  'SELECT username FROM admin_users WHERE password_hash = ?',
};
