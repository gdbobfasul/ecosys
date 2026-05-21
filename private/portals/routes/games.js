// KCY Portals — Games routes
// Version: 1.0093

const express = require('express');
const { requirePortalAccessAPI, requireLoginAPI } = require('../middleware/access-control');

const router = express.Router();

// Каталог на игрите (server-side, използва се и от games-list endpoint)
const GAMES = [
    { slug: 'plane-dodge', title: 'Plane Dodge',  hero: 'самолет', emoji: '✈️', file: '/portals/games/plane-dodge.html' },
    { slug: 'car-race',    title: 'Car Race',     hero: 'кола',    emoji: '🏎️', file: '/portals/games/car-race.html' },
    { slug: 'hero-jump',   title: 'Hero Jump',    hero: 'герой',   emoji: '🦸', file: '/portals/games/hero-jump.html' },
    { slug: 'plane-shoot', title: 'Plane Shoot',  hero: 'самолет', emoji: '🛩️', file: '/portals/games/plane-shoot.html' },
    { slug: 'car-drift',   title: 'Car Drift',    hero: 'кола',    emoji: '🚗', file: '/portals/games/car-drift.html' },
    { slug: 'hero-run',    title: 'Hero Run',     hero: 'герой',   emoji: '🏃', file: '/portals/games/hero-run.html' },
];

router.get('/list', requirePortalAccessAPI, (req, res) => {
    res.json({ games: GAMES });
});

router.post('/score', requireLoginAPI, (req, res) => {
    const db = req.app.locals.db;
    const { game_slug, score, level } = req.body || {};
    if (!GAMES.find(g => g.slug === game_slug)) {
        return res.status(400).json({ error: 'unknown_game' });
    }
    const s = Number(score);
    const l = Number(level || 1);
    if (!Number.isFinite(s) || s < 0) return res.status(400).json({ error: 'bad_score' });

    db.prepare(
        "INSERT INTO portal_game_scores (user_id, game_slug, score, level) VALUES (?, ?, ?, ?)"
    ).run(req.session.userId, game_slug, Math.floor(s), Math.floor(l));

    res.json({ ok: true });
});

router.get('/leaderboard/:slug', (req, res) => {
    const db = req.app.locals.db;
    const rows = db.prepare(`
        SELECT s.score, s.level, s.created_at, u.username
        FROM portal_game_scores s
        LEFT JOIN portal_users u ON u.id = s.user_id
        WHERE s.game_slug = ?
        ORDER BY s.score DESC
        LIMIT 20
    `).all(req.params.slug);
    res.json({ game_slug: req.params.slug, top: rows });
});

module.exports = router;
