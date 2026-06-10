// Version: 1.0001
// SQLite заявки за messages рутера (нативен SQLite: ? плейсхолдъри, datetime('now')).
module.exports = {
  // Приятели ли са двата акаунта (подреден ключ user_id1 < user_id2).
  FRIENDS_CHECK:           'SELECT 1 FROM friends WHERE user_id1 = ? AND user_id2 = ?',

  // ── Download file ──
  FILE_GET_FOR_RECIPIENT:  'SELECT * FROM temp_files WHERE id = ? AND to_user_id = ?',
  FILE_DELETE:             'DELETE FROM temp_files WHERE id = ?',
  FILE_MARK_DOWNLOADED:    'UPDATE temp_files SET downloaded = 1 WHERE id = ?',

  // ── Send location ──
  INSERT_TEXT_MESSAGE:     'INSERT INTO messages (from_user_id, to_user_id, text) VALUES (?, ?, ?)',

  // ── Get conversation ──
  GET_CONVERSATION: `
        SELECT id, from_user_id, text, file_id, file_name, file_size, file_type, created_at, read_at
        FROM messages
        WHERE (from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)
        ORDER BY created_at DESC LIMIT 100
      `,
  MARK_READ: "UPDATE messages SET read_at = datetime('now') WHERE to_user_id = ? AND from_user_id = ? AND read_at IS NULL",

  // ── Send file (multipart) ──
  INSERT_TEMP_FILE: `
        INSERT INTO temp_files (id, from_user_id, to_user_id, file_name, file_size, file_type, file_path, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
  INSERT_FILE_MESSAGE: `
        INSERT INTO messages (from_user_id, to_user_id, file_id, file_name, file_size, file_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `,

  // ── Send text message ──
  COUNT_DAILY_MESSAGES: `
          SELECT COUNT(*) as count FROM messages
          WHERE from_user_id = ? AND created_at LIKE ?
        `,
  // Резултатът ползва lastInsertRowid → SQLite го дава автоматично.
  INSERT_FLAGGED_MESSAGE: 'INSERT INTO messages (from_user_id, to_user_id, text, flagged) VALUES (?, ?, ?, ?)',
  UPDATE_FLAGGED_CONVERSATION: `
          UPDATE flagged_conversations SET message_id = ?
          WHERE user_id1 = ? AND user_id2 = ? AND message_id = 0
        `,
};
