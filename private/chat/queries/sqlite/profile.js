// Version: 1.0001
// SQLite заявки за profile рутера (нативен SQLite: ? плейсхолдъри, datetime('now')).
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
      FROM users WHERE id = ?`,

  // PUT / — текущи данни за проверка на лимит/статичен обект
  PUT_GET_CURRENT:
    `SELECT profile_edits_this_month, profile_edit_reset_date, is_static_object
       FROM users WHERE id = ?`,

  // PUT / — статичен обект: само работно време
  PUT_UPDATE_WORKING_HOURS:
    `UPDATE users
        SET working_hours = ?
      WHERE id = ?`,

  // PUT / — нормален потребител (COALESCE: незададените полета остават)
  PUT_UPDATE_PROFILE:
    `UPDATE users
        SET
          full_name = COALESCE(?, full_name),
          phone = COALESCE(?, phone),
          birth_date = COALESCE(?, birth_date),
          city = COALESCE(?, city),
          last_profile_update = datetime('now'),
          profile_edits_this_month = ?,
          profile_edit_reset_date = ?
      WHERE id = ?`,

  // PUT /password
  GET_PASSWORD_HASH:     'SELECT password_hash FROM users WHERE id = ?',
  UPDATE_PASSWORD:       'UPDATE users SET password_hash = ? WHERE id = ?',

  // PUT /code-word
  UPDATE_CODE_WORD:      'UPDATE users SET code_word = ? WHERE id = ?',

  // PUT /need
  UPDATE_NEED:           'UPDATE users SET current_need = ? WHERE id = ?',

  // PUT /offerings
  GET_IS_VERIFIED:       'SELECT is_verified FROM users WHERE id = ?',
  UPDATE_OFFERINGS:      'UPDATE users SET offerings = ? WHERE id = ?',

  // PUT /email
  UPDATE_EMAIL:          'UPDATE users SET email = ? WHERE id = ?',

  // PUT /hide-phone
  UPDATE_HIDE_PHONE:     'UPDATE users SET hide_phone = ? WHERE id = ?',

  // PUT /hide-names
  UPDATE_HIDE_NAMES:     'UPDATE users SET hide_names = ? WHERE id = ?',
};
