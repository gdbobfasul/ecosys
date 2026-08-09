// channels/messenger.js — Facebook Messenger Platform (Graph API).
// Webhook verify (GET) + приемане (POST) + изпращане. БЕЗПЛАТНО (страница + app).
import { config } from '../config.js';

const C = () => config.messenger;

export function verify(query) {
  const c = C();
  if (query['hub.mode'] === 'subscribe' && query['hub.verify_token'] === c.verifyToken) {
    return { ok: true, challenge: query['hub.challenge'] || '' };
  }
  return { ok: false };
}

// Връща [{ from, text }] от messaging събитията.
export function parseIncoming(body) {
  const out = [];
  try {
    if (body.object !== 'page') return out;
    for (const entry of body.entry || []) {
      for (const ev of entry.messaging || []) {
        if (ev.message && ev.message.text && !ev.message.is_echo) {
          out.push({ from: ev.sender.id, text: ev.message.text });
        }
      }
    }
  } catch (_) { /* игнор */ }
  return out;
}

export async function send(recipientId, text) {
  const c = C();
  if (!c.enabled) throw new Error('messenger disabled');
  const url = `https://graph.facebook.com/${c.graphVersion}/me/messages?access_token=${encodeURIComponent(c.pageToken)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: { id: recipientId }, messaging_type: 'RESPONSE', message: { text } })
  });
  if (!res.ok) throw new Error(`Messenger send ${res.status}: ${await res.text()}`);
  return res.json();
}
