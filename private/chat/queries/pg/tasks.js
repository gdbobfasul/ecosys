// Version: 1.0001
// PostgreSQL заявки за tasks рутера (нативен PG: $n плейсхолдъри, now(), TRUE/FALSE,
// ILIKE, RETURNING id). БЕЗ runtime преводач.
//
// Повечето заявки са статични → прости низове. Две са динамични (списък с филтри),
// затова са BUILDER-функции, които връщат {sql, params} с $1..$n СТРОГО по реда на push.
//
// РАЗЛИКИ спрямо SQLite:
//   ? → $n по ред
//   datetime('now') → now()                (темпоралните колони тук са TIMESTAMPTZ → ОК)
//   ILIKE (PG) ↔ LIKE (SQLite, case-insensitive по подразбиране)
//   TRUE/FALSE (PG) ↔ 1/0 (SQLite)
//   INSERT → RETURNING id (за lastInsertRowid)

module.exports = {
  // ── създай чернова ──
  CREATE_DRAFT:
    `INSERT INTO tasks (author_phone, type, country, city, title, content, reward_amount, reward_currency)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,

  // ── зареди задача за проверки (различни проекции) ──
  GET_AUTHOR_STATUS:                'SELECT author_phone, status FROM tasks WHERE id = $1',
  GET_AUTHOR_STATUS_COUNTRY:        'SELECT author_phone, status, country FROM tasks WHERE id = $1',
  GET_AUTHOR_STATUS_COUNTRY_INTENT: 'SELECT author_phone, status, country, take_fee_intent FROM tasks WHERE id = $1',
  GET_EXECUTOR_STATUS:              'SELECT executor_phone, status FROM tasks WHERE id = $1',
  GET_PARTIES:                      'SELECT author_phone, executor_phone FROM tasks WHERE id = $1',
  GET_PARTIES_FOR_CHAT:             'SELECT author_phone, executor_phone, status, chat_locked FROM tasks WHERE id = $1',
  GET_FULL:                         'SELECT * FROM tasks WHERE id = $1',

  // ── редактирай чернова (само автор, само draft) ──
  UPDATE_DRAFT:
    `UPDATE tasks SET type = COALESCE($1, type), country = COALESCE($2, country), city = $3, title = COALESCE($4, title),
            content = COALESCE($5, content), reward_amount = $6, reward_currency = COALESCE($7, reward_currency)
     WHERE id = $8`,

  // ── публикувай (draft → published) ──
  PUBLISH: "UPDATE tasks SET status = 'published', published_at = now() WHERE id = $1",

  // ── ХВАНИ (free_mode → без плащане) ──
  TAKE:
    "UPDATE tasks SET status = 'taken', executor_phone = $1, take_fee_amount = $2, take_fee_currency = $3, taken_at = now() WHERE id = $4",

  // ── запиши Stripe PaymentIntent за таксата ──
  SET_FEE_INTENT: 'UPDATE tasks SET take_fee_intent = $1 WHERE id = $2',

  // ── потвърди платена такса → ХВАНИ ──
  TAKE_PAID:
    "UPDATE tasks SET status = 'taken', executor_phone = $1, take_fee_amount = $2, take_fee_currency = $3, take_fee_paid = TRUE, taken_at = now() WHERE id = $4",

  // ── чат по задачата ──
  GET_MESSAGES:    'SELECT sender_phone, text, created_at FROM task_messages WHERE task_id = $1 ORDER BY created_at ASC LIMIT 500',
  INSERT_MESSAGE:  'INSERT INTO task_messages (task_id, sender_phone, text) VALUES ($1, $2, $3)',

  // ── ЗАКЛЮЧИ чата → in_progress ──
  LOCK: "UPDATE tasks SET status = 'in_progress', chat_locked = TRUE WHERE id = $1",

  // ── ИЗПЪЛНЕНО с доклад + снимка ──
  DONE: "UPDATE tasks SET status = 'done', done_report = $1, done_photo = $2, done_at = now() WHERE id = $3",

  // ── авторът потвърждава плащане → paid ──
  CONFIRM_PAID: "UPDATE tasks SET status = 'paid', paid_at = now(), payment_disputed = FALSE WHERE id = $1",

  // ── изпълнителят докладва неплащане → за бан ──
  REPORT_NONPAYMENT: 'UPDATE tasks SET payment_disputed = TRUE WHERE id = $1',

  // ── моите задачи ──
  MINE_AUTHORED: 'SELECT * FROM tasks WHERE author_phone = $1 ORDER BY created_at DESC',
  MINE_TAKEN:    'SELECT * FROM tasks WHERE executor_phone = $1 ORDER BY taken_at DESC',

  // ── списък (динамичен: type/country филтри) ──
  // $1..$n се номерират по реда на push на params.
  buildList: ({ type, country }) => {
    const where = ["status IN ('draft','published','taken','in_progress','done')"];
    const params = [];
    if (type) { params.push(type); where.push(`type = $${params.length}`); }
    if (country) { params.push('%' + String(country).trim() + '%'); where.push(`country ILIKE $${params.length}`); }
    return {
      sql:
        `SELECT id, type, country, city, title, content, reward_amount, reward_currency, status, created_at, published_at
         FROM tasks WHERE ${where.join(' AND ')} ORDER BY (status='published') DESC, created_at DESC LIMIT 200`,
      params,
    };
  },
};
