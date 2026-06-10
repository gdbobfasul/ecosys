// Version: 1.0001
// PostgreSQL заявки за search рутера (нативен PG: $n плейсхолдъри).
// Заявките тук са силно динамични (условни WHERE, променлив брой offerings условия),
// затова експортираме BUILDER-функции, които приемат филтрите и връщат {sql, params}.
// $1..$n се номерират СТРОГО по реда на push на параметрите.
//
// РАЗЛИКИ спрямо SQLite:
//   ? → $n по ред на push
//   datetime('now') → to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')
//   RANDOM() остава RANDOM() (еднакво в двата диалекта)
//   is_blocked = 0 / is_static_object = 1 работят в двата (INTEGER колони)

const PG_NOW = "to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')";

// ── FREE SEARCH (4 типа) ────────────────────────────────────────────────────

// Тип 1: EXACT — всичките 5 полета + age>=18 + id != себе си
function buildFreeExact({ phone, fullName, city, age, codeWord, userId }) {
  return {
    sql: `
      SELECT id, phone, full_name, city, age, gender
      FROM users
      WHERE phone = $1
        AND full_name = $2
        AND city = $3
        AND age = $4
        AND code_word = $5
        AND age >= 18
        AND id != $6
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
      WHERE city = $1
        AND age >= 18
        AND id != $2
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
      WHERE age = $1
        AND age >= 18
        AND id != $2
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
        AND id != $1
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
      id != $1
      AND is_blocked = 0
      AND paid_until > ${PG_NOW}
      AND location_latitude IS NOT NULL
      AND location_longitude IS NOT NULL
      AND age >= 18
  `;
  const params = [userId];

  if (gender) {
    params.push(gender);
    sql += ` AND gender = $${params.length}`;
  }
  if (min_height) {
    params.push(min_height);
    sql += ` AND height_cm >= $${params.length}`;
  }
  if (max_height) {
    params.push(max_height);
    sql += ` AND height_cm <= $${params.length}`;
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
    params.push(service);
    const p1 = `$${params.length}`;
    params.push(service + ',%');
    const p2 = `$${params.length}`;
    params.push('%,' + service + '%');
    const p3 = `$${params.length}`;
    offeringsConditions.push(`offerings LIKE ${p1} OR offerings LIKE ${p2} OR offerings LIKE ${p3}`);
  });

  let sql = `
    SELECT
      id, full_name, phone, email, gender, birth_date, height_cm, weight_kg,
      city, country, current_need, offerings, is_verified,
      location_latitude, location_longitude,
      hide_phone, hide_names, is_static_object, profile_photo_url, working_hours
    FROM users
    WHERE
      id != $1
      AND is_blocked = 0
      AND (paid_until > ${PG_NOW} OR is_static_object = 1)
      AND location_latitude IS NOT NULL
      AND location_longitude IS NOT NULL
      AND (age >= 18 OR is_static_object = 1)
      AND (${offeringsConditions.join(' OR ')})
  `;

  if (gender) {
    params.push(gender);
    sql += ` AND gender = $${params.length}`;
  }
  if (min_height) {
    params.push(min_height);
    sql += ` AND height_cm >= $${params.length}`;
  }
  if (max_height) {
    params.push(max_height);
    sql += ` AND height_cm <= $${params.length}`;
  }
  if (city) {
    params.push(city);
    sql += ` AND city = $${params.length}`;
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
