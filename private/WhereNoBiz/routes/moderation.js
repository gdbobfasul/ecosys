// Version: 1.0171
// WhereNoBiz — модерация (само moderator/admin).
// Нищо не е публично преди 'approved'. Червен флаг: Google връща сайт от тази
// страна, предлагащ бизнеса → reject/remove. Един валиден доклад може да свали поста.

const express = require('express');
const { q, one, all, pool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { load } = require('../config-loader');
const { roleForEmail } = require('../roles');

const router = express.Router();
router.use(requireAuth, requireRole('moderator', 'admin'));

async function logAction(client, { post_id, target_user, actor_id, action, note }) {
  await client.query(
    `INSERT INTO moderation_log (post_id, target_user, actor_id, action, note) VALUES ($1, $2, $3, $4, $5)`,
    [post_id || null, target_user || null, actor_id, action, note || null]
  );
}

// GET /api/wnb/moderation/pending
router.get('/pending', async (req, res, next) => {
  try {
    const rows = await all(
      `SELECT p.*, u.email AS owner_email, u.display_name AS owner_name
       FROM posts p JOIN users u ON u.id = p.owner_id
       WHERE p.status = 'pending_moderation' ORDER BY p.submitted_at ASC`
    );
    res.json({ pending: rows });
  } catch (e) { next(e); }
});

// GET /api/wnb/moderation/reports
router.get('/reports', async (req, res, next) => {
  try {
    const rows = await all(
      `SELECT r.*, p.title AS post_title, p.country_code, ru.display_name AS reporter_name
       FROM reports r JOIN posts p ON p.id = r.post_id JOIN users ru ON ru.id = r.reporter_id
       WHERE r.status = 'pending' ORDER BY r.created_at ASC`
    );
    res.json({ reports: rows });
  } catch (e) { next(e); }
});

// POST /api/wnb/moderation/posts/:id/approve
router.post('/posts/:id/approve', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const updated = await client.query(
      `UPDATE posts SET status = 'approved', approved_at = now(), moderated_by = $2, moderation_note = $3, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.params.id, req.user.id, (req.body && req.body.note) || null]
    );
    if (!updated.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'not_found' }); }
    await logAction(client, { post_id: req.params.id, actor_id: req.user.id, action: 'approve', note: req.body?.note });
    await client.query('COMMIT');
    res.json({ post: updated.rows[0] });
  } catch (e) { try { await client.query('ROLLBACK'); } catch (_) {} next(e); }
  finally { client.release(); }
});

// POST /api/wnb/moderation/posts/:id/reject  { note? }
router.post('/posts/:id/reject', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const updated = await client.query(
      `UPDATE posts SET status = 'rejected', moderated_by = $2, moderation_note = $3, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.params.id, req.user.id, (req.body && req.body.note) || null]
    );
    if (!updated.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'not_found' }); }
    await logAction(client, { post_id: req.params.id, actor_id: req.user.id, action: 'reject', note: req.body?.note });
    await client.query('COMMIT');
    res.json({ post: updated.rows[0] });
  } catch (e) { try { await client.query('ROLLBACK'); } catch (_) {} next(e); }
  finally { client.release(); }
});

