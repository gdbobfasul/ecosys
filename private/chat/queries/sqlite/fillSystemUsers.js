// Version: 1.0001
// SQLite заявки за scripts/fill-system-users.js (нативен SQLite: ? плейсхолдъри).
// Системни бот-потребители (is_system = 1). БЕЗ runtime преводач.
module.exports = {
  // Подсигуряване на колоната (изпълнява се през db.exec).
  ENSURE_IS_SYSTEM_COLUMN:
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS is_system INTEGER DEFAULT 0',

  // Вмъкване на системен потребител (13 параметъра + фиксирано is_system = 1).
  INSERT_SYSTEM_USER:
    `INSERT INTO users
       (phone, password_hash, full_name, gender, age, country, country_code, city,
        current_need, offerings, paid_until, subscription_active, is_system)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)`,

  // Брой системни потребители.
  COUNT_SYSTEM_USERS:
    'SELECT COUNT(*) AS n FROM users WHERE is_system = 1',
};
