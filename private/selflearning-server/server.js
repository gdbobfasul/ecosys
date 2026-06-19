// Version: 1.0219
// Selflearning Friend — самостоятелен server-side relay (Express + better-sqlite3).
//
// Канали (token = namespace, част от пътя):
//   POST /api/selflearning/teach/:token        → добави entries в PENDING опашката
//   GET  /api/selflearning/listen/:token        → върни PENDING entries („Слушай")
//   POST /api/selflearning/listen/:token/ack    → изчисти доставените {count}
//   POST /api/selflearning/sync/:token          → запиши пълен knowledge snapshot
//   GET  /api/selflearning/sync/:token          → върни записания snapshot
//   POST /api/selflearning/exec/:token          → изпълни команда (SSH/локално) — OPT-IN, виж по-долу
//   GET  /api/selflearning/health               → {ok, service}
//
// ⚠ ЧЕСТНО за auth: token-ът в URL е ЛЕКА лична namespace-изация, НЕ втвърдена
//   автентикация. Всеки с token-а може да чете/пише данните на този token.
//   За личен робот това е приемливо; реален деплой би добавил таен header.
//   (виж README.md)
//
// БЕЗ user id-та, БЕЗ телефони/контакти, БЕЗ tracking — само queue + snapshot.

const express = require('express');
const path = require('path');
const { execFile } = require('child_process');

const { openDb } = require('./db');

// Граничен/зловреден вход НЕ бива да сваля процеса (→ 502 за всички).
process.on('unhandledRejection', (r) => console.error('[selflearning] unhandledRejection:', r && (r.stack || r.message || r)));
process.on('uncaughtException', (e) => console.error('[selflearning] uncaughtException:', e && (e.stack || e.message || e)));

const PORT = process.env.SELFLEARNING_PORT || process.env.PORT || 3013;

// Скромни лимити (light, но защитава relay-а).
const BODY_LIMIT   = process.env.SELFLEARNING_BODY_LIMIT || '1mb';
const MAX_ENTRIES  = parseInt(process.env.SELFLEARNING_MAX_ENTRIES || '500', 10);  // на заявка teach
const QUEUE_CAP    = parseInt(process.env.SELFLEARNING_QUEUE_CAP   || '5000', 10); // на token
const RL_WINDOW_MS = parseInt(process.env.SELFLEARNING_RL_WINDOW_MS || '60000', 10);
const RL_MAX       = parseInt(process.env.SELFLEARNING_RL_MAX       || '120', 10); // заявки/прозорец/token

const db = openDb();

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: BODY_LIMIT }));

// CORS: мобилният WebView (capacitor/file://) няма стабилен Origin → за личен relay
// е приемливо да разрешим всичко за тези endpoints. (документирано в README.md)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ── helpers ────────────────────────────────────────────────────────
function cleanToken(t) {
  // token = лек namespace; пускаме само безопасни символи, ограничена дължина.
  if (typeof t !== 'string') return null;
  const s = t.trim();
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(s)) return null;
  return s;
}

function normEntry(e) {
  if (!e || typeof e !== 'object') return null;
  const kw = e.keywords;
  let keywords = '';
  if (Array.isArray(kw)) keywords = JSON.stringify(kw.map((x) => String(x)).slice(0, 50));
  else if (kw != null) keywords = String(kw);
  return {
    type: e.type != null ? String(e.type) : '',
    key: e.key != null ? String(e.key) : '',
    value: e.value != null ? String(e.value) : '',
    keywords,
  };
}

function entriesFromBody(body) {
  // Приема масив ИЛИ {entries:[...]}.
  let arr = null;
  if (Array.isArray(body)) arr = body;
  else if (body && Array.isArray(body.entries)) arr = body.entries;
  if (!arr) return null;
  return arr.map(normEntry).filter(Boolean);
}

function rateLimit(token) {
  const now = Date.now();
  const row = db.prepare('SELECT window_start, count FROM ratelimit WHERE token = ?').get(token);
  if (!row || now - row.window_start >= RL_WINDOW_MS) {
    db.prepare(`INSERT INTO ratelimit (token, window_start, count) VALUES (?, ?, 1)
                ON CONFLICT(token) DO UPDATE SET window_start = excluded.window_start, count = 1`)
      .run(token, now);
    return true;
  }
  if (row.count >= RL_MAX) return false;
  db.prepare('UPDATE ratelimit SET count = count + 1 WHERE token = ?').run(token);
  return true;
}

