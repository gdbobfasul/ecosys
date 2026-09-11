// Version: 1.0025
// net.js — мрежов слой на „Pupikes Authenticator & Passwords". Единственото място, което говори с
// мрежата, е одитът за пробиви (HIBP k-анонимност: навън отиват САМО първите 5 знака от SHA-1 хеша).
// Тестерите на Huawei са в Китай → пряка заявка, а при грешка — през нашия relay
// (https://pupikes.app/api/relay/get?url=…). CapacitorHttp НЕ поддържа AbortController → таймаут
// през Promise.race (научен урок от екосистемата).

const RELAY_BASE = 'https://pupikes.app/api/relay/get?url=';

export function fetchTimeout(url, opts, ms) {
  return Promise.race([
    fetch(url, opts || {}),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms || 12000))
  ]);
}

async function getTextDirect(url, ms) {
  const res = await fetchTimeout(url, { headers: { Accept: 'text/plain, */*' } }, ms);
  if (!res || !res.ok) throw new Error('HTTP ' + (res ? res.status : '—'));
  return await res.text();
}

// Текст: пряко → при грешка през relay (освен ако адресът вече е наш).
export async function getText(url, ms) {
  try { return await getTextDirect(url, ms); }
  catch (e) {
    if (/pupikes\.app/.test(url)) throw e;
    return await getTextDirect(RELAY_BASE + encodeURIComponent(url), Math.max(ms || 12000, 15000));
  }
}

export function isOnline() {
  try { if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') return navigator.onLine; } catch (_) {}
  return true;
}
