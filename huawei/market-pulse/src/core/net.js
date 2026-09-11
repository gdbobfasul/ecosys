// Version: 1.0021
// net.js — четене на публични API БЕЗ ключове/акаунти. На телефона ползва CapacitorHttp (заобикаля
// CORS); в браузър — fetch. БЕЗ AbortController (той чупи CapacitorHttp) — таймаут през Promise.race.
// Relay резерв (Huawei 3.1 — тестват от Китай, където Yahoo/Binance/CoinGecko са блокирани):
// първо ПРЯКО, при грешка/таймаут → през нашия сървър (GET прокси с allowlist, private/relay).
const RELAY_BASE = 'https://pupikes.app/api/relay/get?url=';
export async function httpGetJson(url, timeoutMs = 9000) {
  try { return await httpGetJsonDirect(url, timeoutMs); }
  catch (e) { if (/pupikes\.app/.test(url)) throw e; return await httpGetJsonDirect(RELAY_BASE + encodeURIComponent(url), Math.max(timeoutMs, 15000)); }
}
async function httpGetJsonDirect(url, timeoutMs = 9000) {
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs));
  const load = (async () => {
    try {
      const CH = (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp) || window.CapacitorHttp;
      if (CH && CH.get) {
        const r = await CH.get({ url, headers: { accept: 'application/json' } });
        return typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
      }
    } catch (e) { /* пада към fetch */ }
    const r = await fetch(url, { headers: { accept: 'application/json' }, cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  })();
  return Promise.race([load, timeout]);
}

// Тегли ТЕКСТ (напр. RSS на новините) — пак CapacitorHttp на телефон, fetch в браузър, без AbortController.
// 1.0021: и текстът минава през relay резервата (Google News RSS е блокиран в Китай).
export async function httpGetText(url, timeoutMs = 9000) {
  try { return await httpGetTextDirect(url, timeoutMs); }
  catch (e) { if (/pupikes\.app/.test(url)) throw e; return await httpGetTextDirect(RELAY_BASE + encodeURIComponent(url), Math.max(timeoutMs, 15000)); }
}
async function httpGetTextDirect(url, timeoutMs = 9000) {
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs));
  const load = (async () => {
    try {
      const CH = (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp) || window.CapacitorHttp;
      if (CH && CH.get) {
        const r = await CH.get({ url, headers: { accept: 'text/plain,text/csv,*/*' } });
        return typeof r.data === 'string' ? r.data : JSON.stringify(r.data);
      }
    } catch (e) { /* пада към fetch */ }
    const r = await fetch(url, { headers: { accept: 'text/csv,*/*' }, cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.text();
  })();
  return Promise.race([load, timeout]);
}
