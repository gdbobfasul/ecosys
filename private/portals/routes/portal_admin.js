// KCY Portals — Admin routes (НОВ файл)
// Version: 1.0093
// Списък потребители + точки/нива по игри + триене.
// Достъп: ?adm=bgmasters-set И IP whitelist (както изисква access-control).

const express = require('express');
const { hasAdmUrlParam, isIpWhitelisted } = require('../middleware/access-control');

let debug;
try { debug = require('../../shared/debug-helper').create('portals'); }
catch (e) { debug = { scoped: () => () => {} }; }

const router = express.Router();

// Игрите — за да покажем ниво по всяка
const GAME_SLUGS = [
    'plane-dodge', 'plane-shoot', 'car-race', 'car-drift',
    'hero-jump', 'hero-run', 'battle-team', 'battle-duel',
];

// ── Admin gate: ?adm=bgmasters-set И IP whitelist едновременно ──
function requireAdmin(req, res, next) {
    if (hasAdmUrlParam(req) && isIpWhitelisted(req)) return next();
    return res.status(403).json({ error: 'forbidden', message: 'Изисква ?adm=bgmasters-set + whitelist IP.' });
}

// GET /api/portals/adm/users?q=&page=  — списък потребители (по 50)
router.get('/users', requireAdmin, (req, res) => {
    const log = debug.scoped(req, 'adm/users');
    log('старт');
    const db = req.app.locals.db;
    const q = (req.query.q || '').trim();
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const perPage = 50;
    const offset = (page - 1) * perPage;

    // гарантирай рекламните колони
    try { db.exec("ALTER TABLE portal_users ADD COLUMN business_description TEXT DEFAULT ''"); } catch (e) {}
    try { db.exec("ALTER TABLE portal_users ADD COLUMN ad_link TEXT DEFAULT ''"); } catch (e) {}

    let where = '';
    let params = [];
    if (q) {
        where = "WHERE username LIKE ? OR business_description LIKE ? OR ad_link LIKE ?";
        const like = '%' + q + '%';
        params = [like, like, like];
    }

    const total = db.prepare("SELECT COUNT(*) AS c FROM portal_users " + where).get(...params).c;
    const rows = db.prepare(
        "SELECT id, username, password_hash, business_description, ad_link, created_at " +
        "FROM portal_users " + where + " ORDER BY id ASC LIMIT ? OFFSET ?"
    ).all(...params, perPage, offset);
    log('1 — ' + rows.length + ' от ' + total + ' (стр. ' + page + ', q="' + q + '")');

    // за всеки потребител — точки/ниво по игри
    const users = rows.map(function (u) {
        const games = {};
        let totalScore = 0;
        GAME_SLUGS.forEach(function (slug) {
            const pr = db.prepare(
                "SELECT best_level, best_score FROM portal_game_progress WHERE user_id = ? AND game_slug = ?"
            ).get(u.id, slug);
            games[slug] = pr ? { level: pr.best_level, score: pr.best_score } : { level: 0, score: 0 };
            if (pr) totalScore += pr.best_score;
        });
        return {
            id: u.id,
            username: u.username,
            password_hash: u.password_hash,
            business_description: u.business_description || '',
            ad_link: u.ad_link || '',
            created_at: u.created_at,
            total_score: totalScore,
            games: games,
        };
    });

    res.json({
        page: page,
        perPage: perPage,
        total: total,
        totalPages: Math.ceil(total / perPage),
        query: q,
        gameSlugs: GAME_SLUGS,
        users: users,
    });
    log('изход 1 -> 200 OK');
});

// DELETE /api/portals/adm/users/:id — трие потребител
router.delete('/users/:id', requireAdmin, (req, res) => {
    const log = debug.scoped(req, 'adm/delete-user');
    const db = req.app.locals.db;
    const id = parseInt(req.params.id);
    log('старт (id=' + id + ')');
    if (!Number.isFinite(id) || id < 1) {
        log('изход 1 -> 400 bad_id');
        return res.status(400).json({ error: 'bad_id' });
    }
    // изтрий и свързаните данни (резултати, прогрес, плащания)
    try { db.prepare("DELETE FROM portal_game_scores WHERE user_id = ?").run(id); } catch (e) {}
    try { db.prepare("DELETE FROM portal_game_progress WHERE user_id = ?").run(id); } catch (e) {}
    try { db.prepare("DELETE FROM portal_monthly_payments WHERE user_id = ?").run(id); } catch (e) {}
    const info = db.prepare("DELETE FROM portal_users WHERE id = ?").run(id);
    log('1 — изтрит (changes=' + info.changes + ')');
    res.json({ ok: true, deleted: info.changes });
    log('изход 2 -> 200 OK');
});

module.exports = router;
