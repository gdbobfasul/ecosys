// Version: 1.0001
// SQLite заявки за верификацията на спешни услуги (нативен SQLite: ? плейсхолдъри).
module.exports = {
  // Подаване на заявка за верификация (статус по подразбиране 'pending').
  INSERT_REQUEST: `
    INSERT INTO verification_requests (
      user_id, requested_services, org_name, license_number,
      contact_phone, contact_email, address, details,
      document_path, document_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,

  // Последната заявка на даден потребител (за да види статуса си).
  GET_LATEST_BY_USER: `
    SELECT id, requested_services, org_name, status, admin_notes, created_at, reviewed_at
    FROM verification_requests
    WHERE user_id = ?
    ORDER BY id DESC
    LIMIT 1`,

  // Има ли вече висяща заявка (за да не дублира).
  COUNT_PENDING_BY_USER: `
    SELECT COUNT(*) AS count FROM verification_requests
    WHERE user_id = ? AND status = 'pending'`,

  // Админ: списък по статус (oldest-first — най-чакащите отгоре).
  ADMIN_LIST_BY_STATUS: `
    SELECT vr.*, u.full_name, u.phone, u.email AS user_email, u.city, u.country, u.is_verified
    FROM verification_requests vr
    JOIN users u ON u.id = vr.user_id
    WHERE vr.status = ?
    ORDER BY vr.created_at ASC`,

  // Админ: всички (висящите отгоре, после по дата низходящо).
  ADMIN_LIST_ALL: `
    SELECT vr.*, u.full_name, u.phone, u.email AS user_email, u.city, u.country, u.is_verified
    FROM verification_requests vr
    JOIN users u ON u.id = vr.user_id
    ORDER BY CASE WHEN vr.status = 'pending' THEN 0 ELSE 1 END, vr.created_at DESC`,

  ADMIN_GET_BY_ID: `
    SELECT vr.*, u.full_name, u.phone, u.email AS user_email, u.city, u.country, u.is_verified
    FROM verification_requests vr
    JOIN users u ON u.id = vr.user_id
    WHERE vr.id = ?`,

  // Админ: смяна на статус (approved/rejected) + бележки + кой/кога.
  ADMIN_UPDATE_STATUS: `
    UPDATE verification_requests
    SET status = ?, admin_notes = ?, reviewed_by = ?, reviewed_at = datetime('now')
    WHERE id = ?`,

  // Брой висящи заявки (за бадж в админ менюто).
  COUNT_PENDING: `SELECT COUNT(*) AS count FROM verification_requests WHERE status = 'pending'`,
};
