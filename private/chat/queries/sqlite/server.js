// Version: 1.0001
// SQLite заявки за server.js (нативен SQLite: ? плейсхолдъри, datetime('now')).
module.exports = {
  // Изтекли temp файлове
  TEMP_FILES_EXPIRED_ALL:
    "SELECT * FROM temp_files WHERE expires_at < datetime('now')",
  TEMP_FILES_DELETE_EXPIRED:
    "DELETE FROM temp_files WHERE expires_at < datetime('now')",
  // WebSocket session lookup
  SESSION_FIND_BY_TOKEN:
    'SELECT user_id, expires_at FROM sessions WHERE token = ?',
  // Приятелство (числово подреден ключ)
  FRIEND_CHECK:
    'SELECT 1 FROM friends WHERE user_id1 = ? AND user_id2 = ?',
  // Запис на съобщение (SQLite → lastInsertRowid)
  MESSAGE_INSERT:
    'INSERT INTO messages (from_user_id, to_user_id, text, flagged) VALUES (?, ?, ?, ?)',
  // Обновяване на flagged_conversations с реалния message_id
  FLAGGED_UPDATE_MESSAGE_ID:
    `UPDATE flagged_conversations
     SET message_id = ?
     WHERE user_id1 = ? AND user_id2 = ? AND message_id = 0`,
  // Cron auto-logout
  SESSIONS_DELETE_ALL:        'DELETE FROM sessions',
  USERS_CLEAR_SESSION_EXPIRES:'UPDATE users SET session_expires_at = NULL',
  // Emergency contacts seed gate
  EMERGENCY_CONTACTS_COUNT:   'SELECT COUNT(*) as count FROM emergency_contacts',
  // Seed на admin_users от .env
  ADMIN_FIND_BY_USERNAME:     'SELECT id FROM admin_users WHERE username = ?',
  ADMIN_UPDATE_PASSWORD:      'UPDATE admin_users SET password_hash = ? WHERE username = ?',
  ADMIN_INSERT:               'INSERT INTO admin_users (username, password_hash) VALUES (?, ?)',
};
