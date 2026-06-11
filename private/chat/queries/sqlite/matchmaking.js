// Version: 1.0001
// SQLite заявки за matchmaking рутера (нативен SQLite: ? плейсхолдъри, datetime('now')).
//
// Динамичните заявки (FIND_MATCHES / ADMIN_FIND_MATCHES) са builder-функции, които
// връщат { sql, params } — плейсхолдърите са "?" по реда на push в params.
module.exports = {
  // --- CRITERIA ---
  CRITERIA_FIND_BY_USER: 'SELECT id FROM matchmaking_criteria WHERE user_id = ?',

  CRITERIA_UPDATE: `
    UPDATE matchmaking_criteria SET
      height_min = ?, height_max = ?, weight_min = ?, weight_max = ?,
      age_min = ?, age_max = ?, hair_color = ?, eye_color = ?,
      body_type = ?, ethnicity = ?, smoking = ?, drinking = ?,
      diet = ?, exercise = ?, pets = ?, children = ?,
      living_situation = ?, employment = ?, education = ?, religion = ?,
      personality = ?, interests = ?, music_taste = ?, movies_taste = ?,
      hobbies = ?, political_views = ?, travel_frequency = ?,
      night_owl_or_early_bird = ?, introvert_or_extrovert = ?,
      communication_style = ?, conflict_resolution = ?, love_language = ?,
      humor_type = ?, relationship_goals = ?, deal_breakers = ?,
      country = ?, city = ?, distance_km = ?, willing_to_relocate = ?,
      language_spoken = ?, income_range = ?, financial_goals = ?,
      car_ownership = ?, tech_savviness = ?, social_media_usage = ?,
      family_values = ?, jealousy_level = ?, independence_level = ?,
      future_plans = ?, commitment_level = ?,
      updated_at = datetime('now')
    WHERE user_id = ?
  `,

  CRITERIA_INSERT: `
    INSERT INTO matchmaking_criteria (
      user_id, height_min, height_max, weight_min, weight_max,
      age_min, age_max, hair_color, eye_color, body_type, ethnicity,
      smoking, drinking, diet, exercise, pets, children,
      living_situation, employment, education, religion,
      personality, interests, music_taste, movies_taste, hobbies,
      political_views, travel_frequency, night_owl_or_early_bird,
      introvert_or_extrovert, communication_style, conflict_resolution,
      love_language, humor_type, relationship_goals, deal_breakers,
      country, city, distance_km, willing_to_relocate, language_spoken,
      income_range, financial_goals, car_ownership, tech_savviness,
      social_media_usage, family_values, jealousy_level,
      independence_level, future_plans, commitment_level
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,

  CRITERIA_GET: 'SELECT * FROM matchmaking_criteria WHERE user_id = ?',

  // --- FIND MATCHES ($5) ---
  FIND_USER_PAYMENT: 'SELECT payment_amount, payment_currency, paid_until FROM users WHERE id = ?',

  FIND_DISLIKES: 'SELECT disliked_attribute, disliked_value FROM matchmaking_dislikes WHERE user_id = ?',

  FIND_BLOCKED: `
    SELECT blocked_user_id AS blocked_id FROM matchmaking_blocks WHERE user_id = ?
    UNION
    SELECT user_id AS blocked_id FROM matchmaking_blocks WHERE blocked_user_id = ?
  `,

  // Динамичен build на търсачката за обикновено търсене (POST /find).
  FIND_MATCHES: (userId, blockedUsers, criteria, dislikes) => {
    const params = [];
    const ph = (v) => { params.push(v); return '?'; };
    let sql = `
      SELECT DISTINCT u.id, u.full_name, u.age, u.gender, u.height_cm, u.weight_kg,
             u.city, u.country
      FROM users u
      LEFT JOIN matchmaking_criteria mc ON u.id = mc.user_id
      WHERE u.id != ${ph(userId)} AND u.mm_blocked = 0
    `;
    if (blockedUsers.length > 0) {
      sql += ` AND u.id NOT IN (${blockedUsers.map(b => ph(b)).join(',')})`;
    }
    if (criteria.age_min)    { sql += ` AND u.age >= ${ph(criteria.age_min)}`; }
    if (criteria.age_max)    { sql += ` AND u.age <= ${ph(criteria.age_max)}`; }
    if (criteria.height_min) { sql += ` AND u.height_cm >= ${ph(criteria.height_min)}`; }
    if (criteria.height_max) { sql += ` AND u.height_cm <= ${ph(criteria.height_max)}`; }
    if (criteria.weight_min) { sql += ` AND u.weight_kg >= ${ph(criteria.weight_min)}`; }
    if (criteria.weight_max) { sql += ` AND u.weight_kg <= ${ph(criteria.weight_max)}`; }
    if (criteria.country && criteria.country !== 'no-preference') { sql += ` AND u.country = ${ph(criteria.country)}`; }
    if (criteria.city && criteria.city !== 'no-preference')       { sql += ` AND u.city = ${ph(criteria.city)}`; }
    for (const dislike of dislikes) {
      if (dislike.disliked_attribute === 'height_cm') {
        sql += ` AND u.height_cm != ${ph(parseInt(dislike.disliked_value))}`;
      } else if (dislike.disliked_attribute === 'age') {
        sql += ` AND u.age != ${ph(parseInt(dislike.disliked_value))}`;
      }
    }
    sql += ` ORDER BY RANDOM() LIMIT 5`;
    return { sql, params };
  },

  DEDUCT_BALANCE: 'UPDATE users SET payment_amount = payment_amount - ? WHERE id = ?',

  INSERT_SEARCH: `
    INSERT INTO matchmaking_searches (user_id, amount_charged, matches_found)
    VALUES (?, ?, ?)
  `,

  GET_BALANCE: 'SELECT payment_amount FROM users WHERE id = ?',

  // --- INVITATIONS ---
  INVITE_FIND_RECEIVER: 'SELECT id FROM users WHERE id = ?',

  INVITE_FIND_EXISTING: 'SELECT id FROM matchmaking_invitations WHERE sender_id = ? AND receiver_id = ?',

  INVITE_CHECK_BLOCKED: `
    SELECT id FROM matchmaking_blocks
    WHERE (user_id = ? AND blocked_user_id = ?)
       OR (user_id = ? AND blocked_user_id = ?)
  `,

  INVITE_INSERT: `
    INSERT INTO matchmaking_invitations (sender_id, receiver_id, status)
    VALUES (?, ?, 'pending')
  `,

  INVITATIONS_RECEIVED: `
    SELECT
      i.id, i.sender_id, i.created_at,
      u.full_name, u.age, u.gender, u.height_cm, u.weight_kg,
      u.city, u.country,
      mc.*
    FROM matchmaking_invitations i
    JOIN users u ON i.sender_id = u.id
    LEFT JOIN matchmaking_criteria mc ON u.id = mc.user_id
    WHERE i.receiver_id = ? AND i.status = 'pending'
    ORDER BY i.created_at DESC
    LIMIT 50
  `,

  INVITATIONS_SENT: `
    SELECT
      i.id, i.receiver_id, i.status, i.created_at, i.responded_at,
      u.full_name, u.age, u.city
    FROM matchmaking_invitations i
    JOIN users u ON i.receiver_id = u.id
    WHERE i.sender_id = ?
    ORDER BY i.created_at DESC
  `,

  INVITATION_GET: 'SELECT * FROM matchmaking_invitations WHERE id = ? AND receiver_id = ?',

  INVITATION_ACCEPT: `
    UPDATE matchmaking_invitations
    SET status = 'accepted', responded_at = datetime('now')
    WHERE id = ?
  `,

  // --- FRIENDS (при приет invite) ---
  // friends е с подреден числов ключ (user_id1 < user_id2). Рутерът подава вече
  // подредената двойка [low, high].
  FRIEND_FIND_EXISTING: 'SELECT 1 AS ok FROM friends WHERE user_id1 = ? AND user_id2 = ?',

  FRIEND_INSERT: 'INSERT INTO friends (user_id1, user_id2) VALUES (?, ?)',

  // --- BLOCK ---
  BLOCK_FIND_EXISTING: 'SELECT id FROM matchmaking_blocks WHERE user_id = ? AND blocked_user_id = ?',

  BLOCK_INSERT: `
    INSERT INTO matchmaking_blocks (user_id, blocked_user_id)
    VALUES (?, ?)
  `,

  DISLIKE_INSERT: `
    INSERT INTO matchmaking_dislikes (user_id, disliked_attribute, disliked_value)
    VALUES (?, ?, ?)
  `,

  DISLIKE_COUNT: 'SELECT COUNT(*) as count FROM matchmaking_dislikes WHERE user_id = ?',

  BLOCK_UPDATE_INVITATIONS: `
    UPDATE matchmaking_invitations
    SET status = 'blocked', responded_at = datetime('now')
    WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
  `,

  // --- DISLIKES list ---
  DISLIKES_GROUPED: `
    SELECT disliked_attribute, disliked_value, COUNT(*) as count
    FROM matchmaking_dislikes
    WHERE user_id = ?
    GROUP BY disliked_attribute, disliked_value
    ORDER BY count DESC
  `,

  DISLIKES_TOTAL: 'SELECT COUNT(*) as count FROM matchmaking_dislikes WHERE user_id = ?',

  // --- ADMIN ---
  // Чатът няма users.is_admin. Авторитетът са credential-ите в admin_users (username),
  // попълнени от .env при старт (виж roles.js / server.js). Рутерът подава username-а.
  ADMIN_FIND: 'SELECT 1 AS is_admin FROM admin_users WHERE username = ?',

  // Динамичен build за админ проверка (POST /admin/check) — БЕЗ LEFT JOIN, LIMIT 50.
  ADMIN_FIND_MATCHES: (userId, blockedUsers, criteria) => {
    const params = [];
    const ph = (v) => { params.push(v); return '?'; };
    let sql = `
      SELECT DISTINCT u.id, u.full_name, u.age, u.gender, u.height_cm, u.weight_kg,
             u.city, u.country
      FROM users u
      WHERE u.id != ${ph(userId)} AND u.mm_blocked = 0
    `;
    if (blockedUsers.length > 0) {
      sql += ` AND u.id NOT IN (${blockedUsers.map(b => ph(b)).join(',')})`;
    }
    if (criteria.age_min) { sql += ` AND u.age >= ${ph(criteria.age_min)}`; }
    if (criteria.age_max) { sql += ` AND u.age <= ${ph(criteria.age_max)}`; }
    sql += ` ORDER BY RANDOM() LIMIT 50`;
    return { sql, params };
  },
};
