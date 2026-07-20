// util.cjs — общи помощни функции за робота за публикуване.
const dns = require('dns').promises;
const path = require('path');
const whois = require('./whois.cjs');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

// Зарежда Playwright от съседния тест-робот (за да не дублираме node_modules).
function loadPlaywright() {
  const tries = [
    path.join(__dirname, '..', '..', 'bug-bot', 'node_modules', 'playwright'),
    path.join(__dirname, '..', 'node_modules', 'playwright'),
    'playwright'
  ];
  for (const p of tries) { try { return require(p); } catch (_) {} }
  throw new Error('Playwright липсва. Очаквах го в private/bug-bot/node_modules.');
}

// Билднатият Playwright Chromium може да липсва (обновена Playwright версия без
// `playwright install`) → резерва: инсталираният Chrome, после Edge (същият двигател).
async function launchChromium(pw) {
  let err;
  for (const opt of [{}, { channel: 'chrome' }, { channel: 'msedge' }]) {
    try { return await pw.chromium.launch(opt); } catch (e) { err = e; }
  }
  throw err;
}

// fetch с таймаут и браузърен User-Agent. Връща { ok, status, text }.
async function fetchText(url, ms = 12000, extraHeaders = {}) {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': UA, ...extraHeaders } });
    const text = await r.text();
    return { ok: r.ok, status: r.status, text };
  } catch (e) {
    return { ok: false, status: 0, text: '', error: String(e.message || e) };
  } finally { clearTimeout(to); }
}

async function fetchJson(url, ms = 12000) {
  const r = await fetchText(url, ms, { Accept: 'application/json' });
  if (!r.text) return null;
  try { return JSON.parse(r.text); } catch (_) { return null; }
}

// Резолвва ли домейнът в DNS (A или NS)?
async function anyDns(domain) {
  try { const a = await dns.resolve(domain); if (a && a.length) return true; } catch (_) {}
  try { const ns = await dns.resolveNs(domain); if (ns && ns.length) return true; } catch (_) {}
  return false;
}

// Статус на домейн: 'taken' | 'free' | 'unknown' (+ метод).
// АВТОРИТЕТНО: RDAP (регистрационната база) — 2xx = регистриран, 404 = няма запис.
// Понеже 404 от rdap.org при ccTLD без RDAP поддръжка е двусмислен, потвърждаваме „свободен“
// само ако и DNS не резолвва (иначе е зает). Ако RDAP мълчи → DNS резерва → иначе 'unknown'.
async function domainStatus(domain) {
  let rdap = null;
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 12000);
  try {
    const r = await fetch('https://rdap.org/domain/' + domain, { signal: ctl.signal, headers: { Accept: 'application/json' } });
    if (r.status >= 200 && r.status < 300) rdap = 'taken';
    else if (r.status === 404) rdap = 'free';
  } catch (_) { /* мрежа/таймаут */ } finally { clearTimeout(to); }
  if (rdap === 'taken') return { status: 'taken', method: 'RDAP' };
  const dnsHit = await anyDns(domain);
  if (rdap === 'free') return dnsHit ? { status: 'taken', method: 'DNS' } : { status: 'free', method: 'RDAP' };
  if (dnsHit) return { status: 'taken', method: 'DNS' };
  // rdap.org не даде отговор и няма DNS → авторитетно през IANA RDAP bootstrap + WHOIS (порт 43),
  // за да покрием ccTLD/нови gTLD, които rdap.org пропуска.
  const deep = await whois.resolveUncertain(domain);
  if (deep) return deep;
  return { status: 'unknown', method: 'none' };
}

// Съвместимост: булев „зает ли е“.
async function domainTaken(domain) { return (await domainStatus(domain)).status === 'taken'; }

// Оглежда съдържанието на сайт: заглавие, описание, извадка текст (за разпознаване на ниша).
async function inspectDomain(domain) {
  for (const url of ['https://' + domain + '/', 'http://' + domain + '/']) {
    const r = await fetchText(url, 12000);
    if (r.text) {
      const grab = (re) => { const m = r.text.match(re); return m ? m[1].replace(/\s+/g, ' ').trim() : ''; };
      const title = grab(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const desc = grab(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) ||
                   grab(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i);
      const body = r.text
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ').trim();
      return { ok: !!(title || desc || body), status: r.status, title, desc, sample: body.slice(0, 240) };
    }
    if (r.status && r.status >= 400) return { ok: false, status: r.status, title: '', desc: '', sample: '' };
  }
  return { ok: false, status: 0, title: '', desc: '', sample: '' };
}

// Паралелен пул с ограничение (за да не залеем RDAP/сайтовете).
async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() { while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx], idx); } }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

// Търсене през DuckDuckGo HTML (без ключ). Връща [{ title, url }] (до limit).
async function ddg(query, limit = 6) {
  const url = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query);
  const r = await fetchText(url, 14000);
  if (!r.text) return [];
  const out = [];
  const re = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(r.text)) && out.length < limit) {
    let href = m[1];
    // DDG понякога обвива линка в редирект uddg=
    const u = href.match(/[?&]uddg=([^&]+)/);
    if (u) { try { href = decodeURIComponent(u[1]); } catch (_) {} }
    const title = m[2].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    out.push({ title, url: href });
  }
  return out;
}

// Apple App Store търсене (iTunes Search API — отворен, без ключ). entity=software.
async function appleSearch(term, country = 'us', limit = 12) {
  const url = 'https://itunes.apple.com/search?term=' + encodeURIComponent(term) +
    '&entity=software&limit=' + limit + '&country=' + country;
  const j = await fetchJson(url, 12000);
  if (!j || !Array.isArray(j.results)) return [];
  return j.results.map((r) => ({
    name: r.trackName, seller: r.sellerName, genre: r.primaryGenreName, url: r.trackViewUrl
  }));
}

function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ''); }

module.exports = { UA, loadPlaywright, launchChromium, fetchText, fetchJson, domainTaken, domainStatus, inspectDomain, anyDns, pool, ddg, appleSearch, norm };
