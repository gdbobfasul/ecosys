// Version: 1.0001
// PostgreSQL заявки за profile рутера (нативен PG: $n плейсхолдъри, now() AT TIME ZONE 'UTC').
module.exports = {
  // GET / — пълен профил
  GET_PROFILE:
    `SELECT
        id, phone, full_name, gender, birth_date, height_cm, weight_kg,
        country, city, village, street, workplace,
        email, code_word, current_need, offerings, is_verified,
        hide_phone, hide_names, paid_until, payment_amount, payment_currency,
        last_profile_update, profile_edits_this_month, profile_edit_reset_date,
        help_button_uses, help_button_reset_date,
        location_latitude, location_longitude
      FROM users WHERE id = $1`,

  // PUT / — текущи данни за проверка на лимит/статичен обект
  PUT_GET_CURRENT:
    `SELECT profile_edits_this_month, profile_edit_reset_date, is_static_object
       FROM users WHERE id = $1`,

  // PUT / — статичен обект: само работно време
  PUT_UPDATE_WORKING_HOURS:
    `UPDATE users
        SET working_hours = $1
      WHERE id = $2`,

  // PUT / — нормален потребител (COALESCE: незададените полета остават)
  PUT_UPDATE_PROFILE:
    `UPDATE users
        SET
          full_name = COALESCE($1, full_name),
          phone = COALESCE($2, phone),
          birth_date = COALESCE($3, birth_date),
          city = COALESCE($4, city),
          last_profile_update = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
          profile_edits_this_month = $5,
          profile_edit_reset_date = $6
      WHERE id = $7`,

  // PUT /password
  GET_PASSWORD_HASH:     'SELECT password_hash FROM users WHERE id = $1',
  UPDATE_PASSWORD:       'UPDATE users SET password_hash = $1 WHERE id = $2',

  // PUT /code-word
  UPDATE_CODE_WORD:      'UPDATE users SET code_word = $1 WHERE id = $2',

  // PUT /need
  UPDATE_NEED:           'UPDATE users SET current_need = $1 WHERE id = $2',

  // PUT /offerings
  GET_IS_VERIFIED:       'SELECT is_verified FROM users WHERE id = $1',
  UPDATE_OFFERINGS:      'UPDATE users SET offerings = $1 WHERE id = $2',

  // PUT /email
  UPDATE_EMAIL:          'UPDATE users SET email = $1 WHERE id = $2',

  // PUT /hide-phone
  UPDATE_HIDE_PHONE:     'UPDATE users SET hide_phone = $1 WHERE id = $2',

  // PUT /hide-names
  UPDATE_HIDE_NAMES:     'UPDATE users SET hide_names = $1 WHERE id = $2',
};
