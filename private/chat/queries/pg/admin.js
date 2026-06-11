// Version: 1.0001
// PostgreSQL заявки за admin рутера (нативен PG: $n плейсхолдъри, RETURNING id,
// to_char(now()...) вместо datetime('now'), ON CONFLICT DO NOTHING, string_agg).
// БЕЗ runtime преводач. Динамичните заявки са builder-функции, връщащи {sql, params}.
//
// Помощник: NOW_TXT — текстова UTC дата-час колона (като datetime('now') в SQLite).
const NOW_TXT = "to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')";

module.exports = {
  // ── Admin login ──
  LOGIN_FIND_ADMIN:        'SELECT username, password_hash FROM admin_users WHERE username = $1',
  LOGIN_UPDATE_LAST_LOGIN: `UPDATE admin_users SET last_login = ${NOW_TXT} WHERE username = $1`,

  // ── Page 1: Flagged users (динамична търсачка) ──
  // Връща { sql, params, countSql, countParams }. limit/offset се добавят накрая.
  FLAGGED_USERS: (f) => {
    const params = [];
    let where = '';
    const add = (clause, ...vals) => { where += clause; vals.forEach(v => params.push(v)); };
    if (f.search)    add(' AND (u.full_name LIKE $N OR u.phone LIKE $N)', `%${f.search}%`, `%${f.search}%`);
    if (f.gender)    add(' AND u.gender = $N', f.gender);
    if (f.country)   add(' AND u.country LIKE $N', `%${f.country}%`);
    if (f.city)      add(' AND u.city LIKE $N', `%${f.city}%`);
    if (f.village)   add(' AND u.village LIKE $N', `%${f.village}%`);
    if (f.street)    add(' AND u.street LIKE $N', `%${f.street}%`);
    if (f.workplace) add(' AND u.workplace LIKE $N', `%${f.workplace}%`);
    if (f.isBlocked !== undefined) add(' AND u.is_blocked = $N', f.isBlocked === 'true' ? 1 : 0);
    if (f.heightMin) add(' AND u.height_cm >= $N', parseInt(f.heightMin));
    if (f.heightMax) add(' AND u.height_cm <= $N', parseInt(f.heightMax));
    if (f.weightMin) add(' AND u.weight_kg >= $N', parseInt(f.weightMin));
    if (f.weightMax) add(' AND u.weight_kg <= $N', parseInt(f.weightMax));

    const base = `
        FROM users u
        INNER JOIN flagged_conversations fc ON (u.id = fc.user_id1 OR u.id = fc.user_id2)
        WHERE fc.reviewed = 0${where}`;

    const countParams = params.slice();
    const dataParams = params.slice();
    dataParams.push(f.limit, f.offset);

    let sql = `
        SELECT DISTINCT
          u.id, u.phone, u.full_name, u.gender, u.height_cm, u.weight_kg,
          u.country, u.city, u.village, u.street, u.workplace,
          u.is_blocked, u.paid_until, u.report_count,
          COUNT(DISTINCT fc.id) as flagged_count
        ${base}
        GROUP BY u.id ORDER BY flagged_count DESC LIMIT $N OFFSET $N`;
    let countSql = `SELECT COUNT(DISTINCT u.id) as count ${base}`;

    // Номерирай $N СТРОГО по реда на появяване.
    let i = 0; sql = sql.replace(/\$N/g, () => '$' + (++i));
    let j = 0; countSql = countSql.replace(/\$N/g, () => '$' + (++j));
    return { sql, params: dataParams, countSql, countParams };
  },

  // ── Page 2: All users (динамична търсачка) ──
  ALL_USERS: (f) => {
    const params = [];
    let where = '';
    const add = (clause, ...vals) => { where += clause; vals.forEach(v => params.push(v)); };
    if (f.search)    add(' AND (phone LIKE $N OR full_name LIKE $N)', `%${f.search}%`, `%${f.search}%`);
    if (f.gender)    add(' AND gender = $N', f.gender);
    if (f.country)   add(' AND country LIKE $N', `%${f.country}%`);
    if (f.city)      add(' AND city LIKE $N', `%${f.city}%`);
    if (f.village)   add(' AND village LIKE $N', `%${f.village}%`);
    if (f.street)    add(' AND street LIKE $N', `%${f.street}%`);
    if (f.workplace) add(' AND workplace LIKE $N', `%${f.workplace}%`);
    if (f.isBlocked !== undefined) add(' AND is_blocked = $N', f.isBlocked === 'true' ? 1 : 0);
    if (f.heightMin) add(' AND height_cm >= $N', parseInt(f.heightMin));
    if (f.heightMax) add(' AND height_cm <= $N', parseInt(f.heightMax));
    if (f.weightMin) add(' AND weight_kg >= $N', parseInt(f.weightMin));
    if (f.weightMax) add(' AND weight_kg <= $N', parseInt(f.weightMax));

    const countParams = params.slice();
    const dataParams = params.slice();
    dataParams.push(f.limit, f.offset);

    let sql = `
        SELECT id, phone, full_name, gender, height_cm, weight_kg,
               country, city, village, street, workplace,
               paid_until, is_blocked, created_at, last_login
        FROM users
        WHERE 1=1${where}
        ORDER BY created_at DESC LIMIT $N OFFSET $N`;
    let countSql = `SELECT COUNT(*) as count FROM users WHERE 1=1${where}`;

    let i = 0; sql = sql.replace(/\$N/g, () => '$' + (++i));
    let j = 0; countSql = countSql.replace(/\$N/g, () => '$' + (++j));
    return { sql, params: dataParams, countSql, countParams };
  },

  // ── Page 4: Users with messages (динамична търсачка) ──
  USERS_WITH_MESSAGES: (f) => {
    const params = [];
    let where = '';
    const add = (clause, ...vals) => { where += clause; vals.forEach(v => params.push(v)); };
    if (f.search)    add(' AND (phone LIKE $N OR full_name LIKE $N)', `%${f.search}%`, `%${f.search}%`);
    if (f.gender)    add(' AND gender = $N', f.gender);
    if (f.country)   add(' AND country LIKE $N', `%${f.country}%`);
    if (f.city)      add(' AND city LIKE $N', `%${f.city}%`);
    if (f.village)   add(' AND village LIKE $N', `%${f.village}%`);
    if (f.street)    add(' AND street LIKE $N', `%${f.street}%`);
    if (f.workplace) add(' AND workplace LIKE $N', `%${f.workplace}%`);
    if (f.isBlocked !== undefined) add(' AND is_blocked = $N', f.isBlocked === 'true' ? 1 : 0);
    if (f.heightMin) add(' AND height_cm >= $N', parseInt(f.heightMin));
    if (f.heightMax) add(' AND height_cm <= $N', parseInt(f.heightMax));
    if (f.weightMin) add(' AND weight_kg >= $N', parseInt(f.weightMin));
    if (f.weightMax) add(' AND weight_kg <= $N', parseInt(f.weightMax));

    const countParams = params.slice();
    const dataParams = params.slice();
    dataParams.push(f.limit, f.offset);

    let sql = `
        SELECT id, phone, full_name, gender, height_cm, weight_kg,
               country, city, village, street, workplace, is_blocked,
               location_country, location_city, location_village, location_street,
               location_number, location_latitude, location_longitude, location_ip, location_captured_at
        FROM users
        WHERE 1=1${where}
        ORDER BY full_name LIMIT $N OFFSET $N`;
    let countSql = `SELECT COUNT(*) as count FROM users WHERE 1=1${where}`;

    let i = 0; sql = sql.replace(/\$N/g, () => '$' + (++i));
    let j = 0; countSql = countSql.replace(/\$N/g, () => '$' + (++j));
    return { sql, params: dataParams, countSql, countParams };
  },

  // Помощни към Page 4
  // PG драйверът изисква БРОЯ параметри = БРОЯ различни $n. Рутерът подава id-то
  // няколко пъти → използваме отделни $n за всяко подаване (НЕ преизползваме $1).
  USER_FLAGGED_COUNT:
    `SELECT COUNT(*) as count FROM flagged_conversations
          WHERE (user_id1 = $1 OR user_id2 = $2) AND reviewed = 0`,
  USER_CONVERSATIONS:
    `SELECT
            CASE WHEN from_user_id = $1 THEN to_user_id ELSE from_user_id END as contact_id,
            string_agg(text, E'\n') as messages
          FROM messages
          WHERE (from_user_id = $2 OR to_user_id = $3) AND text IS NOT NULL
          GROUP BY contact_id`,
  USER_PHONE_BY_ID: 'SELECT phone FROM users WHERE id = $1',

  // ── Page 5: User details ──
  USER_DETAILS:
    `SELECT id, phone, full_name, gender, birth_date, age, height_cm, weight_kg,
               country, city, village, street, workplace,
               email, code_word, current_need, offerings, is_verified, hide_phone, hide_names,
               profile_photo_url, working_hours,
               paid_until, payment_amount, payment_currency, subscription_active,
               emergency_active, emergency_active_until, mm_blocked, is_system,
               is_blocked, blocked_reason, created_at, last_login,
               location_country, location_city, location_village, location_street, location_number,
               location_latitude, location_longitude, location_ip, location_captured_at
        FROM users WHERE id = $1`,
  USER_DETAILS_FLAGGED_COUNT:
    `SELECT COUNT(*) as count FROM flagged_conversations
        WHERE (user_id1 = $1 OR user_id2 = $2) AND reviewed = 0`,
  // Рутерът подава (id, id, id, id) → 4 отделни $n.
  USER_CONTACTS:
    `SELECT DISTINCT
          CASE WHEN user_id1 = $1 THEN user_id2 ELSE user_id1 END as contact_id,
          CASE WHEN user_id1 = $2 THEN custom_name_by_user1 ELSE custom_name_by_user2 END as custom_name
        FROM friends
        WHERE user_id1 = $3 OR user_id2 = $4`,
  CONTACT_USER_DETAILS:
    `SELECT full_name, gender, country, city, village, street, paid_until, is_blocked
          FROM users WHERE id = $1`,
  // Рутерът подава (user.id, contact.id, contact.id, user.id) → 4 отделни $n.
  CONVERSATION_MESSAGES:
    `SELECT id, from_user_id, text, created_at
          FROM messages
          WHERE ((from_user_id = $1 AND to_user_id = $2) OR (from_user_id = $3 AND to_user_id = $4))
            AND text IS NOT NULL
          ORDER BY created_at DESC
          LIMIT 100`,

  // ── Edit message ──
  EDIT_MESSAGE: 'UPDATE messages SET text = $1 WHERE id = $2',

  // ── Block users (динамичен IN списък) ──
  BLOCK_USERS: (n) =>
    `UPDATE users SET is_blocked = 1, blocked_reason = $1 WHERE id IN (${Array.from({ length: n }, (_, i) => '$' + (i + 2)).join(',')})`,

  // ── Модул „Задачи" ──
  TASK_DISPUTES:
    `SELECT id, type, country, title, reward_amount, reward_currency, author_phone, executor_phone, done_report, done_at
         FROM tasks WHERE payment_disputed = TRUE ORDER BY done_at DESC LIMIT 200`,
  TASK_AUTHOR: 'SELECT author_phone FROM tasks WHERE id = $1',
  TASK_BAN_AUTHOR: 'UPDATE users SET is_blocked = 1, blocked_reason = $1 WHERE phone = $2',
  TASK_CLEAR_DISPUTE: 'UPDATE tasks SET payment_disputed = FALSE WHERE id = $1',

  // ── Unblock user ──
  UNBLOCK_USER:
    `UPDATE users
        SET is_blocked = 0, blocked_reason = NULL, failed_login_attempts = 0
        WHERE id = $1`,

  // ── Update payment ──
  PAYMENT_GET_PAID_UNTIL: 'SELECT paid_until FROM users WHERE id = $1',
  PAYMENT_SET_PAID_UNTIL: 'UPDATE users SET paid_until = $1 WHERE id = $2',
  // Подава се (userId, userId, months) — както в SQLite (3 плейсхолдъра).
  PAYMENT_INSERT_LOG:
    `INSERT INTO payment_logs (user_id, phone, amount, currency, status, payment_type, months)
        VALUES ($1, (SELECT phone FROM users WHERE id = $2), 0, 'MANUAL', 'succeeded', 'admin_manual', $3)`,

  // ── Mark unpaid ──
  MARK_UNPAID: 'UPDATE users SET paid_until = $1 WHERE id = $2',

  // ── Capture location ──
  CAPTURE_LOCATION:
    `UPDATE users
        SET location_country = $1, location_city = $2, location_village = $3,
            location_street = $4, location_number = $5, location_latitude = $6,
            location_longitude = $7, location_ip = $8, location_captured_at = ${NOW_TXT}
        WHERE id = $9`,
  GET_LOCATION:
    `SELECT location_country, location_city, location_village, location_street,
               location_number, location_latitude, location_longitude, location_ip, location_captured_at
        FROM users WHERE id = $1`,

  // ── Critical words ──
  CRITICAL_WORDS_LIST: 'SELECT * FROM critical_words ORDER BY word',
  CRITICAL_WORDS_ADD: 'INSERT INTO critical_words (word) VALUES ($1) ON CONFLICT DO NOTHING',
  CRITICAL_WORDS_DELETE: 'DELETE FROM critical_words WHERE id = $1',

  // ── Stats ──
  STATS_TOTAL_USERS:     'SELECT COUNT(*) as count FROM users',
  STATS_ACTIVE_USERS:    `SELECT COUNT(*) as count FROM users WHERE paid_until > ${NOW_TXT}`,
  STATS_BLOCKED_USERS:   'SELECT COUNT(*) as count FROM users WHERE is_blocked = 1',
  STATS_TOTAL_MESSAGES:  'SELECT COUNT(*) as count FROM messages',
  STATS_FLAGGED_CONV:    'SELECT COUNT(*) as count FROM flagged_conversations WHERE reviewed = 0',
  STATS_CRITICAL_WORDS:  'SELECT COUNT(*) as count FROM critical_words',
  STATS_TOTAL_REVENUE:   "SELECT SUM(amount) as total FROM payment_logs WHERE status = 'succeeded'",
  STATS_HELP_REQUESTS:   'SELECT COUNT(*) as count FROM help_requests WHERE resolved = 0',

  // ── Help requests (динамичен филтър resolved) ──
  HELP_REQUESTS: (resolved) => {
    if (resolved === undefined) {
      return { sql: 'SELECT * FROM help_requests ORDER BY request_time DESC LIMIT 100', params: [] };
    }
    return {
      sql: 'SELECT * FROM help_requests WHERE resolved = $1 ORDER BY request_time DESC LIMIT 100',
      params: [resolved === 'true' ? 1 : 0]
    };
  },
  HELP_REQUEST_CONTACTS:
    `SELECT service_type, service_name, phone_international, phone_local, email
          FROM emergency_contacts
          WHERE country_code = (
            SELECT country_code FROM users WHERE id = $1
          )
          AND service_type IN ('police', 'ambulance', 'hospital', 'emergency')
          AND is_active = 1`,
  HELP_REQUEST_BY_ID: 'SELECT * FROM help_requests WHERE id = $1',
  HELP_NEARBY_CONTACTS:
    `SELECT * FROM emergency_contacts
        WHERE country_code = (SELECT country_code FROM users WHERE id = $1)
        AND service_type IN ('police', 'ambulance', 'hospital', 'fire')
        AND latitude IS NOT NULL
        AND longitude IS NOT NULL
        AND is_active = 1`,
  HELP_NEARBY_USERS:
    `SELECT
          id, full_name, phone, email, gender, offerings,
          city, street, location_latitude, location_longitude
        FROM users
        WHERE
          is_verified = 1
          AND (
            offerings LIKE '%Доктор%'
            OR offerings LIKE '%Болница%'
            OR offerings LIKE '%Бърза помощ%'
            OR offerings LIKE '%Полиция%'
          )
          AND location_latitude IS NOT NULL
          AND location_longitude IS NOT NULL
          AND paid_until > ${NOW_TXT}`,
  HELP_RESOLVE:
    `UPDATE help_requests
        SET resolved = 1, resolved_at = ${NOW_TXT}, admin_notes = $1
        WHERE id = $2`,

  // ── Verify / offerings ──
  USER_VERIFY:
    `UPDATE users
        SET offerings = $1, is_verified = 1
        WHERE id = $2`,
  USER_UNVERIFY:
    `UPDATE users
        SET is_verified = 0
        WHERE id = $1`,
  USER_SET_OFFERINGS: 'UPDATE users SET offerings = $1 WHERE id = $2',

  // ── Payment override ──
  OVERRIDE_GET_USER:
    `SELECT id, phone, full_name, subscription_active,
               paid_until, emergency_active, emergency_active_until
        FROM users
        WHERE phone = $1`,
  OVERRIDE_APPLY_LOGIN:
    `UPDATE users
          SET subscription_active = 1,
              paid_until = $1,
              manually_activated = 1,
              activation_reason = $2,
              activated_by_admin_id = 1
          WHERE id = $3`,
  OVERRIDE_APPLY_EMERGENCY:
    `UPDATE users
          SET emergency_active = 1,
              emergency_active_until = $1,
              manually_activated = 1,
              activation_reason = $2,
              activated_by_admin_id = 1
          WHERE id = $3`,
  OVERRIDE_INSERT_LOG:
    `INSERT INTO payment_overrides
        (admin_id, user_id, action, days, reason, created_at)
        VALUES (1, $1, $2, $3, $4, ${NOW_TXT})`,
  OVERRIDE_HISTORY:
    `SELECT
          po.created_at,
          u.phone,
          po.action,
          po.days,
          po.reason,
          'admin' as admin_username
        FROM payment_overrides po
        JOIN users u ON po.user_id = u.id
        ORDER BY po.created_at DESC
        LIMIT 50`,

  // ── Static objects: list / update / delete ──
  STATIC_USERS_LIST:
    `SELECT id, phone, full_name, offerings, working_hours,
               latitude, longitude, is_static_object, profile_photo_url,
               created_from_signal_id, created_at
        FROM users
        ORDER BY is_static_object DESC, id DESC`,
  // Динамичен UPDATE SET → builder. cols: масив имена на колони (в реда на values).
  // values се подават отделно; id е ПОСЛЕДНИЯТ param. Връща { sql }.
  UPDATE_USER: (cols) => {
    let i = 0;
    const setClause = cols.map(col => `${col} = $${++i}`).join(', ');
    return { sql: `UPDATE users SET ${setClause} WHERE id = $${i + 1}` };
  },
  DELETE_USER: 'DELETE FROM users WHERE id = $1',

  // ── Преглед на 1 потребител (per-user админ изгледи) ──
  // Приятели в двете посоки (friends.user_id1 < user_id2). Подава се (userId, userId).
  ADMIN_USER_FRIENDS:
    `SELECT u.id AS friend_id, u.full_name, u.phone, u.city, u.country, u.is_blocked, f.created_at
       FROM friends f JOIN users u ON u.id = f.user_id2 WHERE f.user_id1 = $1
     UNION ALL
     SELECT u.id, u.full_name, u.phone, u.city, u.country, u.is_blocked, f.created_at
       FROM friends f JOIN users u ON u.id = f.user_id1 WHERE f.user_id2 = $2`,
  ADMIN_USER_SIGNALS:
    `SELECT id, signal_type, title, working_hours, latitude, longitude, photo_url,
            status, submitted_at, processed_at, rejection_reason, created_user_id
       FROM signals WHERE user_id = $1 ORDER BY submitted_at DESC LIMIT 200`,
  ADMIN_USER_PAYMENTS:
    `SELECT id, amount, currency, status, payment_type, months, country_code,
            ip_address, stripe_payment_id, created_at
       FROM payment_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200`,
  // Блокиране САМО в matchmaking (не пипа акаунта). $1 = 1/0, $2 = userId.
  MM_ADMIN_BLOCK_SET: 'UPDATE users SET mm_blocked = $1 WHERE id = $2',

  // ── Ecosystem status ──
  ECOSYSTEM_USER_COUNT:    'SELECT COUNT(*) as count FROM users',
  ECOSYSTEM_SESSION_COUNT: 'SELECT COUNT(*) as count FROM sessions',
  ECOSYSTEM_TABLES:        "SELECT tablename AS name FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
};
