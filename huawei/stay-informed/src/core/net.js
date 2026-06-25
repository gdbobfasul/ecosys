// net.js — мрежов слой. С включен CapacitorHttp (виж capacitor.config.json) нативният
// слой пренаписва window.fetch и заявките тръгват ИЗВЪН WebView → заобикалят CORS (RSS
// емисиите и MyMemory нямат CORS заглавия). Затова тук ползваме обикновен fetch.
//
// ВАЖНО (научен урок от екосистемата): CapacitorHttp НЕ поддържа AbortController/signal —
// подаването му чупи заявката моментално. Затова таймаутът е през Promise.race с гол fetch,
// а не през AbortController.

// Таймаут без AbortController.
export function fetchTimeout(url, opts, ms) {
  return Promise.race([
    fetch(url, opts || {}),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms || 15000))
  ]);
}

// Тегли текст (RSS XML или JSON като текст). Връща низа или хвърля грешка.
export async function getText(url, ms) {
  const res = await fetchTimeout(url, { headers: { Accept: 'application/rss+xml, application/xml, text/xml, */*' } }, ms);
  if (!res || !res.ok) throw new Error('HTTP ' + (res ? res.status : '—'));
  return await res.text();
}

// Тегли JSON. Чете като текст и парсва ръчно (някои native слоеве дават текст вместо обект).
export async function getJson(url, ms) {
  const res = await fetchTimeout(url, { headers: { Accept: 'application/json, */*' } }, ms);
  if (!res || !res.ok) throw new Error('HTTP ' + (res ? res.status : '—'));
  const raw = await res.text();
  try { return JSON.parse(raw); } catch (e) { throw new Error('лош JSON'); }
}

// Има ли изобщо мрежа? (груба проверка през Capacitor, ако е наличен)
export function isOnline() {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') return navigator.onLine;
  } catch (_) {}
  return true;
}
