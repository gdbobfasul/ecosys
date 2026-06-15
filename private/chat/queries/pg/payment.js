// Version: 1.0001
// PostgreSQL заявки за payment рутера (нативен PG: $n плейсхолдъри, RETURNING при нужда).
// Ценовата логика (prices-chat.json) е в рутера — тук са САМО SQL заявките.
module.exports = {
  // confirm: текущо състояние на потребителя (за изчисляване на новата дата paid_until)
  CONFIRM_FIND_USER:
    'SELECT id, phone, paid_until, is_blocked FROM users WHERE phone = $1',

  // confirm: подновяване/активиране на абонамент.
  // datetime('now') → to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')
  CONFIRM_UPDATE_USER:
    `UPDATE users
       SET paid_until = $1,
           last_login = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
           is_blocked = 0,
           blocked_reason = NULL,
           failed_login_attempts = 0,
           payment_amount = $2,
           payment_currency = $3
     WHERE phone = $4`,

  // confirm: журнал на плащането (user_id е NOT NULL в схемата)
  CONFIRM_INSERT_PAYMENT_LOG:
    `INSERT INTO payment_logs (user_id, phone, amount, currency, stripe_payment_id, status, country_code, ip_address, payment_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,

  // confirm: нова сесия (токен) — сесиите се водят по user_id (няма колона phone)
  CONFIRM_INSERT_SESSION:
    `INSERT INTO sessions (id, user_id, token, expires_at, device_type)
     VALUES ($1, $2, $3, $4, $5)`,

  // confirm (emergency): вдига предплатеното за спешна помощ БЕЗ да пипа абонамента (paid_until).
  CONFIRM_SET_EMERGENCY:
    `UPDATE users
       SET emergency_active = 1,
           emergency_active_until = $1
     WHERE phone = $2`,

  // status/:userId: състояние на абонамента/спешен бутон
  STATUS_FIND_USER:
    `SELECT subscription_active, paid_until,
            emergency_active, emergency_active_until
       FROM users
      WHERE id = $1`,
};
