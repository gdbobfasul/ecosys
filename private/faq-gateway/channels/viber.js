// channels/viber.js — Viber Bot (Public Account REST API). БЕЗПЛАТНО.
// Viber праща всички събития като POST. Нас ни интересува event === 'message'.
// Изпращане: POST /pa/send_message с хедър X-Viber-Auth-Token.
import { config } from '../config.js';

const C = () => config.viber;
const API = 'https://chatapi.viber.com/pa';

// Връща [{ from, text }] само за текстови съобщения.
export function parseIncoming(body) {
  const out = [];
  try {
    if (body.event === 'message' && body.message && body.message.type === 'text') {
      out.push({ from: body.sender && body.sender.id, text: body.message.text || '' });
    }
  } catch (_) { /* игнор */ }
  return out;
}

export async function send(receiver, text) {
  const c = C();
  if (!c.enabled) throw new Error('viber disabled');
  const res = await fetch(`${API}/send_message`, {
    method: 'POST',
    headers: { 'X-Viber-Auth-Token': c.token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      receiver, type: 'text', text,
      sender: { name: c.botName, ...(c.avatar ? { avatar: c.avatar } : {}) }
    })
  });
  const data = await res.json().catch(() => ({}));
  if (data.status !== 0) throw new Error(`Viber send status ${data.status}: ${data.status_message || ''}`);
  return data;
}

// Еднократна регистрация на webhook адреса пред Viber (извиква се от setup скрипт/ръчно).
export async function setWebhook(url) {
  const c = C();
  const res = await fetch(`${API}/set_webhook`, {
    method: 'POST',
    headers: { 'X-Viber-Auth-Token': c.token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, event_types: ['message', 'conversation_started'], send_name: true })
  });
  return res.json();
}
