// Version: 1.0005
// ecosystem.js — екран „Още от KCY Ecosystem": плаващ бутон + showcase списък на ДРУГИТЕ
// приложения (снимка + ИМЕ + описание 15 езика + линк към приложението). Footer
// „KCY Ecosystem publisher 2026". БЕЗ изскачащи реклами (доброволен екран → минава правилата на
// магазините). Всеки апп подава своя id и се самоизключва.
//
// Каталогът се тегли ПЪРВО ОТ СЪРВЪРА (public/promo/kcy-promo.json → https://…/promo/kcy-promo.json):
// така СЛЕД издаване се управлява ЦЕНТРАЛНО кои приложения се рекламират (одобрени/качени в
// магазина `enabled:true`) — свалено/неодобрено приложение се спира БЕЗ нов билд, само с редакция
// на файла на сървъра. Ако сървърът не отговори (без интернет) → ЛОКАЛНОТО резервно копие
// `kcy-promo.json`, вкарано в билда от `app-shared/promo-catalog.json`.
// Само записи с `enabled:true` и различни от текущия апп се показват.
const CATALOG_URL_REMOTE = 'https://selflearning.bot.nu/promo/kcy-promo.json';
const CATALOG_URL_LOCAL = './kcy-promo.json';
let CACHE = null;

// Изтегляне на JSON от адрес. БЕЗ AbortController (чупи fetch при CapacitorHttp) —
// таймаутът е през Promise.race, за да не виси екранът при бавен/недостъпен сървър.
async function fetchCatalog(url, timeoutMs) {
  const timeout = new Promise((res) => setTimeout(() => res(null), timeoutMs || 6000));
  const load = (async () => {
    try {
      const CH = (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp) || window.CapacitorHttp;
      if (CH && CH.get) { const r = await CH.get({ url }); return typeof r.data === 'string' ? JSON.parse(r.data) : r.data; }
    } catch (e) { /* пада към fetch */ }
    try { const r = await fetch(url, { cache: 'no-store' }); return await r.json(); } catch (e) { return null; }
  })();
  return await Promise.race([load, timeout]);
}

async function loadCatalog() {
  if (CACHE) return CACHE;
  let cat = await fetchCatalog(CATALOG_URL_REMOTE, 6000);
  if (!cat || !Array.isArray(cat.apps)) cat = await fetchCatalog(CATALOG_URL_LOCAL, 4000);
  if (cat && Array.isArray(cat.apps)) CACHE = cat;
  return CACHE;
}
const LANGS = ['bg', 'ru', 'uk', 'en', 'de', 'fr', 'es', 'es-MX', 'it', 'pt', 'ar', 'hi', 'ja', 'ky', 'zh-Hant'];
// Надеждно откриване на езика: ключа „<апп>.lang" от localStorage (истинският избор — приоритет);
// иначе <html lang>; иначе en.
function lang() {
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && /\.lang$/.test(k)) { const v = localStorage.getItem(k); if (v && LANGS.indexOf(v) >= 0) return v; } } } catch (e) {}
  try { const h = document.documentElement.getAttribute('lang'); if (h && LANGS.indexOf(h) >= 0) return h; } catch (e) {}
  return 'en';
}
function openLink(url) {
  if (!url) return;
  try { if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser) { window.Capacitor.Plugins.Browser.open({ url }); return; } } catch (e) {}
  try { window.open(url, '_blank'); } catch (e) { try { location.href = url; } catch (e2) {} }
}
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

