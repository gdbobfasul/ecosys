// Version: 1.0001
// pairing.js — сдвояване на ДВА телефона през релея (детегледачка ↔ наблюдаващ).
//
// Режими (role):
//   • 'solo'    — един телефон: гледа и сам си вдига алармата (по подразбиране).
//   • 'monitor' — „Детегледачка": до детето; гледа и ПРАЩА събития/кадри към релея.
//   • 'watcher' — „Наблюдаващ"/„Майка Тереза": при родителя; ПОЛВА релея и вдига известията.
//
// ЧЕСТНО: телефон не може да прати известие на друг телефон само on-device — затова
// минаваме през релея (HTTPS), сдвоени по ТАЕН КЛЮЧ ЗА ДВОЙКА. Bluetooth/WiFi-direct
// не стигат „далеч"; релеят работи на всяко разстояние (и двата телефона онлайн).
//
// Самостоятелен модул (пази си конфигурацията в localStorage) → еднакъв и за camera-watch.

const LS_KEY = 'watch.pairing.v1';
const DEFAULT_RELAY = 'https://selflearning.bot.nu';
const API = '/api/watch';

function read() { try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch (_) { return {}; } }
function write(cfg) { try { localStorage.setItem(LS_KEY, JSON.stringify(cfg)); } catch (_) {} }

export function getPairing() {
  const c = read();
  return {
    role: (c.role === 'monitor' || c.role === 'watcher') ? c.role : 'solo',
    pairKey: String(c.pairKey || '').trim(),
    relayBase: String(c.relayBase || DEFAULT_RELAY).trim().replace(/\/+$/, ''),
    sendFrames: c.sendFrames !== false,     // детегледачката праща и снимки (по избор)
    pollSeconds: Math.max(3, parseInt(c.pollSeconds, 10) || 6)
  };
}
export function setPairing(patch) { write({ ...read(), ...patch }); return getPairing(); }
export function pairingConfigured() { const p = getPairing(); return !!(p.pairKey && p.relayBase); }
export function isMonitor() { return getPairing().role === 'monitor'; }
export function isWatcher() { return getPairing().role === 'watcher'; }

// Генерира случаен ключ за двойка (за „новата" двойка).
export function generatePairKey() {
  const a = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(a);
  else for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
  return Array.from(a).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function urls() {
  const p = getPairing();
  const base = `${p.relayBase}${API}`;
  const k = encodeURIComponent(p.pairKey);
  return { alert: `${base}/alert/${k}`, frame: `${base}/frame/${k}` };
}

// --- Детегледачка (monitor) праща ---
export async function sendAlert(app, type, label) {
  if (!pairingConfigured()) return { ok: false, reason: 'not-configured' };
  try {
    const r = await fetch(urls().alert, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app, type, label })
    });
    return { ok: r.ok };
  } catch (e) { return { ok: false, reason: String(e && e.message || e) }; }
}

export async function sendFrame(dataurl, label) {
  if (!pairingConfigured() || !getPairing().sendFrames) return { ok: false, reason: 'skip' };
  if (!/^data:image\//.test(String(dataurl || ''))) return { ok: false, reason: 'no-frame' };
  try {
    const r = await fetch(urls().frame, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataurl, label })
    });
    return { ok: r.ok };
  } catch (e) { return { ok: false, reason: String(e && e.message || e) }; }
}

// --- Наблюдаващ (watcher) тегли ---
export async function pollAlerts({ ack = true } = {}) {
  if (!pairingConfigured()) return { ok: false, alerts: [] };
  try {
    const r = await fetch(urls().alert + (ack ? '?ack=1' : ''), { headers: { Accept: 'application/json' } });
    if (!r.ok) return { ok: false, alerts: [], reason: 'http ' + r.status };
    const d = await r.json();
    return { ok: true, alerts: Array.isArray(d.alerts) ? d.alerts : [] };
  } catch (e) { return { ok: false, alerts: [], reason: String(e && e.message || e) }; }
}

export async function getFrame() {
  if (!pairingConfigured()) return { ok: false };
  try {
    const r = await fetch(urls().frame, { headers: { Accept: 'application/json' } });
    if (!r.ok) return { ok: false };
    return await r.json(); // { ok, frame, label, updated_at }
  } catch (e) { return { ok: false, reason: String(e && e.message || e) }; }
}

// Лек тест на връзката (праща тестово събитие или просто полва).
export async function checkPairing() {
  if (!pairingConfigured()) return { ok: false, reason: 'not-configured' };
  const p = getPairing();
  if (p.role === 'monitor') return await sendAlert('test', 'test', 'Тест от детегледачката');
  const r = await pollAlerts({ ack: false });
  return { ok: r.ok, reason: r.reason };
}
