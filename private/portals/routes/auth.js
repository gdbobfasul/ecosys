// KCY Portals — Auth routes
// Version: 1.0093

const express = require('express');
const bcrypt = require('bcryptjs');

// Debug helper за stage логове (вижда се в portal-errors.log / bundle URL)
let debug;
try { debug = require('../../shared/debug-helper').create('portals'); }
catch (e) { debug = { stage: () => {}, info: () => {}, error: () => {}, warn: () => {} }; }
const {
    HARDCODED_ADMIN_USERNAME,
    HARDCODED_ADMIN_PASSWORD,
    isFirstUserAdmin,
    currentMonth,
    hasPaidCurrentMonth,
} = require('../middleware/access-control');

const router = express.Router();

// ─── POST /api/portals/register ────────────────────────────────
router.post('/register', async (req, res) => {
    const log = debug.scoped(req, 'register');
    const db = req.app.locals.db;
    const { username, password } = req.body || {};
    // Рекламни полета (по избор) — за топ 5 в месечната ранг листа
    const bizDesc = (typeof req.body.business_description === 'string')
        ? req.body.business_description.trim().slice(0, 200) : '';
    const adLink = (typeof req.body.ad_link === 'string')
        ? req.body.ad_link.trim().slice(0, 300) : '';
    log(`старт (username=${username})`);

    if (typeof username !== 'string' || username.length < 3 || username.length > 32) {
        log('изход 1 → 400 username_invalid');
        return res.status(400).json({ error: 'username_invalid', message: 'Потребителското име трябва да е 3–32 символа.' });
    }
    if (typeof password !== 'string' || password.length < 4) {
        log('изход 2 → 400 password_invalid');
        return res.status(400).json({ error: 'password_invalid', message: 'Паролата трябва да е поне 4 символа.' });
    }

    debug.db(req, `SELECT portal_users WHERE username='${username}' (проверка дали е зает)`);
    const existing = db.prepare("SELECT id FROM portal_users WHERE username = ?").get(username);
    log(`1 — име ${existing ? 'ЗАЕТО' : 'свободно'}`);
    if (existing) {
        log('изход 3 → 409 username_taken');
        return res.status(409).json({ error: 'username_taken', message: 'Потребителското име е заето.' });
    }

    const hash = await bcrypt.hash(password, 10);
    debug.db(req, `INSERT portal_users (username='${username}', password_hash=<hash>)`);
    // Гарантирай рекламните колони (idempotent — ако вече ги има, ALTER гърми тихо)
    try { db.exec("ALTER TABLE portal_users ADD COLUMN business_description TEXT DEFAULT ''"); } catch (e) {}
    try { db.exec("ALTER TABLE portal_users ADD COLUMN ad_link TEXT DEFAULT ''"); } catch (e) {}
    const info = db.prepare(
        "INSERT INTO portal_users (username, password_hash, business_description, ad_link) VALUES (?, ?, ?, ?)"
    ).run(username, hash, bizDesc, adLink);
    log(`2 — записан в базата (id=${info.lastInsertRowid})`);

    req.session.userId = info.lastInsertRowid;
    req.session.username = username;
    log('3 — сесия записана');

    res.json({
        ok: true,
        user: { id: info.lastInsertRowid, username },
        is_first_user: info.lastInsertRowid === 1,
    });
    log('изход 4 → 200 OK (регистриран успешно)');
});

// ─── POST /api/portals/login ───────────────────────────────────
router.post('/login', async (req, res) => {
    const log = debug.scoped(req, 'login');
    const db = req.app.locals.db;
    const { username, password } = req.body || {};
    log(`старт (username=${username})`);

    if (typeof username !== 'string' || typeof password !== 'string') {
        log('изход 1 → 400 bad_input');
        return res.status(400).json({ error: 'bad_input' });
    }

    debug.db(req, `SELECT portal_users WHERE username='${username}' (login)`);
    const user = db.prepare("SELECT id, username, password_hash FROM portal_users WHERE username = ?").get(username);
    log(`1 — потребител ${user ? 'намерен (id=' + user.id + ')' : 'НЕ е намерен'}`);
    if (!user) {
        log('изход 2 → 401 bad_credentials (няма такъв потребител)');
        return res.status(401).json({ error: 'bad_credentials', message: 'Грешно потребителско име или парола.' });
    }

    let ok = false;
    if (user.username === HARDCODED_ADMIN_USERNAME && user.id === 1 && password === HARDCODED_ADMIN_PASSWORD) {
        ok = true;
    }
    if (!ok) {
        const hashLen = user.password_hash ? user.password_hash.length : 0;
        const hashPrefix = user.password_hash ? user.password_hash.slice(0, 4) : 'NULL';
        log(`1b — hash в базата: дължина=${hashLen}, префикс='${hashPrefix}' (валиден bcrypt = 60 символа, префикс '$2')`);
        ok = await bcrypt.compare(password, user.password_hash || '');
    }
    log(`2 — парола: ${ok ? 'OK' : 'ГРЕШНА'}`);

    if (!ok) {
        log('изход 3 → 401 bad_credentials (грешна парола)');
        return res.status(401).json({ error: 'bad_credentials', message: 'Грешно потребителско име или парола.' });
    }

    req.session.userId = user.id;
    req.session.username = user.username;
    const paid = hasPaidCurrentMonth(db, user.id);
    log(`3 — сесия записана, платил този месец: ${paid ? 'ДА' : 'НЕ'}`);

    res.json({
        ok: true,
        user: { id: user.id, username: user.username },
        is_admin: isFirstUserAdmin(db, user.id),
        paid_this_month: paid,
        current_month: currentMonth(),
    });
    log('изход 4 → 200 OK (логнат успешно)');
});

// ─── POST /api/portals/logout ──────────────────────────────────
router.post('/logout', (req, res) => {
    const log = debug.scoped(req, 'logout');
    log('старт');
    req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.json({ ok: true });
        log('изход 1 → 200 OK (сесията изтрита)');
    });
});

// ─── GET /api/portals/me ───────────────────────────────────────
router.get('/me', (req, res) => {
    const log = debug.scoped(req, 'me');
    const db = req.app.locals.db;
    log(`старт (сесия: ${req.session?.userId ? 'user#' + req.session.userId : 'НЯМА'})`);
    if (!req.session?.userId) {
        log('изход 1 → 200 {logged_in:false} (няма сесия)');
        return res.json({ logged_in: false });
    }
    debug.db(req, `SELECT portal_users WHERE id=${req.session.userId} (me)`);
    const user = db.prepare(
        "SELECT id, username, stripe_paid_total_usd, crypto_paid_btc, crypto_paid_eth, crypto_paid_bnb, created_at FROM portal_users WHERE id = ?"
    ).get(req.session.userId);
    if (!user) {
        req.session.destroy(() => {});
        log('изход 2 → 200 {logged_in:false} (сесия сочи несъществуващ user)');
        return res.json({ logged_in: false });
    }
    res.json({
        logged_in: true,
        user,
        is_admin: isFirstUserAdmin(db, user.id),
        paid_this_month: hasPaidCurrentMonth(db, user.id),
        current_month: currentMonth(),
    });
    log('изход 3 → 200 {logged_in:true}');
});

module.exports = router;