export function mountEcosystem(selfId) {
  const self = selfId || '';
  function openShowcase() {
    if (document.getElementById('kcy-eco-ov')) return;
    const ov = document.createElement('div'); ov.id = 'kcy-eco-ov';
    ov.style.cssText = 'position:fixed;inset:0;z-index:2147483200;background:#0b1220;color:#e6edf3;font-family:system-ui,Segoe UI,Roboto,sans-serif;display:flex;flex-direction:column';
    ov.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #1b2536">' +
        '<div style="font-weight:800;font-size:16px;background:linear-gradient(90deg,#4a9eff,#8bd450);-webkit-background-clip:text;background-clip:text;color:transparent">KCY Ecosystem</div>' +
        '<button id="kcy-eco-x" style="background:#1b2536;color:#cdd;border:none;border-radius:8px;padding:8px 12px;font-size:16px;cursor:pointer">✕</button></div>' +
      '<div id="kcy-eco-list" style="flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:12px"><div style="text-align:center;opacity:.55;padding:30px">…</div></div>' +
      '<div style="text-align:center;padding:10px;font-size:12px;opacity:.55;border-top:1px solid #1b2536">KCY Ecosystem publisher 2026</div>';
    document.body.appendChild(ov);
    document.getElementById('kcy-eco-x').onclick = () => ov.remove();
    loadCatalog().then((cat) => {
      const list = document.getElementById('kcy-eco-list'); if (!list) return;
      const apps = ((cat && cat.apps) || []).filter((a) => a && a.enabled && a.id !== self);
      if (!apps.length) { list.innerHTML = '<div style="text-align:center;opacity:.55;padding:30px">—</div>'; return; }
      const lg = lang();
      list.innerHTML = apps.map((a) => {
        const desc = (a.text && (a.text[lg] || a.text.en)) || '';
        const img = a.img ? esc(a.img) : '';
        return '<div class="kcy-eco-card" data-url="' + esc(a.storeUrl || '') + '" style="background:#111a2b;border:1px solid #1b2536;border-radius:12px;overflow:hidden;cursor:pointer">' +
          (img ? '<img src="' + img + '" style="width:100%;display:block" loading="lazy" onerror="this.style.display=\'none\'">' : '') +
          '<div style="padding:12px"><div style="font-weight:700;font-size:15px">' + esc(a.name || '') + '</div>' +
          '<div style="opacity:.82;font-size:13px;margin-top:4px">' + esc(desc) + '</div>' +
          '<div style="margin-top:10px"><span style="display:inline-block;background:#2ea043;color:#fff;border-radius:8px;padding:8px 14px;font-weight:600;font-size:13px">Open ›</span></div></div></div>';
      }).join('');
      list.querySelectorAll('.kcy-eco-card').forEach((c) => { c.onclick = () => openLink(c.getAttribute('data-url')); });
    });
  }
  function add() {
    if (!document.body || document.getElementById('kcy-eco-wrap')) return;
    // Обвивка, за да носи и малкия ✕ (бутонът закрива съдържание → потребителят може да го
    // скрие; появява се пак при следващото пускане на приложението).
    const wrap = document.createElement('div'); wrap.id = 'kcy-eco-wrap';
    wrap.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:2147483000;padding:9px 9px 0 0';
    const b = document.createElement('button'); b.id = 'kcy-eco-btn';
    b.textContent = '✨ KCY';
    b.title = 'KCY Ecosystem';
    b.style.cssText = 'background:#1b2536;color:#8bd450;border:1px solid #2a3550;border-radius:20px;padding:9px 13px;font:600 13px system-ui,Segoe UI,Roboto,sans-serif;box-shadow:0 3px 10px rgba(0,0,0,.35);cursor:pointer';
    b.onclick = openShowcase;
    const x = document.createElement('button'); x.id = 'kcy-eco-hide';
    x.textContent = '✕';
    x.title = 'Close';
    x.setAttribute('aria-label', 'Close');
    x.style.cssText = 'position:absolute;top:0;right:0;width:18px;height:18px;display:flex;align-items:center;justify-content:center;background:#2a3550;color:#cdd;border:1px solid #3a4560;border-radius:50%;font:600 10px/1 system-ui,Segoe UI,Roboto,sans-serif;padding:0;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.35)';
    x.onclick = (e) => { e.stopPropagation(); try { wrap.remove(); } catch (err) {} };
    wrap.appendChild(b); wrap.appendChild(x);
    document.body.appendChild(wrap);
  }
  if (document.body) add(); else document.addEventListener('DOMContentLoaded', add);
}
