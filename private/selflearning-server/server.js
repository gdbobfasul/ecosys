// Version: 1.0237
// Selflearning Friend — самостоятелен server-side relay (Express + better-sqlite3).
//
// Канали (token = namespace, част от пътя):
//   POST /api/selflearning/teach/:token        → добави entries в PENDING опашката
//   GET  /api/selflearning/listen/:token        → върни PENDING entries („Слушай")
//   POST /api/selflearning/listen/:token/ack    → изчисти доставените {count}
//   POST /api/selflearning/sync/:token          → запиши пълен knowledge snapshot
//   GET  /api/selflearning/sync/:token          → върни записания snapshot
//   POST /api/selflearning/exec/:token          → изпълни команда (SSH/локално) — OPT-IN, виж по-долу
//   POST /api/selflearning/ai/:token            → локален модел (Ollama) → {text} — OPT-IN (опция 80)
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
const BODY_LIMIT   = process.env.SELFLEARNING_BODY_LIMIT || '2mb';  // 2mb → побира малък кадър (watch/frame)
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
// БЕЗОПАСЕН РЕЖИМ — ВКЛЮЧЕН по подразбиране. Дори exec да е пуснат на production, се допускат
// САМО безвредни команди (mkdir/ls/rm/rmdir/echo/cat/stat/pwd) и САМО в пясъчника по-долу.
// Изключва се изрично с SELFLEARNING_EXEC_SAFE_MODE=0 (НЕ препоръчително на prod).
const EXEC_SAFE_MODE  = String(process.env.SELFLEARNING_EXEC_SAFE_MODE || '1') === '1';
const EXEC_SANDBOX    = (process.env.SELFLEARNING_EXEC_SANDBOX || '/tmp/slf-test').replace(/\/+$/, '');

function isLocalHost(h) {
  return !h || h === 'localhost' || h === '127.0.0.1' || h === '::1';
}

