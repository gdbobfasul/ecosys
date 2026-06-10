// Version: 1.0001
// SQLite заявки за server.js (нативен SQLite: ? плейсхолдъри, datetime/date('now')).
// БЕЗ runtime преводач — всяка заявка е явна за SQLite диалекта.
module.exports = {
  // ── dailyCleanup ──
  CLEANUP_OLD_UNIQUENESS:  "DELETE FROM eco3_uniqueness WHERE date < date('now')",

  // ── eco3_stats ──
  STATS_INSERT:            'INSERT INTO eco3_stats (event_type, details) VALUES (?, ?)',
  STATS_INSERT_AMOUNT:     'INSERT INTO eco3_stats (event_type, details, amount_eur) VALUES (?, ?, ?)',

  // ── eco3_google_usage ──
  GOOGLE_USAGE_TODAY:      'SELECT COALESCE(SUM(calls),0) AS c FROM eco3_google_usage WHERE date = ?',
  GOOGLE_USAGE_INC:        'INSERT INTO eco3_google_usage (date, calls) VALUES (?, 1) ON CONFLICT(date) DO UPDATE SET calls = calls + 1',

  // ── eco3_search_history ──
  HISTORY_INSERT:
    'INSERT INTO eco3_search_history (topic, category, language, budget_tier, duration_min, audience, tone, session_id, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  HISTORY_LIST_BY_CAT:     'SELECT * FROM eco3_search_history WHERE category = ? ORDER BY created_at DESC LIMIT ?',
  HISTORY_LIST_ALL:        'SELECT * FROM eco3_search_history ORDER BY created_at DESC LIMIT ?',

  // ── eco3_results ──
  RESULTS_INSERT:
    'INSERT INTO eco3_results (topic, category, director_output, architect_output, executor_output, language, budget_tier, duration_min, audience, tone, session_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  RESULTS_LIST_BY_CAT:     'SELECT id, topic, category, language, budget_tier, duration_min, created_at FROM eco3_results WHERE category = ? ORDER BY created_at DESC LIMIT ?',
  RESULTS_LIST_ALL:        'SELECT id, topic, category, language, budget_tier, duration_min, created_at FROM eco3_results ORDER BY created_at DESC LIMIT ?',
  RESULTS_GET_BY_ID:       'SELECT * FROM eco3_results WHERE id = ?',
  RESULTS_INC_RESALE:      'UPDATE eco3_results SET resale_count = resale_count + 1 WHERE id = ?',

  // ── eco3_uniqueness ──
  UNIQUENESS_CHECK:        'SELECT id FROM eco3_uniqueness WHERE date = ? AND (title = ? OR link = ?) LIMIT 1',
  UNIQUENESS_INSERT:       'INSERT INTO eco3_uniqueness (date, title, source, link, session_id) VALUES (?, ?, ?, ?, ?)',
  UNIQUENESS_COUNT:        'SELECT COUNT(*) as c FROM eco3_uniqueness WHERE date = ?',

  // ── admin/stats ──
  STATS_TOTAL_24H:         "SELECT COUNT(*) as c FROM eco3_stats WHERE created_at > datetime('now', '-24 hours')",
  STATS_GENERATES_24H:     "SELECT COUNT(*) as c FROM eco3_stats WHERE event_type='generate' AND created_at > datetime('now', '-24 hours')",
  STATS_REVENUE_24H:       "SELECT COALESCE(SUM(amount_eur), 0) as s FROM eco3_stats WHERE event_type='payment_created' AND created_at > datetime('now', '-24 hours')",
  HISTORY_COUNT:           'SELECT COUNT(*) as c FROM eco3_search_history',
  RESULTS_COUNT:           'SELECT COUNT(*) as c FROM eco3_results',
  UNIQUENESS_COUNT_TODAY:  "SELECT COUNT(*) as c FROM eco3_uniqueness WHERE date = date('now')",

  // ── admin/db-status (динамично име на таблица — НЕ е параметър) ──
  TABLE_COUNT: (name) => `SELECT COUNT(*) as c FROM ${name}`,
};
