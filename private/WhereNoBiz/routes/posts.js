// Version: 1.0171
// WhereNoBiz — постове („какъв бизнес НЯМА" за дадена страна).
// Постване концептуално е „на сайта" (server-client модел) и струва config.fees.postUsd
// (за прототипа плащането е заглушка). Гледането е „в приложението".
// Машина на състоянията: pending_moderation → approved/rejected ; removed.

const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');
const { q, one, all } = require('../db');
const { requireAuth, requireSubscribed } = require('../middleware/auth');
const { load } = require('../config-loader');
const { COUNTRIES } = require('../data/countries');
const { roleForEmail } = require('../roles');
const debug = require('../../shared/debug-helper').create('wnb');

const router = express.Router();
const VALID_CODES = new Set(COUNTRIES.map(c => c.code));

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'posts');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

// ── Създаване на пост (постване „на сайта", $20 заглушка) ────────────
// POST /api/wnb/posts { country_code, title, description?, links?[] }
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const log = debug.scoped(req, 'POST /');
    log('старт');
    const cfg = load();
    const { country_code, title, description, links } = req.body || {};
    if (!country_code || !VALID_CODES.has(country_code)) {
      return res.status(400).json({ error: 'bad_country', message: 'Избери валидна страна.' });
    }
    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: 'missing_title', message: 'Назови липсващия бизнес.' });
    }
    const desc = String(description || '').slice(0, cfg.post.maxDescriptionChars);
    log('1');

    // Лимит активни постове на потребител за страна.
    const active = await one(
      `SELECT count(*)::int AS c FROM posts
       WHERE owner_id = $1 AND country_code = $2 AND status IN ('pending_moderation','approved')`,
      [req.user.id, country_code]
    );
    if (active.c >= cfg.post.maxActivePostsPerUserPerCountry) {
      return res.status(409).json({ error: 'too_many', message: 'Вече имаш активен пост за тази страна.' });
    }

    log('2');
    const post = await one(
      `INSERT INTO posts (owner_id, country_code, title, description, status)
       VALUES ($1, $2, $3, $4, 'pending_moderation') RETURNING *`,
      [req.user.id, country_code, String(title).trim(), desc]
    );

    // Линкове (до config.post.maxLinks).
    if (Array.isArray(links)) {
      const slice = links.slice(0, cfg.post.maxLinks);
      for (const l of slice) {
        const url = (typeof l === 'string') ? l : (l && l.url);
        if (url && /^https?:\/\//i.test(url)) {
          await q('INSERT INTO post_links (post_id, url, label) VALUES ($1, $2, $3)',
            [post.id, url, (l && l.label) || null]);
        }
      }
    }
    log('край → 201');
    res.status(201).json({ post, fee: cfg.fees.postUsd });
  } catch (e) { debug.error('POST /:', e && e.message); next(e); }
});

// ── Листване за страна (само одобрени, ранкнати по потвърждения) ──────
// GET /api/wnb/posts?country=ID
router.get('/', async (req, res, next) => {
  try {
    const log = debug.scoped(req, 'GET /');
    log('старт');
    const country = req.query.country;
    if (!country) return res.status(400).json({ error: 'missing_country' });
    const rows = await all(
      `SELECT p.id, p.title, p.description, p.confirm_count, p.unlike_count, p.created_at,
              u.display_name AS owner_name
       FROM posts p JOIN users u ON u.id = p.owner_id
       WHERE p.country_code = $1 AND p.status = 'approved'
       ORDER BY p.confirm_count DESC, p.approved_at ASC`,
      [country]
    );
    const cfg = load();
    log('край → 200');
    res.json({ posts: rows, minVotesToList: cfg.ranking.minVotesToList, votesForRank1: cfg.ranking.votesForRank1 });
  } catch (e) { debug.error('GET /:', e && e.message); next(e); }
});

// ── Детайл на пост (+ линкове + снимки + дали телефонът е достъпен за мен) ─
// GET /api/wnb/posts/:id
router.get('/:id', async (req, res, next) => {
  try {
    const log = debug.scoped(req, 'GET /:id');
    log('старт');
    const cfg = load();
    const p = await one(
      `SELECT p.*, u.display_name AS owner_name FROM posts p JOIN users u ON u.id = p.owner_id WHERE p.id = $1`,
      [req.params.id]
    );
    if (!p) return res.status(404).json({ error: 'not_found' });
    log('1');

    const viewerId = req.session?.userId;
    const isOwner = viewerId && viewerId === p.owner_id;
    let isStaff = false;
    if (viewerId) {
      const v = await one('SELECT email FROM users WHERE id = $1', [viewerId]);
      isStaff = v && roleForEmail(v.email) !== 'user';
    }
    if (p.status !== 'approved' && !isOwner && !isStaff) {
      return res.status(403).json({ error: 'not_visible', message: 'Този пост още не е одобрен.' });
    }

    const links = await all('SELECT id, url, label FROM post_links WHERE post_id = $1', [p.id]);
    const images = await all('SELECT id, url, sort_order FROM post_images WHERE post_id = $1 ORDER BY sort_order', [p.id]);

    // Телефон: показва се само ако собственикът го е разкрил И зрителят е платил достъп
    // (config.fees.viewPhoneUsd) — или е самият собственик/модератор.
    let phone = null;
    let phoneAvailable = false;
    if (p.phone_revealed) {
      phoneAvailable = true;
      if (isOwner || isStaff) {
        const o = await one('SELECT phone FROM users WHERE id = $1', [p.owner_id]);
        phone = o?.phone || null;
      } else if (viewerId) {
        const paid = await one('SELECT 1 AS x FROM phone_access WHERE post_id = $1 AND viewer_id = $2', [p.id, viewerId]);
        if (paid) { const o = await one('SELECT phone FROM users WHERE id = $1', [p.owner_id]); phone = o?.phone || null; }
      }
    }

    log('край → 200');
    res.json({
      post: p, links, images,
      phoneAvailable, phone,
      viewPhoneFee: cfg.fees.viewPhoneUsd,
    });
  } catch (e) { debug.error('GET /:id:', e && e.message); next(e); }
});

