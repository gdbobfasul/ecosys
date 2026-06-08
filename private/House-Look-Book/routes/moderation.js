// Version: 1.0171
// House-Look-Book — модерация (само moderator/admin).
// Нищо не е публично преди 'approved'. Праговете идват от config.json.
//
// Поток:
//   - pending списък (предложения, чакащи одобрение)
//   - approve / reject / remove на предложение
//   - резолюция на доклади: valid → бан на собственика + предложението 'removed';
//                           invalid → +1 baseless_report_count на докладващия
//   - бан на докладващ над config.reports.maxBaselessReportsBeforeReporterBan

const express = require('express');
const https = require('https');
const sharp = require('sharp');
const { q, one, all, pool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { load } = require('../config-loader');
const { roleForEmail } = require('../roles');
const debug = require('../../shared/debug-helper').create('hlb');

const router = express.Router();

// Всичко тук иска логнат модератор/админ.
router.use(requireAuth, requireRole('moderator', 'admin'));

// Запис в одит дневника.
async function logAction(client, { proposal_id, target_user, actor_id, action, note }) {
  await client.query(
    `INSERT INTO moderation_log (proposal_id, target_user, actor_id, action, note)
     VALUES ($1, $2, $3, $4, $5)`,
    [proposal_id || null, target_user || null, actor_id, action, note || null]
  );
}

// GET /api/hlb/moderation/pending — чакащи модерация
router.get('/pending', async (req, res, next) => {
  try {
    const log = debug.scoped(req, 'GET /moderation/pending');
    log('старт');
    const rows = await all(
      `SELECT p.*, u.email AS owner_email, u.display_name AS owner_name
       FROM proposals p JOIN users u ON u.id = p.owner_id
       WHERE p.status = 'pending_moderation'
       ORDER BY p.submitted_at ASC`
    );
    log('край → 200');
    res.json({ pending: rows });
  } catch (e) { debug.error('GET /moderation/pending:', e && e.message); next(e); }
});

// GET /api/hlb/moderation/reports — отворени доклади
router.get('/reports', async (req, res, next) => {
  try {
    const log = debug.scoped(req, 'GET /moderation/reports');
    log('старт');
    const rows = await all(
      `SELECT r.*, p.title AS proposal_title, p.owner_id,
              ru.display_name AS reporter_name
       FROM reports r
       JOIN proposals p ON p.id = r.proposal_id
       JOIN users ru ON ru.id = r.reporter_id
       WHERE r.status = 'pending'
       ORDER BY r.created_at ASC`
    );
    log('край → 200');
    res.json({ reports: rows });
  } catch (e) { debug.error('GET /moderation/reports:', e && e.message); next(e); }
});

// POST /api/hlb/moderation/proposals/:id/approve
router.post('/proposals/:id/approve', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const log = debug.scoped(req, 'POST /moderation/proposals/:id/approve');
    log('старт');
    await client.query('BEGIN');
    const p = await client.query('SELECT * FROM proposals WHERE id = $1', [req.params.id]);
    if (!p.rows[0]) { log('край → 404'); await client.query('ROLLBACK'); return res.status(404).json({ error: 'not_found' }); }
    log('1');
    const updated = await client.query(
      `UPDATE proposals SET status = 'approved', approved_at = now(), moderated_by = $2,
              moderation_note = $3, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.params.id, req.user.id, (req.body && req.body.note) || null]
    );
    await logAction(client, { proposal_id: req.params.id, actor_id: req.user.id, action: 'approve', note: req.body?.note });
    await client.query('COMMIT');
    log('край → 200');
    res.json({ proposal: updated.rows[0] });
  } catch (e) { debug.error('POST /moderation/proposals/:id/approve:', e && e.message); try { await client.query('ROLLBACK'); } catch (_) {} next(e); }
  finally { client.release(); }
});

// POST /api/hlb/moderation/proposals/:id/reject  { note? }
router.post('/proposals/:id/reject', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const log = debug.scoped(req, 'POST /moderation/proposals/:id/reject');
    log('старт');
    await client.query('BEGIN');
    const updated = await client.query(
      `UPDATE proposals SET status = 'rejected', moderated_by = $2, moderation_note = $3, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.params.id, req.user.id, (req.body && req.body.note) || null]
    );
    if (!updated.rows[0]) { log('край → 404'); await client.query('ROLLBACK'); return res.status(404).json({ error: 'not_found' }); }
    await logAction(client, { proposal_id: req.params.id, actor_id: req.user.id, action: 'reject', note: req.body?.note });
    await client.query('COMMIT');
    log('край → 200');
    res.json({ proposal: updated.rows[0] });
  } catch (e) { debug.error('POST /moderation/proposals/:id/reject:', e && e.message); try { await client.query('ROLLBACK'); } catch (_) {} next(e); }
  finally { client.release(); }
});

