// KCY Portals — Main Server
// Version: 1.0091
//
// Разпределя:
//   GET  /portals/*            — статични HTML (login, register, billing, games list, services list, 6 игри, 2 услуги)
//   POST /api/portals/register | login | logout     — auth
//   GET  /api/portals/me
//   GET  /api/portals/billing/fees | status
//   POST /api/portals/billing/declare | admin-grant
//   GET  /api/portals/games/list | leaderboard/:slug
//   POST /api/portals/games/score
//   GET  /api/portals/services/list
//   POST /api/portals/services/ai-listing | scraper

const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

require('dotenv').config({ path: path.join(__dirname, '..', 'configs', '.env') });

// Debug helper за глобални stage логове
let debug;
try { debug = require('../shared/debug-helper').create('portals'); }
catch (e) { debug = { stage: console.log, info: console.log, error: console.error, warn: console.warn }; }
debug.stage('starting portals service');
debug.stage('env file:', path.join(__dirname, '..', 'configs', '.env'), fs.existsSync(path.join(__dirname, '..', 'configs', '.env')) ? '✓' : '✗ MISSING');

const { requirePortalAccess } = require('./middleware/access-control');
const authRouter = require('./routes/auth');
const billingRouter = require('./routes/billing');
const gamesRouter = require('./routes/games');
const servicesRouter = require('./routes/services');

const app = express();
// Зад nginx reverse proxy — Express трябва да вярва на X-Forwarded-* хедърите.
// Без това express-session със secure cookie не работи (nginx терминира SSL и
// proxy-ва plain HTTP → portals мисли че връзката е HTTP → secure cookie се губи
// → сесията не се пази → потребителят постоянно е "разлогнат").
app.set('trust proxy', 1);
const PORT = process.env.PORTALS_PORT || 3002;
const PUBLIC_DIR = process.env.PORTALS_PUBLIC_DIR || path.resolve(__dirname, '..', '..', 'public');

// ── DB ─────────────────────────────────────────────────────────
const DB_PATH = process.env.PORTALS_DB_PATH || path.join(__dirname, 'database', 'portals.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Apply schema on startup if tables missing
const schemaSql = fs.readFileSync(path.join(__dirname, 'database', 'schema.sql'), 'utf8');
db.exec(schemaSql);
app.locals.db = db;

// ── Middleware ─────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(session({
    secret: process.env.PORTALS_SESSION_SECRET || 'change-me-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 дни
        secure: process.env.NODE_ENV === 'production',
    },
}));

// ── ГЛОБАЛЕН ЛОГ НА ЗАЯВКИТЕ ───────────────────────────────────
// Логва ВСЯКА заявка: вход (метод+път+сесия) и изход (статус+време).
// Едно място — покрива всички routes автоматично.
app.use((req, res, next) => {
    const t0 = Date.now();
    const sid = req.session?.userId ? `user#${req.session.userId}` : 'без сесия';
    debug.stage(`→ ${req.method} ${req.originalUrl} [${sid}]`);
    res.on('finish', () => {
        debug.stage(`← ${req.method} ${req.originalUrl} → HTTP ${res.statusCode} (${Date.now() - t0}ms)`);
    });
    next();
});

// ── API routes ─────────────────────────────────────────────────
app.use('/api/portals', authRouter);
app.use('/api/portals/billing', billingRouter);
app.use('/api/portals/games', gamesRouter);
app.use('/api/portals/services', servicesRouter);

// ── Портал-защитени HTML ───────────────────────────────────────
// /portals/games/  → /public/portals/index-games.html (зад login+paid)
app.get('/portals/games/', requirePortalAccess, (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'portals', 'index-games.html'));
});
app.get('/portals/services/', requirePortalAccess, (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'portals', 'index-services.html'));
});

// Самите игри и услуги — също зад access control
app.get('/portals/games/:file', requirePortalAccess, (req, res, next) => {
    const f = path.basename(req.params.file);
    const full = path.join(PUBLIC_DIR, 'portals', 'games', f);
    if (!fs.existsSync(full)) return next();
    res.sendFile(full);
});
app.get('/portals/services/:file', requirePortalAccess, (req, res, next) => {
    const f = path.basename(req.params.file);
    const full = path.join(PUBLIC_DIR, 'portals', 'services', f);
    if (!fs.existsSync(full)) return next();
    res.sendFile(full);
});

// Публични HTML страници (login, register, billing) — без защита
app.use('/portals', express.static(path.join(PUBLIC_DIR, 'portals')));

// Споделени статики (CSS, JS, лого)
app.use('/shared', express.static(path.join(PUBLIC_DIR, 'shared')));

// Главна страница (за standalone mode)
app.get('/', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// ── Health ─────────────────────────────────────────────────────
app.get('/api/portals/health', (req, res) => {
    res.json({ ok: true, version: '1.0086', port: PORT, now: new Date().toISOString() });
});

// ── 404 ────────────────────────────────────────────────────────
app.use((req, res) => {
    debug.stage(`404 ... ${req.method} ${req.originalUrl} — няма такъв route`);
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'not_found', path: req.path });
    res.status(404).send('Not found');
});

// ── ГЛОБАЛЕН ERROR HANDLER ─────────────────────────────────────
// Хваща ВСЯКА грешка хвърлена от route — иначе процесът крашва тихо.
// Логва пълната грешка в portal-errors.log и връща чист JSON, не HTML.
app.use((err, req, res, next) => {
    debug.error(`ГРЕШКА ... ${req.method} ${req.originalUrl}: ${err.message}`);
    debug.error(`stack: ${(err.stack || '').split('\n').slice(0, 4).join(' | ')}`);
    if (res.headersSent) return next(err);
    res.status(500).json({ error: 'server_error', message: err.message });
});

// ── Start ──────────────────────────────────────────────────────
debug.stage('starting HTTP server on port', PORT);
debug.stage('DB path:', DB_PATH, fs.existsSync(DB_PATH) ? '✓' : '✗ NOT FOUND');
app.listen(PORT, () => {
    debug.stage('✓ listening on port', PORT);
    console.log(`🎮 KCY Portals running on http://localhost:${PORT}`);
    console.log(`   DB:   ${DB_PATH}`);
    console.log(`   Public: ${PUBLIC_DIR}`);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log(`   Tables: ${tables.map(t => t.name).join(', ')}`);
});
