// KCY Portals — Auth routes
// Version: 1.0086

const express = require('express');
const bcrypt = require('bcryptjs');
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
    const db = req.app.locals.db;
    const { username, password } = req.body || {};

    if (typeof username !== 'string' || username.length < 3 || username.length > 32) {
        return res.status(400).json({ error: 'username_invalid', message: 'Потребителското име трябва да е 3–32 символа.' });
    }
    if (typeof password !== 'string' || password.length < 4) {
        return res.status(400).json({ error: 'password_invalid', message: 'Паролата трябва да е поне 4 символа.' });
    }

    const existing = db.prepare("SELECT id FROM portal_users WHERE username = ?").get(username);
    if (existing) {
        return res.status(409).json({ error: 'username_taken', message: 'Потребителското име е заето.' });
    }

    const hash = await bcrypt.hash(password, 10);
    const info = db.prepare(
        "INSERT INTO portal_users (username, password_hash) VALUES (?, ?)"
    ).run(username, hash);

    req.session.userId = info.lastInsertRowid;
    req.session.username = username;

    res.json({
        ok: true,
        user: { id: info.lastInsertRowid, username },
        is_first_user: info.lastInsertRowid === 1,
    });
});

// ─── POST /api/portals/login ───────────────────────────────────
router.post('/login', async (req, res) => {
    const db = req.app.locals.db;
    const { username, password } = req.body || {};

    if (typeof username !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ error: 'bad_input' });
    }

    const user = db.prepare("SELECT id, username, password_hash FROM portal_users WHERE username = ?").get(username);
    if (!user) {
        return res.status(401).json({ error: 'bad_credentials', message: 'Грешно потребителско име или парола.' });
    }

    // Hardcoded admin bypass — валиден САМО ако този user е id=1 и username='admin'
    let ok = false;
    if (user.username === HARDCODED_ADMIN_USERNAME && user.id === 1 && password === HARDCODED_ADMIN_PASSWORD) {
        ok = true;
    }
    if (!ok) {
        ok = await bcrypt.compare(password, user.password_hash);
    }

    if (!ok) {
        return res.status(401).json({ error: 'bad_credentials', message: 'Грешно потребителско име или парола.' });
    }

    req.session.userId = user.id;
    req.session.username = user.username;

    res.json({
        ok: true,
        user: { id: user.id, username: user.username },
        is_admin: isFirstUserAdmin(db, user.id),
        paid_this_month: hasPaidCurrentMonth(db, user.id),
        current_month: currentMonth(),
    });
});

// ─── POST /api/portals/logout ──────────────────────────────────
router.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.json({ ok: true });
    });
});

// ─── GET /api/portals/me ───────────────────────────────────────
router.get('/me', (req, res) => {
    const db = req.app.locals.db;
    if (!req.session?.userId) {
        return res.json({ logged_in: false });
    }
    const user = db.prepare(
        "SELECT id, username, stripe_paid_total_usd, crypto_paid_btc, crypto_paid_eth, crypto_paid_bnb, created_at FROM portal_users WHERE id = ?"
    ).get(req.session.userId);
    if (!user) {
        req.session.destroy(() => {});
        return res.json({ logged_in: false });
    }
    res.json({
        logged_in: true,
        user,
        is_admin: isFirstUserAdmin(db, user.id),
        paid_this_month: hasPaidCurrentMonth(db, user.id),
        current_month: currentMonth(),
    });
});

module.exports = router;
