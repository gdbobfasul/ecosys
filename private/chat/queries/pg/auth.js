// Version: 1.0001
// PostgreSQL заявки за auth рутера (нативен PG: $n плейсхолдъри, RETURNING id).
module.exports = {
  LOGIN_FIND_USERS:        'SELECT * FROM users WHERE phone = $1',
  LOGIN_INCREMENT_FAILED:  'UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE phone = $1',
  LOGIN_FIND_TO_BLOCK:     'SELECT id FROM users WHERE phone = $1 AND failed_login_attempts >= 3',
  // Динамичен IN списък → $1,$2,… според броя id-та
  LOGIN_BLOCK_BY_IDS: (n) =>
    `UPDATE users SET is_blocked = 1, blocked_reason = 'Failed login attempts' WHERE id IN (${Array.from({ length: n }, (_, i) => '$' + (i + 1)).join(',')})`,
  LOGIN_RESET_FAILED:      'UPDATE users SET failed_login_attempts = 0 WHERE id = $1',
  LOGIN_INSERT_SESSION:    'INSERT INTO sessions (id, user_id, token, expires_at, device_type) VALUES ($1, $2, $3, $4, $5)',
  LOGIN_UPDATE_LAST_LOGIN: 'UPDATE users SET last_login = $1 WHERE id = $2',
  REGISTER_FIND_EXISTING:  'SELECT id FROM users WHERE phone = $1 AND password_hash = $2',
  REGISTER_INSERT_USER:
    `INSERT INTO users (phone, password_hash, full_name, gender, height_cm, weight_kg, country, city, village, street, workplace, paid_until, payment_amount, payment_currency)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 0, 'EUR') RETURNING id`,
  LOGOUT_DELETE_SESSION:   'DELETE FROM sessions WHERE token = $1',
};
