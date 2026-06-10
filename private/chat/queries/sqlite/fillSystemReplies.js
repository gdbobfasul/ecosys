// Version: 1.0001
// SQLite заявки за scripts/fill-system-replies.js (нативен SQLite: ? плейсхолдъри).
// Системни авто-отговори (is_system). БЕЗ runtime преводач.
//
// messages ползва или *_user_id, или *_phone колони → заявките с динамични имена
// са функции, които приемат (FROM, TO[, UKEY]) и връщат готовия SQL низ.
// SQLite няма DISTINCT ON → еквивалент с GROUP BY + MAX(created_at) (по подателя).
module.exports = {
  // Колоните на messages — интроспекция (SQLite pragma).
  MESSAGES_COLUMNS:
    "SELECT name AS column_name FROM pragma_table_info('messages')",

  // Системните потребители.
  SELECT_SYSTEM_USERS:
    'SELECT id, phone, country_code FROM users WHERE COALESCE(is_system,0) = 1',

  // Неотговорени съобщения от реални хора към даден системен потребител.
  // ? = адресатът (системният), ? = пак системният (за NOT EXISTS).
  FIND_UNANSWERED: (FROM, TO, UKEY) =>
    `SELECT m.${FROM} AS sender, m.text, MAX(m.created_at) AS created_at
       FROM messages m
       JOIN users u ON u.${UKEY} = m.${FROM}
      WHERE m.${TO} = ?
        AND COALESCE(u.is_system,0) = 0
        AND m.text IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM messages r
           WHERE r.${FROM} = ? AND r.${TO} = m.${FROM} AND r.created_at >= m.created_at
        )
      GROUP BY m.${FROM}`,

  // Вмъкване на авто-отговор. ? = системният (FROM), ? = получателят (TO), ? = текст.
  INSERT_REPLY: (FROM, TO) =>
    `INSERT INTO messages (${FROM}, ${TO}, text) VALUES (?, ?, ?)`,
};
