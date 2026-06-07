// Version: 1.0193
// Find Best Price — мобилна конфигурация. Приложението НЯМА своя база — ползва
// сървърното API /api/fbp (същото като уеб). Засега бекендът е на главния домейн;
// при свой домейн смени само API_BASE.
export const API_BASE = 'https://take.offbitch.com';

export const CATS = [
  { id: 'food', ic: '🍎' }, { id: 'building', ic: '🧱' }, { id: 'autoparts', ic: '🔧' }, { id: 'toys', ic: '🧸' },
  { id: 'clothes', ic: '👕' }, { id: 'bicycles', ic: '🚲' }, { id: 'furniture', ic: '🛋️' }, { id: 'computers', ic: '💻' },
  { id: 'antiques', ic: '🏺' }, { id: 'machinery', ic: '🚜' }, { id: 'drones', ic: '🛸' }, { id: 'robots', ic: '🤖' },
];
export const BTYPES = ['factory', 'shop', 'stall', 'reseller', 'online'];
export const QUALITIES = ['new', 'used', 'refurbished', 'premium', 'standard', 'economy'];

// Помощник за заявки към API (cookie сесията се пази от нативния fetch на устройството).
export async function api(path, opts = {}) {
  opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
  const r = await fetch(API_BASE + '/api/fbp' + path, opts);
  let body = null; try { body = await r.json(); } catch (e) {}
  return { status: r.status, ok: r.ok, body: body || {} };
}
