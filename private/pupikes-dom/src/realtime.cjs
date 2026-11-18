/* Реално време: WebSocket разпределител. Клиентите се абонират с токен; известията
 * се пращат до майсторите (нов сигнал), до центъра (всичко) и до собственика (статус). */
'use strict';
const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const cfg = require('./config.cjs');

const clients = new Set(); // {ws, user}

function attach(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (ws, req) => {
    let user = null;
    try {
      const url = new URL(req.url, 'http://x');
      user = jwt.verify(url.searchParams.get('token') || '', cfg.JWT_SECRET);
    } catch { ws.close(); return; }
    const entry = { ws, user };
    clients.add(entry);
    ws.on('close', () => clients.delete(entry));
    ws.on('error', () => {});
    ws.send(JSON.stringify({ type: 'hello', role: user.role }));
  });
}

/* изпраща към всички, за които filter(user) връща true */
function sendWhere(filter, payload) {
  const data = JSON.stringify(payload);
  for (const c of clients) {
    if (c.ws.readyState === 1 && filter(c.user)) { try { c.ws.send(data); } catch {} }
  }
}
const toRole = (role, payload) => sendWhere(u => u.role === role, payload);
const toUser = (id, payload) => sendWhere(u => u.id === id, payload);

module.exports = { attach, sendWhere, toRole, toUser };
