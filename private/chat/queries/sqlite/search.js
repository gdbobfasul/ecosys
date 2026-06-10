// Version: 1.0001
// SQLite заявки за search рутера (нативен SQLite: ? плейсхолдъри).
// Заявките тук са силно динамични (условни WHERE, променлив брой offerings условия),
// затова експортираме BUILDER-функции, които приемат филтрите и връщат {sql, params}.
// Параметрите се push-ват СТРОГО по реда, в който се появяват ? в SQL-а.
//
// РАЗЛИКИ спрямо PG:
//   ? вместо $n
//   datetime('now') вместо to_char(...)
//   RANDOM() остава RANDOM() (еднакво в двата диалекта)
//   is_blocked = 0 / is_static_object = 1 работят в двата (INTEGER колони)

// ── FREE SEARCH (4 типа) ────────────────────────────────────────────────────

// Тип 1: EXACT — всичките 5 полета + age>=18 + id != себе си
function buildFreeExact({ phone, fullName, city, age, codeWord, userId }) {
  return {
    sql: `
      SELECT id, phone, full_name, city, age, gender
      FROM users
      WHERE phone = ?
        AND full_name = ?
        AND city = ?
        AND age = ?
        AND code_word = ?
        AND age >= 18
        AND id != ?
    `,
    params: [phone, fullName, city, age, codeWord, userId],
  };
}

// Тип 2: BY CITY — само град, 5 случайни
function buildFreeByCity({ city, userId }) {
  return {
    sql: `
      SELECT id, phone, full_name, city, age, gender
      FROM users
      WHERE city = ?
        AND age >= 18
        AND id != ?
      ORDER BY RANDOM()
      LIMIT 5
    `,
    params: [city, userId],
  };
}

// Тип 3: BY AGE — само възраст, 5 случайни
function buildFreeByAge({ age, userId }) {
  return {
    sql: `
      SELECT id, phone, full_name, city, age, gender
      FROM users
      WHERE age = ?
        AND age >= 18
        AND id != ?
      ORDER BY RANDOM()
      LIMIT 5
    `,
    params: [age, userId],
  };
}

// Тип 4: RANDOM WORLDWIDE — нищо попълнено, 5 случайни
function buildFreeRandom({ userId }) {
  return {
    sql: `
      SELECT id, phone, full_name, city, age, gender
      FROM users
      WHERE age >= 18
        AND id != ?
      ORDER BY RANDOM()
      LIMIT 5
    `,
    params: [userId],
  };
}

// ── BY DISTANCE ─────────────────────────────────────────────────────────────
// Динамични gender/height условия. paid_until > now, location NOT NULL, age>=18, is_blocked=0.
function buildByDistance({ userId, gender, min_height, max_height }) {
  let sql = `
    SELECT
      id, full_name, phone, gender, birth_date, height_cm, weight_kg,
      city, country, current_need, offerings,
      location_latitude, location_longitude,
      hide_phone, hide_names
    FROM users
    WHERE
      id != ?
      AND is_blocked = 0
      AND paid_until > datetime('now')
      AND location_latitude IS NOT NULL
      AND location_longitude IS NOT NULL
      AND age >= 18
  `;
  const params = [userId];

  if (gender) {
    sql += ' AND gender = ?';
    params.push(gender);
  }
  if (min_height) {
    sql += ' AND height_cm >= ?';
    params.push(min_height);
  }
  if (max_height) {
    sql += ' AND height_cm <= ?';
    params.push(max_height);
  }

  return { sql, params };
}

// ── BY NEED ─────────────────────────────────────────────────────────────────
// Динамични offerings LIKE условия (3 на service) + gender/height/city филтри.
// (paid_until > now OR is_static_object = 1).
function buildByNeed({ userId, matchingOfferings, gender, min_height, max_height, city }) {
  const params = [userId];

  // offerings условия: за всеки service → 3 LIKE-а (точно / в началото / в средата|края)
  const offeringsConditions = [];
  matchingOfferings.forEach((service) => {
    offeringsConditions.push('offerings LIKE ? OR offerings LIKE ? OR offerings LIKE ?');
    params.push(service, service + ',%', '%,' + service + '%');
  });

  let sql = `
    SELECT
      id, full_name, phone, email, gender, birth_date, height_cm, weight_kg,
      city, country, current_need, offerings, is_verified,
      location_latitude, location_longitude,
      hide_phone, hide_names, is_static_object, profile_photo_url, working_hours
    FROM users
    WHERE
      id != ?
      AND is_blocked = 0
      AND (paid_until > datetime('now') OR is_static_object = 1)
      AND location_latitude IS NOT NULL
      AND location_longitude IS NOT NULL
      AND (age >= 18 OR is_static_object = 1)
      AND (${offeringsConditions.join(' OR ')})
  `;

  if (gender) {
    sql += ' AND gender = ?';
    params.push(gender);
  }
  if (min_height) {
    sql += ' AND height_cm >= ?';
    params.push(min_height);
  }
  if (max_height) {
    sql += ' AND height_cm <= ?';
    params.push(max_height);
  }
  if (city) {
    sql += ' AND city = ?';
    params.push(city);
  }

  return { sql, params };
}

module.exports = {
  buildFreeExact,
  buildFreeByCity,
  buildFreeByAge,
  buildFreeRandom,
  buildByDistance,
  buildByNeed,
};
