// channels/whatsapp.js — WhatsApp Cloud API (Meta Graph).
// Webhook verify (GET) + приемане на съобщения (POST) + изпращане на отговор.
// БЕЗПЛАТНО за тест: тестов номер от конзолата + безплатни service разговори.
import { config } from '../config.js';

const C = () => config.whatsapp;

// GET verify: Meta праща hub.mode/hub.verify_token/hub.challenge.
export function verify(query) {
  const c = C();
  if (query['hub.mode'] === 'subscribe' && query['hub.verify_token'] === c.verifyToken) {
    return { ok: true, challenge: query['hub.challenge'] || '' };
  }
  return { ok: false };
}

// Извлича входящите текстови съобщения от webhook payload.
// Връща [{ from, text, name }].
export function parseIncoming(body) {
  const out = [];
  try {
    for (const entry of body.entry || []) {
      for (const ch of entry.changes || []) {
        const v = ch.value || {};
        const contacts = v.contacts || [];
        for (const m of v.messages || []) {
          if (m.type !== 'text') continue; // отговаряме само на текст
          out.push({
            from: m.from,
            text: (m.text && m.text.body) || '',
            name: (contacts[0] && contacts[0].profile && contacts[0].profile.name) || ''
          });
        }
      }
    }
  } catch (_) { /* игнорираме малформиран payload */ }
  return out;
}

// Изпраща текстов отговор към даден номер.
export async function send(to, text) {
  const c = C();
  if (!c.enabled) throw new Error('whatsapp disabled');
  const url = `https://graph.facebook.com/${c.graphVersion}/${c.phoneId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } })
  });
  if (!res.ok) throw new Error(`WA send ${res.status}: ${await res.text()}`);
  return res.json();
}
