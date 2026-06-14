// Version: 1.0001
// SQLite заявки за help рутера (нативен SQLite: ? плейсхолдъри, lastInsertRowid).
module.exports = {
  EMERGENCY_GET_USER: `
    SELECT
      id, phone, full_name, email, gender, birth_date,
      country, city, street,
      paid_until, payment_amount, payment_currency,
      help_button_uses, help_button_reset_date,
      emergency_active
    FROM users WHERE id = ?`,

  EMERGENCY_INSERT_REQUEST: `
    INSERT INTO help_requests (
      user_id, phone, full_name, email, gender, age,
      country, city, street, street_number,
      latitude, longitude,
      charge_amount, charge_currency
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,

  EMERGENCY_UPDATE_USER: `
    UPDATE users
    SET
      paid_until = ?,
      help_button_uses = ?,
      help_button_reset_date = ?
    WHERE id = ?`,

  // Консумиране на предплатената застраховка (emergency_active 1→0) БЕЗ да пипа абонамента.
  EMERGENCY_CONSUME_PREPAID: `
    UPDATE users
    SET
      emergency_active = 0,
      help_button_uses = ?,
      help_button_reset_date = ?
    WHERE id = ?`,

  CONTACTS_GET_USER: 'SELECT country_code, country FROM users WHERE id = ?',

  CONTACTS_GET_BY_COUNTRY: `
    SELECT
      service_type, service_name,
      phone_international, phone_local,
      email, address, city
    FROM emergency_contacts
    WHERE country_code = ? AND is_active = 1
    ORDER BY
      CASE service_type
        WHEN 'emergency' THEN 1
        WHEN 'ambulance' THEN 2
        WHEN 'police' THEN 3
        WHEN 'fire' THEN 4
        WHEN 'hospital' THEN 5
        ELSE 6
      END`,

  AVAILABILITY_GET_USER: `
    SELECT
      help_button_uses, help_button_reset_date,
      paid_until, payment_amount, payment_currency,
      emergency_active
    FROM users WHERE id = ?`,
};