// POST /api/wnb/moderation/posts/:id/remove  { note? } — сваляне
router.post('/posts/:id/remove', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const updated = await client.query(
      `UPDATE posts SET status = 'removed', moderated_by = $2, moderation_note = $3, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.params.id, req.user.id, (req.body && req.body.note) || null]
    );
    if (!updated.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'not_found' }); }
    await logAction(client, { post_id: req.params.id, actor_id: req.user.id, action: 'remove', note: req.body?.note });
    await client.query('COMMIT');
    res.json({ post: updated.rows[0] });
  } catch (e) { try { await client.query('ROLLBACK'); } catch (_) {} next(e); }
  finally { client.release(); }
});

// POST /api/wnb/moderation/reports/:id/resolve  { valid: true|false, note? }
//   valid=true → постът се сваля ('removed'); по config.moderation един валиден доклад стига.
router.post('/reports/:id/resolve', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const valid = !!(req.body && req.body.valid);
    await client.query('BEGIN');
    const r = await client.query('SELECT * FROM reports WHERE id = $1', [req.params.id]);
    if (!r.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'not_found' }); }
    const report = r.rows[0];
    if (report.status !== 'pending') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'already_resolved' }); }

    await client.query('UPDATE reports SET status = $2, reviewed_by = $3, reviewed_at = now() WHERE id = $1',
      [report.id, valid ? 'valid' : 'invalid', req.user.id]);

    if (valid) {
      await client.query("UPDATE posts SET status = 'removed', updated_at = now() WHERE id = $1", [report.post_id]);
      await logAction(client, { post_id: report.post_id, actor_id: req.user.id, action: 'remove', note: 'валиден доклад' });
    }
    await client.query('COMMIT');
    res.json({ ok: true, valid });
  } catch (e) { try { await client.query('ROLLBACK'); } catch (_) {} next(e); }
  finally { client.release(); }
});

// POST /api/wnb/moderation/users/:id/ban  { reason? }
router.post('/users/:id/ban', requireRole('admin'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const updated = await client.query(
      `UPDATE users SET is_banned = TRUE, ban_reason = $2, banned_at = now() WHERE id = $1 RETURNING id, email, is_banned`,
      [req.params.id, (req.body && req.body.reason) || 'бан от модератор']
    );
    if (!updated.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'not_found' }); }
    await logAction(client, { target_user: req.params.id, actor_id: req.user.id, action: 'ban_owner', note: req.body?.reason });
    await client.query('COMMIT');
    res.json({ user: updated.rows[0] });
  } catch (e) { try { await client.query('ROLLBACK'); } catch (_) {} next(e); }
  finally { client.release(); }
});

// GET /api/wnb/moderation/posts?status=&sort=confirm|unlike|new&order=asc|desc&limit=&offset=
//   Списък на ВСИЧКИ постове (админ: най-/най-малко потвърждавани, несъгласия, трий).
router.get('/posts', requireRole('admin'), async (req, res, next) => {
  try {
    const sortMap = { confirm: 'p.confirm_count', unlike: 'p.unlike_count', new: 'p.created_at' };
    const sort = sortMap[req.query.sort] || 'p.confirm_count';
    const order = (req.query.order === 'asc') ? 'ASC' : 'DESC';
    const limit = Math.min(parseInt(req.query.limit || '50', 10) || 50, 200);
    const offset = Math.max(parseInt(req.query.offset || '0', 10) || 0, 0);
    const cols = `p.id, p.title, p.status, p.country_code, p.confirm_count, p.unlike_count,
                  p.report_count, p.created_at, p.owner_id, u.email AS owner_email,
                  u.display_name AS owner_name, u.is_banned AS owner_banned`;
    const tail = `ORDER BY ${sort} ${order}, p.id DESC LIMIT ${limit} OFFSET ${offset}`;
    const rows = req.query.status
      ? await all(`SELECT ${cols} FROM posts p JOIN users u ON u.id = p.owner_id WHERE p.status = $1 ${tail}`, [req.query.status])
      : await all(`SELECT ${cols} FROM posts p JOIN users u ON u.id = p.owner_id ${tail}`);
    res.json({ posts: rows });
  } catch (e) { next(e); }
});

// GET /api/wnb/moderation/users?banned=1
router.get('/users', requireRole('admin'), async (req, res, next) => {
  try {
    const onlyBanned = req.query.banned === '1';
    const rows = await all(
      `SELECT id, email, display_name, is_banned, ban_reason, created_at
       FROM users ${onlyBanned ? 'WHERE is_banned = TRUE' : ''}
       ORDER BY is_banned DESC, created_at DESC LIMIT 200`
    );
    // Ролята идва от .env (roles.js), не от базата.
    res.json({ users: rows.map(r => ({ ...r, role: roleForEmail(r.email) })) });
  } catch (e) { next(e); }
});

// POST /api/wnb/moderation/users/:id/unban
router.post('/users/:id/unban', requireRole('admin'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const updated = await client.query(
      `UPDATE users SET is_banned = FALSE, ban_reason = NULL, banned_at = NULL WHERE id = $1
       RETURNING id, email, is_banned`, [req.params.id]
    );
    if (!updated.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'not_found' }); }
    await logAction(client, { target_user: req.params.id, actor_id: req.user.id, action: 'unban', note: null });
    await client.query('COMMIT');
    res.json({ user: updated.rows[0] });
  } catch (e) { try { await client.query('ROLLBACK'); } catch (_) {} next(e); }
  finally { client.release(); }
});

// GET /api/wnb/moderation/db — суров read-only изглед на всички таблици (за страница db.html).
// Admin/moderator (рутерът вече е зад requireRole). Паролните хешове се маскират.
router.get('/db', requireRole('admin'), async (req, res, next) => {
  try {
    const tnames = await all("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
    const tables = [];
    for (const t of tnames) {
      const name = t.tablename;
      const rows = await all(`SELECT * FROM "${name}" ORDER BY 1 LIMIT 2000`);
      const totalRow = await one(`SELECT count(*)::int AS c FROM "${name}"`);
      const safe = rows.map(r => {
        const o = { ...r };
        if ('password_hash' in o) o.password_hash = '***';
        return o;
      });
      tables.push({
        name,
        total: totalRow ? totalRow.c : rows.length,
        columns: rows.length ? Object.keys(rows[0]) : [],
        rows: safe,
      });
    }
    res.json({ tables });
  } catch (e) { next(e); }
});

module.exports = router;
