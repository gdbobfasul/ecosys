// Version: 1.0171
// Token Monitor сървис — ЕДИН токен (подава се аргумент или TOKEN_KEY от .env).
// Дава: read-only dashboard API (статистика/holders/аларми) + админ вход (от .env).
// Стартира индексатора. Пуска се отделно за всеки токен (token/brch1/multisig).
//   node server.js token   |   node server.js brch1   |   node server.js multisig
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'configs', '.env') });

const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');

const { tokenConfig } = require('./tokens');
const { roleForUsername, envAccounts } = require('./roles');
const { openDb } = require('./db');
const { createIndexer } = require('./indexer');

const KEY = String(process.argv[2] || process.env.TOKEN_KEY || 'token').toLowerCase();
const cfg = tokenConfig(KEY);
const db = openDb(KEY);

// Админи/модератори НЕ се попълват тук (при старт). Попълват се при подготовката по време
// на деплой — скрипт 31 вика `node admins.js <key>` (правило „бази при бази"). Виж admins.js.

const indexer = createIndexer(cfg, db);
indexer.start();

// Предпазители: граничен/зловреден вход (или fuzz) НЕ бива да сваля целия процес (→ 502 за всички).
process.on('unhandledRejection', function (r) { console.error('[tokmon] unhandledRejection:', r && (r.stack || r.message || r)); });
process.on('uncaughtException', function (e) { console.error('[tokmon] uncaughtException:', e && (e.stack || e.message || e)); });

const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use(cookieParser());
app.use(session({
  name: `kcytok-${KEY}.sid`,
  secret: process.env[`${KEY.toUpperCase()}_SESSION_SECRET`] || 'change-me-token',
  resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24, secure: process.env.NODE_ENV === 'production' },
}));

const B = `/api/tok/${KEY}`;
const roleOf = u => (u ? roleForUsername(KEY, u) : 'user');
function requireStaff(req, res, next) {
  if (req.session && req.session.user && roleOf(req.session.user) !== 'user') return next();
  res.status(403).json({ error: 'forbidden', message: 'Само за админ/модератор (виж .env).' });
}

app.get(`${B}/health`, (req, res) => res.json({ ok: true, token: KEY, name: cfg.name, deployed: cfg.deployed }));

app.post(`${B}/login`, async (req, res) => {
  const { username, password } = req.body || {};
  const u = String(username || '').toLowerCase();
  const row = db.prepare('SELECT username,password_hash FROM admins WHERE username=?').get(u);
  if (!row || !(await bcrypt.compare(String(password || ''), row.password_hash))) {
    return res.status(401).json({ error: 'bad_credentials', message: 'Грешен потребител или парола.' });
  }
  if (roleOf(row.username) === 'user') return res.status(403).json({ error: 'not_staff', message: 'Не си в .env админ/модератор списъка.' });
  db.prepare("UPDATE admins SET last_login=datetime('now') WHERE username=?").run(row.username);
  req.session.user = row.username;
  res.json({ ok: true, user: row.username, role: roleOf(row.username) });
});
app.post(`${B}/logout`, (req, res) => req.session.destroy(() => res.json({ ok: true })));
app.get(`${B}/me`, (req, res) => res.json({ user: req.session?.user || null, role: roleOf(req.session?.user) }));

// ── Read-only данни (само за staff) ──
app.get(`${B}/stats`, requireStaff, (req, res) => res.json(indexer.stats()));
app.get(`${B}/alerts`, requireStaff, (req, res) =>
  res.json({ alerts: db.prepare('SELECT * FROM alerts ORDER BY id DESC LIMIT 200').all() }));
app.get(`${B}/holders`, requireStaff, (req, res) =>
  res.json({ holders: db.prepare("SELECT addr,balance,first_seen,last_seen FROM holders WHERE balance NOT IN ('0','') ORDER BY last_seen DESC LIMIT 500").all() }));

// ── Dashboard (статичен, read-only) ──
app.get('/monitor-config.js', (req, res) =>
  res.type('application/javascript').send(`window.TOK_KEY=${JSON.stringify(KEY)};window.TOK_NAME=${JSON.stringify(cfg.name)};`));
app.use(express.static(path.join(__dirname, 'public')));

const PORT = cfg.port;
app.listen(PORT, () => console.log(`🛡️  token-monitor [${KEY}] на http://localhost:${PORT} — deployed=${cfg.deployed}`));
module.exports = app;
