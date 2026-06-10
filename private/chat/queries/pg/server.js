// Version: 1.0001
// PostgreSQL заявки за server.js (нативен PG: $n плейсхолдъри, now() AT TIME ZONE 'UTC').
module.exports = {
  // Изтекли temp файлове — datetime('now') → to_char(now() AT TIME ZONE 'UTC', ...)
  TEMP_FILES_EXPIRED_ALL:
    "SELECT * FROM temp_files WHERE expires_at < to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')",
  TEMP_FILES_DELETE_EXPIRED:
    "DELETE FROM temp_files WHERE expires_at < to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')",
  // WebSocket session lookup
  SESSION_FIND_BY_TOKEN:
    'SELECT user_id, expires_at FROM sessions WHERE token = $1',
  // Приятелство (числово подреден ключ)
  FRIEND_CHECK:
    'SELECT 1 FROM friends WHERE user_id1 = $1 AND user_id2 = $2',
  // Запис на съобщение (PG → RETURNING id за lastInsertRowid)
  MESSAGE_INSERT:
    'INSERT INTO messages (from_user_id, to_user_id, text, flagged) VALUES ($1, $2, $3, $4) RETURNING id',
  // Обновяване на flagged_conversations с реалния message_id
  FLAGGED_UPDATE_MESSAGE_ID:
    `UPDATE flagged_conversations
     SET message_id = $1
     WHERE user_id1 = $2 AND user_id2 = $3 AND message_id = 0`,
  // Cron auto-logout
  SESSIONS_DELETE_ALL:        'DELETE FROM sessions',
  USERS_CLEAR_SESSION_EXPIRES:'UPDATE users SET session_expires_at = NULL',
  // Emergency contacts seed gate
  EMERGENCY_CONTACTS_COUNT:   'SELECT COUNT(*) as count FROM emergency_contacts',
  // Seed на admin_users от .env
  ADMIN_FIND_BY_USERNAME:     'SELECT id FROM admin_users WHERE username = $1',
  ADMIN_UPDATE_PASSWORD:      'UPDATE admin_users SET password_hash = $1 WHERE username = $2',
  ADMIN_INSERT:               'INSERT INTO admin_users (username, password_hash) VALUES ($1, $2)',
};
