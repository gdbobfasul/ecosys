// House-Look-Book — модерация (само moderator/admin).
// Нищо не е публично преди 'approved'. Праговете идват от config.json.
//
// Поток:
//   - pending списък (предложения, чакащи одобрение)
//   - approve / reject / remove на предложение
//   - резолюция на доклади: valid → бан на собственика + предложението 'removed';
//                           invalid → +1 baseless_report_count на докладващия
//   - бан на докладващ над config.reports.maxBaselessReportsBeforeReporterBan

const express = require('express');
const { q, one, all, pool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { load } = require('../config-loader');

const router = express.Router();

// Всичко тук иска логнат модератор/админ.
router.use(requireAuth, requireRole('moderator', 'admin'));

// Запис в одит дневника.
async function logAction(client, { proposal_id, target_user, actor_id, action, note }) {
  await client.query(
    `INSERT INTO moderation_log (proposal_id, target_user, actor_id, action, note)
     VALUES ($1, $2, $3, $4, $5)`,
    [proposal_id || null, target_user || null, actor_id, action, note || null]
  );
}

// GET /api/hlb/moderation/pending — чакащи модерация
router.get('/pending', async (req, res, next) => {
  try {
    const rows = await all(
      `SELECT p.*, u.email AS owner_email, u.display_name AS owner_name
       FROM proposals p JOIN users u ON u.id = p.owner_id
       WHERE p.status = 'pending_moderation'
       ORDER BY p.submitted_at ASC`
    );
    res.json({ pending: rows });
  } catch (e) { next(e); }
});

// GET /api/hlb/moderation/reports — отворени доклади
router.get('/reports', async (req, res, next) => {
  try {
    const rows = await all(
      `SELECT r.*, p.title AS proposal_title, p.owner_id,
              ru.display_name AS reporter_name
       FROM reports r
       JOIN proposals p ON p.id = r.proposal_id
       JOIN users ru ON ru.id = r.reporter_id
       WHERE r.status = 'pending'
       ORDER BY r.created_at ASC`
    );
    res.json({ reports: rows });
  } catch (e) { next(e); }
});

// POST /api/hlb/moderation/proposals/:id/approve
router.post('/proposals/:id/approve', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const p = await client.query('SELECT * FROM proposals WHERE id = $1', [req.params.id]);
    if (!p.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'not_found' }); }
    const updated = await client.query(
      `UPDATE proposals SET status = 'approved', approved_at = now(), moderated_by = $2,
              moderation_note = $3, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.params.id, req.user.id, (req.body && req.body.note) || null]
    );
    await logAction(client, { proposal_id: req.params.id, actor_id: req.user.id, action: 'approve', note: req.body?.note });
    await client.query('COMMIT');
    res.json({ proposal: updated.rows[0] });
  } catch (e) { try { await client.query('ROLLBACK'); } catch (_) {} next(e); }
  finally { client.release(); }
});

// POST /api/hlb/moderation/proposals/:id/reject  { note? }
router.post('/proposals/:id/reject', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const updated = await client.query(
      `UPDATE proposals SET status = 'rejected', moderated_by = $2, moderation_note = $3, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.params.id, req.user.id, (req.body && req.body.note) || null]
    );
    if (!updated.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'not_found' }); }
    await logAction(client, { proposal_id: req.params.id, actor_id: req.user.id, action: 'reject', note: req.body?.note });
    await client.query('COMMIT');
    res.json({ proposal: updated.rows[0] });
  } catch (e) { try { await client.query('ROLLBACK'); } catch (_) {} next(e); }
  finally { client.release(); }
});

