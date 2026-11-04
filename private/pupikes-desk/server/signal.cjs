#!/usr/bin/env node
// Signaling сървър за Pupikes Remote Desk.
// Задача: само да сдвои двата компютъра по 9-цифрен ID и да размени offer/answer/ICE.
// НЕ пренася екрана/файловете — те вървят директно между машините (WebRTC P2P).
// Пускане локално:  node server/signal.cjs    (порт 9000)
// На наш сървър: зад nginx/wss на публичен адрес; клиентът сочи към него (SIGNAL_URL).
'use strict';
const http = require('http');
const path = require('path');
const fs = require('fs');
const { WebSocketServer } = require('ws');

const PORT = parseInt(process.env.PORT || '9000', 10);
const CONTACT_EMAIL = 'kalaydzhievvaleri@gmail.com';   // поща за връзка/проблеми
const peers = new Map();              // id → ws
const idOf = new Map();               // ws → id
const WEB = path.join(__dirname, '..', 'renderer');   // раздаваме интерфейса → телефон/браузър може да е КОНТРОЛЕР
const DATA = path.join(__dirname, 'data'); try { fs.mkdirSync(DATA, { recursive: true }); } catch (_) {}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8' };
const ipOf = (req) => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || (req.socket.remoteAddress || '').replace(/^::ffff:/, '') || 'unknown';

const server = http.createServer((req, res) => {
  const p = (req.url || '/').split('?')[0];
  if (p === '/health') { res.writeHead(200); res.end('ok'); return; }
  if (p === '/api/contact' && req.method === 'GET') { res.writeHead(200, { 'content-type': MIME['.json'] }); res.end(JSON.stringify({ contact: CONTACT_EMAIL })); return; }
  // Връзка/проблеми: потребителят описва проблема си → записваме за собственика (data/feedback.json).
  if (p === '/api/feedback' && req.method === 'POST') {
    let b = ''; req.on('data', (d) => b += d); req.on('end', () => {
      let o; try { o = JSON.parse(b || '{}'); } catch (_) { o = {}; }
      const text = String(o.message || '').trim();
      if (!text) { res.writeHead(400, { 'content-type': MIME['.json'] }); res.end(JSON.stringify({ ok: false, error: 'опиши проблема' })); return; }
      const F = path.join(DATA, 'feedback.json');
      let list; try { const a = JSON.parse(fs.readFileSync(F, 'utf8')); list = Array.isArray(a) ? a : []; } catch (_) { list = []; }
      list.push({ date: new Date().toISOString(), ip: ipOf(req), email: String(o.email || '').trim().slice(0, 120), message: text.slice(0, 4000) });
      try { fs.writeFileSync(F, JSON.stringify(list, null, 2)); } catch (_) {}
      res.writeHead(200, { 'content-type': MIME['.json'] }); res.end(JSON.stringify({ ok: true, contact: CONTACT_EMAIL }));
    });
    return;
  }
  const rel = (p === '/' ? 'index.html' : p.replace(/^\/+/, '').replace(/\.\./g, ''));
  const file = path.join(WEB, rel);
  if (file.startsWith(WEB) && fs.existsSync(file) && fs.statSync(file).isFile()) {
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(fs.readFileSync(file)); return;
  }
  res.writeHead(404); res.end('404');
});
const wss = new WebSocketServer({ server });

function send(ws, obj) { try { ws.send(JSON.stringify(obj)); } catch (_) {} }

wss.on('connection', (ws) => {
  ws.on('message', (buf) => {
    let m; try { m = JSON.parse(buf.toString()); } catch (_) { return; }
    if (m.type === 'hello' && m.id) {                 // регистрирай този компютър под неговия ID
      if (peers.has(m.id) && peers.get(m.id) !== ws) { send(ws, { type: 'error', error: 'id-taken' }); return; }
      peers.set(m.id, ws); idOf.set(ws, m.id);
      send(ws, { type: 'hello-ok', id: m.id });
      return;
    }
    if (m.type === 'signal' && m.to) {                // релей offer/answer/ICE към другия по ID
      const dst = peers.get(m.to);
      if (!dst) { send(ws, { type: 'error', error: 'peer-offline', to: m.to }); return; }
      send(dst, { type: 'signal', from: idOf.get(ws) || null, data: m.data });
      return;
    }
    if (m.type === 'bye' && m.to) { const dst = peers.get(m.to); if (dst) send(dst, { type: 'bye', from: idOf.get(ws) || null }); return; }
  });
  ws.on('close', () => { const id = idOf.get(ws); if (id && peers.get(id) === ws) peers.delete(id); idOf.delete(ws); });
  ws.on('error', () => {});
});

server.listen(PORT, () => console.log('Signaling слуша на :' + PORT + '  (ws://host:' + PORT + ')'));