// Пази машината: допуска САМО безвредни команди В ПЯСЪЧНИКА. Без sudo, без опасни обвивкови
// оператори (; | & ` $() < > \), без пътища извън пясъчника, без „..". Връща { ok } | { ok, reason }.
const EXEC_SAFE_VERBS = ['mkdir', 'ls', 'rm', 'rmdir', 'echo', 'cat', 'stat', 'pwd'];
function safeGuard(command) {
  const c = String(command || '').trim();
  if (!c) return { ok: false, reason: 'празна команда' };
  if (c.length > 500) return { ok: false, reason: 'командата е твърде дълга' };
  // Без обвивкови оператори/подмяна (позволяваме интервали, кавички, тире, * за glob).
  if (/[;&|`<>\n\r\\]|\$\(|\$\{/.test(c)) return { ok: false, reason: 'недопустими обвивкови оператори' };
  const verb = c.split(/\s+/)[0];
  if (!EXEC_SAFE_VERBS.includes(verb)) {
    return { ok: false, reason: `командата „${verb}" не е в безопасния списък (${EXEC_SAFE_VERBS.join('/')})` };
  }
  // Всеки АБСОЛЮТЕН път трябва да е самият пясъчник или под него.
  const paths = c.match(/\/[^\s"']*/g) || [];
  for (const raw of paths) {
    const p = raw.replace(/["']/g, '');
    if (p.includes('..')) return { ok: false, reason: 'пътят съдържа „..“' };
    if (p !== EXEC_SANDBOX && !p.startsWith(EXEC_SANDBOX + '/')) {
      return { ok: false, reason: `пътят „${p}" е извън пясъчника ${EXEC_SANDBOX}` };
    }
  }
  // Променящите команди ЗАДЪЛЖИТЕЛНО работят по път в пясъчника (без гол „rm -rf").
  if (['rm', 'rmdir', 'mkdir'].includes(verb) && paths.length === 0) {
    return { ok: false, reason: `„${verb}" изисква път в пясъчника ${EXEC_SANDBOX}` };
  }
  return { ok: true };
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
  // БЕЗОПАСЕН РЕЖИМ: пропускаме само безвредни команди в пясъчника (пази production).
  if (EXEC_SAFE_MODE) {
    const g = safeGuard(command);
    if (!g.ok) {
      console.log(`[selflearning][exec] ОТКАЗАНА (safe): ${g.reason} | cmd=${command.slice(0, 200)}`);
      return res.status(400).json({ ok: false, error: 'unsafe_command', hint: g.reason, sandbox: EXEC_SANDBOX });
    }
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

// ── ai: ЛОКАЛЕН езиков модел (Ollama) на ТОЗИ сървър — частен, без облак ──────────
// Телефонът/роботът праща { prompt } → relay-ят пита локалния Ollama → връща { text }.
// Така апът ползва МОДЕЛА НА СЪРВЪРА (tier1 endpoint в teacher.js), вместо облачния Pollinations.
//   • ИЗКЛЮЧЕНО по подразбиране. Пуска се само ако SELFLEARNING_AI_ENABLED=1 (слага се от опция 80
//     САМО на сериозен сървър/VM — НЕ на production). Конфигът е в сървър-локален файл (ai.env),
//     който деплоят НЕ трие.
const AI_ENABLED    = String(process.env.SELFLEARNING_AI_ENABLED || '') === '1';
const AI_URL        = (process.env.SELFLEARNING_AI_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '');
const AI_MODEL      = process.env.SELFLEARNING_AI_MODEL || 'qwen2.5:3b';
const AI_TIMEOUT_MS = parseInt(process.env.SELFLEARNING_AI_TIMEOUT_MS || '60000', 10);

async function askLocalModel(prompt) {
  if (typeof fetch !== 'function') return null;          // Node < 18 → няма глобален fetch
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), AI_TIMEOUT_MS);
  try {
    const resp = await fetch(`${AI_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: AI_MODEL, prompt: String(prompt || ''), stream: false }),
      signal: ctrl.signal,
    });
    if (!resp.ok) return null;
    const data = await resp.json().catch(() => null);
    const text = data && typeof data.response === 'string' ? data.response.trim() : '';
    return text || null;
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

app.post('/api/selflearning/ai/:token', withToken, async (req, res) => {
  if (!AI_ENABLED) {
    return res.status(403).json({ ok: false, error: 'ai_disabled',
      hint: 'Локалният AI е изключен. Пусни го през деплой опция 80 на ТОЗИ сървър (Ollama + модел).' });
  }
  const prompt = (req.body && typeof req.body.prompt === 'string') ? req.body.prompt : '';
  if (!prompt.trim()) return res.status(400).json({ ok: false, error: 'no_prompt' });
  const text = await askLocalModel(prompt);
  if (text == null) {
    return res.status(502).json({ ok: false, error: 'ai_unreachable',
      hint: `Не стигнах до локалния модел (${AI_MODEL} на ${AI_URL}). Провери, че Ollama върви.` });
  }
  res.json({ ok: true, text, model: AI_MODEL });
});

// ── WATCH (детегледачка / camera-watch): сдвояване по „pair" ключ ────────────
// Телефонът до детето (Детегледачка) праща събития/кадри; наблюдаващият ги тегли.
// pair = таен ключ за двойка (като token — лек namespace, не втвърдена автентикация).
function withPair(req, res, next) {
  const pair = cleanToken(req.params.pair);
  if (!pair) return res.status(400).json({ ok: false, error: 'bad_pair' });
  if (!rateLimit('watch:' + pair)) return res.status(429).json({ ok: false, error: 'rate_limited' });
  req.pair = pair;
  next();
}
function watchPending(pair) {
  return db.prepare('SELECT COUNT(*) AS c FROM watch_queue WHERE pair = ?').get(pair).c;
}

// Детегледачката праща събитие.
app.post('/api/watch/alert/:pair', withPair, (req, res) => {
  const b = req.body || {};
  const appName = b.app != null ? String(b.app).slice(0, 40) : '';
  const type = b.type != null ? String(b.type).slice(0, 40) : '';
  const label = b.label != null ? String(b.label).slice(0, 400) : '';
  db.prepare('INSERT INTO watch_queue (pair, app, type, label, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(req.pair, appName, type, label, Date.now());
  // Cap: пазим последните 200 на двойка.
  db.prepare(`DELETE FROM watch_queue WHERE pair = ? AND id NOT IN
              (SELECT id FROM watch_queue WHERE pair = ? ORDER BY id DESC LIMIT 200)`)
    .run(req.pair, req.pair);
  res.json({ ok: true, pending: watchPending(req.pair) });
});

// Наблюдаващият тегли новите събития (?ack=1 ги изчиства веднага).
app.get('/api/watch/alert/:pair', withPair, (req, res) => {
  const rows = db.prepare('SELECT id, app, type, label, created_at FROM watch_queue WHERE pair = ? ORDER BY id ASC').all(req.pair);
  if (String(req.query.ack || '') === '1') db.prepare('DELETE FROM watch_queue WHERE pair = ?').run(req.pair);
  res.json({ ok: true, alerts: rows });
});

// Изчиства най-старите N (по-безопасният ack).
app.post('/api/watch/alert/:pair/ack', withPair, (req, res) => {
  const n = parseInt((req.body && req.body.count), 10);
  if (!Number.isInteger(n) || n < 0) return res.status(400).json({ ok: false, error: 'bad_count' });
  const info = db.prepare('DELETE FROM watch_queue WHERE id IN (SELECT id FROM watch_queue WHERE pair = ? ORDER BY id ASC LIMIT ?)').run(req.pair, n);
  res.json({ ok: true, cleared: info.changes, pending: watchPending(req.pair) });
});

// Детегледачката качва последния кадър (малка компресирана снимка).
app.post('/api/watch/frame/:pair', withPair, (req, res) => {
  const b = req.body || {};
  const dataurl = b.dataurl != null ? String(b.dataurl) : '';
  if (!/^data:image\//.test(dataurl)) return res.status(400).json({ ok: false, error: 'bad_frame' });
  const label = b.label != null ? String(b.label).slice(0, 400) : '';
  db.prepare(`INSERT INTO watch_frame (pair, dataurl, label, updated_at) VALUES (?, ?, ?, ?)
              ON CONFLICT(pair) DO UPDATE SET dataurl = excluded.dataurl, label = excluded.label, updated_at = excluded.updated_at`)
    .run(req.pair, dataurl, label, Date.now());
  res.json({ ok: true, bytes: dataurl.length });
});

// Наблюдаващият дърпа последния кадър.
app.get('/api/watch/frame/:pair', withPair, (req, res) => {
  const row = db.prepare('SELECT dataurl, label, updated_at FROM watch_frame WHERE pair = ?').get(req.pair);
  if (!row) return res.json({ ok: true, frame: null });
  res.json({ ok: true, frame: row.dataurl, label: row.label, updated_at: row.updated_at });
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
