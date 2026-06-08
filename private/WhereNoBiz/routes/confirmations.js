// WhereNoBiz — потвърждения („такъв бизнес НЯМА").
// НЕ е „харесва ми". Лайкът ИЗИСКВА обосновка (config.confirmation):
//   where_could_develop — къде би могъл да се развие (градове/места)
//   why_missing         — защо лайкващият знае, че го няма
// stance: 'confirm' (няма го) брои в confirm_count; 'dispute' брои в unlike_count.
// Един потребител — едно потвърждение на пост (UNIQUE в базата).

const express = require('express');
const { one } = require('../db');
const { requireAuth, requireSubscribed } = require('../middleware/auth');
const { load } = require('../config-loader');
const debug = require('../../shared/debug-helper').create('wnb');

const router = express.Router();

// POST /api/wnb/posts/:id/confirm
//   { stance?: 'confirm'|'dispute', where_could_develop, why_missing }
router.post('/:id/confirm', requireAuth, requireSubscribed, async (req, res, next) => {
  const cfg = load();
  const client = await req.app.locals.pool.connect();
  try {
    const log = debug.scoped(req, 'POST /:id/confirm');
    log('старт');
    const postId = req.params.id;
    const stance = (req.body && req.body.stance === 'dispute') ? 'dispute' : 'confirm';
    const where = String((req.body && req.body.where_could_develop) || '').trim();
    const why = String((req.body && req.body.why_missing) || '').trim();

    // Обосновката е задължителна за 'confirm' (потвърждение, че няма бизнес).
    if (stance === 'confirm') {
      if (cfg.confirmation.requireWhereItCouldDevelop && where.length < cfg.confirmation.minReasonChars) {
        client.release();
        return res.status(400).json({ error: 'need_where', message: `Опиши къде би могъл да се развие (поне ${cfg.confirmation.minReasonChars} символа).` });
      }
      if (cfg.confirmation.requireWhyItIsMissing && why.length < cfg.confirmation.minReasonChars) {
        client.release();
        return res.status(400).json({ error: 'need_why', message: `Опиши защо знаеш, че го няма (поне ${cfg.confirmation.minReasonChars} символа).` });
      }
    }

    log('1');
    const post = await client.query("SELECT status, owner_id FROM posts WHERE id = $1", [postId]);
    if (!post.rows[0]) { client.release(); return res.status(404).json({ error: 'not_found' }); }
    if (post.rows[0].status !== 'approved') {
      client.release();
      return res.status(409).json({ error: 'not_approved', message: 'Може да се потвърждават само одобрени постове.' });
    }
    if (post.rows[0].owner_id === req.user.id) {
      client.release();
      return res.status(400).json({ error: 'self', message: 'Не можеш да потвърждаваш собствения си пост.' });
    }

    await client.query('BEGIN');
    const existing = await client.query('SELECT stance FROM confirmations WHERE post_id = $1 AND user_id = $2', [postId, req.user.id]);
    if (existing.rows[0]) {
      // Вече има глас → не дублираме (за смяна на мнение трябва първо махане).
      await client.query('ROLLBACK');
      client.release();
      return res.status(409).json({ error: 'already_voted', message: 'Вече си гласувал по този пост.' });
    }

    log('2');
    await client.query(
      `INSERT INTO confirmations (post_id, user_id, stance, where_could_develop, why_missing)
       VALUES ($1, $2, $3, $4, $5)`,
      [postId, req.user.id, stance, where || null, why || null]
    );
    if (stance === 'confirm') {
      await client.query('UPDATE posts SET confirm_count = confirm_count + 1 WHERE id = $1', [postId]);
    } else {
      await client.query('UPDATE posts SET unlike_count = unlike_count + 1 WHERE id = $1', [postId]);
    }
    const r = await client.query('SELECT confirm_count, unlike_count FROM posts WHERE id = $1', [postId]);
    await client.query('COMMIT');
    log('край → 200');
    res.json({ ok: true, stance, confirm_count: r.rows[0].confirm_count, unlike_count: r.rows[0].unlike_count });
  } catch (e) {
    debug.error('POST /:id/confirm:', e && e.message);
    try { await client.query('ROLLBACK'); } catch (_) {}
    next(e);
  } finally {
    client.release();
  }
});

// DELETE /api/wnb/posts/:id/confirm — махни своя глас
router.delete('/:id/confirm', requireAuth, async (req, res, next) => {
  const client = await req.app.locals.pool.connect();
  try {
    const log = debug.scoped(req, 'DELETE /:id/confirm');
    log('старт');
    const postId = req.params.id;
    await client.query('BEGIN');
    const existing = await client.query('SELECT stance FROM confirmations WHERE post_id = $1 AND user_id = $2', [postId, req.user.id]);
    log('1');
    if (existing.rows[0]) {
      await client.query('DELETE FROM confirmations WHERE post_id = $1 AND user_id = $2', [postId, req.user.id]);
      if (existing.rows[0].stance === 'confirm') {
        await client.query('UPDATE posts SET confirm_count = GREATEST(confirm_count - 1, 0) WHERE id = $1', [postId]);
      } else {
        await client.query('UPDATE posts SET unlike_count = GREATEST(unlike_count - 1, 0) WHERE id = $1', [postId]);
      }
    }
    const r = await client.query('SELECT confirm_count, unlike_count FROM posts WHERE id = $1', [postId]);
    await client.query('COMMIT');
    log('край → 200');
    res.json({ ok: true, confirm_count: r.rows[0]?.confirm_count ?? 0, unlike_count: r.rows[0]?.unlike_count ?? 0 });
  } catch (e) {
    debug.error('DELETE /:id/confirm:', e && e.message);
    try { await client.query('ROLLBACK'); } catch (_) {}
    next(e);
  } finally {
    client.release();
  }
});

// GET /api/wnb/posts/:id/confirm — моят глас (за UI)
router.get('/:id/confirm', requireAuth, async (req, res, next) => {
  try {
    const log = debug.scoped(req, 'GET /:id/confirm');
    log('старт');
    const r = await one('SELECT stance, where_could_develop, why_missing FROM confirmations WHERE post_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]);
    log('край → 200');
    res.json({ vote: r || null });
  } catch (e) { debug.error('GET /:id/confirm:', e && e.message); next(e); }
});

module.exports = router;
