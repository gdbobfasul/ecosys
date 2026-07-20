// Pupikes Portals — Portal Games routes (НОВ файл — не пипа games.js)
// Version: 1.0093
// Игри с нива/точки/прогрес + МЕСЕЧНА ранг листа + реклама за топ 5.

const express = require('express');
const fs = require('fs');
const path = require('path');
const { requirePortalAccessAPI, requireLoginAPI } = require('../middleware/access-control');

let debug;
try { debug = require('../../shared/debug-helper').create('portals'); }
catch (e) { debug = { scoped: () => () => {} }; }

const router = express.Router();

const GAMES = [
    { slug: 'plane-dodge', title: 'Самолет — Избягвай', theme: 'plane',
      goal: 'Управлявай самолета и избягвай облаците. Колкото по-дълго летиш — повече точки.',
      controls: 'Стрелки ← → или A / D за движение.', levels: 10 },
    { slug: 'plane-shoot', title: 'Самолет — Стрелба', theme: 'plane',
      goal: 'Стреляй по враговете преди да те ударят. Всеки свален враг е точки.',
      controls: 'Стрелки ← → движение, Space стрелба.', levels: 10 },
    { slug: 'car-race', title: 'Кола — Надбягване', theme: 'car',
      goal: 'Карай по пътя и избягвай другите коли. Стигни края на нивото.',
      controls: 'Стрелки ← → за смяна на лента.', levels: 10 },
    { slug: 'car-drift', title: 'Кола — Дрифт', theme: 'car',
      goal: 'Събирай монети по пътя и избягвай конусите.',
      controls: 'Стрелки ← → завиване.', levels: 10 },
    { slug: 'hero-jump', title: 'Герой — Скачане', theme: 'hero',
      goal: 'Скачай по платформите нагоре. Не падай долу.',
      controls: 'Стрелки ← → движение, Space скок.', levels: 10 },
    { slug: 'hero-run', title: 'Герой — Бягане', theme: 'hero',
      goal: 'Бягай и прескачай препятствията. Колкото по-далеч — повече точки.',
      controls: 'Space или ↑ за скок.', levels: 10 },
    { slug: 'battle-team', title: 'Pupikes Field Battle — 3 срещу 3', theme: 'battle',
      goal: 'Походова битка. 3 произволни героя срещу 3 вражески. Изтреби вражеския отбор.',
      controls: 'Клавиши V / B за удари. Скрита 4-буквена комбинация (други букви) за специален удар.', levels: 10 },
    { slug: 'battle-duel', title: 'Pupikes Ring Clash — 1 срещу 1', theme: 'battle',
      goal: 'Походов дуел. Твой произволен герой срещу противник. Победи го.',
      controls: 'Клавиши V / B за удари. Скрита 4-буквена комбинация (други букви) за специален удар.', levels: 10 },
];

function currentMonth() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

// ── Schema (прогрес + рекламни колони) — при първа заявка ──
let schemaReady = false;
function ensureSchema(db) {
    if (schemaReady) return;
    try {
        const sql = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema_games.sql'), 'utf8');
        db.exec(sql);
    } catch (e) { /* може вече да съществува */ }
    // Рекламни колони в portal_users — ALTER е idempotent чрез try
    try { db.exec("ALTER TABLE portal_users ADD COLUMN business_description TEXT DEFAULT ''"); } catch (e) {}
    try { db.exec("ALTER TABLE portal_users ADD COLUMN ad_link TEXT DEFAULT ''"); } catch (e) {}
    schemaReady = true;
}

// GET /api/portal-games/list — игри + прогрес на текущия user
router.get('/list', requirePortalAccessAPI, (req, res) => {
    const log = debug.scoped(req, 'portal-games/list');
    log('старт');
    const db = req.app.locals.db;
    ensureSchema(db);
    const userId = req.session && req.session.userId;
    let progress = {};
    if (userId) {
        const rows = db.prepare(
            "SELECT game_slug, best_level, best_score FROM portal_game_progress WHERE user_id = ?"
        ).all(userId);
        rows.forEach(function (r) { progress[r.game_slug] = { best_level: r.best_level, best_score: r.best_score }; });
        log('1 - прогрес за ' + rows.length + ' игри');
    }
    const games = GAMES.map(function (g) {
        return Object.assign({}, g, { progress: progress[g.slug] || { best_level: 1, best_score: 0 } });
    });
    res.json({ games: games });
    log('изход 1 -> 200 OK');
});

// GET /api/portal-games/progress/:slug — докъде е стигнал
router.get('/progress/:slug', requireLoginAPI, (req, res) => {
    const log = debug.scoped(req, 'portal-games/progress');
    log('старт (' + req.params.slug + ')');
    const db = req.app.locals.db;
    ensureSchema(db);
    const row = db.prepare(
        "SELECT best_level, best_score FROM portal_game_progress WHERE user_id = ? AND game_slug = ?"
    ).get(req.session.userId, req.params.slug);
    res.json({ best_level: row ? row.best_level : 1, best_score: row ? row.best_score : 0 });
    log('изход 1 -> 200 OK');
});

