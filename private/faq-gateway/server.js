// server.js — HTTP шлюз за FAQ бота. Node stdlib http, глобален fetch (Node 18+).
// Маршрути:
//   GET  /health                      — статус + активни канали
//   GET  /webhook/whatsapp            — verify challenge
//   POST /webhook/whatsapp            — входящи → отговор
//   GET  /webhook/messenger           — verify challenge
//   POST /webhook/messenger           — входящи → отговор
//   POST /webhook/viber               — входящи → отговор
//   GET  /kb        (Bearer admin)    — чете config+kb
//   POST /kb        (Bearer admin)    — публикува config+kb от приложението
//   GET  /log       (Bearer admin)    — последните обработени съобщения + броячи
//   POST /reply     (Bearer admin)    — тест: {input} → {reply,kind} (без изпращане)
//
// Всеки канал е опционален. Отговорът идва от ЕДИН rule-engine (lib/respond.js),
// същия като в приложението.
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Мини зареждане на .env (без зависимост) — само KEY=VALUE редове.
const __dirname = dirname(fileURLToPath(import.meta.url));
(function loadEnv() {
  const p = join(__dirname, '.env');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
})();

const { config, enabledChannels } = await import('./config.js');
const { respond } = await import('./lib/respond.js');
const store = await import('./lib/store.js');
const whatsapp = await import('./channels/whatsapp.js');
const messenger = await import('./channels/messenger.js');
const viber = await import('./channels/viber.js');

const CHANNELS = { whatsapp, messenger, viber };

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 2e6) req.destroy(); });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

function isAdmin(req) {
  if (!config.adminToken) return false; // без зададен токен — админ операциите са забранени
  const h = req.headers['authorization'] || '';
  return h === `Bearer ${config.adminToken}`;
}

// Обработва входящите от даден канал: за всяко съобщение → respond → send.
async function handleIncoming(channelId, msgs) {
  const state = store.getState();
  const mod = CHANNELS[channelId];
  for (const m of msgs) {
    if (!m || !m.text || !m.from) continue;
    const r = respond(state, m.text);
    store.logTurn({ channel: channelId, from: m.from, input: m.text, reply: r.reply, kind: r.kind, label: r.label });
    try {
      await mod.send(m.from, r.reply);
    } catch (e) {
      console.error(`[${channelId}] send fail:`, e.message);
    }
  }
}

const server = createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const path = u.pathname;
  const q = Object.fromEntries(u.searchParams.entries());

  if (req.method === 'OPTIONS') return json(res, 204, {});

  // ── health ──
  if (path === '/health' && req.method === 'GET') {
    return json(res, 200, { ok: true, service: 'faq-gateway', channels: enabledChannels(), kb: store.getState().kb.length });
  }

  // ── WhatsApp ──
  if (path === '/webhook/whatsapp') {
    if (req.method === 'GET') {
      const v = whatsapp.verify(q);
      if (v.ok) { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end(v.challenge); }
      res.writeHead(403); return res.end('forbidden');
    }
    if (req.method === 'POST') {
      const body = await readBody(req);
      json(res, 200, { ok: true }); // отговаряме бързо, после обработваме
      return handleIncoming('whatsapp', whatsapp.parseIncoming(body));
    }
  }

  // ── Messenger ──
  if (path === '/webhook/messenger') {
    if (req.method === 'GET') {
      const v = messenger.verify(q);
      if (v.ok) { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end(v.challenge); }
      res.writeHead(403); return res.end('forbidden');
    }
    if (req.method === 'POST') {
      const body = await readBody(req);
      json(res, 200, { ok: true });
      return handleIncoming('messenger', messenger.parseIncoming(body));
    }
  }

  // ── Viber ──
  if (path === '/webhook/viber' && req.method === 'POST') {
    const body = await readBody(req);
    json(res, 200, { ok: true });
    return handleIncoming('viber', viber.parseIncoming(body));
  }

  // ── Админ: KB sync ──
  if (path === '/kb') {
    if (!isAdmin(req)) return json(res, 401, { error: 'unauthorized' });
    if (req.method === 'GET') {
      const s = store.getState();
      return json(res, 200, { config: s.config, kb: s.kb });
    }
    if (req.method === 'POST') {
      const body = await readBody(req);
      return json(res, 200, store.replaceKb(body));
    }
  }

  // ── Админ: дневник ──
  if (path === '/log' && req.method === 'GET') {
    if (!isAdmin(req)) return json(res, 401, { error: 'unauthorized' });
    const s = store.getState();
    return json(res, 200, { stats: s.stats, log: s.log.slice(0, 100) });
  }

  // ── Админ: тест на отговора без изпращане ──
  if (path === '/reply' && req.method === 'POST') {
    if (!isAdmin(req)) return json(res, 401, { error: 'unauthorized' });
    const body = await readBody(req);
    return json(res, 200, respond(store.getState(), body.input || ''));
  }

  json(res, 404, { error: 'not found' });
});

server.listen(config.port, () => {
  console.log(`[faq-gateway] слуша на :${config.port} — активни канали: ${enabledChannels().join(', ') || '(нито един — попълни .env)'}`);
});