// ── Качване на снимка (само собственик, до config.post.maxImages) ─────
// POST /api/wnb/posts/:id/images  (multipart, поле "image")
router.post('/:id/images', requireAuth, upload.single('image'), async (req, res, next) => {
  try {
    const log = debug.scoped(req, 'POST /:id/images');
    log('старт');
    const cfg = load();
    const p = await one('SELECT * FROM posts WHERE id = $1', [req.params.id]);
    if (!p) return res.status(404).json({ error: 'not_found' });
    if (p.owner_id !== req.user.id) return res.status(403).json({ error: 'forbidden' });
    if (!req.file) return res.status(400).json({ error: 'no_file' });
    log('1');

    const existing = await one('SELECT count(*)::int AS c FROM post_images WHERE post_id = $1', [p.id]);
    if (existing.c >= cfg.post.maxImages) {
      return res.status(409).json({ error: 'too_many_images', message: `Лимит ${cfg.post.maxImages} снимки.` });
    }
    const fname = `post${p.id}_${existing.c + 1}_${Date.now()}.jpg`;
    await sharp(req.file.buffer)
      .resize({ width: cfg.post.thumbnailMaxWidthPx, withoutEnlargement: true })
      .jpeg({ quality: cfg.post.thumbnailQuality })
      .toFile(path.join(UPLOAD_DIR, fname));
    log('2');
    const img = await one(
      `INSERT INTO post_images (post_id, url, sort_order) VALUES ($1, $2, $3) RETURNING id, url, sort_order`,
      [p.id, `/uploads/posts/${fname}`, existing.c + 1]
    );
    log('край → 201');
    res.status(201).json({ image: img });
  } catch (e) { debug.error('POST /:id/images:', e && e.message); next(e); }
});

// ── Плати достъп до телефона ($20 заглушка) ──────────────────────────
// POST /api/wnb/posts/:id/buy-phone
router.post('/:id/buy-phone', requireAuth, async (req, res, next) => {
  try {
    const log = debug.scoped(req, 'POST /:id/buy-phone');
    log('старт');
    const p = await one('SELECT id, owner_id, phone_revealed FROM posts WHERE id = $1', [req.params.id]);
    if (!p) return res.status(404).json({ error: 'not_found' });
    if (!p.phone_revealed) return res.status(409).json({ error: 'no_phone', message: 'Постващият още не е разкрил телефон.' });
    log('1');
    await q('INSERT INTO phone_access (post_id, viewer_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [p.id, req.user.id]);
    const o = await one('SELECT phone FROM users WHERE id = $1', [p.owner_id]);
    log('край → 200');
    res.json({ ok: true, phone: o?.phone || null });
  } catch (e) { debug.error('POST /:id/buy-phone:', e && e.message); next(e); }
});

// ── Разкрий собствения телефон ($100 заглушка) — позволено само при прага ──
// POST /api/wnb/posts/:id/reveal-phone
router.post('/:id/reveal-phone', requireAuth, async (req, res, next) => {
  try {
    const log = debug.scoped(req, 'POST /:id/reveal-phone');
    log('старт');
    const cfg = load();
    const p = await one('SELECT * FROM posts WHERE id = $1', [req.params.id]);
    if (!p) return res.status(404).json({ error: 'not_found' });
    if (p.owner_id !== req.user.id) return res.status(403).json({ error: 'forbidden' });
    if (!req.user.phone) return res.status(400).json({ error: 'no_phone_set', message: 'Първо добави телефон в профила си.' });
    log('1');

    // Праг: confirm_count >= votesToAllowPhoneReveal (+ 0 ънлайка, ако config го иска).
    if (p.confirm_count < cfg.ranking.votesToAllowPhoneReveal) {
      return res.status(409).json({ error: 'threshold_not_met',
        message: `Нужни са поне ${cfg.ranking.votesToAllowPhoneReveal} потвърждения (има ${p.confirm_count}).` });
    }
    if (cfg.ranking.requireZeroUnlikesForPhone && p.unlike_count > 0) {
      return res.status(409).json({ error: 'has_unlikes', message: 'Изисква се 0 несъгласия за разкриване на телефон.' });
    }
    log('2');
    const updated = await one('UPDATE posts SET phone_revealed = TRUE, updated_at = now() WHERE id = $1 RETURNING phone_revealed', [p.id]);
    log('край → 200');
    res.json({ ok: true, phone_revealed: updated.phone_revealed, fee: cfg.fees.revealOwnPhoneUsd });
  } catch (e) { debug.error('POST /:id/reveal-phone:', e && e.message); next(e); }
});

// ── Мои постове ──────────────────────────────────────────────────────
// GET /api/wnb/posts/mine/list
router.get('/mine/list', requireAuth, async (req, res, next) => {
  try {
    const log = debug.scoped(req, 'GET /mine/list');
    log('старт');
    const rows = await all('SELECT * FROM posts WHERE owner_id = $1 ORDER BY updated_at DESC', [req.user.id]);
    log('край → 200');
    res.json({ posts: rows });
  } catch (e) { debug.error('GET /mine/list:', e && e.message); next(e); }
});

module.exports = router;
