// Version: 1.0001
// Рутер за кандидатстване за верификация на СПЕШНИ услуги (Лекар/Болница/Линейка/Полиция).
// Тези услуги изискват проверка от админ/модератор — обикновен потребител НЕ може да ги
// предлага, докато не бъде верифициран. Тук потребителят подава заявка (по желание с документ),
// а админ опашката (admin.js) я одобрява или отказва.
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const { VERIFIED_ONLY_SERVICES } = require('../utils/serviceCategories');
const Q = require('../queries').verification; // набор заявки според CHAT_DB_TYPE (pg/sqlite)
const { logActionError } = require('../utils/actionLog');

function createVerificationRoutes(db, uploadDir) {
  const router = express.Router();
  const upload = multer({ dest: uploadDir, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB

  // Жив db от app.locals (route може да е монтиран преди init на базата).
  router.use((req, res, next) => { if (req.app.locals.db) db = req.app.locals.db; next(); });

  // Подаване на заявка (по желание с прикачен документ 'document').
  router.post('/apply', upload.single('document'), async (req, res) => {
    try {
      const userId = req.userId;
      let { requested_services, org_name, license_number, contact_phone, contact_email, address, details } = req.body;

      // requested_services може да дойде като масив или CSV низ.
      let services = Array.isArray(requested_services)
        ? requested_services
        : String(requested_services || '').split(',');
      services = services.map(s => String(s).trim()).filter(Boolean);

      const cleanup = () => { if (req.file) { try { fs.unlinkSync(req.file.path); } catch (_) {} } };

      if (services.length === 0) {
        cleanup();
        return res.status(400).json({ error: 'Изберете поне една спешна услуга.' });
      }
      // Само спешни услуги, които изискват верификация.
      const invalid = services.filter(s => !VERIFIED_ONLY_SERVICES.includes(s));
      if (invalid.length) {
        cleanup();
        return res.status(400).json({ error: 'Невалидна услуга за верификация: ' + invalid.join(', ') });
      }
      if (services.length > VERIFIED_ONLY_SERVICES.length) {
        cleanup();
        return res.status(400).json({ error: 'Твърде много услуги.' });
      }
      if (!org_name || !String(org_name).trim()) {
        cleanup();
        return res.status(400).json({ error: 'Въведете име на организацията/заведението.' });
      }

      // Без дублиране на висяща заявка.
      const pending = await db.prepare(Q.COUNT_PENDING_BY_USER).get(userId);
      if (pending && pending.count > 0) {
        cleanup();
        return res.status(409).json({ error: 'Вече имате висяща заявка, изчакайте обработката ѝ.' });
      }

      const inserted = await db.prepare(Q.INSERT_REQUEST).run(
        userId,
        services.join(','),
        String(org_name).trim(),
        license_number ? String(license_number).trim() : null,
        contact_phone ? String(contact_phone).trim() : null,
        contact_email ? String(contact_email).trim() : null,
        address ? String(address).trim() : null,
        details ? String(details).trim() : null,
        req.file ? req.file.path : null,
        req.file ? req.file.originalname : null
      );
      const requestId = inserted.lastInsertRowid != null ? inserted.lastInsertRowid : inserted.id;

      res.json({
        success: true,
        request_id: requestId,
        message: 'Заявката е подадена. Админ/модератор ще я прегледа и ще Ви уведоми.'
      });
    } catch (err) {
      if (req.file) { try { fs.unlinkSync(req.file.path); } catch (_) {} }
      logActionError('Кандидатстване за верификация (POST /api/verification/apply)', err, { userId: req.userId });
      res.status(500).json({ error: 'Сървърна грешка при подаване на заявката.' });
    }
  });

  // Статус на последната заявка на потребителя.
  router.get('/my', async (req, res) => {
    try {
      const row = await db.prepare(Q.GET_LATEST_BY_USER).get(req.userId);
      res.json({ success: true, request: row || null });
    } catch (err) {
      logActionError('Преглед на статус за верификация (GET /api/verification/my)', err, { userId: req.userId });
      res.status(500).json({ error: 'Сървърна грешка.' });
    }
  });

  return router;
}

module.exports = createVerificationRoutes;
