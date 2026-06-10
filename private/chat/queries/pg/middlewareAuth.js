// Version: 1.0001
// PostgreSQL заявки за middleware/auth.js (нативен PG: $n плейсхолдъри).
module.exports = {
  SESSION_FIND_BY_TOKEN:   'SELECT user_id, device_type, expires_at FROM sessions WHERE token = $1',
  USER_FIND_BY_ID:         'SELECT * FROM users WHERE id = $1',
  ADMIN_FIND_BY_PASSWORD:  'SELECT username FROM admin_users WHERE password_hash = $1',
};
