// KCY Portals — Auth routes
// Version: 1.0202

const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

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
    isIpWhitelisted,
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

    // Вход само с bcrypt. Backdoor-ът admin/admin123 е премахнат — админ/модератор
    // се определя от .env username (виж roles.js / access-control.js).
    const hashLen = user.password_hash ? user.password_hash.length : 0;
    const hashPrefix = user.password_hash ? user.password_hash.slice(0, 4) : 'NULL';
    log(`1b — hash в базата: дължина=${hashLen}, префикс='${hashPrefix}' (валиден bcrypt = 60 символа, префикс '$2')`);
    const ok = await bcrypt.compare(password, user.password_hash || '');
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

// ─── Facebook Login ────────────────────────────────────────────
// Дава ВЕДНАГА регистрация: при първо влизане с Facebook създаваме акаунт с
// потребителско име + генерирана парола и ги показваме ВЕДНЪЖ — следващия път
// човекът може да влиза и БЕЗ Facebook (с тези данни). FB акаунтът се връзва
// по facebook_id, за да е същият акаунт при следващи Facebook логини.
const FB_APP_ID = process.env.PORTAL_FB_APP_ID || '';
const FB_APP_SECRET = process.env.PORTAL_FB_APP_SECRET || '';
const GOOGLE_CLIENT_ID = process.env.PORTAL_GOOGLE_CLIENT_ID || '';

function genPassword() {
    return crypto.randomBytes(9).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, 12) || crypto.randomBytes(6).toString('hex');
}

// Обща логика за Facebook И Google: намери акаунта по provider id, или СЪЗДАЙ нов
// (username от имейл/име, уникален + генерирана парола). idColumn е константа
// ('facebook_id' | 'google_id') — НЕ потребителски вход → няма SQL инжекция.
async function findOrCreateOAuth(db, idColumn, providerId, email, name) {
    try { db.exec(`ALTER TABLE portal_users ADD COLUMN ${idColumn} TEXT`); } catch (e) {}
    try { db.exec("ALTER TABLE portal_users ADD COLUMN business_description TEXT DEFAULT ''"); } catch (e) {}
    try { db.exec("ALTER TABLE portal_users ADD COLUMN ad_link TEXT DEFAULT ''"); } catch (e) {}
    let user = db.prepare(`SELECT id, username FROM portal_users WHERE ${idColumn} = ?`).get(providerId);
    let credentials = null;
    if (!user) {
        let base = (email ? String(email).split('@')[0] : (name || idColumn.replace('_id', '')))
            .toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 24);
        if (base.length < 3) base = idColumn.replace('_id', '') + String(providerId).slice(-6);
        let username = base, n = 0;
        while (db.prepare("SELECT id FROM portal_users WHERE username = ?").get(username)) { n++; username = base + n; }
        const password = genPassword();
        const hash = await bcrypt.hash(password, 10);
        const info = db.prepare(
            `INSERT INTO portal_users (username, password_hash, ${idColumn}, business_description, ad_link) VALUES (?, ?, ?, ?, ?)`
        ).run(username, hash, providerId, '', '');
        user = { id: info.lastInsertRowid, username };
        credentials = { username, password };   // показва се ВЕДНЪЖ
    }
    return { user, credentials };
}

// Дава App ID на фронтенда (БЕЗ секрета) + дали е настроено
router.get('/fb-config', (req, res) => {
    res.json({ appId: FB_APP_ID, enabled: !!(FB_APP_ID && FB_APP_SECRET) });
});