// Token middleware за /:token маршрутите.
function withToken(req, res, next) {
  const token = cleanToken(req.params.token);
  if (!token) return res.status(400).json({ ok: false, error: 'bad_token' });
  if (!rateLimit(token)) return res.status(429).json({ ok: false, error: 'rate_limited' });
  req.token = token;
  next();
}

// ── health ─────────────────────────────────────────────────────────
app.get('/api/selflearning/health', (req, res) => {
  res.json({ ok: true, service: 'selflearning', port: PORT, now: new Date().toISOString() });
});

// ── teach: добави entries в PENDING опашката ────────────────────────
app.post('/api/selflearning/teach/:token', withToken, (req, res) => {
  const entries = entriesFromBody(req.body);
  if (!entries) return res.status(400).json({ ok: false, error: 'no_entries' });
  if (entries.length > MAX_ENTRIES) {
    return res.status(413).json({ ok: false, error: 'too_many_entries', max: MAX_ENTRIES });
  }
  if (entries.length === 0) return res.json({ ok: true, added: 0, pending: pendingCount(req.token) });

  const insert = db.prepare(
    'INSERT INTO queue (token, type, key, value, keywords, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const now = Date.now();
  const tx = db.transaction((rows) => {
    for (const e of rows) insert.run(req.token, e.type, e.key, e.value, e.keywords, now);
    // Cap: подрежи най-старите ако сме над тавана.
    trimQueue(req.token);
  });
  tx(entries);
  res.json({ ok: true, added: entries.length, pending: pendingCount(req.token) });
});

// ── listen: върни PENDING entries („Слушай") ────────────────────────
app.get('/api/selflearning/listen/:token', withToken, (req, res) => {
  const rows = db.prepare(
    'SELECT type, key, value, keywords FROM queue WHERE token = ? ORDER BY id ASC'
  ).all(req.token);
  const out = rows.map((r) => ({
    type: r.type, key: r.key, value: r.value, keywords: parseKeywords(r.keywords),
  }));
  // По избор: ?ack=1 изчиства веднага след доставка (за прости клиенти).
  if (String(req.query.ack || '') === '1') {
    db.prepare('DELETE FROM queue WHERE token = ?').run(req.token);
  }
  res.json(out);
});

// ── ack: изчисти доставените {count} (по-безопасният път) ────────────
app.post('/api/selflearning/listen/:token/ack', withToken, (req, res) => {
  const n = parseInt((req.body && req.body.count), 10);
  if (!Number.isInteger(n) || n < 0) {
    return res.status(400).json({ ok: false, error: 'bad_count' });
  }
  // Изтрий най-старите n (същия ред като listen връща).
  const info = db.prepare(
    'DELETE FROM queue WHERE id IN (SELECT id FROM queue WHERE token = ? ORDER BY id ASC LIMIT ?)'
  ).run(req.token, n);
  res.json({ ok: true, cleared: info.changes, pending: pendingCount(req.token) });
});

// ── sync: запиши/върни пълен knowledge snapshot ─────────────────────
app.post('/api/selflearning/sync/:token', withToken, (req, res) => {
  if (req.body == null || typeof req.body !== 'object') {
    return res.status(400).json({ ok: false, error: 'no_snapshot' });
  }
  const payload = JSON.stringify(req.body);
  const now = Date.now();
  db.prepare(`INSERT INTO snapshot (token, payload, updated_at) VALUES (?, ?, ?)
              ON CONFLICT(token) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`)
    .run(req.token, payload, now);
  res.json({ ok: true, bytes: payload.length, updated_at: now });
});

app.get('/api/selflearning/sync/:token', withToken, (req, res) => {
  const row = db.prepare('SELECT payload, updated_at FROM snapshot WHERE token = ?').get(req.token);
  if (!row) return res.json({ ok: true, snapshot: null, updated_at: null });
  let snapshot = null;
  try { snapshot = JSON.parse(row.payload); } catch (_) { snapshot = null; }
  res.json({ ok: true, snapshot, updated_at: row.updated_at });
});

// ── exec: изпълни команда на отдалечена машина по SSH (или локално) ──────────
// Телефонът праща { host, command }; relay-ят изпълнява и връща { stdout, stderr, code }.
//
// ⚠ СИГУРНОСТ (важно):
//   • ИЗКЛЮЧЕНО по подразбиране. Работи САМО ако SELFLEARNING_EXEC_ENABLED=1 на сървъра.
//     Така relay-ят не е „тихо" RCE кутия — собственикът съзнателно го пуска.
//   • Гейтингът с КОДОВА ДУМА е на телефона (commands.js): без вярната дума апът не праща.
//   • token + rate-limit важат; всяка команда се ЛОГВА; таймаут + таван на изхода.
//   • SSH ползва ключа/потребителя на relay-а (env по-долу) — достъпът му определя докъде стига.
const EXEC_ENABLED    = String(process.env.SELFLEARNING_EXEC_ENABLED || '') === '1';
const EXEC_SSH_USER   = process.env.SELFLEARNING_EXEC_SSH_USER || 'deploy';
const EXEC_SSH_PORT   = String(process.env.SELFLEARNING_EXEC_SSH_PORT || '22');
const EXEC_SSH_KEY    = process.env.SELFLEARNING_EXEC_SSH_KEY || '';        // по избор: път до частен ключ
const EXEC_TIMEOUT_MS = parseInt(process.env.SELFLEARNING_EXEC_TIMEOUT_MS || '60000', 10);
const EXEC_MAX_OUTPUT = parseInt(process.env.SELFLEARNING_EXEC_MAX_OUTPUT || '100000', 10); // байта на поток

function isLocalHost(h) {
  return !h || h === 'localhost' || h === '127.0.0.1' || h === '::1';
}

app.post('/api/selflearning/exec/:token', withToken, (req, res) => {
  if (!EXEC_ENABLED) {
    return res.status(403).json({ ok: false, error: 'exec_disabled',
      hint: 'Изпълнението е изключено. На сървъра задай SELFLEARNING_EXEC_ENABLED=1 и рестартирай услугата.' });
  }
  const host = (req.body && typeof req.body.host === 'string') ? req.body.host.trim() : '';
  const command = (req.body && typeof req.body.command === 'string') ? req.body.command : '';
  if (!command.trim()) return res.status(400).json({ ok: false, error: 'no_command' });
  // Лек филтър на хоста (за SSH): без интервали/опасни символи.
  if (host && !/^[A-Za-z0-9._-]{1,255}$/.test(host)) {
    return res.status(400).json({ ok: false, error: 'bad_host' });
  }

  const stamp = new Date().toISOString();
  console.log(`[selflearning][exec] ${stamp} token=${req.token.slice(0, 6)}… host=${host || 'local'} cmd=${command.slice(0, 300)}`);

  let file, args;
  if (isLocalHost(host)) {
    file = 'bash';
    args = ['-lc', command];
  } else {
    file = 'ssh';
    args = ['-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=accept-new', '-o', 'ConnectTimeout=12', '-p', EXEC_SSH_PORT];
    if (EXEC_SSH_KEY) args.push('-o', 'IdentitiesOnly=yes', '-i', EXEC_SSH_KEY);
    args.push(`${EXEC_SSH_USER}@${host}`, command);
  }

  execFile(file, args, { timeout: EXEC_TIMEOUT_MS, maxBuffer: EXEC_MAX_OUTPUT * 2 + 1024, windowsHide: true },
    (err, stdout, stderr) => {
      const out = String(stdout || '').slice(0, EXEC_MAX_OUTPUT);
      const errout = String(stderr || '').slice(0, EXEC_MAX_OUTPUT);
      const code = err && typeof err.code === 'number' ? err.code : (err ? 1 : 0);
      const timedOut = !!(err && err.killed);
      res.json({ ok: !err, code, host: host || 'localhost', stdout: out, stderr: errout, timedOut });
    });
});

// ── helpers (db) ────────────────────────────────────────────────────
function pendingCount(token) {
  return db.prepare('SELECT COUNT(*) AS c FROM queue WHERE token = ?').get(token).c;
}
function parseKeywords(s) {
  if (!s) return [];
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : s; } catch (_) { return s; }
}
function trimQueue(token) {
  const c = pendingCount(token);
  if (c <= QUEUE_CAP) return;
  const over = c - QUEUE_CAP;
  db.prepare(
    'DELETE FROM queue WHERE id IN (SELECT id FROM queue WHERE token = ? ORDER BY id ASC LIMIT ?)'
  ).run(token, over);
}

// ── 404 / error ─────────────────────────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ ok: false, error: 'not_found', path: req.path });
  res.status(404).send('Not found');
});
app.use((err, req, res, next) => {
  console.error(`❌ selflearning грешка ${req.method} ${req.originalUrl}:`, err && err.message);
  if (res.headersSent) return next(err);
  res.status(500).json({ ok: false, error: 'server_error', message: err && err.message });
});

app.listen(PORT, () => {
  console.log(`🧠 Selflearning Friend relay на http://localhost:${PORT}`);
  console.log(`   teach → /api/selflearning/teach/:token   listen → /api/selflearning/listen/:token`);
});

module.exports = app;