// POST /api/portal-games/score — записва резултат + обновява прогрес
router.post('/score', requireLoginAPI, (req, res) => {
    const log = debug.scoped(req, 'portal-games/score');
    const db = req.app.locals.db;
    ensureSchema(db);
    const body = req.body || {};
    const game = GAMES.find(function (g) { return g.slug === body.game_slug; });
    log('старт (game=' + body.game_slug + ', score=' + body.score + ', level=' + body.level + ')');
    if (!game) { log('изход 1 -> 400 unknown_game'); return res.status(400).json({ error: 'unknown_game' }); }
    const score = Math.floor(Number(body.score));
    const level = Math.floor(Number(body.level || 1));
    if (!Number.isFinite(score) || score < 0) { log('изход 2 -> 400 bad_score'); return res.status(400).json({ error: 'bad_score' }); }
    const userId = req.session.userId;

    db.prepare("INSERT INTO portal_game_scores (user_id, game_slug, score, level) VALUES (?, ?, ?, ?)")
      .run(userId, game.slug, score, level);
    log('1 - резултат записан');

    const prev = db.prepare(
        "SELECT best_level, best_score FROM portal_game_progress WHERE user_id = ? AND game_slug = ?"
    ).get(userId, game.slug);
    const bestLevel = Math.max(level, prev ? prev.best_level : 1);
    const bestScore = Math.max(score, prev ? prev.best_score : 0);
    db.prepare(
        "INSERT INTO portal_game_progress (user_id, game_slug, best_level, best_score, updated_at) " +
        "VALUES (?, ?, ?, ?, datetime('now')) " +
        "ON CONFLICT(user_id, game_slug) DO UPDATE SET best_level=?, best_score=?, updated_at=datetime('now')"
    ).run(userId, game.slug, bestLevel, bestScore, bestLevel, bestScore);
    log('2 - прогрес обновен');

    res.json({ ok: true, best_level: bestLevel, best_score: bestScore });
    log('изход 3 -> 200 OK');
});

// GET /api/portal-games/leaderboard/:slug — топ 20 за ЕДНА игра (този месец)
router.get('/leaderboard/:slug', requirePortalAccessAPI, (req, res) => {
    const log = debug.scoped(req, 'portal-games/leaderboard');
    log('старт (' + req.params.slug + ')');
    const db = req.app.locals.db;
    const month = currentMonth();
    const rows = db.prepare(
        "SELECT MAX(s.score) AS score, u.username " +
        "FROM portal_game_scores s LEFT JOIN portal_users u ON u.id = s.user_id " +
        "WHERE s.game_slug = ? AND substr(s.created_at,1,7) = ? " +
        "GROUP BY s.user_id ORDER BY score DESC LIMIT 20"
    ).all(req.params.slug, month);
    res.json({ game_slug: req.params.slug, month: month, top: rows });
    log('изход 1 -> 200 OK (' + rows.length + ' резултата)');
});

// GET /api/portal-games/ranking — ОБЩА МЕСЕЧНА ранг листа (сбор от игрите)
// Нулира се всеки месец автоматично — брои само резултати от текущия месец.
// Топ 5 получават рекламно място (описание + линк от регистрацията).
// ПУБЛИЧНА — класацията се вижда от всеки, без плащане/login (това е реклама).
router.get('/ranking', (req, res) => {
    const log = debug.scoped(req, 'portal-games/ranking');
    log('старт');
    const db = req.app.locals.db;
    ensureSchema(db);
    const month = currentMonth();

    // Сбор: за всеки user взимаме най-добрия резултат ПО ИГРА, после ги сумираме.
    const rows = db.prepare(
        "SELECT u.id AS user_id, u.username, u.business_description, u.ad_link, " +
        "       SUM(best_per_game) AS total " +
        "FROM ( " +
        "   SELECT user_id, game_slug, MAX(score) AS best_per_game " +
        "   FROM portal_game_scores " +
        "   WHERE substr(created_at,1,7) = ? " +
        "   GROUP BY user_id, game_slug " +
        ") g JOIN portal_users u ON u.id = g.user_id " +
        "GROUP BY g.user_id ORDER BY total DESC LIMIT 50"
    ).all(month);
    log('1 - ' + rows.length + ' класирани за ' + month);

    // Топ 5 → с реклама; останалите → без рекламните полета. is_me маркира моя ред.
    const meId = req.session && req.session.userId;
    const ranking = rows.map(function (r, i) {
        const base = { rank: i + 1, username: r.username, total: r.total };
        if (i < 5) {
            base.business_description = r.business_description || '';
            base.ad_link = r.ad_link || '';
            base.is_winner = true;
        } else {
            base.is_winner = false;
        }
        if (meId && r.user_id === meId) base.is_me = true;
        return base;
    });

    // МОИТЕ точки — дори да не съм в топ листата (играл съм само няколко игри).
    let me = null;
    if (meId) {
        const myGames = db.prepare(
            "SELECT game_slug, MAX(score) AS best FROM portal_game_scores " +
            "WHERE user_id = ? AND substr(created_at,1,7) = ? GROUP BY game_slug"
        ).all(meId, month);
        const myTotal = myGames.reduce(function (s, r) { return s + (r.best || 0); }, 0);
        let myRank = null;
        if (myGames.length) {
            // ранг = брой потребители с по-голям общ сбор + 1
            const better = db.prepare(
                "SELECT COUNT(*) AS c FROM ( " +
                "   SELECT g.user_id, SUM(best_per_game) AS total FROM ( " +
                "      SELECT user_id, game_slug, MAX(score) AS best_per_game FROM portal_game_scores " +
                "      WHERE substr(created_at,1,7) = ? GROUP BY user_id, game_slug " +
                "   ) g GROUP BY g.user_id HAVING total > ? " +
                ")"
            ).get(month, myTotal);
            myRank = (better.c || 0) + 1;
        }
        me = { total: myTotal, played: myGames.length, total_games: GAMES.length, rank: myRank };
    }

    res.json({ month: month, ranking: ranking, me: me });
    log('изход 1 -> 200 OK (me=' + (me ? me.total + 'т/' + me.played + 'игри' : 'гост') + ')');
});

module.exports = router;
