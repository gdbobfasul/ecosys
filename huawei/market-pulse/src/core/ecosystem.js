// Version: 1.0017
// ecosystem.js — екран „Още от Pupikes": бутон „Pupikes" в ЕДИННАТА долна лента
// (core/kcy-bar.js) + showcase списък на ДРУГИТЕ приложения (снимка + ИМЕ + описание 15 езика +
// линк към приложението). Footer „Pupikes publisher 2026". БЕЗ изскачащи реклами
// (доброволен екран → минава правилата на магазините). Всеки апп подава своя id и се самоизключва.
//
// Каталогът се тегли ПЪРВО ОТ СЪРВЪРА (public/promo/kcy-promo.json → https://…/promo/kcy-promo.json):
// така СЛЕД издаване се управлява ЦЕНТРАЛНО кои приложения се рекламират (одобрени/качени в
// магазина `enabled:true`) — свалено/неодобрено приложение се спира БЕЗ нов билд, само с редакция
// на файла на сървъра. Ако сървърът не отговори (без интернет) → ЛОКАЛНОТО резервно копие
// `kcy-promo.json`, вкарано в билда от `app-shared/promo-catalog.json`.
// Само записи с `enabled:true` и различни от текущия апп се показват.
import { kcyBarButton } from './kcy-bar.js';

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
  try {
    if (!document.getElementById('kcy-paw-halo-style')) {
      const st = document.createElement('style'); st.id = 'kcy-paw-halo-style';
      st.textContent = '#kcy-eco-btn{font-size:17px;line-height:1;border-radius:50%;animation:kcyPawHalo 1.8s ease-in-out infinite}' +
        '@keyframes kcyPawHalo{0%,100%{box-shadow:0 0 5px 1px rgba(130,195,255,.35)}50%{box-shadow:0 0 13px 5px rgba(130,195,255,.75)}}';
      (document.head || document.documentElement).appendChild(st);
    }
  } catch (e) {}
  const self = selfId || '';
  function openShowcase() {
    if (document.getElementById('kcy-eco-ov')) return;
    const ov = document.createElement('div'); ov.id = 'kcy-eco-ov';
    ov.style.cssText = 'position:fixed;inset:0;z-index:2147483200;background:#0b1220;color:#e6edf3;font-family:system-ui,Segoe UI,Roboto,sans-serif;display:flex;flex-direction:column';
    ov.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #1b2536">' +
        '<div style="font-weight:800;font-size:16px;background:linear-gradient(90deg,#4a9eff,#8bd450);-webkit-background-clip:text;background-clip:text;color:transparent">Pupikes</div>' +
        '<button id="kcy-eco-x" style="background:#1b2536;color:#cdd;border:none;border-radius:8px;padding:8px 12px;font-size:16px;cursor:pointer">✕</button></div>' +
      '<div id="kcy-eco-list" style="flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:12px"><div style="text-align:center;opacity:.55;padding:30px">…</div></div>' +
      '<div style="text-align:center;padding:10px;font-size:12px;opacity:.55;border-top:1px solid #1b2536">Pupikes publisher 2026</div>';
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
  kcyBarButton({ id: 'kcy-eco-btn', order: 10, accent: true, label: () => '🐾', onClick: openShowcase });
}
