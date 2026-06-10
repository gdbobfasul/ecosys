// Version: 1.0001
// SQLite заявки за tasks рутера (нативен SQLite: ? плейсхолдъри, datetime('now'),
// 1/0 за boolean, LIKE). БЕЗ runtime преводач.
//
// Повечето заявки са статични → прости низове. Две са динамични (списък с филтри),
// затова са BUILDER-функции, които връщат {sql, params}; ? се появяват СТРОГО по реда
// на push на params.
//
// РАЗЛИКИ спрямо PG:
//   $n → ?
//   now() → datetime('now')
//   ILIKE → LIKE (SQLite LIKE е case-insensitive за ASCII по подразбиране)
//   TRUE/FALSE → 1/0
//   без RETURNING (lastInsertRowid идва от драйвера)

module.exports = {
  // ── създай чернова ──
  CREATE_DRAFT:
    `INSERT INTO tasks (author_phone, type, country, city, title, content, reward_amount, reward_currency)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,

  // ── зареди задача за проверки (различни проекции) ──
  GET_AUTHOR_STATUS:                'SELECT author_phone, status FROM tasks WHERE id = ?',
  GET_AUTHOR_STATUS_COUNTRY:        'SELECT author_phone, status, country FROM tasks WHERE id = ?',
  GET_AUTHOR_STATUS_COUNTRY_INTENT: 'SELECT author_phone, status, country, take_fee_intent FROM tasks WHERE id = ?',
  GET_EXECUTOR_STATUS:              'SELECT executor_phone, status FROM tasks WHERE id = ?',
  GET_PARTIES:                      'SELECT author_phone, executor_phone FROM tasks WHERE id = ?',
  GET_PARTIES_FOR_CHAT:             'SELECT author_phone, executor_phone, status, chat_locked FROM tasks WHERE id = ?',
  GET_FULL:                         'SELECT * FROM tasks WHERE id = ?',

  // ── редактирай чернова (само автор, само draft) ──
  UPDATE_DRAFT:
    `UPDATE tasks SET type = COALESCE(?, type), country = COALESCE(?, country), city = ?, title = COALESCE(?, title),
            content = COALESCE(?, content), reward_amount = ?, reward_currency = COALESCE(?, reward_currency)
     WHERE id = ?`,

  // ── публикувай (draft → published) ──
  PUBLISH: "UPDATE tasks SET status = 'published', published_at = datetime('now') WHERE id = ?",

  // ── ХВАНИ (free_mode → без плащане) ──
  TAKE:
    "UPDATE tasks SET status = 'taken', executor_phone = ?, take_fee_amount = ?, take_fee_currency = ?, taken_at = datetime('now') WHERE id = ?",

  // ── запиши Stripe PaymentIntent за таксата ──
  SET_FEE_INTENT: 'UPDATE tasks SET take_fee_intent = ? WHERE id = ?',

  // ── потвърди платена такса → ХВАНИ ──
  TAKE_PAID:
    "UPDATE tasks SET status = 'taken', executor_phone = ?, take_fee_amount = ?, take_fee_currency = ?, take_fee_paid = 1, taken_at = datetime('now') WHERE id = ?",

  // ── чат по задачата ──
  GET_MESSAGES:    'SELECT sender_phone, text, created_at FROM task_messages WHERE task_id = ? ORDER BY created_at ASC LIMIT 500',
  INSERT_MESSAGE:  'INSERT INTO task_messages (task_id, sender_phone, text) VALUES (?, ?, ?)',

  // ── ЗАКЛЮЧИ чата → in_progress ──
  LOCK: "UPDATE tasks SET status = 'in_progress', chat_locked = 1 WHERE id = ?",

  // ── ИЗПЪЛНЕНО с доклад + снимка ──
  DONE: "UPDATE tasks SET status = 'done', done_report = ?, done_photo = ?, done_at = datetime('now') WHERE id = ?",

  // ── авторът потвърждава плащане → paid ──
  CONFIRM_PAID: "UPDATE tasks SET status = 'paid', paid_at = datetime('now'), payment_disputed = 0 WHERE id = ?",

  // ── изпълнителят докладва неплащане → за бан ──
  REPORT_NONPAYMENT: 'UPDATE tasks SET payment_disputed = 1 WHERE id = ?',

  // ── моите задачи ──
  MINE_AUTHORED: 'SELECT * FROM tasks WHERE author_phone = ? ORDER BY created_at DESC',
  MINE_TAKEN:    'SELECT * FROM tasks WHERE executor_phone = ? ORDER BY taken_at DESC',

  // ── списък (динамичен: type/country филтри) ──
  // ? се появяват по реда на push на params.
  buildList: ({ type, country }) => {
    const where = ["status IN ('draft','published','taken','in_progress','done')"];
    const params = [];
    if (type) { where.push('type = ?'); params.push(type); }
    if (country) { where.push('country LIKE ?'); params.push('%' + String(country).trim() + '%'); }
    return {
      sql:
        `SELECT id, type, country, city, title, content, reward_amount, reward_currency, status, created_at, published_at
         FROM tasks WHERE ${where.join(' AND ')} ORDER BY (status='published') DESC, created_at DESC LIMIT 200`,
      params,
    };
  },
};
