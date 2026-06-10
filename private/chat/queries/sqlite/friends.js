// Version: 1.0001
// SQLite заявки за friends рутера (нативен SQLite: ? плейсхолдъри).
// Контактите се адресират по account id (users.id), НЕ по телефон.

// Динамичен search builder — гради WHERE според подадените филтри.
// Връща { sql, params }. Използва "?" плейсхолдъри по реда на push.
function SEARCH({ phone, country, gender, height, weight, userId }) {
  const params = [];

  let sql = `
        SELECT id, phone, full_name, gender, height_cm, weight_kg,
               country, city, village, street
        FROM users
        WHERE paid_until > datetime('now')
      `;

  if (phone)   { sql += ` AND phone LIKE ?`;   params.push(`%${phone}%`); }
  if (country) { sql += ` AND country LIKE ?`; params.push(`%${country}%`); }
  if (gender)  { sql += ` AND gender = ?`;      params.push(gender); }
  if (height)  { sql += ` AND height_cm = ?`;   params.push(parseInt(height)); }
  if (weight)  { sql += ` AND weight_kg = ?`;   params.push(parseInt(weight)); }

  sql += ` AND id != ? LIMIT 50`;
  params.push(userId);
  return { sql, params };
}

module.exports = {
  SEARCH,

  FRIENDS_LIST: `
        SELECT
          CASE WHEN user_id1 = ? THEN user_id2 ELSE user_id1 END as friend_id,
          CASE WHEN user_id1 = ? THEN custom_name_by_user1 ELSE custom_name_by_user2 END as custom_name
        FROM friends
        WHERE user_id1 = ? OR user_id2 = ?
      `,

  FRIEND_USER: 'SELECT phone, full_name FROM users WHERE id = ?',

  LAST_MESSAGE: `
          SELECT text, created_at FROM messages
          WHERE (from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)
          ORDER BY created_at DESC LIMIT 1
        `,

  UNREAD_COUNT: `
          SELECT COUNT(*) as count FROM messages
          WHERE to_user_id = ? AND from_user_id = ? AND read_at IS NULL
        `,

  ADD_CHECK_USER: 'SELECT id, paid_until FROM users WHERE id = ?',

  ADD_INSERT: 'INSERT INTO friends (user_id1, user_id2) VALUES (?, ?)',

  // Динамична колона (custom_name_by_user1/2) е ИДЕНТИФИКАТОР, не параметър — подава се във builder-а.
  CUSTOM_NAME_UPDATE: (field) =>
    `UPDATE friends SET ${field} = ? WHERE user_id1 = ? AND user_id2 = ?`,
};
