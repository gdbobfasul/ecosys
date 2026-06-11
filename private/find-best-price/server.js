// Version: 1.0193
// Find Best Price per Country — самостоятелен сървър (Express + PostgreSQL).
// API под /api/fbp/* ; статичният фронтенд е public/find-best-price.
// Server-client модел: същото API захранва и уеб, и мобилния (Expo) апп.

const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');
const debug = require('../shared/debug-helper').create('fbp');

require('dotenv').config({ path: path.join(__dirname, '..', 'configs', '.env') });

const { pool, applySchema, seedAdminsAndMods, checkHealth, q } = require('./db');

const authRouter = require('./routes/auth');
const businessRouter = require('./routes/business');
const productsRouter = require('./routes/products');
const searchRouter = require('./routes/search');
const wantedRouter = require('./routes/wanted');

// Предпазители: граничен/зловреден вход (или fuzz) НЕ бива да сваля целия процес (→ 502 за всички).
process.on('unhandledRejection', function (r) { console.error('[fbp] unhandledRejection:', r && (r.stack || r.message || r)); });
process.on('uncaughtException', function (e) { console.error('[fbp] uncaughtException:', e && (e.stack || e.message || e)); });

const app = express();
app.set('trust proxy', 1);

const PORT = process.env.FBP_PORT || 3012;
const PUBLIC_DIR = process.env.FBP_PUBLIC_DIR
  || path.resolve(__dirname, '..', '..', 'public', 'find-best-price');

app.locals.pool = pool;

app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(session({
  secret: process.env.FBP_SESSION_SECRET || process.env.SESSION_SECRET || 'fbp-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 * 30, secure: process.env.NODE_ENV === 'production' },
}));

// ── API ────────────────────────────────────────────────────────
app.use('/api/fbp', authRouter);                 // /register /login /logout /me
app.use('/api/fbp/business', businessRouter);    // създай/мои обекти
app.use('/api/fbp/products', productsRouter);    // добави/мои продукти
app.use('/api/fbp/search', searchRouter);        // ПУБЛИЧНО търсене
app.use('/api/fbp/wanted', wantedRouter);        // ZERO PRICE — заявки „търся" + оферти

app.use('/', express.static(PUBLIC_DIR));
app.get('/', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

// ── Health / статус ────────────────────────────────────────────
app.get('/api/fbp/health', async (req, res) => {
  const h = await checkHealth();
  res.json({ ok: h.healthy, app: 'find-best-price', port: PORT, db: h, now: new Date().toISOString() });
});
app.get('/api/fbp/db-status', async (req, res) => {
  try {
    const tables = await q("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
    const info = {}; let total = 0;
    for (const t of tables.rows) {
      const c = await q(`SELECT count(*)::int AS c FROM "${t.tablename}"`);
      info[t.tablename] = c.rows[0].c; total += c.rows[0].c;
    }
    res.json({ connected: true, type: 'postgresql', tableCount: tables.rows.length, totalRows: total, tables: info });
  } catch (err) { res.status(500).json({ connected: false, error: err.message }); }
});

// ── 404 / error ────────────────────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'not_found', path: req.path });
  res.status(404).send('Not found');
});
app.use((err, req, res, next) => {
  debug.error('UNCAUGHT', req.method, req.originalUrl, err && err.message);
  console.error(`❌ FBP грешка ${req.method} ${req.originalUrl}:`, err.message);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'server_error', message: err.message });
});

// ── Старт ──────────────────────────────────────────────────────
async function start() {
  if (process.env.FBP_APPLY_SCHEMA !== 'false') {
    try { await applySchema(); console.log('✅ FBP схема приложена'); }
    catch (e) { console.error('⚠️  FBP applySchema пропуснат:', e.message); }
    // Админи/модератори НЕ се попълват тук (при старт). Попълват се при ПОДГОТОВКАТА на
    // базата по време на деплой — скрипт 16 вика db.seedAdminsAndMods (правило „бази при бази").
  }
  const h = await checkHealth();
  if (!h.healthy) console.error('⚠️  FBP няма връзка с PostgreSQL:', h.error);

  app.listen(PORT, () => {
    console.log(`💰 Find Best Price на http://localhost:${PORT}`);
    console.log(`   Public: ${PUBLIC_DIR}`);
    console.log(`   DB: ${process.env.FBP_PG_DATABASE || 'findbestprice'} @ ${process.env.FBP_PG_HOST || 'localhost'}`);
  });
}

start();
module.exports = app;
