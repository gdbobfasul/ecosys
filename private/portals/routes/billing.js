// KCY Portals — Billing routes
// Version: 1.0105
//
// Месечна такса, декларация на плащане (Stripe webhook или crypto tx hash),
// admin grant (за първия потребител).

const express = require('express');
const fs = require('fs');
const path = require('path');
const { requireLoginAPI, currentMonth, isFirstUserAdmin } = require('../middleware/access-control');

// Stripe — избира LIVE или TEST ключове според STRIPE_TEST_MODE (резолвер)
const { resolveStripeConfig } = require('../../configs/stripe-config');
const STRIPE_CFG = resolveStripeConfig(process.env);
let stripe = null;
if (STRIPE_CFG.secretKey) {
    try { stripe = require('stripe')(STRIPE_CFG.secretKey); }
    catch (e) { stripe = null; }
}

let debug;
try { debug = require('../../shared/debug-helper').create('portals'); }
catch (e) { debug = { stage: () => {}, info: () => {}, error: () => {}, warn: () => {} }; }

const router = express.Router();

// Цената идва от ЦЕНТРАЛНИЯ per-app файл private/configs/prices-portals.json
// (3 валути usd/rub/kgs). Резерв към стария configs/fees.json, ако липсва.
function loadFees() {
    try {
        const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'configs', 'prices-portals.json'), 'utf8'));
        const m = cfg.services && cfg.services.monthly;
        if (m && m.usd != null) {
            return { version: cfg.version, monthly_fee: { USD: m.usd, RUB: m.rub, KGS: m.kgs } };
        }
    } catch (e) { /* резерв по-долу */ }
    return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'configs', 'fees.json'), 'utf8'));
}

// ─── GET /api/portals/billing/wallets ──────────────────────────
// Връща крипто адресите за порталите (от централния crypto_addresses.js).
// Единствен източник на адресите — billing.html ги чете оттук.
router.get('/wallets', (req, res) => {
    try {
        const CA = require('../../configs/crypto_addresses.js');
        res.json(CA.PROJECTS.portals.wallets); // { BTC, ETH, BNB }
    } catch (e) {
        res.status(500).json({ error: 'wallets_unavailable' });
    }
});

// ─── GET /api/portals/billing/fees ─────────────────────────────
router.get('/fees', (req, res) => {
    const fees = loadFees();
    res.json({
        version: fees.version,
        current_month: currentMonth(),
        monthly_fee: fees.monthly_fee,
    });
});

// ─── GET /api/portals/billing/status ───────────────────────────
router.get('/status', requireLoginAPI, (req, res) => {
    const log = debug.scoped(req, 'billing/status');
    const db = req.app.locals.db;
    const userId = req.session.userId;
    const month = currentMonth();
    log(`старт (user#${userId}, месец ${month})`);
    debug.db(req, `SELECT portal_monthly_payments WHERE user_id=${userId} AND month='${month}'`);
    const paid = db.prepare(
        "SELECT method, amount, tx_reference, paid_at FROM portal_monthly_payments WHERE user_id = ? AND month = ?"
    ).get(userId, month);
    log(`1 — платил този месец: ${paid ? 'ДА' : 'НЕ'}`);
    res.json({
        current_month: month,
        paid_this_month: !!paid,
        payment: paid || null,
        fees: loadFees().monthly_fee,
    });
    log('изход 1 → 200 OK');
});

