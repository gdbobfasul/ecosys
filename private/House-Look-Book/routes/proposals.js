// Version: 1.0171
// House-Look-Book — предложения (къщи).
// Машина на състоянията (виж schema.sql):
//   editing → pending_moderation → approved/rejected ; removed.
// Прагове/срокове идват ИЗЦЯЛО от config.json (config-loader), не от кода.

const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');
const { q, one, all, pool } = require('../db');
const { requireAuth, requireSubscribed } = require('../middleware/auth');
const { load } = require('../config-loader');
const { roleForEmail } = require('../roles');
const debug = require('../../shared/debug-helper').create('hlb');

const router = express.Router();

// Качените картинки се пазят на диск (умалени), пътят им — в базата.
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'proposals');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Multer пази в паметта; после sharp прави thumbnail и записва на диск.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB суров вход; thumbnail-ът е малък
});

// Помощни дати според config.editWindow.
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// ── Създаване (от конструктора или като качени снимки) ───────────────
// POST /api/hlb/proposals  { title, description?, composer_params? }
router.post('/', requireAuth, requireSubscribed, async (req, res, next) => {
  try {
    const log = debug.scoped(req, 'POST /proposals');
    log('старт');
    const cfg = load();
    const { title, description, composer_params } = req.body || {};
    if (!title || !String(title).trim()) {
      log('край → 400');
      return res.status(400).json({ error: 'missing_title', message: 'Дай заглавие на къщата.' });
    }
    const desc = String(description || '').slice(0, cfg.proposals.maxDescriptionChars);

    // composer_params е JSONB → валидирай. Невалиден низ → 400 (а НЕ 500 от PG json cast).
    let cp = null;
    if (composer_params !== undefined && composer_params !== null && composer_params !== '') {
      let obj = composer_params;
      if (typeof obj === 'string') {
        try { obj = JSON.parse(obj); }
        catch (e) { log('край → 400 (невалиден composer_params)'); return res.status(400).json({ error: 'bad_composer_params', message: 'Невалидни данни за композитора.' }); }
      }
      if (typeof obj !== 'object') { return res.status(400).json({ error: 'bad_composer_params', message: 'Невалидни данни за композитора.' }); }
      cp = obj;
    }

    // Лимит на брой предложения на потребител.
    const cnt = await one(
      "SELECT count(*)::int AS c FROM proposals WHERE owner_id = $1 AND status <> 'removed'",
      [req.user.id]
    );
    log('1');
    if (cnt.c >= cfg.proposals.maxPerUser) {
      log('край → 409');
      return res.status(409).json({
        error: 'too_many',
        message: `Достигнат е лимитът от ${cfg.proposals.maxPerUser} предложения.`,
      });
    }

    const editUntil = addDays(new Date(), cfg.editWindow.initialDays);
    log('2');
    const p = await one(
      `INSERT INTO proposals (owner_id, title, description, composer_params, status, edit_window_until)
       VALUES ($1, $2, $3, $4, 'editing', $5)
       RETURNING *`,
      [req.user.id, String(title).trim(), desc, cp, editUntil]
    );
    log('край → 201');
    res.status(201).json({ proposal: p });
  } catch (e) { debug.error('POST /proposals:', e && e.message); next(e); }
});

