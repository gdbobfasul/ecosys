// Version: 1.0001
// PostgreSQL заявки за scripts/fill-system-replies.js (нативен PG: $n, DISTINCT ON).
// Системни авто-отговори (is_system). БЕЗ runtime преводач.
//
// messages ползва или *_user_id, или *_phone колони → заявките с динамични имена
// са функции, които приемат (FROM, TO[, UKEY]) и връщат готовия SQL низ.
module.exports = {
  // Колоните на messages — интроспекция (PG information_schema).
  MESSAGES_COLUMNS:
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'messages'",

  // Системните потребители.
  SELECT_SYSTEM_USERS:
    'SELECT id, phone, country_code FROM users WHERE COALESCE(is_system,0) = 1',

  // Неотговорени съобщения от реални хора към даден системен потребител.
  // $1 = адресатът (системният), $2 = пак системният (за NOT EXISTS).
  FIND_UNANSWERED: (FROM, TO, UKEY) =>
    `SELECT DISTINCT ON (m.${FROM}) m.${FROM} AS sender, m.text, m.created_at
       FROM messages m
       JOIN users u ON u.${UKEY} = m.${FROM}
      WHERE m.${TO} = $1
        AND COALESCE(u.is_system,0) = 0
        AND m.text IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM messages r
           WHERE r.${FROM} = $2 AND r.${TO} = m.${FROM} AND r.created_at >= m.created_at
        )
      ORDER BY m.${FROM}, m.created_at DESC`,

  // Вмъкване на авто-отговор. $1 = системният (FROM), $2 = получателят (TO), $3 = текст.
  INSERT_REPLY: (FROM, TO) =>
    `INSERT INTO messages (${FROM}, ${TO}, text) VALUES ($1, $2, $3)`,
};
