// KCY Portals — Billing routes
// Version: 1.0086
//
// Месечна такса, декларация на плащане (Stripe webhook или crypto tx hash),
// admin grant (за първия потребител).

const express = require('express');
const fs = require('fs');
const path = require('path');
const { requireLoginAPI, currentMonth, isFirstUserAdmin } = require('../middleware/access-control');

const router = express.Router();

function loadFees() {
    const p = path.join(__dirname, '..', 'configs', 'fees.json');
    return JSON.parse(fs.readFileSync(p, 'utf8'));
}

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
    const db = req.app.locals.db;
    const userId = req.session.userId;
    const month = currentMonth();
    const paid = db.prepare(
        "SELECT method, amount, tx_reference, paid_at FROM portal_monthly_payments WHERE user_id = ? AND month = ?"
    ).get(userId, month);
    res.json({
        current_month: month,
        paid_this_month: !!paid,
        payment: paid || null,
        fees: loadFees().monthly_fee,
    });
});

// ─── POST /api/portals/billing/declare ─────────────────────────
// Potребителят декларира че е платил (Stripe или crypto).
// В реален production: Stripe webhook / on-chain verifier.
// Тук е опростено — записваме и работим на доверие; admin може да бъде инспектира.
router.post('/declare', requireLoginAPI, (req, res) => {
    const db = req.app.locals.db;
    const userId = req.session.userId;
    const { method, amount, tx_reference } = req.body || {};

    const allowed = ['stripe', 'btc', 'eth', 'bnb'];
    if (!allowed.includes(method)) {
        return res.status(400).json({ error: 'bad_method', allowed });
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
        return res.status(400).json({ error: 'bad_amount' });
    }

    const fees = loadFees().monthly_fee;
    const required = method === 'stripe' ? fees.USD
        : method === 'btc' ? fees.BTC
        : method === 'eth' ? fees.ETH
        : fees.BNB;

    if (amt < required) {
        return res.status(400).json({ error: 'amount_too_low', required, provided: amt });
    }

    const month = currentMonth();
    try {
        db.prepare(
            "INSERT INTO portal_monthly_payments (user_id, month, method, amount, tx_reference) VALUES (?, ?, ?, ?, ?)"
        ).run(userId, month, method, amt, tx_reference || null);
    } catch (err) {
        if (String(err.message).includes('UNIQUE')) {
            return res.status(409).json({ error: 'already_paid_this_month' });
        }
        return res.status(500).json({ error: 'db_error', message: err.message });
    }

    // Обнови общи суми в user профила
    if (method === 'stripe') {
        db.prepare("UPDATE portal_users SET stripe_paid_total_usd = stripe_paid_total_usd + ? WHERE id = ?").run(amt, userId);
    } else {
        const col = `crypto_paid_${method}`;
        db.prepare(`UPDATE portal_users SET ${col} = ${col} + ? WHERE id = ?`).run(amt, userId);
    }

    res.json({ ok: true, month, method, amount: amt });
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

module.exports = router;
