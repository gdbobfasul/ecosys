// WhereNoBiz — доклади за фалшив/нелогичен пост.
// Дори ЕДИН доклад с доказателство може да свали поста (решава модератор).
// Един потребител — един доклад на пост.

const express = require('express');
const { q, one } = require('../db');
const { requireAuth } = require('../middleware/auth');
const debug = require('../../shared/debug-helper').create('wnb');

const router = express.Router();

// POST /api/wnb/posts/:id/report  { reason, evidence_url? }
router.post('/:id/report', requireAuth, async (req, res, next) => {
  try {
    const log = debug.scoped(req, 'POST /:id/report');
    log('старт');
    const postId = req.params.id;
    const reason = String((req.body && req.body.reason) || '').trim();
    const evidence = (req.body && req.body.evidence_url) || null;
    if (!reason) return res.status(400).json({ error: 'missing_reason', message: 'Опиши защо постът е фалшив/нелогичен.' });

    const p = await one('SELECT id, owner_id FROM posts WHERE id = $1', [postId]);
    if (!p) return res.status(404).json({ error: 'not_found' });
    if (p.owner_id === req.user.id) return res.status(400).json({ error: 'self_report', message: 'Не можеш да докладваш собствения си пост.' });
    log('1');

    try {
      await q('INSERT INTO reports (post_id, reporter_id, reason, evidence_url) VALUES ($1, $2, $3, $4)',
        [postId, req.user.id, reason, evidence]);
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'already_reported', message: 'Вече си докладвал този пост.' });
      throw err;
    }
    await q('UPDATE posts SET report_count = report_count + 1 WHERE id = $1', [postId]);
    log('край → 201');
    res.status(201).json({ ok: true, message: 'Докладът е подаден и чака модератор.' });
  } catch (e) { debug.error('POST /:id/report:', e && e.message); next(e); }
});

module.exports = router;
