// Version: 1.0193
// Find Best Price — обекти (бизнеси) на потребителя.
// За да въвежда цени, човек ПЪРВО дефинира обект: тип + държава/град/село/район/точна локация/име.

const express = require('express');
const { one, all } = require('../db');
const { requireAuth } = require('../middleware/auth');
const debug = require('../../shared/debug-helper').create('fbp');

const router = express.Router();
const BTYPES = ['factory', 'shop', 'stall', 'reseller', 'online'];

// POST /api/fbp/business  { btype, name, country, city?, village?, district?, location_exact }
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const log = debug.scoped(req, 'POST /business');
    log('старт');
    const b = req.body || {};
    if (!BTYPES.includes(b.btype)) return res.status(400).json({ error: 'bad_type', message: 'Невалиден тип обект.' });
    if (!b.name || !String(b.name).trim()) return res.status(400).json({ error: 'no_name', message: 'Наименованието е задължително.' });
    if (!b.country || !String(b.country).trim()) return res.status(400).json({ error: 'no_country', message: 'Държавата е задължителна.' });
    if (!b.location_exact || !String(b.location_exact).trim()) return res.status(400).json({ error: 'no_location', message: 'Точната локация е задължителна.' });
    log('1');
    const row = await one(
      `INSERT INTO businesses (owner_id, btype, name, country, city, village, district, location_exact)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, btype, name, country, city, village, district, location_exact, created_at`,
      [req.user.id, b.btype, String(b.name).trim(), String(b.country).trim(),
        b.city || null, b.village || null, b.district || null, String(b.location_exact).trim()]
    );
    log('край → 201');
    res.status(201).json({ business: row });
  } catch (e) { debug.error('POST /business:', e && e.message); next(e); }
});

// GET /api/fbp/business/mine — обектите на текущия потребител
router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const log = debug.scoped(req, 'GET /business/mine');
    log('старт');
    const rows = await all('SELECT * FROM businesses WHERE owner_id = $1 ORDER BY created_at DESC', [req.user.id]);
    log('край → 200');
    res.json({ businesses: rows });
  } catch (e) { debug.error('GET /business/mine:', e && e.message); next(e); }
});

// GET /api/fbp/business/:id — публична визитка на обект
router.get('/:id', async (req, res, next) => {
  try {
    const log = debug.scoped(req, 'GET /business/:id');
    log('старт');
    const row = await one('SELECT id, btype, name, country, city, village, district, location_exact FROM businesses WHERE id = $1', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'not_found' });
    log('край → 200');
    res.json({ business: row });
  } catch (e) { debug.error('GET /business/:id:', e && e.message); next(e); }
});

module.exports = router;
