// Version: 1.0193
// Find Best Price — ПУБЛИЧНО търсене в цените с филтрите:
//   категория · държава/град/село/район · ценови диапазон · качество · материали · производител · марка.
// Сортирано по цена възходящо (най-евтиното най-отгоре).

const express = require('express');
const { all } = require('../db');
const debug = require('../../shared/debug-helper').create('fbp');

const router = express.Router();

// GET /api/fbp/search?category=&country=&city=&village=&district=&price_min=&price_max=&quality=&materials=&manufacturer=&brand=
router.get('/', async (req, res, next) => {
  try {
    const log = debug.scoped(req, 'GET /search');
    log('старт');
    const Q = req.query || {};
    const where = []; const params = []; let i = 1;
    const eq = (col, val) => { where.push(`${col} = $${i}`); params.push(val); i++; };
    const like = (col, val) => { where.push(`${col} ILIKE $${i}`); params.push('%' + String(val).trim() + '%'); i++; };

    if (Q.kind) eq('p.kind', Q.kind);                       // product | service | sparepart
    if (Q.category) eq('p.category', Q.category);
    if (Q.fits_product) like('p.fits_product', Q.fits_product);  // за резервни части: за кой модел
    if (Q.country) like('b.country', Q.country);
    if (Q.city) like('b.city', Q.city);
    if (Q.village) like('b.village', Q.village);
    if (Q.district) like('b.district', Q.district);
    if (Q.quality) like('p.quality', Q.quality);
    if (Q.materials) like('p.materials', Q.materials);
    if (Q.manufacturer) like('p.manufacturer', Q.manufacturer);
    if (Q.brand) like('p.brand', Q.brand);
    if (Q.price_min !== undefined && Q.price_min !== '') { where.push(`p.price >= $${i}`); params.push(Number(Q.price_min) || 0); i++; }
    if (Q.price_max !== undefined && Q.price_max !== '') { where.push(`p.price <= $${i}`); params.push(Number(Q.price_max) || 0); i++; }

    const sql =
      `SELECT p.id, p.kind, p.category, p.name, p.price, p.currency, p.quality, p.materials, p.manufacturer, p.brand, p.fits_product,
              b.id AS business_id, b.name AS business_name, b.btype, b.country, b.city, b.village, b.district, b.location_exact
       FROM products p
       JOIN businesses b ON b.id = p.business_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY p.price ASC
       LIMIT 200`;
    log('1');
    const rows = await all(sql, params);
    log('край → 200');
    res.json({ count: rows.length, results: rows });
  } catch (e) { debug.error('GET /search:', e && e.message); next(e); }
});

module.exports = router;
