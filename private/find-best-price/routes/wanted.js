// Version: 1.0196
// Find Best Price — ZERO PRICE („цена 0"): заявки „търся това, което го няма у нас"
// + оферти от други (цена / къде го има). GET е публичен; POST иска вход.

const express = require('express');
const { one, all } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/fbp/wanted?country=  — публичен списък с отворени заявки + брой оферти
router.get('/', async (req, res, next) => {
  try {
    const country = String(req.query.country || '').trim();
    const params = [], where = ["w.status = 'open'"];
    if (country) { params.push(country); where.push(`w.country = $${params.length}`); }
    const rows = await all(
      `SELECT w.id, w.title, w.description, w.country, w.city, w.created_at, w.is_system,
              COALESCE(u.display_name, '—') AS requester,
              (SELECT COUNT(*) FROM wanted_offers o WHERE o.request_id = w.id) AS offer_count
         FROM wanted_requests w JOIN users u ON u.id = w.requester_id
        WHERE ${where.join(' AND ')}
        ORDER BY w.created_at DESC LIMIT 200`, params);
    res.json({ requests: rows });
  } catch (e) { next(e); }
});

// GET /api/fbp/wanted/:id — заявка + офертите ѝ (публично)
router.get('/:id(\\d+)', async (req, res, next) => {
  try {
    const w = await one(
      `SELECT w.*, COALESCE(u.display_name, '—') AS requester
         FROM wanted_requests w JOIN users u ON u.id = w.requester_id WHERE w.id = $1`, [req.params.id]);
    if (!w) return res.status(404).json({ error: 'not_found' });
    const offers = await all(
      `SELECT o.id, o.price, o.currency, o.where_country, o.note, o.created_at, o.is_system,
              COALESCE(u.display_name, '—') AS responder
         FROM wanted_offers o JOIN users u ON u.id = o.responder_id
        WHERE o.request_id = $1 ORDER BY o.created_at ASC`, [req.params.id]);
    res.json({ request: w, offers });
  } catch (e) { next(e); }
});

// POST /api/fbp/wanted  { title, description?, country, city? }
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const p = req.body || {};
    if (!p.title || !String(p.title).trim()) return res.status(400).json({ error: 'no_title', message: 'Какво търсиш?' });
    if (!p.country || !String(p.country).trim()) return res.status(400).json({ error: 'no_country', message: 'Държавата е задължителна.' });
    const row = await one(
      `INSERT INTO wanted_requests (requester_id, title, description, country, city)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, String(p.title).trim().slice(0, 160), String(p.description || '').trim().slice(0, 2000),
        String(p.country).trim().slice(0, 80), (p.city ? String(p.city).trim().slice(0, 80) : null)]);
    res.status(201).json({ request: row });
  } catch (e) { next(e); }
});

// POST /api/fbp/wanted/:id/offer  { price?, currency?, where_country?, note }
router.post('/:id(\\d+)/offer', requireAuth, async (req, res, next) => {
  try {
    const p = req.body || {};
    const w = await one('SELECT id FROM wanted_requests WHERE id = $1', [req.params.id]);
    if (!w) return res.status(404).json({ error: 'not_found' });
    const note = String(p.note || '').trim();
    let price = null;
    if (p.price !== undefined && p.price !== null && String(p.price).trim() !== '') {
      price = Number(p.price);
      if (!isFinite(price) || price < 0) return res.status(400).json({ error: 'bad_price', message: 'Невалидна цена.' });
    }
    if (price === null && !note && !p.where_country) return res.status(400).json({ error: 'empty_offer', message: 'Дай цена или кажи къде го има.' });
    const row = await one(
      `INSERT INTO wanted_offers (request_id, responder_id, price, currency, where_country, note)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [w.id, req.user.id, price, (p.currency || 'USD'), (p.where_country ? String(p.where_country).trim().slice(0, 80) : null), note.slice(0, 1000)]);
    res.status(201).json({ offer: row });
  } catch (e) { next(e); }
});

module.exports = router;