// ─── POST /api/portals/billing/declare ─────────────────────────
router.post('/declare', requireLoginAPI, (req, res) => {
    const log = debug.scoped(req, 'billing/declare');
    const db = req.app.locals.db;
    const userId = req.session.userId;
    const { method, amount, tx_reference } = req.body || {};
    log(`старт (user#${userId}, method=${method}, amount=${amount})`);

    const allowed = ['stripe', 'btc', 'eth', 'bnb'];
    if (!allowed.includes(method)) {
        log('изход 1 → 400 bad_method');
        return res.status(400).json({ error: 'bad_method', allowed });
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
        log('изход 2 → 400 bad_amount');
        return res.status(400).json({ error: 'bad_amount' });
    }

    const fees = loadFees().monthly_fee;
    if (method === 'stripe') {
        // Картово плащане: декларираната сума е в USD → сравняваме с месечната такса.
        const required = Number(fees.USD);
        log(`1 — нужно ${required} USD, дадено ${amt}`);
        if (Number.isFinite(required) && amt < required) {
            log('изход 3 → 400 amount_too_low');
            return res.status(400).json({ error: 'amount_too_low', required, provided: amt });
        }
    } else {
        // Крипто (btc/eth/bnb): сумата е в КРИПТО единици — не може да се сравни с фиат
        // таксата без курс. (Преди тук required беше undefined, защото monthly_fee няма
        // BTC/ETH/BNB ключове → `amt < undefined` е винаги false → ВСЯКА сума минаваше.)
        // Затова искаме tx_reference (хешът на транзакцията) като проверимо доказателство.
        if (!tx_reference || !String(tx_reference).trim()) {
            log('изход 3 → 400 tx_reference_required');
            return res.status(400).json({ error: 'tx_reference_required' });
        }
        log(`1 — крипто ${method}, сума ${amt}, tx=${String(tx_reference).slice(0, 16)}…`);
    }

    const month = currentMonth();
    try {
        debug.db(req, `INSERT portal_monthly_payments (user_id=${userId}, month='${month}', method='${method}', amount=${amt})`);
        db.prepare(
            "INSERT INTO portal_monthly_payments (user_id, month, method, amount, tx_reference) VALUES (?, ?, ?, ?, ?)"
        ).run(userId, month, method, amt, tx_reference || null);
        log(`2 — плащане записано за ${month}`);
    } catch (err) {
        if (String(err.message).includes('UNIQUE')) {
            log('изход 4 → 409 already_paid_this_month');
            return res.status(409).json({ error: 'already_paid_this_month' });
        }
        log(`изход 5 → 500 db_error — ${err.message}`);
        return res.status(500).json({ error: 'db_error', message: err.message });
    }

    if (method === 'stripe') {
        debug.db(req, `UPDATE portal_users SET stripe_paid_total_usd += ${amt} WHERE id=${userId}`);
        db.prepare("UPDATE portal_users SET stripe_paid_total_usd = stripe_paid_total_usd + ? WHERE id = ?").run(amt, userId);
    } else {
        const col = `crypto_paid_${method}`;
        debug.db(req, `UPDATE portal_users SET ${col} += ${amt} WHERE id=${userId}`);
        db.prepare(`UPDATE portal_users SET ${col} = ${col} + ? WHERE id = ?`).run(amt, userId);
    }
    log('3 — профил обновен');

    res.json({ ok: true, month, method, amount: amt });
    log('изход 6 → 200 OK (плащането прието)');
});

// ─── POST /api/portals/billing/admin-grant ─────────────────────
// Admin (първият user) маркира произволен user като платил за месеца.
router.post('/admin-grant', requireLoginAPI, (req, res) => {
    const db = req.app.locals.db;
    if (!isFirstUserAdmin(db, req.session.userId)) {
        return res.status(403).json({ error: 'admin_only' });
    }
    const { target_user_id, month } = req.body || {};
    const m = month || currentMonth();
    const tid = Number(target_user_id);
    if (!Number.isFinite(tid) || tid <= 0) return res.status(400).json({ error: 'bad_target' });

    try {
        db.prepare(
            "INSERT INTO portal_monthly_payments (user_id, month, method, amount) VALUES (?, ?, 'admin_grant', 0)"
        ).run(tid, m);
    } catch (err) {
        if (String(err.message).includes('UNIQUE')) {
            return res.status(409).json({ error: 'already_paid' });
        }
        return res.status(500).json({ error: 'db_error' });
    }
    res.json({ ok: true, target_user_id: tid, month: m });
});

