#!/usr/bin/env node
'use strict';
// PupikesSendTo — сървър:
//  1) раздава уеб-страницата (web/) със заключване по IP (безплатно 2 отваряния/IP, после плащане);
//  2) signaling за P2P трансфер по 6-цифрен код (сдвоява sender↔receiver, релейва offer/answer/ICE).
// Файловете НЕ минават през сървъра — вървят директно между устройствата (WebRTC). Сървърът само сдвоява.
// Мобилното приложение (Capacitor) зарежда същото web/ локално → БЕЗ заключване (безплатно).
const http = require('http');
const path = require('path');
const fs = require('fs');
const { WebSocketServer } = require('ws');

// ⚠ ПОТВЪРДИ/СМЕНИ:
const CONFIG = {
  PAYPAL_EMAIL: 'miroljubkalaydjiev@gmail.com',
  CONTACT_EMAIL: 'kalaydzhievvaleri@gmail.com',   // поща за връзка/проблеми (регистрации)
  // Цена по регион (еднократно за уеб-страницата след безплатните отваряния):
  PRICE: '5 € (Европа) · 5 € в рубли (Русия) · 5 $ (останалият свят)',
  FREE_OPENS: 2,                       // безплатни отваряния на страницата от едно IP
  OWNER_CODE: 'PUPIKES-FREE-2026',     // специален код → безплатно
};
const PORT = parseInt(process.env.PORT || '3015', 10);
const WEB = path.join(__dirname, '..', 'web');
const DATA = path.join(__dirname, 'data'); try { fs.mkdirSync(DATA, { recursive: true }); } catch (_) {}
const OPENS = path.join(DATA, 'opens.json');        // { ip: брой отваряния }
const ACTIVE = path.join(DATA, 'activated.json');   // { ip: {key,txn,sender,date,method} }
const LIC = path.join(DATA, 'licenses.json');       // { "txn|sender": {txn,sender,firstDate,seenIps:[]} } — само за запис/одит
// Едно плащане (транзакция+име) = ЕДИН лиценз. Ограничението е МОМЕНТНО: в даден момент лицензът може
// да има само ЕДНА активна двойка (ip1↔ip2). Щом трансферът приключи/разкачи се — после може от друго
// място (ip3↔ip4, ip2↔ip4…). НЕ може само ЕДНОВРЕМЕННО две двойки на едно плащане. Owner е освободен.
const normKey = (txn, sender) => (String(txn || '').trim().toLowerCase() + '|' + String(sender || '').trim().toLowerCase());

const load = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_) { return {}; } };
const load2 = (f) => { try { const a = JSON.parse(fs.readFileSync(f, 'utf8')); return Array.isArray(a) ? a : []; } catch (_) { return []; } };
const save = (f, o) => { try { fs.writeFileSync(f, JSON.stringify(o, null, 2)); } catch (_) {} };
const ipOf = (req) => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || (req.socket.remoteAddress || '').replace(/^::ffff:/, '') || 'unknown';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8' };

