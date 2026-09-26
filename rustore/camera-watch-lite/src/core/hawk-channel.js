// Version: 1.0021
// hawk-channel.js — шифрован канал между двата сдвоени телефона през релея:
//   POST {relay}/api/watch/msg/{pairId}   {seq, blob}
//   GET  {relay}/api/watch/msg/{pairId}?since=ID
//
// Пакетът се шифрова ТУК (hawk-crypto.js) преди да тръгне; сървърът вижда само хеш на кода
// и непрозрачни низове, пази ги в паметта до 24 ч. и не може да ги чете.
// Съдържание на пакета (след разшифроване): { from: 'wearer'|'guardian', type, payload, ts, seq }.
//
// Изходяща опашка: ако няма мрежа, пакетите чакат (до OUTBOX_MAX) и се пращат при следващия опит.

import { encryptJson, decryptJson, pairId, cryptoAvailable } from './hawk-crypto.js';
import { getHawkCfg, getSince, setSince } from './hawk-store.js';

const OUTBOX_MAX = 120;
let _seq = 0;
let _outbox = [];       // [{ seq, blob }]
let _flushing = false;
let _pairIdCache = { code: '', id: '' };

async function endpoint() {
  const c = getHawkCfg();
  if (!c.code || !c.relayBase) return null;
  if (_pairIdCache.code !== c.code) _pairIdCache = { code: c.code, id: await pairId(c.code) };
  return `${c.relayBase}/api/watch/msg/${_pairIdCache.id}`;
}

export function channelAvailable() { return cryptoAvailable(); }

// Шифрова и нарежда пакет за изпращане; веднага опитва да го достави.
// Връща { ok, queued } — ok=true означава ДОСТАВЕН; queued=true — чака мрежа.
export async function sendPacket(type, payload) {
  const c = getHawkCfg();
  if (!c.code) return { ok: false, reason: 'not-configured' };
  const seq = ++_seq + Date.now();
  let blob;
  try { blob = await encryptJson(c.code, { from: c.role, type, payload: payload || {}, ts: Date.now(), seq }); }
  catch (e) { return { ok: false, reason: String(e && e.message || e) }; }
  _outbox.push({ seq, blob });
  if (_outbox.length > OUTBOX_MAX) _outbox = _outbox.slice(_outbox.length - OUTBOX_MAX);
  const r = await flush();
  return { ok: r.ok && _outbox.length === 0, queued: _outbox.length > 0, reason: r.reason };
}

export function pendingCount() { return _outbox.length; }

// Праща каквото чака в опашката (по ред). Спира при първата грешка (пази реда).
export async function flush() {
  if (_flushing) return { ok: true };
  _flushing = true;
  try {
    const url = await endpoint();
    if (!url) return { ok: false, reason: 'not-configured' };
    while (_outbox.length) {
      const it = _outbox[0];
      let r;
      try {
        r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seq: it.seq, blob: it.blob }) });
      } catch (e) { return { ok: false, reason: String(e && e.message || e) }; }
      if (r.status === 400) { _outbox.shift(); continue; } // повреден пакет — не блокирай опашката
      if (!r.ok) return { ok: false, reason: 'http ' + r.status };
      _outbox.shift();
    }
    return { ok: true };
  } finally { _flushing = false; }
}

// Тегли новите пакети от другия телефон, разшифрова ги и мести курсора.
// Връща { ok, packets: [{type, payload, ts, from}], reason }.
export async function pullPackets() {
  const c = getHawkCfg();
  const url = await endpoint();
  if (!url) return { ok: false, packets: [], reason: 'not-configured' };
  let d;
  try {
    const r = await fetch(url + '?since=' + getSince(), { headers: { Accept: 'application/json' } });
    if (!r.ok) return { ok: false, packets: [], reason: 'http ' + r.status };
    d = await r.json();
  } catch (e) { return { ok: false, packets: [], reason: String(e && e.message || e) }; }
  const out = [];
  const list = Array.isArray(d.packets) ? d.packets : [];
  for (const p of list) {
    const obj = await decryptJson(c.code, p.blob);
    if (obj && obj.from && obj.from !== c.role && obj.type) out.push({ type: obj.type, payload: obj.payload || {}, ts: obj.ts || p.ts, from: obj.from, id: p.id });
  }
  if (Number.isFinite(Number(d.last)) && Number(d.last) > getSince()) setSince(Number(d.last));
  // Пътьом доставяме и чакащите изходящи.
  if (_outbox.length) flush().catch(() => {});
  return { ok: true, packets: out };
}

// Лека проверка на връзката (само GET без местене на курсора).
export async function checkChannel() {
  const url = await endpoint();
  if (!url) return { ok: false, reason: 'not-configured' };
  try {
    const r = await fetch(url + '?since=999999999999', { headers: { Accept: 'application/json' } });
    return { ok: r.ok, reason: r.ok ? '' : 'http ' + r.status };
  } catch (e) { return { ok: false, reason: String(e && e.message || e) }; }
}