// POST /api/hlb/moderation/proposals/:id/remove  { note? } — сваляне
router.post('/proposals/:id/remove', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const updated = await client.query(
      `UPDATE proposals SET status = 'removed', moderated_by = $2, moderation_note = $3, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.params.id, req.user.id, (req.body && req.body.note) || null]
    );
    if (!updated.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'not_found' }); }
    await logAction(client, { proposal_id: req.params.id, actor_id: req.user.id, action: 'remove', note: req.body?.note });
    await client.query('COMMIT');
    res.json({ proposal: updated.rows[0] });
  } catch (e) { try { await client.query('ROLLBACK'); } catch (_) {} next(e); }
  finally { client.release(); }
});

// POST /api/hlb/moderation/reports/:id/resolve  { valid: true|false, note? }
//   valid=true  → собственикът се банва (ако config.reports.validReportBansProposer), предложението 'removed'
//   valid=false → +1 baseless_report_count на докладващия; над прага може да се банне
router.post('/reports/:id/resolve', async (req, res, next) => {
  const cfg = load();
  const client = await pool.connect();
  try {
    const valid = !!(req.body && req.body.valid);
    const note = (req.body && req.body.note) || null;

    await client.query('BEGIN');
    const r = await client.query('SELECT * FROM reports WHERE id = $1', [req.params.id]);
    if (!r.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'not_found' }); }
    const report = r.rows[0];
    if (report.status !== 'pending') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'already_resolved' }); }

    await client.query(
      `UPDATE reports SET status = $2, reviewed_by = $3, reviewed_at = now() WHERE id = $1`,
      [report.id, valid ? 'valid' : 'invalid', req.user.id]
    );

    let outcome = {};
    if (valid) {
      // Свали предложението.
      await client.query(
        `UPDATE proposals SET status = 'removed', updated_at = now() WHERE id = $1`,
        [report.proposal_id]
      );
      await logAction(client, { proposal_id: report.proposal_id, actor_id: req.user.id, action: 'remove', note: 'валиден доклад' });
      // Бани собственика, ако конфигът го иска.
      if (cfg.reports.validReportBansProposer) {
        const owner = await client.query('SELECT owner_id FROM proposals WHERE id = $1', [report.proposal_id]);
        const ownerId = owner.rows[0]?.owner_id;
        if (ownerId) {
          await client.query(
            `UPDATE users SET is_banned = TRUE, ban_reason = $2, banned_at = now() WHERE id = $1`,
            [ownerId, 'валиден доклад за нереално предложение']
          );
          await logAction(client, { target_user: ownerId, actor_id: req.user.id, action: 'ban_owner', note });
          outcome.ownerBanned = true;
        }
      }
    } else {
      // Неоснователен доклад → +1 на докладващия.
      const upd = await client.query(
        `UPDATE users SET baseless_report_count = baseless_report_count + 1 WHERE id = $1
         RETURNING baseless_report_count`,
        [report.reporter_id]
      );
      const cntNow = upd.rows[0]?.baseless_report_count ?? 0;
      outcome.reporterBaselessCount = cntNow;
      outcome.reporterOverThreshold = cntNow > cfg.reports.maxBaselessReportsBeforeReporterBan;
    }

    await client.query('COMMIT');
    res.json({ ok: true, valid, ...outcome });
  } catch (e) { try { await client.query('ROLLBACK'); } catch (_) {} next(e); }
  finally { client.release(); }
});

// POST /api/hlb/moderation/users/:id/ban  { reason? } — ръчен бан (напр. на докладващ над прага)
router.post('/users/:id/ban', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const updated = await client.query(
      `UPDATE users SET is_banned = TRUE, ban_reason = $2, banned_at = now() WHERE id = $1
       RETURNING id, email, is_banned`,
      [req.params.id, (req.body && req.body.reason) || 'бан от модератор']
    );
    if (!updated.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'not_found' }); }
    await logAction(client, { target_user: req.params.id, actor_id: req.user.id, action: 'ban_reporter', note: req.body?.reason });
    await client.query('COMMIT');
    res.json({ user: updated.rows[0] });
  } catch (e) { try { await client.query('ROLLBACK'); } catch (_) {} next(e); }
  finally { client.release(); }
});

module.exports = router;
