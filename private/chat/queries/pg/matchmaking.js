// Version: 1.0001
// PostgreSQL заявки за matchmaking рутера (нативен PG: $n плейсхолдъри, RETURNING id,
// to_char(now()...) за датите вместо datetime('now')).
//
// Динамичните заявки (FIND_MATCHES / ADMIN_FIND_MATCHES) са builder-функции, които
// връщат { sql, params } — плейсхолдърите се номерират $1..$n по реда на push в params.
module.exports = {
  // --- CRITERIA ---
  CRITERIA_FIND_BY_USER: 'SELECT id FROM matchmaking_criteria WHERE user_id = $1',

  CRITERIA_UPDATE: `
    UPDATE matchmaking_criteria SET
      height_min = $1, height_max = $2, weight_min = $3, weight_max = $4,
      age_min = $5, age_max = $6, hair_color = $7, eye_color = $8,
      body_type = $9, ethnicity = $10, smoking = $11, drinking = $12,
      diet = $13, exercise = $14, pets = $15, children = $16,
      living_situation = $17, employment = $18, education = $19, religion = $20,
      personality = $21, interests = $22, music_taste = $23, movies_taste = $24,
      hobbies = $25, political_views = $26, travel_frequency = $27,
      night_owl_or_early_bird = $28, introvert_or_extrovert = $29,
      communication_style = $30, conflict_resolution = $31, love_language = $32,
      humor_type = $33, relationship_goals = $34, deal_breakers = $35,
      country = $36, city = $37, distance_km = $38, willing_to_relocate = $39,
      language_spoken = $40, income_range = $41, financial_goals = $42,
      car_ownership = $43, tech_savviness = $44, social_media_usage = $45,
      family_values = $46, jealousy_level = $47, independence_level = $48,
      future_plans = $49, commitment_level = $50,
      updated_at = to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS')
    WHERE user_id = $51
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
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45, $46, $47, $48, $49, $50, $51)
  `,

  CRITERIA_GET: 'SELECT * FROM matchmaking_criteria WHERE user_id = $1',

  // --- FIND MATCHES ($5) ---
  FIND_USER_PAYMENT: 'SELECT payment_amount, payment_currency, paid_until FROM users WHERE id = $1',

  FIND_DISLIKES: 'SELECT disliked_attribute, disliked_value FROM matchmaking_dislikes WHERE user_id = $1',

  FIND_BLOCKED: `
    SELECT blocked_user_id AS blocked_id FROM matchmaking_blocks WHERE user_id = $1
    UNION
    SELECT user_id AS blocked_id FROM matchmaking_blocks WHERE blocked_user_id = $2
  `,

  // Динамичен build на търсачката за обикновено търсене (POST /find).
  // criteria — обектът с критериите; blockedUsers — масив id; dislikes — масив { disliked_attribute, disliked_value }.
  FIND_MATCHES: (userId, blockedUsers, criteria, dislikes) => {
    const params = [];
    const ph = (v) => { params.push(v); return '$' + params.length; };
    // PG: при SELECT DISTINCT, ORDER BY RANDOM() не може да е извън select-листа →
    // обвиваме вътрешния DISTINCT в подзаявка и сортираме отвън (SQLite го прави директно).
    let sql = `
      SELECT * FROM (
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
    sql += ` ) t ORDER BY RANDOM() LIMIT 5`;
    return { sql, params };
  },

  DEDUCT_BALANCE: 'UPDATE users SET payment_amount = payment_amount - $1 WHERE id = $2',

  INSERT_SEARCH: `
    INSERT INTO matchmaking_searches (user_id, amount_charged, matches_found)
    VALUES ($1, $2, $3)
  `,

  GET_BALANCE: 'SELECT payment_amount FROM users WHERE id = $1',

  // --- INVITATIONS ---
  INVITE_FIND_RECEIVER: 'SELECT id FROM users WHERE id = $1',

  INVITE_FIND_EXISTING: 'SELECT id FROM matchmaking_invitations WHERE sender_id = $1 AND receiver_id = $2',

  INVITE_CHECK_BLOCKED: `
    SELECT id FROM matchmaking_blocks
    WHERE (user_id = $1 AND blocked_user_id = $2)
       OR (user_id = $3 AND blocked_user_id = $4)
  `,

  INVITE_INSERT: `
    INSERT INTO matchmaking_invitations (sender_id, receiver_id, status)
    VALUES ($1, $2, 'pending')
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
    WHERE i.receiver_id = $1 AND i.status = 'pending'
    ORDER BY i.created_at DESC
    LIMIT 50
  `,

  INVITATIONS_SENT: `
    SELECT
      i.id, i.receiver_id, i.status, i.created_at, i.responded_at,
      u.full_name, u.age, u.city
    FROM matchmaking_invitations i
    JOIN users u ON i.receiver_id = u.id
    WHERE i.sender_id = $1
    ORDER BY i.created_at DESC
  `,

  INVITATION_GET: 'SELECT * FROM matchmaking_invitations WHERE id = $1 AND receiver_id = $2',

  INVITATION_ACCEPT: `
    UPDATE matchmaking_invitations
    SET status = 'accepted', responded_at = to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS')
    WHERE id = $1
  `,

  // --- FRIENDS (при приет invite) ---
  // friends е с подреден числов ключ (user_id1 < user_id2). Рутерът подава вече
  // подредената двойка [low, high].
  FRIEND_FIND_EXISTING: 'SELECT 1 AS ok FROM friends WHERE user_id1 = $1 AND user_id2 = $2',

  FRIEND_INSERT: 'INSERT INTO friends (user_id1, user_id2) VALUES ($1, $2)',

  // --- BLOCK ---
  BLOCK_FIND_EXISTING: 'SELECT id FROM matchmaking_blocks WHERE user_id = $1 AND blocked_user_id = $2',

  BLOCK_INSERT: `
    INSERT INTO matchmaking_blocks (user_id, blocked_user_id)
    VALUES ($1, $2)
  `,

  DISLIKE_INSERT: `
    INSERT INTO matchmaking_dislikes (user_id, disliked_attribute, disliked_value)
    VALUES ($1, $2, $3)
  `,

  DISLIKE_COUNT: 'SELECT COUNT(*) as count FROM matchmaking_dislikes WHERE user_id = $1',

  BLOCK_UPDATE_INVITATIONS: `
    UPDATE matchmaking_invitations
    SET status = 'blocked', responded_at = to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS')
    WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $3 AND receiver_id = $4)
  `,

  // --- DISLIKES list ---
  DISLIKES_GROUPED: `
    SELECT disliked_attribute, disliked_value, COUNT(*) as count
    FROM matchmaking_dislikes
    WHERE user_id = $1
    GROUP BY disliked_attribute, disliked_value
    ORDER BY count DESC
  `,

  DISLIKES_TOTAL: 'SELECT COUNT(*) as count FROM matchmaking_dislikes WHERE user_id = $1',

  // --- ADMIN ---
  // Чатът няма users.is_admin. Авторитетът са credential-ите в admin_users (username),
  // попълнени от .env при старт (виж roles.js / server.js). Рутерът подава username-а.
  ADMIN_FIND: "SELECT 1 AS is_admin FROM admin_users WHERE username = $1",

  // Динамичен build за админ проверка (POST /admin/check) — БЕЗ LEFT JOIN, LIMIT 50.
  ADMIN_FIND_MATCHES: (userId, blockedUsers, criteria) => {
    const params = [];
    const ph = (v) => { params.push(v); return '$' + params.length; };
    // PG: DISTINCT + ORDER BY RANDOM() → подзаявка (виж FIND_MATCHES).
    let sql = `
      SELECT * FROM (
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
    sql += ` ) t ORDER BY RANDOM() LIMIT 50`;
    return { sql, params };
  },
};
