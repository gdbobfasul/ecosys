// House-Look-Book — доклади за НЕРЕАЛНО/неуместно предложение
// (напр. „това е магаре, не къща"). НЕ за „не ми харесва".
// Един потребител — един доклад на предложение. Решението е на модератора (виж moderation.js).

const express = require('express');
const { q, one } = require('../db');
const { requireAuth, requireSubscribed } = require('../middleware/auth');
const debug = require('../../shared/debug-helper').create('hlb');

const router = express.Router();

// POST /api/hlb/proposals/:id/report  { reason }
router.post('/:id/report', requireAuth, requireSubscribed, async (req, res, next) => {
  try {
    const log = debug.scoped(req, 'POST /:id/report');
    log('старт');
    const proposalId = req.params.id;
    const reason = String((req.body && req.body.reason) || '').trim();
    if (!reason) { log('край → 400'); return res.status(400).json({ error: 'missing_reason', message: 'Опиши защо това не е реална къща.' }); }

    const p = await one('SELECT id, owner_id FROM proposals WHERE id = $1', [proposalId]);
    if (!p) { log('край → 404'); return res.status(404).json({ error: 'not_found' }); }
    if (p.owner_id === req.user.id) {
      log('край → 400');
      return res.status(400).json({ error: 'self_report', message: 'Не можеш да докладваш собственото си предложение.' });
    }

    log('1');
    try {
      await q(
        `INSERT INTO reports (proposal_id, reporter_id, reason) VALUES ($1, $2, $3)`,
        [proposalId, req.user.id, reason]
      );
    } catch (err) {
      // UNIQUE (proposal_id, reporter_id) → вече е докладвано от този човек.
      if (err.code === '23505') {
        log('край → 409');
        return res.status(409).json({ error: 'already_reported', message: 'Вече си докладвал това предложение.' });
      }
      throw err;
    }
    await q('UPDATE proposals SET report_count = report_count + 1 WHERE id = $1', [proposalId]);
    log('край → 201');
    res.status(201).json({ ok: true, message: 'Докладът е подаден и чака модератор.' });
  } catch (e) { debug.error('POST /:id/report:', e && e.message); next(e); }
});

module.exports = router;
