// Version: 1.0001
// PostgreSQL заявки за signals рутера (нативен PG: $n плейсхолдъри, RETURNING id,
// to_char(now() AT TIME ZONE 'UTC', ...) вместо datetime('now')).
module.exports = {
  // --- auth middleware ---
  AUTH_FIND_SESSION:        'SELECT user_id, expires_at FROM sessions WHERE token = $1',
  AUTH_FIND_STAFF_ADMIN:    'SELECT username FROM admin_users WHERE password_hash = $1',

  // --- can-submit ---
  CAN_SUBMIT_GET_USER:      'SELECT last_signal_date FROM users WHERE id = $1',

  // --- submit ---
  SUBMIT_GET_USER:          'SELECT last_signal_date FROM users WHERE id = $1',
  SUBMIT_INSERT_SIGNAL:
    `INSERT INTO signals (user_id, signal_type, title, working_hours, latitude, longitude, photo_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
  SUBMIT_UPDATE_LAST_DATE:  'UPDATE users SET last_signal_date = $1 WHERE id = $2',

  // --- my-signals ---
  MY_SIGNALS:
    `SELECT id, signal_type, title, working_hours, latitude, longitude,
            photo_url, status, submitted_at, processed_at, rejection_reason
     FROM signals
     WHERE user_id = $1
     ORDER BY submitted_at DESC`,

  // --- admin guard (споделено) ---
  ADMIN_CHECK_USER:         'SELECT id FROM users WHERE id = $1 AND manually_activated = 1',

  // --- admin/pending ---
  PENDING_LIST:
    `SELECT s.id, s.user_id, s.signal_type, s.title, s.working_hours,
            s.latitude, s.longitude, s.photo_url, s.submitted_at,
            u.phone, u.full_name
     FROM signals s
     JOIN users u ON s.user_id = u.id
     WHERE s.status = 'pending'
     ORDER BY s.submitted_at ASC`,
  PENDING_NEARBY_COUNT:
    `SELECT COUNT(*) as count
     FROM signals
     WHERE id != $1
       AND status = 'approved'
       AND signal_type = $2
       AND ABS(latitude - $3) < 0.00005
       AND ABS(longitude - $4) < 0.00005`,

  // --- admin/approve ---
  APPROVE_GET_SIGNAL:
    `SELECT id, user_id, signal_type, title, working_hours, latitude, longitude, photo_url, status
     FROM signals WHERE id = $1`,
  APPROVE_INSERT_OBJECT:
    `INSERT INTO users (
       phone, password_hash, full_name, gender, birth_date,
       country, city, latitude, longitude,
       offerings, working_hours, profile_photo_url,
       is_static_object, created_from_signal_id,
       paid_until, payment_amount, payment_currency,
       created_at
     ) VALUES ($1, $2, $3, 'male', NULL, NULL, NULL, $4, $5, $6, $7, $8, 1, $9,
       to_char((now() AT TIME ZONE 'UTC') + interval '100 years', 'YYYY-MM-DD HH24:MI:SS'),
       0, 'N/A',
       to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')) RETURNING id`,
  APPROVE_UPDATE_SIGNAL:
    `UPDATE signals
     SET status = 'approved',
         processed_at = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
         processed_by_admin_id = $1,
         created_user_id = $2
     WHERE id = $3`,
  APPROVE_GET_SUBMITTER_PAID:  'SELECT paid_until FROM users WHERE id = $1',
  APPROVE_GRANT_FREE_DAY:
    `UPDATE users
     SET paid_until = $1,
         free_days_earned = free_days_earned + 1
     WHERE id = $2`,

  // --- admin/reject ---
  REJECT_GET_SIGNAL:        'SELECT user_id, status FROM signals WHERE id = $1',
  REJECT_UPDATE_SIGNAL:
    `UPDATE signals
     SET status = 'rejected',
         processed_at = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
         processed_by_admin_id = $1, rejection_reason = $2
     WHERE id = $3`,
  REJECT_RESET_USER_DATE:
    `UPDATE users
     SET last_signal_date = NULL
     WHERE id = $1`,

  // --- admin/obsolete ---
  OBSOLETE_GET_SIGNAL:
    `SELECT id, signal_type, title, working_hours, latitude, longitude, status
     FROM signals WHERE id = $1`,
  OBSOLETE_FIND_MATCHING:
    `SELECT id, phone, full_name, offerings, latitude, longitude
     FROM users
     WHERE is_static_object = 1
       AND offerings = $1
       AND ABS(latitude - $2) < 0.0001
       AND ABS(longitude - $3) < 0.0001`,
  OBSOLETE_DELETE_OBJECT:   'DELETE FROM users WHERE id = $1',
  OBSOLETE_UPDATE_SIGNAL:
    `UPDATE signals
     SET status = 'rejected',
         processed_at = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
         processed_by_admin_id = $1,
         rejection_reason = $2
     WHERE id = $3`,

  // --- nearby ---
  NEARBY_LIST:
    `SELECT
       s.id, s.signal_type, s.title, s.working_hours, s.latitude, s.longitude,
       s.photo_url, s.submitted_at, s.status
     FROM signals s
     WHERE s.status IN ('pending', 'approved')
       AND s.submitted_at > to_char((now() AT TIME ZONE 'UTC') + interval '-7 days', 'YYYY-MM-DD HH24:MI:SS')

     UNION ALL

     SELECT
       u.id, u.offerings as signal_type, u.full_name as title, u.working_hours,
       u.location_latitude as latitude, u.location_longitude as longitude,
       u.profile_photo_url as photo_url, u.created_at as submitted_at, 'static_object' as status
     FROM users u
     WHERE u.is_static_object = 1
       AND u.location_latitude IS NOT NULL
       AND u.location_longitude IS NOT NULL`,
};
