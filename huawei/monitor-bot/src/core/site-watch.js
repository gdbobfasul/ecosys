// Version: 1.0026
// Обогатяване (Huawei 4.1) — проверки за новите табове:
//   • текст на сайт (таб 2), съвпадение на картинка по размер+байтове (таб 3), online/offline (таб 4).
// NA NATIVE: CapacitorHttp (заобикаля CORS за произволни сайтове); в браузър пада към fetch (може CORS).

function CH() { return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp) || window.CapacitorHttp || null; }
function withTimeout(promise, ms) { return Promise.race([promise, new Promise((r) => setTimeout(() => r({ __timeout: true }), ms || 15000))]); }

// ── Текст на страница (HTML) ──
export async function fetchText(url) {
  const ch = CH();
  if (ch && ch.get) {
    const r = await withTimeout(ch.get({ url, headers: { Accept: 'text/html,*/*' } }), 20000);
    if (r && !r.__timeout) return typeof r.data === 'string' ? r.data : (r.data != null ? String(r.data) : '');
  }
  const r = await withTimeout(fetch(url, { redirect: 'follow', headers: { Accept: 'text/html,*/*' } }).then((x) => x.text()), 20000);
  return (r && !r.__timeout) ? r : '';
}

// Видим текст от HTML (маха скриптове/стилове/тагове).
export function htmlToText(html) {
  if (!html) return '';
  let s = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ');
  s = s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  return s.replace(/\s+/g, ' ').trim();
}

// ТАБ 2: намира ли се фраза (текст) в сайта. caseSensitive по избор.
export async function checkTextOnSite(url, phrase, opts) {
  opts = opts || {};
  const html = await fetchText(url);
  if (!html) return { ok: false, error: 'fetch' };
  const hay = opts.raw ? html : htmlToText(html);
  const H = opts.caseSensitive ? hay : hay.toLowerCase();
  const N = opts.caseSensitive ? phrase : String(phrase || '').toLowerCase();
  return { ok: true, found: !!N && H.indexOf(N) >= 0 };
}

// ТАБ 4: online/offline (успешен отговор = online).
export async function checkUptime(url) {
  const ch = CH();
  try {
    if (ch && ch.get) {
      const r = await withTimeout(ch.get({ url, headers: { Accept: '*/*' } }), 15000);
      if (r && !r.__timeout) { const st = r.status || 0; return { ok: true, online: st >= 200 && st < 400, status: st }; }
      return { ok: true, online: false, status: 0 };
    }
    const r = await withTimeout(fetch(url, { redirect: 'follow' }), 15000);
    if (r && !r.__timeout) return { ok: true, online: r.ok || (r.status >= 200 && r.status < 400), status: r.status };
    return { ok: true, online: false, status: 0 };
  } catch (e) { return { ok: true, online: false, status: 0 }; }
}

// ── ТАБ 3: съвпадение на картинка (първо размер в байтове, после байт-по-байт) ──
// Взима байтовете на изображение (native: CapacitorHttp responseType base64/arraybuffer; браузър: fetch).
export async function fetchImageBytes(url) {
  const ch = CH();
  try {
    if (ch && ch.get) {
      const r = await withTimeout(ch.get({ url, responseType: 'arraybuffer' }), 20000);
      if (r && !r.__timeout && r.data != null) {
        if (r.data instanceof ArrayBuffer) return new Uint8Array(r.data);
        if (typeof r.data === 'string') return b64ToBytes(r.data); // base64
      }
    }
  } catch (e) { /* пада към fetch */ }
  try {
    const buf = await withTimeout(fetch(url).then((x) => x.arrayBuffer()), 20000);
    if (buf && !buf.__timeout) return new Uint8Array(buf);
  } catch (e) {}
  return null;
}
function b64ToBytes(b64) {
  try { const clean = b64.replace(/^data:[^,]*,/, ''); const bin = atob(clean); const a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a; } catch (e) { return null; }
}
function bytesEqual(a, b) { if (!a || !b || a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; }

// Извлича src-овете на всички <img> (+ srcset) от HTML, абсолютизирани спрямо base.
export function extractImageUrls(html, baseUrl) {
  const urls = new Set();
  const re = /<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi;
  let m; while ((m = re.exec(html))) urls.add(m[1]);
  const abs = [];
  for (const u of urls) { try { abs.push(new URL(u, baseUrl).href); } catch (e) {} }
  return abs;
}

// ТАБ 3: намира ли се в сайта картинка, ИДЕНТИЧНА (размер + всички байтове) на зададената.
// refBytes = Uint8Array на подадената картинка. maxImages — таван (за да не тегли безкрайно).
export async function checkImageOnSite(url, refBytes, opts) {
  opts = opts || {};
  if (!refBytes || !refBytes.length) return { ok: false, error: 'noref' };
  const html = await fetchText(url);
  if (!html) return { ok: false, error: 'fetch' };
  const imgs = extractImageUrls(html, url).slice(0, opts.maxImages || 60);
  const refLen = refBytes.length;
  for (const iu of imgs) {
    const bytes = await fetchImageBytes(iu);
    if (!bytes) continue;
    if (bytes.length !== refLen) continue;      // 1) първо размер в байтове
    if (bytesEqual(bytes, refBytes)) return { ok: true, found: true, matchedUrl: iu, scanned: imgs.length }; // 2) после байт-по-байт
  }
  return { ok: true, found: false, scanned: imgs.length };
}
