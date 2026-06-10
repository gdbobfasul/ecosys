// Version: 1.0001
// PostgreSQL заявки за messages рутера (нативен PG: $n плейсхолдъри, RETURNING id).
// Темпоралните колони са TEXT → datetime('now') се превежда към to_char(...TEXT...),
// а LIKE/сравненията на дати остават текстови (форматът е сортируем).
module.exports = {
  // Приятели ли са двата акаунта (подреден ключ user_id1 < user_id2).
  FRIENDS_CHECK:           'SELECT 1 FROM friends WHERE user_id1 = $1 AND user_id2 = $2',

  // ── Download file ──
  FILE_GET_FOR_RECIPIENT:  'SELECT * FROM temp_files WHERE id = $1 AND to_user_id = $2',
  FILE_DELETE:             'DELETE FROM temp_files WHERE id = $1',
  FILE_MARK_DOWNLOADED:    'UPDATE temp_files SET downloaded = 1 WHERE id = $1',

  // ── Send location ──
  INSERT_TEXT_MESSAGE:     'INSERT INTO messages (from_user_id, to_user_id, text) VALUES ($1, $2, $3)',

  // ── Get conversation ──
  GET_CONVERSATION: `
        SELECT id, from_user_id, text, file_id, file_name, file_size, file_type, created_at, read_at
        FROM messages
        WHERE (from_user_id = $1 AND to_user_id = $2) OR (from_user_id = $3 AND to_user_id = $4)
        ORDER BY created_at DESC LIMIT 100
      `,
  MARK_READ: "UPDATE messages SET read_at = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') WHERE to_user_id = $1 AND from_user_id = $2 AND read_at IS NULL",

  // ── Send file (multipart) ──
  INSERT_TEMP_FILE: `
        INSERT INTO temp_files (id, from_user_id, to_user_id, file_name, file_size, file_type, file_path, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
  INSERT_FILE_MESSAGE: `
        INSERT INTO messages (from_user_id, to_user_id, file_id, file_name, file_size, file_type)
        VALUES ($1, $2, $3, $4, $5, $6)
      `,

  // ── Send text message ──
  COUNT_DAILY_MESSAGES: `
          SELECT COUNT(*) as count FROM messages
          WHERE from_user_id = $1 AND created_at LIKE $2
        `,
  // Резултатът ползва lastInsertRowid → RETURNING id дава вмъкнатия id.
  INSERT_FLAGGED_MESSAGE: 'INSERT INTO messages (from_user_id, to_user_id, text, flagged) VALUES ($1, $2, $3, $4) RETURNING id',
  UPDATE_FLAGGED_CONVERSATION: `
          UPDATE flagged_conversations SET message_id = $1
          WHERE user_id1 = $2 AND user_id2 = $3 AND message_id = 0
        `,
};
