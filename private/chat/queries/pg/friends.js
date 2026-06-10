// Version: 1.0001
// PostgreSQL заявки за friends рутера (нативен PG: $n плейсхолдъри, RETURNING id).
// Контактите се адресират по account id (users.id), НЕ по телефон.

// Динамичен search builder — гради WHERE според подадените филтри.
// Връща { sql, params }. Номерира $1..$n по реда на push.
// paid_until е TEXT (формат 'YYYY-MM-DD HH24:MI:SS') → сравняваме с now() в същия формат.
function SEARCH({ phone, country, gender, height, weight, userId }) {
  const params = [];
  const p = (v) => { params.push(v); return '$' + params.length; };

  let sql = `
        SELECT id, phone, full_name, gender, height_cm, weight_kg,
               country, city, village, street
        FROM users
        WHERE paid_until > to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')
      `;

  if (phone)   { sql += ` AND phone LIKE ${p(`%${phone}%`)}`; }
  if (country) { sql += ` AND country LIKE ${p(`%${country}%`)}`; }
  if (gender)  { sql += ` AND gender = ${p(gender)}`; }
  if (height)  { sql += ` AND height_cm = ${p(parseInt(height))}`; }
  if (weight)  { sql += ` AND weight_kg = ${p(parseInt(weight))}`; }

  sql += ` AND id != ${p(userId)} LIMIT 50`;
  return { sql, params };
}

module.exports = {
  SEARCH,

  FRIENDS_LIST: `
        SELECT
          CASE WHEN user_id1 = $1 THEN user_id2 ELSE user_id1 END as friend_id,
          CASE WHEN user_id1 = $2 THEN custom_name_by_user1 ELSE custom_name_by_user2 END as custom_name
        FROM friends
        WHERE user_id1 = $3 OR user_id2 = $4
      `,

  FRIEND_USER: 'SELECT phone, full_name FROM users WHERE id = $1',

  LAST_MESSAGE: `
          SELECT text, created_at FROM messages
          WHERE (from_user_id = $1 AND to_user_id = $2) OR (from_user_id = $3 AND to_user_id = $4)
          ORDER BY created_at DESC LIMIT 1
        `,

  UNREAD_COUNT: `
          SELECT COUNT(*) as count FROM messages
          WHERE to_user_id = $1 AND from_user_id = $2 AND read_at IS NULL
        `,

  ADD_CHECK_USER: 'SELECT id, paid_until FROM users WHERE id = $1',

  ADD_INSERT: 'INSERT INTO friends (user_id1, user_id2) VALUES ($1, $2)',

  // Динамична колона (custom_name_by_user1/2) е ИДЕНТИФИКАТОР, не параметър — подава се във builder-а.
  CUSTOM_NAME_UPDATE: (field) =>
    `UPDATE friends SET ${field} = $1 WHERE user_id1 = $2 AND user_id2 = $3`,
};
