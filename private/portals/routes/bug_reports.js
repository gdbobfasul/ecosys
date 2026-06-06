// KCY Portals — Докладвани грешки от потребители.
// 1 запис на потребител (UNIQUE user_id) — може да се редактира. Само заглавие + текст,
// БЕЗ снимки. Само за логнати портални потребители. Записите са в порталната база.
const express = require('express');
const { requireLoginAPI, isIpWhitelisted, isEnvStaff, userRole } = require('../middleware/access-control');

// Преглед на докладите: админ ИЛИ модератор (ИЛИ IP whitelist).
function requireStaffView(req, res, next) {
    if (isIpWhitelisted(req) || isEnvStaff(req.app.locals.db, req.session && req.session.userId)) return next();
    return res.status(403).json({ error: 'forbidden', message: 'Само за админ/модератор.' });
}
// Маркиране „оправено": логнат МОДЕРАТОР е блокиран (само преглед); админ/IP минават.
function requireAdminWrite(req, res, next) {
    const db = req.app.locals.db;
    const uid = req.session && req.session.userId;
    if (uid && userRole(db, uid) === 'moderator') {
        return res.status(403).json({ error: 'forbidden', message: 'Модераторите само преглеждат докладите.' });
    }
    if (isIpWhitelisted(req) || isEnvStaff(db, uid)) return next();
    return res.status(403).json({ error: 'forbidden', message: 'Само за админ.' });
}

let debug;
try { debug = require('../../shared/debug-helper').create('portals'); }
catch (e) { debug = { scoped: () => () => {} }; }

const router = express.Router();

// GET /api/portals/bug-report/mine — моят доклад (или null), за да се попълни за редакция
router.get('/mine', requireLoginAPI, (req, res) => {
    const db = req.app.locals.db;
    const row = db.prepare(
        'SELECT id, title, body, created_at, updated_at FROM portal_bug_reports WHERE user_id = ?'
    ).get(req.session.userId);
    res.json({ report: row || null });
});

// POST /api/portals/bug-report — създава ИЛИ обновява единствения ми доклад (upsert)
router.post('/', requireLoginAPI, (req, res) => {
    const db = req.app.locals.db;
    const uid = req.session.userId;
    let { title, body } = req.body || {};
    title = String(title || '').trim();
    body = String(body || '').trim();
    if (!title) return res.status(400).json({ error: 'title_required', message: 'Заглавието е задължително.' });
    if (!body) return res.status(400).json({ error: 'body_required', message: 'Текстът е задължителен.' });
    if (title.length > 200) title = title.slice(0, 200);
    if (body.length > 5000) body = body.slice(0, 5000);

    // UPSERT по user_id → гарантира 1 доклад на потребител (повторно = редакция).
    // ВАЖНО: при редакция нулираме `fixed = 0` — щом потребителят е променил доклада,
    // той пак отива при „неоправени/непрегледани" за нов преглед от админ/модератор.
    db.prepare(
        `INSERT INTO portal_bug_reports (user_id, title, body) VALUES (?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET title = excluded.title, body = excluded.body, fixed = 0, updated_at = datetime('now')`
    ).run(uid, title, body);

    const row = db.prepare(
        'SELECT id, title, body, created_at, updated_at FROM portal_bug_reports WHERE user_id = ?'
    ).get(uid);
    res.json({ ok: true, report: row });
});

// ── Админ/модератор: списък по статус ────────────────────────────────────────
// GET /api/portals/bug-report/admin/list?fixed=0|1  (0 = неоправени, 1 = оправени)
router.get('/admin/list', requireStaffView, (req, res) => {
    const db = req.app.locals.db;
    const fixed = req.query.fixed === '1' ? 1 : 0;
    const rows = db.prepare(
        `SELECT b.id, b.title, b.body, b.fixed, b.created_at, b.updated_at, u.username
         FROM portal_bug_reports b JOIN portal_users u ON u.id = b.user_id
         WHERE b.fixed = ? ORDER BY b.updated_at DESC`
    ).all(fixed);
    res.json({ reports: rows });
});

// POST /api/portals/bug-report/admin/:id/fixed  { fixed: 0|1 } — маркира оправена/неоправена
router.post('/admin/:id/fixed', requireAdminWrite, (req, res) => {
    const db = req.app.locals.db;
    const fixed = (req.body && (req.body.fixed === 1 || req.body.fixed === true || req.body.fixed === '1')) ? 1 : 0;
    const r = db.prepare("UPDATE portal_bug_reports SET fixed = ?, updated_at = datetime('now') WHERE id = ?").run(fixed, req.params.id);
    if (!r.changes) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true, fixed: fixed });
});

module.exports = router;
