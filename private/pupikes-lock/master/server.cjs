/* Pupikes-Lock — сървърът на мастера (чист, без Electron, за да е тестваем headless).
 * Слуша за клиентски агенти, пази съответствие код→пореден№, препредава команди. */
'use strict';
const { WebSocketServer } = require('ws');

class LockServer {
  /* store = {nextSeq, clients:{[code]:{seq,name,host}}}; saveStore() записва на диска;
     onChange(kind, data) се вика при промяна ('list') или грешка ('error'). */
  constructor({ store, saveStore, onChange } = {}) {
    this.store = store || { nextSeq: 1, clients: {} };
    this.store.clients = this.store.clients || {};
    this.store.nextSeq = this.store.nextSeq || 1;
    this.saveStore = saveStore || (() => {});
    this.onChange = onChange || (() => {});
    this.live = new Map();                 // code -> {ws, host, online, status, remainingSec}
    this.wss = null;
  }

  start(port) {
    this.wss = new WebSocketServer({ port });
    this.wss.on('connection', ws => this._onConn(ws));
    this.wss.on('error', e => this.onChange('error', String(e.message || e)));
    return this;
  }
  stop() { try { this.wss && this.wss.close(); } catch {} }

  _onConn(ws) {
    let code = null;
    ws.on('message', buf => {
      let m; try { m = JSON.parse(buf); } catch { return; }
      if (m.type === 'hello') {
        code = String(m.code || '').trim(); if (!code) return;
        if (!this.store.clients[code]) { const seq = this.store.nextSeq++; this.store.clients[code] = { seq, name: String(seq), host: m.host || '' }; this.saveStore(); }
        const c = this.store.clients[code]; if (m.host) { c.host = m.host; this.saveStore(); }
        this.live.set(code, { ws, host: m.host || c.host || '', online: true, status: m.status || 'waiting', remainingSec: (m.remainingSec ?? null) });
        this._send(code, { type: 'welcome', code, seq: c.seq, name: c.name });
        this.onChange('list');
      } else if (m.type === 'status' && code) {
        const l = this.live.get(code) || { ws, online: true };
        l.online = true; l.status = m.status; l.remainingSec = m.remainingSec; if (m.host) l.host = m.host; l.ws = ws;
        this.live.set(code, l); this.onChange('list');
      }
    });
    ws.on('close', () => { if (code) { const l = this.live.get(code); if (l) { l.online = false; l.status = 'offline'; } this.onChange('list'); } });
    ws.on('error', () => {});
  }

  _send(code, msg) { const l = this.live.get(code); try { if (l && l.ws && l.ws.readyState === 1) l.ws.send(JSON.stringify(msg)); } catch {} }

  list() {
    return Object.entries(this.store.clients).map(([code, c]) => {
      const l = this.live.get(code) || {};
      return { code, seq: c.seq, name: c.name, host: l.host || c.host || '',
               online: !!l.online, status: l.online ? (l.status || 'waiting') : 'offline',
               remainingSec: (l.remainingSec == null ? null : l.remainingSec) };
    }).sort((a, b) => (Number(a.seq) || 0) - (Number(b.seq) || 0));
  }

  cmd({ action, code, value }) {
    const c = this.store.clients[code];
    if (!c && action !== 'forget') return;
    if (action === 'rename') {
      c.seq = value; c.name = String(value); this.saveStore();
      this._send(code, { type: 'welcome', code, seq: c.seq, name: c.name });
      this._send(code, { type: 'rename', seq: c.seq, name: c.name });
      this.onChange('list');
    } else if (action === 'hours') { this._send(code, { type: 'grant', hours: Math.max(0, Math.floor(Number(value) || 0)) }); }
    else if (action === 'lock') { this._send(code, { type: 'lock' }); }
    else if (action === 'unlock') { this._send(code, { type: 'unlock' }); }
    else if (action === 'forget') { delete this.store.clients[code]; this.live.delete(code); this.saveStore(); this.onChange('list'); }
  }
}

module.exports = { LockServer };