// ── Галерия (само одобрени, странициране) ────────────────────────────
// GET /api/hlb/proposals?limit=20&offset=0
router.get('/', async (req, res, next) => {
  try {
    const log = debug.scoped(req, 'GET /proposals');
    log('старт');
    const cfg = load();
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);
    log('1');
    const rows = await all(
      `SELECT p.id, p.title, p.description, p.composer_params, p.like_count, p.created_at,
              u.display_name AS owner_name
       FROM proposals p JOIN users u ON u.id = p.owner_id
       WHERE p.status = 'approved'
       ORDER BY p.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    log('край → 200');
    res.json({ proposals: rows, topListSize: cfg.ranking.topListSize });
  } catch (e) { debug.error('GET /proposals:', e && e.message); next(e); }
});

// ── Класация (топ N по лайкове) ──────────────────────────────────────
// GET /api/hlb/proposals/ranking
router.get('/ranking', async (req, res, next) => {
  try {
    const log = debug.scoped(req, 'GET /proposals/ranking');
    log('старт');
    const cfg = load();
    log('1');
    const rows = await all(
      `SELECT p.id, p.title, p.composer_params, p.like_count,
              u.display_name AS owner_name
       FROM proposals p JOIN users u ON u.id = p.owner_id
       WHERE p.status = 'approved'
       ORDER BY p.like_count DESC, p.approved_at ASC
       LIMIT $1`,
      [cfg.ranking.topListSize]
    );
    log('край → 200');
    res.json({ ranking: rows });
  } catch (e) { debug.error('GET /proposals/ranking:', e && e.message); next(e); }
});

// ── Мои предложения (всякакъв статус) ────────────────────────────────
// GET /api/hlb/proposals/mine
router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const log = debug.scoped(req, 'GET /proposals/mine');
    log('старт');
    const rows = await all(
      `SELECT * FROM proposals WHERE owner_id = $1 ORDER BY updated_at DESC`,
      [req.user.id]
    );
    log('край → 200');
    res.json({ proposals: rows });
  } catch (e) { debug.error('GET /proposals/mine:', e && e.message); next(e); }
});

// ── Един запис (+ картинки). Скритите статуси вижда само собственик/модератор ─
// GET /api/hlb/proposals/:id
router.get('/:id', async (req, res, next) => {
  try {
    const log = debug.scoped(req, 'GET /proposals/:id');
    log('старт');
    const p = await one('SELECT * FROM proposals WHERE id = $1', [req.params.id]);
    if (!p) { log('край → 404'); return res.status(404).json({ error: 'not_found' }); }

    log('1');
    const viewerId = req.session?.userId;
    const isOwner = viewerId && viewerId === p.owner_id;
    let isStaff = false;
    if (viewerId) {
      const v = await one('SELECT email FROM users WHERE id = $1', [viewerId]);
      isStaff = v && roleForEmail(v.email) !== 'user';
    }
    if (p.status !== 'approved' && !isOwner && !isStaff) {
      log('край → 403');
      return res.status(403).json({ error: 'not_visible', message: 'Това предложение още не е одобрено.' });
    }
    const images = await all(
      'SELECT id, kind, url, sort_order FROM proposal_images WHERE proposal_id = $1 ORDER BY kind, sort_order',
      [p.id]
    );
    log('край → 200');
    res.json({ proposal: p, images });
  } catch (e) { debug.error('GET /proposals/:id:', e && e.message); next(e); }
});

// ── Редакция (само собственик) — отваря НОВ edit-window и връща за модерация ──
// PUT /api/hlb/proposals/:id  { title?, description?, composer_params? }
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const log = debug.scoped(req, 'PUT /proposals/:id');
    log('старт');
    const cfg = load();
    const p = await one('SELECT * FROM proposals WHERE id = $1', [req.params.id]);
    if (!p) { log('край → 404'); return res.status(404).json({ error: 'not_found' }); }
    if (p.owner_id !== req.user.id) { log('край → 403'); return res.status(403).json({ error: 'forbidden' }); }
    if (p.status === 'removed') { log('край → 409'); return res.status(409).json({ error: 'removed', message: 'Свалено е, не може да се редактира.' }); }

    const { title, description, composer_params } = req.body || {};
    const newTitle = title !== undefined ? String(title).trim() : p.title;
    const newDesc = description !== undefined
      ? String(description).slice(0, cfg.proposals.maxDescriptionChars)
      : p.description;
    const newParams = composer_params !== undefined ? composer_params : p.composer_params;

    // Всяка редакция (дори на одобрено) → нов прозорец + пак 'editing' → пак модерация.
    const editUntil = addDays(new Date(), cfg.editWindow.perEditDays);
    log('1');
    const updated = await one(
      `UPDATE proposals
       SET title = $1, description = $2, composer_params = $3,
           status = 'editing', edit_window_until = $4, updated_at = now()
       WHERE id = $5
       RETURNING *`,
      [newTitle, newDesc, newParams, editUntil, p.id]
    );
    log('край → 200');
    res.json({ proposal: updated });
  } catch (e) { debug.error('PUT /proposals/:id:', e && e.message); next(e); }
});

// ── Триене (само собственик) → 'removed' (меко, пази историята) ───────
// DELETE /api/hlb/proposals/:id
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const log = debug.scoped(req, 'DELETE /proposals/:id');
    log('старт');
    const p = await one('SELECT owner_id FROM proposals WHERE id = $1', [req.params.id]);
    if (!p) { log('край → 404'); return res.status(404).json({ error: 'not_found' }); }
    if (p.owner_id !== req.user.id) { log('край → 403'); return res.status(403).json({ error: 'forbidden' }); }
    log('1');
    await q("UPDATE proposals SET status = 'removed', updated_at = now() WHERE id = $1", [req.params.id]);
    log('край → 200');
    res.json({ ok: true });
  } catch (e) { debug.error('DELETE /proposals/:id:', e && e.message); next(e); }
});

// ── Качване на картинки (само собственик, само докато е 'editing') ────
// POST /api/hlb/proposals/:id/images?kind=view|detail  (multipart, поле "image")
router.post('/:id/images', requireAuth, upload.single('image'), async (req, res, next) => {
  try {
    const log = debug.scoped(req, 'POST /proposals/:id/images');
    log('старт');
    const cfg = load();
    const p = await one('SELECT * FROM proposals WHERE id = $1', [req.params.id]);
    if (!p) { log('край → 404'); return res.status(404).json({ error: 'not_found' }); }
    if (p.owner_id !== req.user.id) { log('край → 403'); return res.status(403).json({ error: 'forbidden' }); }
    if (p.status !== 'editing') {
      log('край → 409');
      return res.status(409).json({ error: 'not_editing', message: 'Картинки се качват само докато прозорецът за редакция е отворен.' });
    }
    if (!req.file) { log('край → 400'); return res.status(400).json({ error: 'no_file' }); }

    log('1');
    const kind = (req.query.kind === 'view') ? 'view' : 'detail';

    // Лимити от config (брой view/detail).
    const existing = await one(
      'SELECT count(*)::int AS c FROM proposal_images WHERE proposal_id = $1 AND kind = $2',
      [p.id, kind]
    );
    const max = kind === 'view' ? cfg.proposals.requiredExteriorViews : cfg.proposals.maxDetailImages;
    if (existing.c >= max) {
      log('край → 409');
      return res.status(409).json({ error: 'too_many_images', message: `Лимит ${max} за тип '${kind}'.` });
    }

    // 1) ВАЛИДИРАЙ, че е истинско изображение (само декодиране). Провал ТУК = наистина
    //    невалиден файл → 400 invalid_image.
    try {
      await sharp(req.file.buffer).metadata();
    } catch (decodeErr) {
      log('край → 400 (invalid_image)');
      return res.status(400).json({ error: 'invalid_image', message: 'Файлът не е валидно изображение.' });
    }

    // 2) Папката може да е изтрита от деплой (rsync --delete) СЛЕД старта на процеса —
    //    пресъздай я преди запис (идемпотентно), иначе toFile гърми с ENOENT.
    try { fs.mkdirSync(UPLOAD_DIR, { recursive: true }); } catch (_) {}

    // 3) Умаляване (sharp) по config.proposals.thumbnail* + запис. Провал ТУК = файлов/сървърен
    //    проблем (не „лошо изображение") → 500 с ясен код, за да не подвежда като invalid_image.
    const fname = `p${p.id}_${kind}_${existing.c + 1}_${Date.now()}.jpg`;
    const fpath = path.join(UPLOAD_DIR, fname);
    try {
      await sharp(req.file.buffer)
        .resize({ width: cfg.proposals.thumbnailMaxWidthPx, withoutEnlargement: true })
        .jpeg({ quality: cfg.proposals.thumbnailQuality })
        .toFile(fpath);
    } catch (writeErr) {
      debug.error('thumbnail toFile се провали:', writeErr && (writeErr.stack || writeErr.message));
      return res.status(500).json({ error: 'thumbnail_failed', message: 'Грешка при обработка/запис на изображението.', detail: writeErr && writeErr.message });
    }

    log('2');
    const img = await one(
      `INSERT INTO proposal_images (proposal_id, kind, url, sort_order)
       VALUES ($1, $2, $3, $4) RETURNING id, kind, url, sort_order`,
      [p.id, kind, `/uploads/proposals/${fname}`, existing.c + 1]
    );
    log('край → 201');
    res.status(201).json({ image: img });
  } catch (e) { debug.error('POST /proposals/:id/images:', e && e.message); next(e); }
});

// ── Подаване за модерация (собственик слага край на прозореца ръчно) ──
// POST /api/hlb/proposals/:id/submit
router.post('/:id/submit', requireAuth, async (req, res, next) => {
  try {
    const log = debug.scoped(req, 'POST /proposals/:id/submit');
    log('старт');
    const p = await one('SELECT * FROM proposals WHERE id = $1', [req.params.id]);
    if (!p) { log('край → 404'); return res.status(404).json({ error: 'not_found' }); }
    if (p.owner_id !== req.user.id) { log('край → 403'); return res.status(403).json({ error: 'forbidden' }); }
    if (p.status !== 'editing') { log('край → 409'); return res.status(409).json({ error: 'not_editing' }); }
    log('1');
    const updated = await one(
      `UPDATE proposals SET status = 'pending_moderation', submitted_at = now(), updated_at = now()
       WHERE id = $1 RETURNING *`,
      [p.id]
    );
    log('край → 200');
    res.json({ proposal: updated });
  } catch (e) { debug.error('POST /proposals/:id/submit:', e && e.message); next(e); }
});

// ── Форма от снимка (силует) ─────────────────────────────────────────
// POST /api/hlb/proposals/shape-from-image  (multipart "image") → { pts }
// Изважда силует (контур по редове) от качена снимка → нормализирани точки 0..1.
// Ползва се от КЛИЕНТА (конструктора) и от админа. Не записва нищо — само връща формата.
router.post('/shape-from-image', requireAuth, upload.single('image'), async (req, res, next) => {
  try {
    const log = debug.scoped(req, 'POST /proposals/shape-from-image');
    log('старт');
    if (!req.file) { log('край → 400'); return res.status(400).json({ error: 'no_file', message: 'Качи изображение.' }); }
    let raw;
    try { raw = await sharp(req.file.buffer).resize(48, 48, { fit: 'fill' }).grayscale().raw().toBuffer({ resolveWithObject: true }); }
    catch (e) { log('край → 400'); return res.status(400).json({ error: 'bad_image', message: 'Не мога да обработя изображението.' }); }
    log('1');
    const data = raw.data, Wd = raw.info.width, Hd = raw.info.height;
    let sum = 0; for (let i = 0; i < Wd * Hd; i++) sum += data[i];
    const mean = sum / (Wd * Hd);
    const left = [], right = [];
    for (let y = 0; y < Hd; y++) {
      let l = -1, r = -1;
      for (let x = 0; x < Wd; x++) { if (data[y * Wd + x] < mean) { if (l < 0) l = x; r = x; } }
      if (l >= 0) { left.push([l, y]); right.push([r, y]); }
    }
    if (left.length < 4) { log('край → 422'); return res.status(422).json({ error: 'no_shape', message: 'Не успях да извлека форма от тази снимка.' }); }
    const step = Math.max(1, Math.floor(left.length / 14));
    const pts = [];
    for (let i = 0; i < left.length; i += step) pts.push(left[i]);
    for (let i = right.length - 1; i >= 0; i -= step) pts.push(right[i]);
    log('край → 200');
    res.json({ pts: pts.map(p => [+(p[0] / (Wd - 1)).toFixed(3), +(p[1] / (Hd - 1)).toFixed(3)]) });
  } catch (e) { debug.error('POST /proposals/shape-from-image:', e && e.message); next(e); }
});

// ── Снимка на мебел (вариант на стандартна) ──────────────────────────
// POST /api/hlb/proposals/furniture-image  (multipart "image") → { url }
// Качва се от КЛИЕНТА в конструктора за конкретна мебел. Записва нормализирана
// PNG в uploads/proposals и връща URL — слага се в composer_params.rooms[].items[].img.
// Не променя базата (URL живее в JSONB на предложението).
router.post('/furniture-image', requireAuth, upload.single('image'), async (req, res, next) => {
  try {
    const log = debug.scoped(req, 'POST /proposals/furniture-image');
    log('старт');
    if (!req.file) { log('край → 400'); return res.status(400).json({ error: 'no_file', message: 'Качи изображение.' }); }
    try { await sharp(req.file.buffer).metadata(); }
    catch (decodeErr) { log('край → 400 (bad_image)'); return res.status(400).json({ error: 'bad_image', message: 'Не мога да обработя изображението.' }); }
    try { fs.mkdirSync(UPLOAD_DIR, { recursive: true }); } catch (_) {}
    const fname = `furn_u${req.user.id}_${Date.now()}.png`;
    const fpath = path.join(UPLOAD_DIR, fname);
    try {
      await sharp(req.file.buffer)
        .resize({ width: 256, height: 256, fit: 'inside', withoutEnlargement: true })
        .png({ quality: 82 })
        .toFile(fpath);
    } catch (writeErr) {
      debug.error('furniture-image toFile се провали:', writeErr && writeErr.message);
      return res.status(500).json({ error: 'thumbnail_failed', message: 'Грешка при запис на изображението.' });
    }
    log('край → 201');
    res.status(201).json({ url: `/uploads/proposals/${fname}` });
  } catch (e) { debug.error('POST /proposals/furniture-image:', e && e.message); next(e); }
});

module.exports = router;