// POST /api/portals/facebook-login  { accessToken }
router.post('/facebook-login', async (req, res) => {
    const log = debug.scoped(req, 'fb-login');
    const db = req.app.locals.db;
    const token = (req.body && req.body.accessToken) || '';
    if (!FB_APP_ID || !FB_APP_SECRET) {
        log('изход → 503 fb_disabled (липсват PORTAL_FB_APP_ID/SECRET)');
        return res.status(503).json({ error: 'fb_disabled', message: 'Facebook вход не е настроен.' });
    }
    if (!token) return res.status(400).json({ error: 'no_token' });
    try {
        // 1) провери че токенът е валиден И е за НАШЕТО приложение (debug_token с app token)
        const appToken = `${FB_APP_ID}|${FB_APP_SECRET}`;
        const dbg = await fetch('https://graph.facebook.com/debug_token?input_token=' + encodeURIComponent(token) + '&access_token=' + encodeURIComponent(appToken)).then(r => r.json());
        if (!dbg.data || !dbg.data.is_valid || String(dbg.data.app_id) !== String(FB_APP_ID)) {
            log('изход → 401 bad_token (невалиден или чужд токен)');
            return res.status(401).json({ error: 'bad_token', message: 'Невалиден Facebook токен.' });
        }
        // 2) вземи профила (id винаги; email/name по разрешения)
        const prof = await fetch('https://graph.facebook.com/me?fields=id,name,email&access_token=' + encodeURIComponent(token)).then(r => r.json());
        if (!prof.id) return res.status(401).json({ error: 'no_profile' });
        log(`FB профил: id=${prof.id}, email=${prof.email || '—'}`);

        // намери/създай акаунта (обща логика с Google)
        const { user, credentials } = await findOrCreateOAuth(db, 'facebook_id', prof.id, prof.email, prof.name);
        log(credentials ? `нов акаунт чрез FB (id=${user.id}, username=${user.username})` : `съществуващ FB акаунт (id=${user.id})`);

        req.session.userId = user.id;
        req.session.username = user.username;
        res.json({
            ok: true,
            user: { id: user.id, username: user.username },
            is_admin: isFirstUserAdmin(db, user.id),
            paid_this_month: hasPaidCurrentMonth(db, user.id),
            current_month: currentMonth(),
            new_account: !!credentials,
            credentials,   // null при повторни логини; { username, password } при ПЪРВО
        });
        log('изход → 200 OK (Facebook вход успешен)');
    } catch (e) {
        log('грешка: ' + e.message);
        res.status(500).json({ error: 'server_error', message: e.message });
    }
});

// ─── Google Login ──────────────────────────────────────────────
// Същата идея като Facebook: вход с Google → ВЕДНАГА регистрация (username +
// генерирана парола, показани веднъж) → следващия път и без Google.
// Дава Client ID на фронтенда (публичен)
router.get('/google-config', (req, res) => {
    res.json({ clientId: GOOGLE_CLIENT_ID, enabled: !!GOOGLE_CLIENT_ID });
});

// POST /api/portals/google-login  { credential }  (ID token от Google Identity Services)
router.post('/google-login', async (req, res) => {
    const log = debug.scoped(req, 'google-login');
    const db = req.app.locals.db;
    const credential = (req.body && req.body.credential) || '';
    if (!GOOGLE_CLIENT_ID) {
        log('изход → 503 google_disabled (липсва PORTAL_GOOGLE_CLIENT_ID)');
        return res.status(503).json({ error: 'google_disabled', message: 'Google вход не е настроен.' });
    }
    if (!credential) return res.status(400).json({ error: 'no_token' });
    // Проверката на токена е ОТДЕЛНО обвита: невалиден токен, недостъпен Google или
    // непарсваем отговор НЕ са сървърна грешка (500) — те значат „лош токен" → 401.
    let info;
    try {
        // провери ID токена през официалния tokeninfo ендпойнт (връща payload само ако е валиден)
        info = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential)).then(r => r.json());
    } catch (e) {
        log('изход → 401 bad_token (tokeninfo недостъпен/непарсваем: ' + e.message + ')');
        return res.status(401).json({ error: 'bad_token', message: 'Невалиден Google токен.' });
    }
    try {
        if (!info || !info.sub || String(info.aud) !== String(GOOGLE_CLIENT_ID)) {
            log('изход → 401 bad_token (невалиден или за чуждо приложение)');
            return res.status(401).json({ error: 'bad_token', message: 'Невалиден Google токен.' });
        }
        log(`Google профил: sub=${info.sub}, email=${info.email || '—'}`);
        const { user, credentials } = await findOrCreateOAuth(db, 'google_id', info.sub, info.email, info.name);
        log(credentials ? `нов акаунт чрез Google (id=${user.id}, username=${user.username})` : `съществуващ Google акаунт (id=${user.id})`);

        req.session.userId = user.id;
        req.session.username = user.username;
        res.json({
            ok: true,
            user: { id: user.id, username: user.username },
            is_admin: isFirstUserAdmin(db, user.id),
            paid_this_month: hasPaidCurrentMonth(db, user.id),
            current_month: currentMonth(),
            new_account: !!credentials,
            credentials,   // null при повторни логини; { username, password } при ПЪРВО
        });
        log('изход → 200 OK (Google вход успешен)');
    } catch (e) {
        log('грешка: ' + e.message);
        res.status(500).json({ error: 'server_error', message: e.message });
    }
});

// ─── GET /api/portals/ip-admin ─────────────────────────────────
// Връща дали сървърът третира този клиент като админ по IP whitelist
// (вкл. allow-all 0.0.0.0/0). Менюто го пита, за да реши дали да покаже
// бутоните "ЛОГНАТ АДМИН". Зависи САМО от IP whitelist-а, не от URL параметри.
router.get('/ip-admin', (req, res) => {
    res.json({ ip_admin: isIpWhitelisted(req) });
});

module.exports = router;
