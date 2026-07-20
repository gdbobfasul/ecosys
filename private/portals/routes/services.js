// Pupikes Portals — Services routes
// Version: 1.0093

const express = require('express');
const { requirePortalAccessAPI, currentMonth } = require('../middleware/access-control');
const { generateListing } = require('../services/anthropic');
const { runScrape } = require('../services/scraper');

const router = express.Router();

const SERVICES = [
    { slug: 'ai-listing', title: 'AI обява за имот', emoji: '🏠', file: '/portals/services/ai-listing.html', description: 'Генерирай обява за продажба на имот по няколко ключови думи чрез Claude AI.' },
    { slug: 'scraper',    title: 'Web скрапер',      emoji: '🕸️', file: '/portals/services/scraper.html',    description: '3 заявки за търсене + какво да се извлече. До 5 минути работа.' },
];

router.get('/list', requirePortalAccessAPI, (req, res) => {
    res.json({ services: SERVICES });
});

// AI услугите (ai-listing, scraper) са ВКЛЮЧЕНИ в месечния абонамент: логнат + платил
// този месец → безплатно. Иначе 402 (плати абонамента). Без допълнителна такса на бройка.
// Връща true ако може; иначе праща отговора (401/402) и връща false.
function requireMonthlyPaid(req, res) {
    const db = req.app.locals.db;
    const userId = req.session && req.session.userId;
    if (!userId) { res.status(401).json({ error: 'login_required', message: 'Влез, за да ползваш AI услугата.' }); return false; }
    const paid = db.prepare("SELECT 1 FROM portal_monthly_payments WHERE user_id = ? AND month = ?").get(userId, currentMonth());
    if (!paid) { res.status(402).json({ error: 'payment_required', message: 'Плати месечния абонамент, за да ползваш AI услугите.' }); return false; }
    return true;
}

// ─── POST /api/portals/services/ai-listing ─────────────────────
router.post('/ai-listing', requirePortalAccessAPI, async (req, res) => {
    const db = req.app.locals.db;
    const userId = req.session?.userId || null;
    const { keywords, language, tone } = req.body || {};

    if (typeof keywords !== 'string' || keywords.trim().length < 3) {
        return res.status(400).json({ error: 'keywords_required' });
    }

    // Достъп: AI обявата е включена в месечния абонамент (логнат + платил) → иначе 402.
    if (!requireMonthlyPaid(req, res)) return;

    let jobId = null;
    if (userId) {
        const info = db.prepare(
            "INSERT INTO portal_service_jobs (user_id, service, input_json, status) VALUES (?, 'ai-listing', ?, 'running')"
        ).run(userId, JSON.stringify({ keywords, language, tone }));
        jobId = info.lastInsertRowid;
    }

    try {
        const result = await generateListing(keywords, { language, tone });
        if (jobId) {
            db.prepare(
                "UPDATE portal_service_jobs SET output_text = ?, status = 'done', finished_at = datetime('now') WHERE id = ?"
            ).run(result.text, jobId);
        }
        res.json({ ok: true, job_id: jobId, ...result });
    } catch (err) {
        if (jobId) {
            db.prepare(
                "UPDATE portal_service_jobs SET status = 'error', error_message = ?, finished_at = datetime('now') WHERE id = ?"
            ).run(err.message, jobId);
        }
        // Липсващ AI ключ / провалена AI заявка → 503 (услугата временно недостъпна), НЕ 500.
        res.status(503).json({ error: 'ai_unavailable', message: 'AI услугата временно е недостъпна.', detail: err.message });
    }
});

// ─── POST /api/portals/services/scraper ────────────────────────
router.post('/scraper', requirePortalAccessAPI, async (req, res) => {
    const db = req.app.locals.db;
    const userId = req.session?.userId || null;
    const { query1, query2, query3, hint, max_seconds } = req.body || {};

    const queries = [query1, query2, query3].map(q => (typeof q === 'string' ? q.trim() : '')).filter(Boolean);
    if (queries.length === 0) {
        return res.status(400).json({ error: 'no_queries', message: 'Поне едно от 3-те полета за търсене трябва да е попълнено.' });
    }
    if (typeof hint !== 'string' || hint.trim().length < 2) {
        return res.status(400).json({ error: 'hint_required', message: 'Полето "какво да се скрапва" е задължително.' });
    }

    let jobId = null;
    if (userId) {
        const info = db.prepare(
            "INSERT INTO portal_service_jobs (user_id, service, input_json, status) VALUES (?, 'scraper', ?, 'running')"
        ).run(userId, JSON.stringify({ queries, hint, max_seconds }));
        jobId = info.lastInsertRowid;
    }

    try {
        const result = await runScrape({
            queries,
            hint: hint.trim(),
            maxSeconds: Number(max_seconds) || undefined,
        });
        if (jobId) {
            db.prepare(
                "UPDATE portal_service_jobs SET output_text = ?, status = ?, finished_at = datetime('now') WHERE id = ?"
            ).run(JSON.stringify(result), result.stats.aborted ? 'timeout' : 'done', jobId);
        }
        res.json({ ok: true, job_id: jobId, ...result });
    } catch (err) {
        if (jobId) {
            db.prepare(
                "UPDATE portal_service_jobs SET status = 'error', error_message = ?, finished_at = datetime('now') WHERE id = ?"
            ).run(err.message, jobId);
        }
        res.status(500).json({ error: 'scrape_failed', message: err.message });
    }
});

module.exports = router;
