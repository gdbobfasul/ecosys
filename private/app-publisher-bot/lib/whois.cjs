// whois.cjs — покрива „несигурните" домейни, които rdap.org не резолвва:
//   1) IANA RDAP bootstrap (data.iana.org/rdap/dns.json) → авторитетен RDAP сървър за TLD-то.
//   2) WHOIS по порт 43 (за ccTLD без RDAP) — намира whois сървъра през whois.iana.org, после пита него.
// Връща 'taken' | 'free' | null (не можах да определя). Кешира bootstrap + whois-сървъри по TLD.
const net = require('net');

let _bootstrap = null;      // { tld: rdapBaseUrl }
const _whoisSrv = new Map(); // tld -> whois host

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

async function getBootstrap() {
  if (_bootstrap) return _bootstrap;
  _bootstrap = {};
  try {
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 12000);
    const r = await fetch('https://data.iana.org/rdap/dns.json', { signal: ctl.signal }); clearTimeout(to);
    const j = await r.json();
    for (const svc of (j.services || [])) {
      const tlds = svc[0] || []; const urls = svc[1] || [];
      let base = urls.find((u) => u.startsWith('https://')) || urls[0];
      if (!base) continue; if (!base.endsWith('/')) base += '/';
      for (const t of tlds) _bootstrap[t.toLowerCase()] = base;
    }
  } catch (_) { /* остава празен → пропускаме RDAP-bootstrap */ }
  return _bootstrap;
}

// Директна RDAP заявка към авторитетния сървър за TLD-то.
async function rdapViaBootstrap(domain) {
  const tld = domain.split('.').pop().toLowerCase();
  const bs = await getBootstrap();
  const base = bs[tld]; if (!base) return null;
  try {
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 12000);
    const r = await fetch(base + 'domain/' + encodeURIComponent(domain), { signal: ctl.signal, headers: { Accept: 'application/rdap+json', 'User-Agent': UA } });
    clearTimeout(to);
    if (r.status === 404) return 'free';
    if (r.status >= 200 && r.status < 300) return 'taken';
  } catch (_) {}
  return null;
}

// Един WHOIS въпрос по порт 43.
function whoisAsk(server, query, timeoutMs = 10000) {
  return new Promise((resolve) => {
    let data = ''; let done = false;
    const sock = net.connect(43, server);
    const finish = (v) => { if (!done) { done = true; try { sock.destroy(); } catch (_) {} resolve(v); } };
    sock.setTimeout(timeoutMs);
    sock.on('connect', () => { try { sock.write(query + '\r\n'); } catch (_) { finish(null); } });
    sock.on('data', (d) => { data += d.toString('utf8'); });
    sock.on('end', () => finish(data || null));
    sock.on('timeout', () => finish(data || null));
    sock.on('error', () => finish(null));
  });
}

// WHOIS сървър за TLD (през whois.iana.org). Кешира.
async function whoisServerFor(tld) {
  tld = tld.toLowerCase();
  if (_whoisSrv.has(tld)) return _whoisSrv.get(tld);
  let srv = null;
  const resp = await whoisAsk('whois.iana.org', tld);
  if (resp) { const m = resp.match(/whois:\s*(\S+)/i); if (m) srv = m[1].trim(); }
  _whoisSrv.set(tld, srv);
  return srv;
}

const FREE_RE = /(^|\n)\s*(no match|not found|no data found|no entries found|not registered|no object found|available for registration|domain (not|isn'?t) registered|status:\s*(available|free))/i;
const TAKEN_RE = /(^|\n)\s*(domain name:|registrar:|creation date:|created(\s+on)?:|registered on|registrant|holder|status:\s*(ok|active|client|server|connect|registered))/i;

// WHOIS статус на домейн.
async function whoisStatus(domain) {
  const tld = domain.split('.').pop();
  const srv = await whoisServerFor(tld); if (!srv) return null;
  const resp = await whoisAsk(srv, domain); if (!resp) return null;
  if (FREE_RE.test(resp)) return 'free';
  if (TAKEN_RE.test(resp)) return 'taken';
  return null;
}

// Комбиниран разрешител за „несигурен" домейн: bootstrap-RDAP → WHOIS. Връща 'taken'|'free'|null.
async function resolveUncertain(domain) {
  const viaR = await rdapViaBootstrap(domain);
  if (viaR) return { status: viaR, method: 'RDAP-iana' };
  const viaW = await whoisStatus(domain);
  if (viaW) return { status: viaW, method: 'WHOIS' };
  return null;
}

module.exports = { resolveUncertain, rdapViaBootstrap, whoisStatus, whoisServerFor };
