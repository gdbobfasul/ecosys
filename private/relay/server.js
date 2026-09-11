// Version: 1.0001
// Pupikes Relay — лек GET-прокси за публичните безплатни API-та, които мобилните апове ползват
// (Yahoo Finance, Binance, CoinGecko, Google News RSS, Open-Meteo, курсове, MyMemory…).
//
// ЗАЩО: Huawei AppGallery тества апа от КИТАЙ (правило 3.1 „да работи в регионите на публикуване"):
// там Yahoo/Google/Binance са блокирани → „Няма данни". Апът пробва първо ДИРЕКТНО, а при грешка
// минава през този relay на нашия сървър (който е достъпен отвсякъде).
//
// Маршрути:
//   GET /api/relay/health              → {ok, service, hosts}
//   GET /api/relay/get?url=<encoded>   → тялото на отдалечения GET (JSON/XML/текст), със същия Content-Type
//
// Защити: allowlist на хостове (само публични API-та, БЕЗ произволни адреси), само GET, таймаут,
// лимит на размера (5 MB), лимит заявки/IP, кеш 60 с в паметта (щади лимитите на безплатните API-та).
// Node stdlib само (http + https + global fetch, Node 18+), без зависимости, без БД, без лични данни.
const http = require('http');

const PORT = parseInt(process.env.RELAY_PORT || process.env.PORT || '3014', 10);
const TIMEOUT_MS = parseInt(process.env.RELAY_TIMEOUT_MS || '20000', 10);
const MAX_BYTES = parseInt(process.env.RELAY_MAX_BYTES || String(5 * 1024 * 1024), 10);
const CACHE_MS = parseInt(process.env.RELAY_CACHE_MS || '60000', 10);
const RL_WINDOW_MS = 60000, RL_MAX = parseInt(process.env.RELAY_RL_MAX || '240', 10);

// Разрешени хостове (точно име или суфикс „.домейн").
const ALLOW = [
  'query1.finance.yahoo.com', 'query2.finance.yahoo.com',
  'api.binance.com', 'fapi.binance.com', 'data-api.binance.vision',
  'api.coingecko.com', 'api.alternative.me', 'api.coinpaprika.com',
  'news.google.com', 'www.google.com',
  'api.open-meteo.com', 'open.er-api.com', 'api.frankfurter.app', 'api.exchangerate.host',
  'api.mymemory.translated.net',
  'text.pollinations.ai',
  'bbc.com',
  'weather.com',
  'example.org',   // примерните сайтове на Site Monitor (11.09.2026)   // Toolkit AI Announcement (Huawei 3.1 от Китай, 11.09.2026)
  'api.certspotter.com', 'crt.sh',
  'hnrss.org', 'www.reddit.com', 'rsshub.app', 'www.youtube.com', 'github.com',
  'api.fda.gov', 'rxnav.nlm.nih.gov', 'en.wikipedia.org',
  'feeds.bbci.co.uk', 'rss.dw.com', 'www.aljazeera.com', 'rss.nytimes.com', 'feeds.reuters.com',
  'stooq.com', 'stooq.pl',
  'html.duckduckgo.com', 'lite.duckduckgo.com', 'duckduckgo.com', 'api.pwnedpasswords.com'
];
function hostAllowed(h) {
  h = String(h || '').toLowerCase();
  return ALLOW.some((a) => h === a || h.endsWith('.' + a.replace(/^www\./, '')));
}

const cache = new Map();   // key → { at, status, type, body }
const rl = new Map();      // ip → { at, n }
function limited(ip) {
  const now = Date.now(); let e = rl.get(ip);
  if (!e || now - e.at > RL_WINDOW_MS) { e = { at: now, n: 0 }; rl.set(ip, e); }
  e.n++; return e.n > RL_MAX;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of cache) if (now - v.at > CACHE_MS * 5) cache.delete(k); for (const [k, v] of rl) if (now - v.at > RL_WINDOW_MS * 2) rl.delete(k); }, 60000).unref();

function send(res, status, type, body, extra) {
  res.writeHead(status, Object.assign({
    'Content-Type': type, 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'
  }, extra || {}));
  res.end(body);
}
function json(res, status, obj) { send(res, status, 'application/json; charset=utf-8', JSON.stringify(obj)); }

async function relayGet(target, accept) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(target, {
      signal: ctl.signal, redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 12) PupikesRelay/1.0', 'Accept': accept || '*/*', 'Accept-Language': 'en' }
    });
    const type = r.headers.get('content-type') || 'application/octet-stream';
    const len = parseInt(r.headers.get('content-length') || '0', 10);
    if (len > MAX_BYTES) return { status: 413, type: 'text/plain', body: 'too large' };
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > MAX_BYTES) return { status: 413, type: 'text/plain', body: 'too large' };
    return { status: r.status, type, body: buf };
  } finally { clearTimeout(t); }
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const p = u.pathname.replace(/\/+$/, '') || '/';
  if (req.method === 'OPTIONS') return send(res, 204, 'text/plain', '', { 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Accept, Content-Type' });
  if (p === '/api/relay/health' || p === '/health') return json(res, 200, { ok: true, service: 'pupikes-relay', hosts: ALLOW.length, cacheMs: CACHE_MS });
  if (p !== '/api/relay/get' && p !== '/get') return json(res, 404, { ok: false, error: 'not found' });
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'GET only' });
  const ip = (req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();
  if (limited(ip)) return json(res, 429, { ok: false, error: 'rate limited' });
  let target;
  try { target = new URL(u.searchParams.get('url') || ''); } catch (_) { return json(res, 400, { ok: false, error: 'bad url' }); }
  if (!/^https?:$/.test(target.protocol)) return json(res, 400, { ok: false, error: 'http(s) only' });
  if (!hostAllowed(target.hostname)) return json(res, 403, { ok: false, error: 'host not allowed', host: target.hostname });
  const key = target.href;
  const c = cache.get(key);
  if (c && Date.now() - c.at < CACHE_MS) return send(res, c.status, c.type, c.body, { 'X-Relay-Cache': 'hit' });
  try {
    const r = await relayGet(key, req.headers.accept);
    if (r.status >= 200 && r.status < 300) cache.set(key, { at: Date.now(), status: r.status, type: r.type, body: r.body });
    return send(res, r.status, r.type, r.body, { 'X-Relay-Cache': 'miss' });
  } catch (e) {
    return json(res, 502, { ok: false, error: (e && e.name === 'AbortError') ? 'timeout' : 'upstream ' + (e && e.message || e) });
  }
});
server.listen(PORT, '127.0.0.1', () => console.log('[relay] listening on 127.0.0.1:' + PORT + ' (' + ALLOW.length + ' allowed hosts)'));
process.on('unhandledRejection', (r) => console.error('[relay] unhandledRejection', r));
process.on('uncaughtException', (e) => console.error('[relay] uncaughtException', e));
