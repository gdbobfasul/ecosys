// Version: 1.0001
// SQLite заявки за auth рутера (нативен SQLite: ? плейсхолдъри).
module.exports = {
  LOGIN_FIND_USERS:        'SELECT * FROM users WHERE phone = ?',
  LOGIN_INCREMENT_FAILED:  'UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE phone = ?',
  LOGIN_FIND_TO_BLOCK:     'SELECT id FROM users WHERE phone = ? AND failed_login_attempts >= 3',
  // Динамичен IN списък → ?,?,… според броя id-та
  LOGIN_BLOCK_BY_IDS: (n) =>
    `UPDATE users SET is_blocked = 1, blocked_reason = 'Failed login attempts' WHERE id IN (${Array.from({ length: n }, () => '?').join(',')})`,
  LOGIN_RESET_FAILED:      'UPDATE users SET failed_login_attempts = 0 WHERE id = ?',
  LOGIN_INSERT_SESSION:    'INSERT INTO sessions (id, user_id, token, expires_at, device_type) VALUES (?, ?, ?, ?, ?)',
  LOGIN_UPDATE_LAST_LOGIN: 'UPDATE users SET last_login = ? WHERE id = ?',
  REGISTER_FIND_EXISTING:  'SELECT id FROM users WHERE phone = ? AND password_hash = ?',
  REGISTER_INSERT_USER:
    `INSERT INTO users (phone, password_hash, full_name, gender, height_cm, weight_kg, country, city, village, street, workplace, paid_until, payment_amount, payment_currency)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'EUR')`,
  LOGOUT_DELETE_SESSION:   'DELETE FROM sessions WHERE token = ?',
};
