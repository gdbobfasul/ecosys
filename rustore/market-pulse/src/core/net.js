// Version: 1.0001
// net.js — четене на публични API БЕЗ ключове/акаунти. На телефона ползва CapacitorHttp (заобикаля
// CORS); в браузър — fetch. БЕЗ AbortController (той чупи CapacitorHttp) — таймаут през Promise.race.
export async function httpGetJson(url, timeoutMs = 9000) {
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

// Тегли ТЕКСТ (напр. CSV от Stooq) — пак CapacitorHttp на телефон, fetch в браузър, без AbortController.
export async function httpGetText(url, timeoutMs = 9000) {
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