// ─── GET /api/portals/billing/stripe-config ────────────────────
// Връща дали картовото плащане е активно (има ли Stripe ключ).
router.get('/stripe-config', (req, res) => {
    res.json({
        enabled: !!stripe,
        testMode: STRIPE_CFG.testMode,
        publishableKey: STRIPE_CFG.publishableKey,
        paymentLink: STRIPE_CFG.paymentLinks.portals
    });
});

// ─── POST /api/portals/billing/create-checkout ─────────────────
// Създава Stripe Checkout сесия и връща URL за пренасочване.
// Клиентът отива на сигурната Stripe страница, въвежда картата там.
router.post('/create-checkout', requireLoginAPI, async (req, res) => {
    const log = debug.scoped(req, 'billing/create-checkout');
    if (!stripe) {
        log('изход → 503 stripe_not_configured');
        return res.status(503).json({ error: 'stripe_not_configured',
            message: 'Картовите плащания не са настроени (липсва STRIPE_SECRET_KEY).' });
    }
    const userId = req.session.userId;
    const month = currentMonth();
    const fees = loadFees().monthly_fee;
    const usd = Number(fees.USD);
    const origin = `${req.protocol}://${req.get('host')}`;

    try {
        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: { name: `KCY Портали — месечен достъп (${month})` },
                    unit_amount: Math.round(usd * 100), // в центове
                },
                quantity: 1,
            }],
            metadata: { userId: String(userId), month, kind: 'portal_monthly' },
            success_url: `${origin}/portals/billing.html?stripe=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/portals/billing.html?stripe=cancel`,
        });
        log(`1 — checkout сесия създадена ${session.id}`);
        res.json({ url: session.url, sessionId: session.id });
    } catch (err) {
        log(`изход → 500 ${err.message}`);
        res.status(500).json({ error: 'stripe_error', message: err.message });
    }
});

// ─── POST /api/portals/billing/confirm-checkout ────────────────
// След връщане от Stripe — проверява дали сесията е платена и записва.
router.post('/confirm-checkout', requireLoginAPI, async (req, res) => {
    const log = debug.scoped(req, 'billing/confirm-checkout');
    if (!stripe) return res.status(503).json({ error: 'stripe_not_configured' });
    const db = req.app.locals.db;
    const userId = req.session.userId;
    const { session_id } = req.body || {};
    if (!session_id) return res.status(400).json({ error: 'missing_session_id' });

    try {
        const session = await stripe.checkout.sessions.retrieve(session_id);
        // сигурност: сесията трябва да е платена И да е за ТОЗИ потребител
        if (session.payment_status !== 'paid') {
            log(`изход → 402 не е платена (${session.payment_status})`);
            return res.status(402).json({ error: 'not_paid', status: session.payment_status });
        }
        if (String(session.metadata.userId) !== String(userId)) {
            log('изход → 403 чужда сесия');
            return res.status(403).json({ error: 'session_user_mismatch' });
        }
        const month = session.metadata.month || currentMonth();
        const amt = session.amount_total / 100;
        try {
            db.prepare(
                "INSERT INTO portal_monthly_payments (user_id, month, method, amount, tx_reference) VALUES (?, ?, 'stripe', ?, ?)"
            ).run(userId, month, amt, session.id);
            db.prepare("UPDATE portal_users SET stripe_paid_total_usd = stripe_paid_total_usd + ? WHERE id = ?").run(amt, userId);
        } catch (err) {
            if (String(err.message).includes('UNIQUE')) {
                log('вече записано — OK');
                return res.json({ ok: true, already: true, month });
            }
            throw err;
        }
        log(`1 — Stripe плащане потвърдено за ${month} (${amt} USD)`);
        res.json({ ok: true, month, amount: amt });
    } catch (err) {
        log(`изход → 500 ${err.message}`);
        res.status(500).json({ error: 'stripe_error', message: err.message });
    }
});

module.exports = router;
