// Version: 1.0001
// SQLite заявки за signals рутера (нативен SQLite: ? плейсхолдъри, datetime('now')).
module.exports = {
  // --- auth middleware ---
  AUTH_FIND_SESSION:        'SELECT user_id, expires_at FROM sessions WHERE token = ?',
  AUTH_FIND_STAFF_ADMIN:    'SELECT username FROM admin_users WHERE password_hash = ?',

  // --- can-submit ---
  CAN_SUBMIT_GET_USER:      'SELECT last_signal_date FROM users WHERE id = ?',

  // --- submit ---
  SUBMIT_GET_USER:          'SELECT last_signal_date FROM users WHERE id = ?',
  SUBMIT_INSERT_SIGNAL:
    `INSERT INTO signals (user_id, signal_type, title, working_hours, latitude, longitude, photo_url)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  SUBMIT_UPDATE_LAST_DATE:  'UPDATE users SET last_signal_date = ? WHERE id = ?',

  // --- my-signals ---
  MY_SIGNALS:
    `SELECT id, signal_type, title, working_hours, latitude, longitude,
            photo_url, status, submitted_at, processed_at, rejection_reason
     FROM signals
     WHERE user_id = ?
     ORDER BY submitted_at DESC`,

  // --- admin guard (споделено) ---
  ADMIN_CHECK_USER:         'SELECT id FROM users WHERE id = ? AND manually_activated = 1',

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
     WHERE id != ?
       AND status = 'approved'
       AND signal_type = ?
       AND ABS(latitude - ?) < 0.00005
       AND ABS(longitude - ?) < 0.00005`,

  // --- admin/approve ---
  APPROVE_GET_SIGNAL:
    `SELECT id, user_id, signal_type, title, working_hours, latitude, longitude, photo_url, status
     FROM signals WHERE id = ?`,
  APPROVE_INSERT_OBJECT:
    `INSERT INTO users (
       phone, password_hash, full_name, gender, birth_date,
       country, city, latitude, longitude,
       offerings, working_hours, profile_photo_url,
       is_static_object, created_from_signal_id,
       paid_until, payment_amount, payment_currency,
       created_at
     ) VALUES (?, ?, ?, 'male', NULL, NULL, NULL, ?, ?, ?, ?, ?, 1, ?, datetime('now', '+100 years'), 0, 'N/A', datetime('now'))`,
  APPROVE_UPDATE_SIGNAL:
    `UPDATE signals
     SET status = 'approved',
         processed_at = datetime('now'),
         processed_by_admin_id = ?,
         created_user_id = ?
     WHERE id = ?`,
  APPROVE_GET_SUBMITTER_PAID:  'SELECT paid_until FROM users WHERE id = ?',
  APPROVE_GRANT_FREE_DAY:
    `UPDATE users
     SET paid_until = ?,
         free_days_earned = free_days_earned + 1
     WHERE id = ?`,

  // --- admin/reject ---
  REJECT_GET_SIGNAL:        'SELECT user_id, status FROM signals WHERE id = ?',
  REJECT_UPDATE_SIGNAL:
    `UPDATE signals
     SET status = 'rejected', processed_at = datetime('now'),
         processed_by_admin_id = ?, rejection_reason = ?
     WHERE id = ?`,
  REJECT_RESET_USER_DATE:
    `UPDATE users
     SET last_signal_date = NULL
     WHERE id = ?`,

  // --- admin/obsolete ---
  OBSOLETE_GET_SIGNAL:
    `SELECT id, signal_type, title, working_hours, latitude, longitude, status
     FROM signals WHERE id = ?`,
  OBSOLETE_FIND_MATCHING:
    `SELECT id, phone, full_name, offerings, latitude, longitude
     FROM users
     WHERE is_static_object = 1
       AND offerings = ?
       AND ABS(latitude - ?) < 0.0001
       AND ABS(longitude - ?) < 0.0001`,
  OBSOLETE_DELETE_OBJECT:   'DELETE FROM users WHERE id = ?',
  OBSOLETE_UPDATE_SIGNAL:
    `UPDATE signals
     SET status = 'rejected',
         processed_at = datetime('now'),
         processed_by_admin_id = ?,
         rejection_reason = ?
     WHERE id = ?`,

  // --- nearby ---
  NEARBY_LIST:
    `SELECT
       s.id, s.signal_type, s.title, s.working_hours, s.latitude, s.longitude,
       s.photo_url, s.submitted_at, s.status
     FROM signals s
     WHERE s.status IN ('pending', 'approved')
       AND s.submitted_at > datetime('now', '-7 days')

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
