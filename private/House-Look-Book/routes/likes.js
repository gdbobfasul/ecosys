// House-Look-Book — лайкове (глас „едно от най-добрите").
// Един потребител — един лайк на предложение (UNIQUE в базата + проверка тук).
// like_count е денормализиран в proposals за бърза класация.

const express = require('express');
const { q, one } = require('../db');
const { requireAuth, requireSubscribed } = require('../middleware/auth');
const debug = require('../../shared/debug-helper').create('hlb');

const router = express.Router();

// POST /api/hlb/proposals/:id/like  — лайкни (идемпотентно)
router.post('/:id/like', requireAuth, requireSubscribed, async (req, res, next) => {
  const client = await req.app.locals.pool.connect();
  try {
    const log = debug.scoped(req, 'POST /:id/like');
    log('старт');
    const proposalId = req.params.id;
    const p = await client.query("SELECT status FROM proposals WHERE id = $1", [proposalId]);
    if (!p.rows[0]) { log('край → 404'); client.release(); return res.status(404).json({ error: 'not_found' }); }
    if (p.rows[0].status !== 'approved') {
      log('край → 409');
      client.release();
      return res.status(409).json({ error: 'not_approved', message: 'Може да се лайкват само одобрени предложения.' });
    }

    log('1');
    await client.query('BEGIN');
    // ON CONFLICT DO NOTHING → втори лайк от същия човек не прави нищо.
    const ins = await client.query(
      `INSERT INTO likes (proposal_id, user_id) VALUES ($1, $2)
       ON CONFLICT (proposal_id, user_id) DO NOTHING`,
      [proposalId, req.user.id]
    );
    if (ins.rowCount === 1) {
      await client.query('UPDATE proposals SET like_count = like_count + 1 WHERE id = $1', [proposalId]);
    }
    const r = await client.query('SELECT like_count FROM proposals WHERE id = $1', [proposalId]);
    await client.query('COMMIT');
    log('край → 200');
    res.json({ liked: true, like_count: r.rows[0].like_count });
  } catch (e) {
    debug.error('POST /:id/like:', e && e.message);
    try { await client.query('ROLLBACK'); } catch (_) {}
    next(e);
  } finally {
    client.release();
  }
});

// DELETE /api/hlb/proposals/:id/like  — махни лайка
router.delete('/:id/like', requireAuth, async (req, res, next) => {
  const client = await req.app.locals.pool.connect();
  try {
    const log = debug.scoped(req, 'DELETE /:id/like');
    log('старт');
    const proposalId = req.params.id;
    log('1');
    await client.query('BEGIN');
    const del = await client.query(
      'DELETE FROM likes WHERE proposal_id = $1 AND user_id = $2',
      [proposalId, req.user.id]
    );
    if (del.rowCount === 1) {
      await client.query('UPDATE proposals SET like_count = GREATEST(like_count - 1, 0) WHERE id = $1', [proposalId]);
    }
    const r = await client.query('SELECT like_count FROM proposals WHERE id = $1', [proposalId]);
    await client.query('COMMIT');
    log('край → 200');
    res.json({ liked: false, like_count: r.rows[0]?.like_count ?? 0 });
  } catch (e) {
    debug.error('DELETE /:id/like:', e && e.message);
    try { await client.query('ROLLBACK'); } catch (_) {}
    next(e);
  } finally {
    client.release();
  }
});

// GET /api/hlb/proposals/:id/like  — лайкнал ли съм аз (за UI)
router.get('/:id/like', requireAuth, async (req, res, next) => {
  try {
    const log = debug.scoped(req, 'GET /:id/like');
    log('старт');
    const r = await one('SELECT 1 AS x FROM likes WHERE proposal_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]);
    log('край → 200');
    res.json({ liked: !!r });
  } catch (e) { debug.error('GET /:id/like:', e && e.message); next(e); }
});

module.exports = router;
