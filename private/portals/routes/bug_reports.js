// Pupikes Portals — Докладвани грешки от потребители.
// 1 запис на потребител (UNIQUE user_id) — може да се редактира. Само заглавие + текст,
// БЕЗ снимки. Само за логнати портални потребители. Записите са в порталната база.
const express = require('express');
const { requireLoginAPI, isIpWhitelisted, isEnvStaff, userRole } = require('../middleware/access-control');
// Известяване по имейл при нов доклад (през HTTP API — виж services/mailer.js). Fire-and-forget:
// ако липсва конфигурация или писмото не мине, докладът пак се записва нормално.
const { notifyNewBugReport } = require('../services/mailer');

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

// Родни имена на 15-те езика (за реда „<Приложение> — <език>" в текста на имейла).
const LANG_NAMES = {
    bg: 'Български', ru: 'Русский', uk: 'Українська', en: 'English', de: 'Deutsch', fr: 'Français',
    es: 'Español', 'es-MX': 'Español (MX)', it: 'Italiano', pt: 'Português', ar: 'العربية',
    hi: 'हिन्दी', ja: '日本語', ky: 'Кыргызча', 'zh-Hant': '繁體中文'
};
function langLabel(code) { code = String(code || '').trim(); return code ? ((LANG_NAMES[code] || code) + ' (' + code + ')') : '—'; }
// Сглобява ТЕКСТА на доклада: започва с ЦЯЛОТО име на приложението + избрания език, после
// От кого / Телефон-имейл / [Акаунт, ако е логнат] и накрая самото съобщение.
function composeBody(o) {
    const lines = [];
    lines.push((o.displayName || 'Pupikes') + ' — ' + langLabel(o.lang));
    lines.push('');
    if (o.name) lines.push('От: ' + o.name);
    if (o.contact) lines.push('Телефон/имейл: ' + o.contact);
    if (o.username) lines.push('Акаунт (логнат): ' + o.username);
    if (o.name || o.contact || o.username) lines.push('');
    lines.push(String(o.text || ''));
    return lines.join('\n');
}
// Логин идентификатор (за тест) — ако има активна сесия с потребител.
function loggedUsername(db, req) {
    try { const uid = req.session && req.session.userId; if (!uid) return ''; const u = db.prepare('SELECT username FROM portal_users WHERE id = ?').get(uid); return (u && u.username) || ''; }
    catch (e) { return ''; }
}

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

    // Дали вече има доклад от този потребител — за да известим по имейл САМО при НОВ (не при редакция).
    const existed = db.prepare('SELECT 1 FROM portal_bug_reports WHERE user_id = ?').get(uid);

    // UPSERT по user_id → гарантира 1 доклад на потребител (повторно = редакция).
    // ВАЖНО: при редакция нулираме `fixed = 0` — щом потребителят е променил доклада,
    // той пак отива при „неоправени/непрегледани" за нов преглед от админ/модератор.
    db.prepare(
        `INSERT INTO portal_bug_reports (user_id, title, body) VALUES (?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET title = excluded.title, body = excluded.body, fixed = 0, updated_at = datetime('now')`
    ).run(uid, title, body);

    // Само при ПЪРВИ доклад от този потребител → имейл известие (редакциите не спамят).
    // В базата пазим СУРОВИЯ текст (за редакция), но в имейла сглобяваме заглавие+акаунт+текст.
    if (!existed) {
        const username = loggedUsername(db, req);
        // Порталният потребител може да е писал на своя език; мейлърът превежда за писмото.
        notifyNewBugReport({ app: 'portal', displayName: 'Pupikes Портал', lang: '', name: '', contact: '', username, title, text: body, source: 'portal' });
    }

    const row = db.prepare(
        'SELECT id, title, body, created_at, updated_at FROM portal_bug_reports WHERE user_id = ?'
    ).get(uid);
    res.json({ ok: true, report: row });
});

// ── АНОНИМЕН доклад от мобилно приложение (без вход) ─────────────────────────
// POST /api/portals/bug-report/anon  { app, title, body }
// Всяко приложение (Pupikes Toolkit Authenticator, игрите и т.н.) има бутон „HELP?" на началния екран,
// който праща тук БЕЗ вход. Записва се в СЪЩАТА таблица като порталните доклади, с user_id = NULL
// и поле `app` (от кое приложение идва). Няколко доклада от един ап са позволени (не upsert).
const anonHits = new Map();   // проста защита от спам: IP → [времена] (не ползваме Date в тестове? тук е рънтайм — Date е ок)
function anonRateOk(ip) {
    const now = Date.now();
    const arr = (anonHits.get(ip) || []).filter((t) => now - t < 60000);
    if (arr.length >= 8) { anonHits.set(ip, arr); return false; }   // макс 8/минута на IP
    arr.push(now); anonHits.set(ip, arr); return true;
}
// CORS: мобилните апове POST-ват от WebView (origin capacitor://localhost и т.н.) → пусни всички
// за анонимния endpoint (публичен, само запис на доклад). CapacitorHttp и без това заобикаля CORS.
router.options('/anon', (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).end();
});
router.post('/anon', (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    const db = req.app.locals.db;
    const ip = (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();
    if (!anonRateOk(ip)) return res.status(429).json({ error: 'too_many', message: 'Твърде много доклади. Опитай пак след минута.' });
    let { app, appName, lang, name, contact, title, body } = req.body || {};
    app = String(app || '').trim().slice(0, 60) || 'unknown';
    appName = String(appName || '').trim().slice(0, 120);
    lang = String(lang || '').trim().slice(0, 12);
    name = String(name || '').trim().slice(0, 120);
    contact = String(contact || '').trim().slice(0, 160);
    title = String(title || '').trim();
    body = String(body || '').trim();
    if (!body) return res.status(400).json({ error: 'body_required', message: 'Опиши проблема.' });
    if (!title) title = body.slice(0, 60);   // ако няма заглавие → първите думи от текста
    if (title.length > 200) title = title.slice(0, 200);
    if (body.length > 5000) body = body.slice(0, 5000);
    // Сглобеният ТЕКСТ (в базата и в имейла): пълно име на апа + език + от кого/контакт/[логин] + съобщение.
    const username = loggedUsername(db, req);
    const composed = composeBody({ displayName: appName || app, lang, name, contact, username, text: body });
    db.prepare(
        'INSERT INTO portal_bug_reports (user_id, app, title, body) VALUES (NULL, ?, ?, ?)'
    ).run(app, title, composed);
    // Веднага щом записът е в базата (в ОРИГИНАЛ) → известие по имейл (не блокира отговора).
    // Подаваме структурираните полета в оригинал; мейлърът ги ПРЕВЕЖДА на български за писмото.
    notifyNewBugReport({ app, displayName: appName || app, lang, name, contact, username, title, text: body, source: 'app' });
    res.json({ ok: true, message: 'Благодарим! Докладът е изпратен.' });
});

// ── Админ/модератор: списък по статус ────────────────────────────────────────
// GET /api/portals/bug-report/admin/list?fixed=0|1  (0 = неоправени, 1 = оправени)
router.get('/admin/list', requireStaffView, (req, res) => {
    const db = req.app.locals.db;
    const fixed = req.query.fixed === '1' ? 1 : 0;
    // LEFT JOIN → показваме и АНОНИМНИТЕ (user_id NULL) доклади от приложенията; `app` = източникът.
    const rows = db.prepare(
        `SELECT b.id, b.title, b.body, b.fixed, b.app, b.created_at, b.updated_at,
                COALESCE(u.username, '') AS username
         FROM portal_bug_reports b LEFT JOIN portal_users u ON u.id = b.user_id
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
