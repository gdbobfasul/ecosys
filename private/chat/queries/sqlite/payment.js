// Version: 1.0001
// SQLite заявки за payment рутера (нативен SQLite: ? плейсхолдъри).
// Ценовата логика (prices-chat.json) е в рутера — тук са САМО SQL заявките.
module.exports = {
  // confirm: текущо състояние на потребителя (за изчисляване на новата дата paid_until)
  CONFIRM_FIND_USER:
    'SELECT id, phone, paid_until, is_blocked FROM users WHERE phone = ?',

  // confirm: подновяване/активиране на абонамент
  CONFIRM_UPDATE_USER:
    `UPDATE users
       SET paid_until = ?,
           last_login = datetime('now'),
           is_blocked = 0,
           blocked_reason = NULL,
           failed_login_attempts = 0,
           payment_amount = ?,
           payment_currency = ?
     WHERE phone = ?`,

  // confirm: журнал на плащането (user_id е NOT NULL в схемата)
  CONFIRM_INSERT_PAYMENT_LOG:
    `INSERT INTO payment_logs (user_id, phone, amount, currency, stripe_payment_id, status, country_code, ip_address, payment_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,

  // confirm: нова сесия (токен) — сесиите се водят по user_id (няма колона phone)
  CONFIRM_INSERT_SESSION:
    `INSERT INTO sessions (id, user_id, token, expires_at, device_type)
     VALUES (?, ?, ?, ?, ?)`,

  // confirm (emergency): вдига предплатената застраховка БЕЗ да пипа абонамента (paid_until).
  CONFIRM_SET_EMERGENCY:
    `UPDATE users
       SET emergency_active = 1,
           emergency_active_until = ?
     WHERE phone = ?`,

  // status/:userId: състояние на абонамента/спешен бутон
  STATUS_FIND_USER:
    `SELECT subscription_active, paid_until,
            emergency_active, emergency_active_until
       FROM users
      WHERE id = ?`,
};
