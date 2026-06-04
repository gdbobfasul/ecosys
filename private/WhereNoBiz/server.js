// Version: 1.0171
// WhereNoBiz („Намери ми бизнес, който го няма") — самостоятелен сървър.
// Express + PostgreSQL. Самостоятелно, чисто (правило от brief-а).
//
// Модел сървер–клиент (brief 4): в приложението САМО се гледа; постване/лични
// данни/плащания са „на сайта" (тук са същите endpoints — за прототип в едно).
// API под /api/wnb/* ; статичният фронтенд е public/WhereNoBiz.
// Прагове/тарифи идват от config.json (config-loader), не от кода.

const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', 'configs', '.env') });

const { pool, applySchema, seedCountries, seedAdminsAndMods, checkHealth, q } = require('./db');

const authRouter = require('./routes/auth');
const countriesRouter = require('./routes/countries');
const postsRouter = require('./routes/posts');
const confirmationsRouter = require('./routes/confirmations');
const reportsRouter = require('./routes/reports');
const moderationRouter = require('./routes/moderation');

const app = express();
app.set('trust proxy', 1);

const PORT = process.env.WNB_PORT || 3011;
const PUBLIC_DIR = process.env.WNB_PUBLIC_DIR
  || path.resolve(__dirname, '..', '..', 'public', 'WhereNoBiz');

app.locals.pool = pool;

app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(session({
  secret: process.env.WNB_SESSION_SECRET || process.env.SESSION_SECRET || 'wnb-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 * 30, secure: process.env.NODE_ENV === 'production' },
}));

// ── API routes ─────────────────────────────────────────────────
app.use('/api/wnb', authRouter);
app.use('/api/wnb', countriesRouter);              // /continents, /countries
app.use('/api/wnb/posts', postsRouter);
app.use('/api/wnb/posts', confirmationsRouter);    // /:id/confirm
app.use('/api/wnb/posts', reportsRouter);          // /:id/report
app.use('/api/wnb/moderation', moderationRouter);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/', express.static(PUBLIC_DIR));
app.get('/', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

// ── Health / статус ────────────────────────────────────────────
app.get('/api/wnb/health', async (req, res) => {
  const h = await checkHealth();
  res.json({ ok: h.healthy, app: 'where-no-biz', port: PORT, db: h, now: new Date().toISOString() });
});
app.get('/api/wnb/db-status', async (req, res) => {
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
  console.error(`❌ WNB грешка ${req.method} ${req.originalUrl}:`, err.message);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'server_error', message: err.message });
});

// ── Старт ──────────────────────────────────────────────────────
async function start() {
  if (process.env.WNB_APPLY_SCHEMA !== 'false') {
    // Разделени: ако applySchema гръмне (напр. права/локов), seedCountries ВСЕ ПАК да тече —
    // иначе countries остава празна и всяко вкарване на пост дава FK грешка.
    try { await applySchema(); console.log('✅ WNB схема приложена'); }
    catch (e) { console.error('⚠️  WNB applySchema пропуснат:', e.message); }
    try { await seedCountries(); console.log('✅ WNB страни заредени'); }
    catch (e) { console.error('⚠️  WNB seedCountries пропуснат:', e.message); }
    // Всяко приложение попълва САМО своите админи/модератори от .env, при собствения
    // си старт (идемпотентно — безвредно по всяко време). Виж roles.js.
    try { await seedAdminsAndMods(); console.log('✅ WNB админи/модератори попълнени от .env'); }
    catch (e) { console.error('⚠️  WNB попълване на админи пропуснато:', e.message); }
  }
  const h = await checkHealth();
  if (!h.healthy) console.error('⚠️  WNB няма връзка с PostgreSQL:', h.error);

  app.listen(PORT, () => {
    console.log(`🌍 WhereNoBiz на http://localhost:${PORT}`);
    console.log(`   Public: ${PUBLIC_DIR}`);
    console.log(`   DB: ${process.env.WNB_PG_DATABASE || 'wherenobiz'} @ ${process.env.WNB_PG_HOST || 'localhost'}`);
  });
}

start();
module.exports = app;
