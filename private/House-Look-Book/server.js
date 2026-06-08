// Version: 1.0171
// House-Look-Book („Подреди своя дом") — самостоятелен сървър.
// Express + PostgreSQL. Самостоятелно, чисто (правило от brief-а).
// Моделът копира private/portals/server.js, но базата е pg.Pool (db.js).
//
// API под /api/hlb/* ; статичният фронтенд е public/House-Look-Book.
// Прагове/срокове идват от config.json (config-loader), не от кода.

const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');

require('dotenv').config({ path: path.join(__dirname, '..', 'configs', '.env') });

const { pool, applySchema, seedAdminsAndMods, checkHealth, q } = require('./db');
const { load } = require('./config-loader');
const debug = require('../shared/debug-helper').create('hlb');

const authRouter = require('./routes/auth');
const proposalsRouter = require('./routes/proposals');
const likesRouter = require('./routes/likes');
const reportsRouter = require('./routes/reports');
const moderationRouter = require('./routes/moderation');

const app = express();
app.set('trust proxy', 1); // зад nginx reverse proxy

const PORT = process.env.HLB_PORT || 3010;
const PUBLIC_DIR = process.env.HLB_PUBLIC_DIR
  || path.resolve(__dirname, '..', '..', 'public', 'House-Look-Book');

// pool е достъпен за router-ите, които правят собствени транзакции.
app.locals.pool = pool;

// ── Middleware ─────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(session({
  secret: process.env.HLB_SESSION_SECRET || process.env.SESSION_SECRET || 'hlb-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 30, // 30 дни
    secure: process.env.NODE_ENV === 'production',
  },
}));

// ── API routes ─────────────────────────────────────────────────
app.use('/api/hlb', authRouter);
// proposals + likes + reports споделят префикса /proposals (различни пътища)
app.use('/api/hlb/proposals', proposalsRouter);
app.use('/api/hlb/proposals', likesRouter);
app.use('/api/hlb/proposals', reportsRouter);
app.use('/api/hlb/moderation', moderationRouter);

// Качените (умалени) картинки.
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Клиентски config (само лимитите за конструктора) — от public-а.
// Статичният фронтенд:
app.use('/', express.static(PUBLIC_DIR));
app.get('/', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

// ── Health / статус ────────────────────────────────────────────
app.get('/api/hlb/health', async (req, res) => {
  const h = await checkHealth();
  res.json({ ok: h.healthy, app: 'house-look-book', port: PORT, db: h, now: new Date().toISOString() });
});

app.get('/api/hlb/db-status', async (req, res) => {
  try {
    const tables = await q(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
    );
    const info = {};
    let total = 0;
    for (const t of tables.rows) {
      const c = await q(`SELECT count(*)::int AS c FROM "${t.tablename}"`);
      info[t.tablename] = c.rows[0].c;
      total += c.rows[0].c;
    }
    res.json({ connected: true, type: 'postgresql', tableCount: tables.rows.length, totalRows: total, tables: info });
  } catch (err) {
    res.status(500).json({ connected: false, error: err.message });
  }
});

// ── 404 / error handler ────────────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'not_found', path: req.path });
  res.status(404).send('Not found');
});
app.use((err, req, res, next) => {
  debug.error('UNCAUGHT', req.method, req.originalUrl, err && err.message);
  console.error(`❌ HLB грешка ${req.method} ${req.originalUrl}:`, err.message);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'server_error', message: err.message });
});

// ── Фонов процес: изтекли 'editing' → 'pending_moderation' ──────
// Период от config.moderation.autoFlipExpiredEditingMinutes (по подразбиране 30 мин).
function startAutoFlip() {
  const cfg = load();
  const minutes = Math.max(1, parseInt(cfg.moderation.autoFlipExpiredEditingMinutes || 30, 10));
  // node-cron: на всеки N минути.
  const expr = `*/${Math.min(minutes, 59)} * * * *`;
  cron.schedule(expr, async () => {
    try {
      const r = await q(
        `UPDATE proposals
         SET status = 'pending_moderation', submitted_at = now(), updated_at = now()
         WHERE status = 'editing' AND edit_window_until < now()`
      );
      if (r.rowCount > 0) console.log(`⏰ HLB auto-flip: ${r.rowCount} предложения → за модерация`);
    } catch (e) {
      console.error('⏰ HLB auto-flip грешка:', e.message);
    }
  });
  console.log(`⏰ HLB auto-flip активен (на всеки ${minutes} мин)`);
}

// ── Старт ──────────────────────────────────────────────────────
async function start() {
  // На сървъра схемата вече я слага деплой скриптът; тук е удобство за dev.
  if (process.env.HLB_APPLY_SCHEMA !== 'false') {
    try { await applySchema(); console.log('✅ HLB схема приложена/проверена'); }
    catch (e) { console.error('⚠️  HLB applySchema пропуснат:', e.message); }
    // Всяко приложение попълва САМО своите админи/модератори от .env, при собствения
    // си старт (идемпотентно — безвредно по всяко време). Виж roles.js.
    try { await seedAdminsAndMods(); console.log('✅ HLB админи/модератори попълнени от .env'); }
    catch (e) { console.error('⚠️  HLB попълване на админи пропуснато:', e.message); }
  }
  const h = await checkHealth();
  if (!h.healthy) console.error('⚠️  HLB няма връзка с PostgreSQL:', h.error);

  startAutoFlip();

  app.listen(PORT, () => {
    console.log(`🏠 House-Look-Book на http://localhost:${PORT}`);
    console.log(`   Public: ${PUBLIC_DIR}`);
    console.log(`   DB: ${process.env.HLB_PG_DATABASE || 'houselookbook'} @ ${process.env.HLB_PG_HOST || 'localhost'}`);
  });
}

start();

module.exports = app;