// POST /api/hlb/moderation/proposals/:id/remove  { note? } — сваляне
router.post('/proposals/:id/remove', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const log = debug.scoped(req, 'POST /moderation/proposals/:id/remove');
    log('старт');
    await client.query('BEGIN');
    const updated = await client.query(
      `UPDATE proposals SET status = 'removed', moderated_by = $2, moderation_note = $3, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.params.id, req.user.id, (req.body && req.body.note) || null]
    );
    if (!updated.rows[0]) { log('край → 404'); await client.query('ROLLBACK'); return res.status(404).json({ error: 'not_found' }); }
    await logAction(client, { proposal_id: req.params.id, actor_id: req.user.id, action: 'remove', note: req.body?.note });
    await client.query('COMMIT');
    log('край → 200');
    res.json({ proposal: updated.rows[0] });
  } catch (e) { debug.error('POST /moderation/proposals/:id/remove:', e && e.message); try { await client.query('ROLLBACK'); } catch (_) {} next(e); }
  finally { client.release(); }
});

// POST /api/hlb/moderation/reports/:id/resolve  { valid: true|false, note? }
//   valid=true  → собственикът се банва (ако config.reports.validReportBansProposer), предложението 'removed'
//   valid=false → +1 baseless_report_count на докладващия; над прага може да се банне
router.post('/reports/:id/resolve', async (req, res, next) => {
  const cfg = load();
  const client = await pool.connect();
  try {
    const log = debug.scoped(req, 'POST /moderation/reports/:id/resolve');
    log('старт');
    const valid = !!(req.body && req.body.valid);
    const note = (req.body && req.body.note) || null;

    await client.query('BEGIN');
    const r = await client.query('SELECT * FROM reports WHERE id = $1', [req.params.id]);
    if (!r.rows[0]) { log('край → 404'); await client.query('ROLLBACK'); return res.status(404).json({ error: 'not_found' }); }
    const report = r.rows[0];
    if (report.status !== 'pending') { log('край → 409'); await client.query('ROLLBACK'); return res.status(409).json({ error: 'already_resolved' }); }
    log('1');

    await client.query(
      `UPDATE reports SET status = $2, reviewed_by = $3, reviewed_at = now() WHERE id = $1`,
      [report.id, valid ? 'valid' : 'invalid', req.user.id]
    );

    let outcome = {};
    if (valid) {
      // Свали предложението.
      await client.query(
        `UPDATE proposals SET status = 'removed', updated_at = now() WHERE id = $1`,
        [report.proposal_id]
      );
      await logAction(client, { proposal_id: report.proposal_id, actor_id: req.user.id, action: 'remove', note: 'валиден доклад' });
      // Бани собственика, ако конфигът го иска.
      if (cfg.reports.validReportBansProposer) {
        const owner = await client.query('SELECT owner_id FROM proposals WHERE id = $1', [report.proposal_id]);
        const ownerId = owner.rows[0]?.owner_id;
        if (ownerId) {
          await client.query(
            `UPDATE users SET is_banned = TRUE, ban_reason = $2, banned_at = now() WHERE id = $1`,
            [ownerId, 'валиден доклад за нереално предложение']
          );
          await logAction(client, { target_user: ownerId, actor_id: req.user.id, action: 'ban_owner', note });
          outcome.ownerBanned = true;
        }
      }
    } else {
      // Неоснователен доклад → +1 на докладващия.
      const upd = await client.query(
        `UPDATE users SET baseless_report_count = baseless_report_count + 1 WHERE id = $1
         RETURNING baseless_report_count`,
        [report.reporter_id]
      );
      const cntNow = upd.rows[0]?.baseless_report_count ?? 0;
      outcome.reporterBaselessCount = cntNow;
      outcome.reporterOverThreshold = cntNow > cfg.reports.maxBaselessReportsBeforeReporterBan;
    }

    await client.query('COMMIT');
    log('край → 200');
    res.json({ ok: true, valid, ...outcome });
  } catch (e) { debug.error('POST /moderation/reports/:id/resolve:', e && e.message); try { await client.query('ROLLBACK'); } catch (_) {} next(e); }
  finally { client.release(); }
});

// POST /api/hlb/moderation/users/:id/ban  { reason? } — ръчен бан (напр. на докладващ над прага)
router.post('/users/:id/ban', requireRole('admin'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const log = debug.scoped(req, 'POST /moderation/users/:id/ban');
    log('старт');
    await client.query('BEGIN');
    const updated = await client.query(
      `UPDATE users SET is_banned = TRUE, ban_reason = $2, banned_at = now() WHERE id = $1
       RETURNING id, email, is_banned`,
      [req.params.id, (req.body && req.body.reason) || 'бан от модератор']
    );
    if (!updated.rows[0]) { log('край → 404'); await client.query('ROLLBACK'); return res.status(404).json({ error: 'not_found' }); }
    await logAction(client, { target_user: req.params.id, actor_id: req.user.id, action: 'ban_reporter', note: req.body?.reason });
    await client.query('COMMIT');
    log('край → 200');
    res.json({ user: updated.rows[0] });
  } catch (e) { debug.error('POST /moderation/users/:id/ban:', e && e.message); try { await client.query('ROLLBACK'); } catch (_) {} next(e); }
  finally { client.release(); }
});

// GET /api/hlb/moderation/proposals?status=&sort=likes|new&order=asc|desc&limit=&offset=
//   Списък на ВСИЧКИ предложения (админ преглед: най-/най-малко харесвани, трий).
//   sort/order са whitelist-нати; limit/offset са валидирани числа → безопасни за inline.
router.get('/proposals', requireRole('admin'), async (req, res, next) => {
  try {
    const log = debug.scoped(req, 'GET /moderation/proposals');
    log('старт');
    const sort = req.query.sort === 'new' ? 'p.created_at' : 'p.like_count';
    const order = (req.query.order === 'asc') ? 'ASC' : 'DESC';
    const limit = Math.min(parseInt(req.query.limit || '50', 10) || 50, 200);
    const offset = Math.max(parseInt(req.query.offset || '0', 10) || 0, 0);
    const cols = `p.id, p.title, p.status, p.composer_params, p.like_count, p.report_count,
                  p.created_at, p.owner_id, u.email AS owner_email,
                  u.display_name AS owner_name, u.is_banned AS owner_banned`;
    const tail = `ORDER BY ${sort} ${order}, p.id DESC LIMIT ${limit} OFFSET ${offset}`;
    const rows = req.query.status
      ? await all(`SELECT ${cols} FROM proposals p JOIN users u ON u.id = p.owner_id WHERE p.status = $1 ${tail}`, [req.query.status])
      : await all(`SELECT ${cols} FROM proposals p JOIN users u ON u.id = p.owner_id ${tail}`);
    log('край → 200');
    res.json({ proposals: rows });
  } catch (e) { debug.error('GET /moderation/proposals:', e && e.message); next(e); }
});

// GET /api/hlb/moderation/users?banned=1 — потребители (за бан управление)
router.get('/users', requireRole('admin'), async (req, res, next) => {
  try {
    const log = debug.scoped(req, 'GET /moderation/users');
    log('старт');
    const onlyBanned = req.query.banned === '1';
    const rows = await all(
      `SELECT id, email, display_name, is_banned, ban_reason, baseless_report_count, created_at
       FROM users ${onlyBanned ? 'WHERE is_banned = TRUE' : ''}
       ORDER BY is_banned DESC, created_at DESC LIMIT 200`
    );
    // Ролята идва от .env (roles.js), не от базата.
    log('край → 200');
    res.json({ users: rows.map(r => ({ ...r, role: roleForEmail(r.email) })) });
  } catch (e) { debug.error('GET /moderation/users:', e && e.message); next(e); }
});

// POST /api/hlb/moderation/users/:id/unban — сваля бан
router.post('/users/:id/unban', requireRole('admin'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const log = debug.scoped(req, 'POST /moderation/users/:id/unban');
    log('старт');
    await client.query('BEGIN');
    const updated = await client.query(
      `UPDATE users SET is_banned = FALSE, ban_reason = NULL, banned_at = NULL WHERE id = $1
       RETURNING id, email, is_banned`, [req.params.id]
    );
    if (!updated.rows[0]) { log('край → 404'); await client.query('ROLLBACK'); return res.status(404).json({ error: 'not_found' }); }
    await logAction(client, { target_user: req.params.id, actor_id: req.user.id, action: 'unban', note: null });
    await client.query('COMMIT');
    log('край → 200');
    res.json({ user: updated.rows[0] });
  } catch (e) { debug.error('POST /moderation/users/:id/unban:', e && e.message); try { await client.query('ROLLBACK'); } catch (_) {} next(e); }
  finally { client.release(); }
});

// ── Генератор на модели (локален, БЕЗ Google) ────────────────────────
// Масово създава НОВИ параметрични къщи с имена и ги вкарва в галерията.
// Собственик = админът, който ги пуска; статус 'approved' (видими веднага).
// Виждат се/редактират се в админа („Всички къщи") и през конструктора (?edit=ID).
const GEN = {
  footprints: ['square', 'rect', 'lshape', 'dome', 'snail', 'waterlily', 'cabin', 'inverted'],
  roofs: ['gabled', 'flat', 'dome', 'inverted', 'none'],
  rooms: ['living', 'bedroom', 'kitchen', 'bathroom', 'toilet', 'dining', 'kids', 'office', 'hall', 'balcony'],
  shapes: ['rect', 'rounded', 'circle', 'oval', 'crescent', 'diamond', 'triangle', 'hex'],
  walls: ['#e8d9c0', '#cfd8dc', '#f3e1c0', '#d9c2e0', '#c9e0d0', '#f0c9c9', '#bcd3e8', '#e0e8d0'],
  roofcol: ['#8a4b3b', '#445566', '#3b6b4a', '#7a5230', '#5b4b7a', '#6b3b3b'],
  accents: ['#3b6ea5', '#b5651d', '#2e8b57', '#8a3b6e', '#3b8a85'],
  adj: ['Слънчева', 'Уютна', 'Просторна', 'Модерна', 'Класическа', 'Морска', 'Планинска', 'Градска', 'Селска', 'Минималистична', 'Романтична', 'Футуристична', 'Тиха', 'Светла'],
  fpName: { square: 'квадратна', rect: 'правоъгълна', lshape: 'L-образна', dome: 'куполна', snail: 'охлювна', waterlily: 'като водна лилия', cabin: 'дървена', inverted: 'обърната' },
  noun: ['къща', 'дом', 'вила', 'резиденция', 'хижа', 'кът'],
};
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function genModel() {
  const floors = 1 + Math.floor(Math.random() * 3);
  const rooms = [];
  for (let f = 0; f < floors; f++) {
    const cnt = 1 + Math.floor(Math.random() * 4);
    const arr = [];
    for (let i = 0; i < cnt; i++) arr.push({ type: pick(GEN.rooms), shape: pick(GEN.shapes) });
    rooms.push(arr);
  }
  const footprint = pick(GEN.footprints);
  return {
    params: {
      footprint, roof: pick(GEN.roofs), floors,
      windowsPerFloor: 1 + Math.floor(Math.random() * 3),
      wallColor: pick(GEN.walls), roofColor: pick(GEN.roofcol), accentColor: pick(GEN.accents),
      extras: { pool: Math.random() < 0.3, boat: Math.random() < 0.2, pier: Math.random() < 0.2 },
      rooms,
    },
    title: `${pick(GEN.adj)} ${GEN.fpName[footprint] || ''} ${pick(GEN.noun)}`.replace(/\s+/g, ' ').trim(),
  };
}

// POST /api/hlb/moderation/generate  { count }
router.post('/generate', requireRole('admin'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const log = debug.scoped(req, 'POST /moderation/generate');
    log('старт');
    let count = parseInt(req.body && req.body.count, 10) || 10;
    count = Math.min(Math.max(count, 1), 100);
    log('1');
    await client.query('BEGIN');
    const ids = [];
    for (let i = 0; i < count; i++) {
      const m = genModel();
      const r = await client.query(
        `INSERT INTO proposals (owner_id, title, composer_params, status, edit_window_until, submitted_at, approved_at, moderated_by)
         VALUES ($1, $2, $3, 'approved', now(), now(), now(), $1) RETURNING id`,
        [req.user.id, m.title, m.params]
      );
      ids.push(r.rows[0].id);
    }
    await logAction(client, { actor_id: req.user.id, action: 'generate', note: `${count} модела` });
    await client.query('COMMIT');
    log('край → 200');
    res.json({ ok: true, created: ids.length });
  } catch (e) { debug.error('POST /moderation/generate:', e && e.message); try { await client.query('ROLLBACK'); } catch (_) {} next(e); }
  finally { client.release(); }
});

// ── Генератор ОТ GOOGLE (официален Custom Search API → силует → форма) ────
// Нужни в .env: HLB_GOOGLE_API_KEY, HLB_GOOGLE_CX (Custom Search Engine с image search).
// За всяко изображение вадим силует (контур по редове) → нормализирани точки →
// custom footprint. Изходът е НАША векторна форма (не самата снимка).
function httpsGet(url, asBuffer, depth) {
  depth = depth || 0;
  return new Promise((resolve, reject) => {
    if (depth > 4) return reject(new Error('твърде много пренасочвания'));
    const req = https.get(url, { timeout: 12000 }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume(); return resolve(httpsGet(res.headers.location, asBuffer, depth + 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => { const b = Buffer.concat(chunks); resolve(asBuffer ? b : b.toString('utf8')); });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}
// Изображение → нормализиран силует (масив точки [x,y] в 0..1) или null.
async function imageToShapePts(imgUrl) {
  let buf;
  try { buf = await httpsGet(imgUrl, true); } catch (e) { return null; }
  let raw;
  try { raw = await sharp(buf).resize(48, 48, { fit: 'fill' }).grayscale().raw().toBuffer({ resolveWithObject: true }); }
  catch (e) { return null; }
  const data = raw.data, Wd = raw.info.width, Hd = raw.info.height;
  let sum = 0; for (let i = 0; i < Wd * Hd; i++) sum += data[i];
  const mean = sum / (Wd * Hd);
  const left = [], right = [];
  for (let y = 0; y < Hd; y++) {
    let l = -1, r = -1;
    for (let x = 0; x < Wd; x++) { if (data[y * Wd + x] < mean) { if (l < 0) l = x; r = x; } }
    if (l >= 0) { left.push([l, y]); right.push([r, y]); }
  }
  if (left.length < 4) return null;
  const step = Math.max(1, Math.floor(left.length / 14));
  const pts = [];
  for (let i = 0; i < left.length; i += step) pts.push(left[i]);
  for (let i = right.length - 1; i >= 0; i -= step) pts.push(right[i]);
  return pts.map(p => [+(p[0] / (Wd - 1)).toFixed(3), +(p[1] / (Hd - 1)).toFixed(3)]);
}

// POST /api/hlb/moderation/generate-from-google  { query, count }
router.post('/generate-from-google', requireRole('admin'), async (req, res, next) => {
  try {
    const log = debug.scoped(req, 'POST /moderation/generate-from-google');
    log('старт');
    const key = process.env.HLB_GOOGLE_API_KEY, cx = process.env.HLB_GOOGLE_CX;
    if (!key || !cx) { log('край → 400'); return res.status(400).json({ error: 'no_google_config', message: 'Липсват HLB_GOOGLE_API_KEY и/или HLB_GOOGLE_CX в .env.' }); }
    const query = String((req.body && req.body.query) || '').trim();
    if (!query) { log('край → 400'); return res.status(400).json({ error: 'no_query', message: 'Дай текст за търсене.' }); }
    const count = Math.min(Math.max(parseInt(req.body && req.body.count, 10) || 5, 1), 10);

    // Предпазител от такси: спираме ПОД безплатния лимит (100/ден).
    const DAILY_CAP = 90;
    const usageRow = await one('SELECT count FROM google_usage WHERE day = CURRENT_DATE');
    const usedToday = usageRow ? usageRow.count : 0;
    if (usedToday >= DAILY_CAP) {
      log('край → 429');
      return res.status(429).json({ error: 'daily_cap', message: `Достигнат дневен лимит (${DAILY_CAP} търсения), за да няма такси от Google. Опитай утре.` });
    }
    log('1');

    const url = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(key)}&cx=${encodeURIComponent(cx)}&searchType=image&num=${count}&q=${encodeURIComponent(query)}`;
    let items;
    try { items = (JSON.parse(await httpsGet(url, false)).items) || []; }
    catch (e) { log('край → 502'); return res.status(502).json({ error: 'google_failed', message: 'Google търсене се провали: ' + e.message }); }
    // Заявката е направена → отчитаме я в дневния брояч.
    await q(`INSERT INTO google_usage (day, count) VALUES (CURRENT_DATE, 1)
             ON CONFLICT (day) DO UPDATE SET count = google_usage.count + 1`);
    if (!items.length) { log('край → 200'); return res.json({ ok: true, created: 0, message: 'Google не върна изображения.' }); }
    log('2');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const ids = [];
      for (const it of items) {
        const pts = await imageToShapePts(it.link);
        if (!pts) continue;
        const m = genModel();
        m.params.footprint = 'custom';
        m.params.customShape = { pts };
        const title = `${pick(GEN.adj)} къща (по „${query}")`;
        const r = await client.query(
          `INSERT INTO proposals (owner_id, title, composer_params, status, edit_window_until, submitted_at, approved_at, moderated_by)
           VALUES ($1, $2, $3, 'approved', now(), now(), now(), $1) RETURNING id`,
          [req.user.id, title, m.params]
        );
        ids.push(r.rows[0].id);
      }
      await logAction(client, { actor_id: req.user.id, action: 'generate_google', note: `${ids.length} от "${query}"` });
      await client.query('COMMIT');
      log('край → 200');
      res.json({ ok: true, created: ids.length, found: items.length });
    } catch (e) { try { await client.query('ROLLBACK'); } catch (_) {} throw e; }
    finally { client.release(); }
  } catch (e) { debug.error('POST /moderation/generate-from-google:', e && e.message); next(e); }
});

// GET /api/hlb/moderation/db — суров read-only изглед на всички таблици (за db.html).
// Admin/moderator (рутерът е зад requireRole). Паролните хешове се маскират.
router.get('/db', requireRole('admin'), async (req, res, next) => {
  try {
    const log = debug.scoped(req, 'GET /moderation/db');
    log('старт');
    const tnames = await all("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
    const tables = [];
    log('1');
    for (const t of tnames) {
      const name = t.tablename;
      const rows = await all(`SELECT * FROM "${name}" ORDER BY 1 LIMIT 2000`);
      const totalRow = await one(`SELECT count(*)::int AS c FROM "${name}"`);
      const safe = rows.map(r => {
        const o = { ...r };
        if ('password_hash' in o) o.password_hash = '***';
        return o;
      });
      tables.push({
        name,
        total: totalRow ? totalRow.c : rows.length,
        columns: rows.length ? Object.keys(rows[0]) : [],
        rows: safe,
      });
    }
    log('край → 200');
    res.json({ tables });
  } catch (e) { debug.error('GET /moderation/db:', e && e.message); next(e); }
});

module.exports = router;
