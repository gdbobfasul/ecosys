// Version: 1.0193
// Find Best Price — продукти с цени (под обект на потребителя, в една от 12-те категории).

const express = require('express');
const { one, all } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
// Категории по ВИД (kind): продукт/резервна част → продуктови; услуга → услугови.
const PRODUCT_CATS = ['food', 'building', 'autoparts', 'toys', 'clothes', 'bicycles',
  'furniture', 'computers', 'antiques', 'machinery', 'drones', 'robots'];
const SERVICE_CATS = ['dentist', 'medical', 'repair', 'legal', 'manufacturing', 'construction',
  'beauty', 'education', 'transport', 'it'];
const KINDS = ['product', 'service', 'sparepart'];
function validCat(kind, cat) { return kind === 'service' ? SERVICE_CATS.includes(cat) : PRODUCT_CATS.includes(cat); }

// POST /api/fbp/products  { business_id, kind?, category, name, price, currency?, quality?, materials?, manufacturer?, brand?, fits_product? }
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const p = req.body || {};
    const kind = KINDS.includes(p.kind) ? p.kind : 'product';
    // обектът трябва да е на текущия потребител
    const biz = await one('SELECT id FROM businesses WHERE id = $1 AND owner_id = $2', [p.business_id, req.user.id]);
    if (!biz) return res.status(403).json({ error: 'not_your_business', message: 'Първо дефинирай свой обект.' });
    if (!validCat(kind, p.category)) return res.status(400).json({ error: 'bad_category', message: 'Невалидна категория за този вид.' });
    if (!p.name || !String(p.name).trim()) return res.status(400).json({ error: 'no_name', message: 'Името е задължително.' });
    const price = Number(p.price);
    if (!isFinite(price) || price < 0) return res.status(400).json({ error: 'bad_price', message: 'Невалидна цена.' });
    const row = await one(
      `INSERT INTO products (business_id, kind, category, name, price, currency, quality, materials, manufacturer, brand, fits_product)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [biz.id, kind, p.category, String(p.name).trim(), price, p.currency || 'USD',
        p.quality || null, p.materials || null, p.manufacturer || null, p.brand || null,
        kind === 'sparepart' ? (p.fits_product || null) : null]
    );
    res.status(201).json({ product: row });
  } catch (e) { next(e); }
});

// GET /api/fbp/products/mine — продуктите на потребителя (през неговите обекти)
router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const rows = await all(
      `SELECT p.*, b.name AS business_name FROM products p
       JOIN businesses b ON b.id = p.business_id
       WHERE b.owner_id = $1 ORDER BY p.created_at DESC`,
      [req.user.id]
    );
    res.json({ products: rows });
  } catch (e) { next(e); }
});

module.exports = router;
