// Version: 1.0001
// PostgreSQL заявки за server.js (нативен PG: $n плейсхолдъри, now(), to_char за date TEXT, RETURNING id).
// БЕЗ runtime преводач — всяка заявка е явна за PG диалекта.
// Времевите колони (created_at/last_login) са TIMESTAMP DEFAULT now(); колоната `date` е TEXT.
module.exports = {
  // ── dailyCleanup ──
  CLEANUP_OLD_UNIQUENESS:  "DELETE FROM eco3_uniqueness WHERE date < to_char(now(), 'YYYY-MM-DD')",

  // ── eco3_stats ──
  STATS_INSERT:            'INSERT INTO eco3_stats (event_type, details) VALUES ($1, $2)',
  STATS_INSERT_AMOUNT:     'INSERT INTO eco3_stats (event_type, details, amount_eur) VALUES ($1, $2, $3)',

  // ── eco3_google_usage ──
  GOOGLE_USAGE_TODAY:      'SELECT COALESCE(SUM(calls),0) AS c FROM eco3_google_usage WHERE date = $1',
  GOOGLE_USAGE_INC:        'INSERT INTO eco3_google_usage (date, calls) VALUES ($1, 1) ON CONFLICT(date) DO UPDATE SET calls = eco3_google_usage.calls + 1',

  // ── eco3_search_history ──
  HISTORY_INSERT:
    'INSERT INTO eco3_search_history (topic, category, language, budget_tier, duration_min, audience, tone, session_id, ip_address) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
  HISTORY_LIST_BY_CAT:     'SELECT * FROM eco3_search_history WHERE category = $1 ORDER BY created_at DESC LIMIT $2',
  HISTORY_LIST_ALL:        'SELECT * FROM eco3_search_history ORDER BY created_at DESC LIMIT $1',

  // ── eco3_results ──
  RESULTS_INSERT:
    'INSERT INTO eco3_results (topic, category, director_output, architect_output, executor_output, language, budget_tier, duration_min, audience, tone, session_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
  RESULTS_LIST_BY_CAT:     'SELECT id, topic, category, language, budget_tier, duration_min, created_at FROM eco3_results WHERE category = $1 ORDER BY created_at DESC LIMIT $2',
  RESULTS_LIST_ALL:        'SELECT id, topic, category, language, budget_tier, duration_min, created_at FROM eco3_results ORDER BY created_at DESC LIMIT $1',
  RESULTS_GET_BY_ID:       'SELECT * FROM eco3_results WHERE id = $1',
  RESULTS_INC_RESALE:      'UPDATE eco3_results SET resale_count = resale_count + 1 WHERE id = $1',

  // ── eco3_uniqueness ──
  UNIQUENESS_CHECK:        'SELECT id FROM eco3_uniqueness WHERE date = $1 AND (title = $2 OR link = $3) LIMIT 1',
  UNIQUENESS_INSERT:       'INSERT INTO eco3_uniqueness (date, title, source, link, session_id) VALUES ($1, $2, $3, $4, $5)',
  UNIQUENESS_COUNT:        'SELECT COUNT(*) as c FROM eco3_uniqueness WHERE date = $1',

  // ── admin/stats ──
  STATS_TOTAL_24H:         "SELECT COUNT(*) as c FROM eco3_stats WHERE created_at > (now() - interval '24 hours')",
  STATS_GENERATES_24H:     "SELECT COUNT(*) as c FROM eco3_stats WHERE event_type='generate' AND created_at > (now() - interval '24 hours')",
  STATS_REVENUE_24H:       "SELECT COALESCE(SUM(amount_eur), 0) as s FROM eco3_stats WHERE event_type='payment_created' AND created_at > (now() - interval '24 hours')",
  HISTORY_COUNT:           'SELECT COUNT(*) as c FROM eco3_search_history',
  RESULTS_COUNT:           'SELECT COUNT(*) as c FROM eco3_results',
  UNIQUENESS_COUNT_TODAY:  "SELECT COUNT(*) as c FROM eco3_uniqueness WHERE date = to_char(now(), 'YYYY-MM-DD')",

  // ── admin/db-status (динамично име на таблица — НЕ е параметър) ──
  TABLE_COUNT: (name) => `SELECT COUNT(*) as c FROM ${name}`,
};