function serveFile(res, file) {
  fs.readFile(file, (e, buf) => {
    if (e) { res.writeHead(404); res.end('404'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}
function body(req) { return new Promise((r) => { let b = ''; req.on('data', (d) => b += d); req.on('end', () => { try { r(JSON.parse(b || '{}')); } catch (_) { r({}); } }); }); }

// ── МОМЕНТНО (ЧАСОВО) ЗАКЛЮЧВАНЕ ПО ДВОЙКА IP ─────────────────────────────────
// Едно плащане (лиценз) може да има само ЕДНА активна двойка в рамките на 1 ЧАС.
// Първата двойка, която ползва лиценза, го „държи" 60 минути; друга двойка през това време → отказ.
// След часа лицензът е свободен — следваща двойка (ip3↔ip4, ip2↔ip4…) може да го поеме за нов час.
// Така „1 купува, 1000 ползват" е невъзможно, но човекът пак може да се връзва от различни места във времето.
const LOCK_MS = 60 * 60 * 1000;   // 1 час
const licenseKeyForIp = (ip) => { const a = load(ACTIVE)[ip]; return (a && a.method !== 'owner' && a.key) ? a.key : null; };
function checkPair(ipA, ipB) {
  if (!ipA || !ipB || ipA === 'unknown' || ipB === 'unknown') return { ok: true };
  const act = load(ACTIVE);
  if ((act[ipA] && act[ipA].method === 'owner') || (act[ipB] && act[ipB].method === 'owner')) return { ok: true };  // owner свободно
  const key = licenseKeyForIp(ipA) || licenseKeyForIp(ipB);
  if (!key) return { ok: true };   // нито една машина не е платена → безплатен слой, без заключване
  const now = Date.now();
  const lic = load(LIC); const L = lic[key] || {};
  const active = L.windowStart && (now - L.windowStart) < LOCK_MS;   // има ли жив 1-часов прозорец
  if (active) {
    const s = new Set(L.pairIps || []);
    if (s.has(ipA) && s.has(ipB)) return { ok: true };   // СЪЩАТА двойка в прозореца → разрешено
    const mins = Math.ceil((LOCK_MS - (now - L.windowStart)) / 60000);
    return { ok: false, error: 'pair-busy', mins };       // друга двойка държи плащането → изчакай ~mins мин.
  }
  // Няма жив прозорец (или е изтекъл) → тази двойка поема лиценза за нов 1 час.
  L.windowStart = now; L.pairIps = [ipA, ipB];
  const seen = new Set(L.seenIps || []); seen.add(ipA); seen.add(ipB); L.seenIps = Array.from(seen).slice(-20);
  lic[key] = L; save(LIC, lic);
  return { ok: true };
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'); const p = u.pathname;
  const ip = ipOf(req);

  if (p === '/health') { res.writeHead(200); res.end('ok'); return; }

  if (p === '/api/status') {
    const opens = load(OPENS), act = load(ACTIVE);
    res.writeHead(200, { 'content-type': MIME['.json'] });
    res.end(JSON.stringify({ opens: opens[ip] || 0, free: CONFIG.FREE_OPENS, activated: !!act[ip], price: CONFIG.PRICE, paypal: CONFIG.PAYPAL_EMAIL, contact: CONFIG.CONTACT_EMAIL }));
    return;
  }
  // Връзка/проблеми: потребителят описва проблема си → записваме за собственика (data/feedback.json).
  if (p === '/api/feedback' && req.method === 'POST') {
    const { message, email } = await body(req);
    const text = String(message || '').trim();
    if (!text) { res.writeHead(400, { 'content-type': MIME['.json'] }); res.end(JSON.stringify({ ok: false, error: 'опиши проблема' })); return; }
    const F = path.join(DATA, 'feedback.json'); const list = load2(F);
    list.push({ date: new Date().toISOString(), ip, email: String(email || '').trim().slice(0, 120), message: text.slice(0, 4000) });
    try { fs.writeFileSync(F, JSON.stringify(list, null, 2)); } catch (_) {}
    res.writeHead(200, { 'content-type': MIME['.json'] }); res.end(JSON.stringify({ ok: true, contact: CONFIG.CONTACT_EMAIL })); return;
  }
  if (p === '/api/activate' && req.method === 'POST') {
    const { txn, sender } = await body(req);
    if (!txn || !sender) { res.writeHead(400, { 'content-type': MIME['.json'] }); res.end(JSON.stringify({ ok: false, error: 'въведи номер на транзакцията и име на изпращача' })); return; }
    const key = normKey(txn, sender);
    // Активацията отключва страницата за това IP и записва лиценза. НЕ блокира по IP —
    // реалното ограничение е часовото заключване по двойка (checkPair) при самия трансфер.
    const lic = load(LIC); const existing = lic[key];
    if (!existing) lic[key] = { txn: String(txn).trim(), sender: String(sender).trim(), firstDate: new Date().toISOString(), seenIps: [] };
    save(LIC, lic);
    const act = load(ACTIVE); act[ip] = { key, txn: String(txn).trim(), sender: String(sender).trim(), date: new Date().toISOString(), method: 'paid' }; save(ACTIVE, act);
    res.writeHead(200, { 'content-type': MIME['.json'] }); res.end(JSON.stringify({ ok: true })); return;
  }
  if (p === '/api/redeem' && req.method === 'POST') {
    const { code } = await body(req);
    if (String(code || '').trim() !== CONFIG.OWNER_CODE) { res.writeHead(200, { 'content-type': MIME['.json'] }); res.end(JSON.stringify({ ok: false, error: 'грешен код' })); return; }
    const act = load(ACTIVE); act[ip] = { method: 'owner', date: new Date().toISOString() }; save(ACTIVE, act);
    res.writeHead(200, { 'content-type': MIME['.json'] }); res.end(JSON.stringify({ ok: true })); return;
  }

  // статични файлове на приложението (app.js и пр.) — без заключване
  if (p !== '/' && p !== '/index.html') {
    const f = path.join(WEB, p.replace(/^\/+/, '').replace(/\.\./g, ''));
    if (f.startsWith(WEB) && fs.existsSync(f)) { serveFile(res, f); return; }
    res.writeHead(404); res.end('404'); return;
  }

  // ГЛАВНА страница: брои отваряне по IP; след FREE_OPENS → заключващ екран (освен ако е активирано)
  const opens = load(OPENS); opens[ip] = (opens[ip] || 0) + 1; save(OPENS, opens);
  const act = load(ACTIVE);
  const locked = !act[ip] && opens[ip] > CONFIG.FREE_OPENS;
  serveFile(res, path.join(WEB, locked ? 'paywall.html' : 'index.html'));
});

// ── signaling по 6-цифрен код ──
const peers = new Map();              // code → ws (sender)
const codeOf = new Map();
const wss = new WebSocketServer({ server });
const send = (ws, o) => { try { ws.send(JSON.stringify(o)); } catch (_) {} };
wss.on('connection', (ws, req) => {
  ws._ip = ipOf(req);                                  // IP на тази машина (зад nginx идва от X-Forwarded-For)
  ws.on('message', (buf) => {
    let m; try { m = JSON.parse(buf.toString()); } catch (_) { return; }
    if (m.type === 'hello' && m.id) {                 // sender регистрира кода си
      peers.set(m.id, ws); codeOf.set(ws, m.id); send(ws, { type: 'hello-ok', id: m.id }); return;
    }
    if (m.type === 'signal' && m.to) {                // релей към другия по код
      const dst = peers.get(m.to);
      if (!dst) { send(ws, { type: 'error', error: 'code-not-found', to: m.to }); return; }
      // ЗАКЛЮЧВАНЕ ПО ДВОЙКА IP: едно плащане = точно една двойка (ip1↔ip2). Трета машина/втора двойка → отказ.
      const chk = checkPair(ws._ip, dst._ip);
      if (!chk.ok) { const e = { type: 'error', error: chk.error, mins: chk.mins }; send(ws, e); send(dst, e); return; }
      send(dst, { type: 'signal', from: codeOf.get(ws) || null, data: m.data });
      return;
    }
  });
  ws.on('close', () => { const c = codeOf.get(ws); if (c && peers.get(c) === ws) peers.delete(c); codeOf.delete(ws); });
  ws.on('error', () => {});
});

server.listen(PORT, () => console.log('PupikesSendTo слуша на :' + PORT));
