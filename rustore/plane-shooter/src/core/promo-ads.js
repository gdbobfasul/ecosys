// Version: 1.0001
// promo-ads.js — ИЗСКАЧАЩА реклама (само за БЕЗПЛАТНИ апове, напр. Plane Shooter). Показва ~3–4с
// промо на ПРОИЗВОЛНО одобрено приложение от каталога (kcy-promo.json): снимка + ИМЕ + описание +
// бутон „Open" (линк към приложението) + „KCY Ecosystem publisher 2026". Затворима (× се появява
// веднага; авто-затваря след ~4с). Извиква се на СТАРТ, по СРЕДАТА (таймер) и в КРАЯ (game over).
const CATALOG_URL = './kcy-promo.json';
let CACHE = null, SELF = '', midTimer = null;

async function loadCatalog() {
  if (CACHE) return CACHE;
  try {
    const CH = (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp) || window.CapacitorHttp;
    if (CH && CH.get) { const r = await CH.get({ url: CATALOG_URL }); CACHE = typeof r.data === 'string' ? JSON.parse(r.data) : r.data; return CACHE; }
  } catch (e) {}
  try { const r = await fetch(CATALOG_URL, { cache: 'no-store' }); CACHE = await r.json(); return CACHE; } catch (e) { return null; }
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

async function showAd() {
  try { if (window.__KCY_INTRO_OFF__) return; } catch (e) {}          // без реклами при правене на снимки
  if (document.getElementById('kcy-ad-ov')) return;
  const cat = await loadCatalog();
  const apps = ((cat && cat.apps) || []).filter((a) => a && a.enabled && a.id !== SELF);
  if (!apps.length) return;                                           // няма одобрени → нищо (не дразним)
  const a = apps[Math.floor(Math.random() * apps.length)] || apps[0]; // ПРОИЗВОЛНО приложение
  const lg = lang();
  const desc = (a.text && (a.text[lg] || a.text.en)) || '';
  const ov = document.createElement('div'); ov.id = 'kcy-ad-ov';
  ov.style.cssText = 'position:fixed;inset:0;z-index:2147483400;background:rgba(6,10,18,.94);display:flex;align-items:center;justify-content:center;padding:18px;font-family:system-ui,Segoe UI,Roboto,sans-serif';
  ov.innerHTML =
    '<div style="max-width:360px;width:100%;background:#111a2b;border:1px solid #24314a;border-radius:16px;overflow:hidden;position:relative">' +
      '<button id="kcy-ad-x" style="position:absolute;top:8px;right:8px;z-index:2;background:rgba(0,0,0,.55);color:#fff;border:none;border-radius:16px;width:32px;height:32px;font-size:16px;cursor:pointer">✕</button>' +
      (a.img ? '<img src="' + esc(a.img) + '" style="width:100%;display:block" onerror="this.style.display=\'none\'">' : '') +
      '<div style="padding:14px">' +
        '<div style="font-weight:800;font-size:17px;color:#e6edf3">' + esc(a.name || '') + '</div>' +
        '<div style="opacity:.82;font-size:13px;color:#cdd9e5;margin-top:5px">' + esc(desc) + '</div>' +
        '<button id="kcy-ad-open" style="margin-top:12px;width:100%;padding:12px;border:none;border-radius:10px;background:#2ea043;color:#fff;font-weight:700;font-size:15px;cursor:pointer">Open ›</button>' +
        '<div style="text-align:center;margin-top:10px;font-size:11px;opacity:.55;color:#cdd9e5">KCY Ecosystem publisher 2026</div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(ov);
  const close = () => { try { ov.remove(); } catch (e) {} };
  document.getElementById('kcy-ad-x').onclick = close;
  document.getElementById('kcy-ad-open').onclick = () => { openLink(a.storeUrl); close(); };
  const img = ov.querySelector('img'); if (img) img.onclick = () => { openLink(a.storeUrl); close(); };
  setTimeout(close, 4200);                                            // авто-затваря след ~4с
}

// СТАРТ (веднага) + СРЕДА (на всеки ~120с докато е активно). КРАЯТ се вика от играта при game over
// през window.KCY_END_AD().
export function startPromoAds(selfId) {
  SELF = selfId || '';
  loadCatalog();                                                     // предзареди
  const start = () => { showAd(); };                                 // старт реклама
  if (document.body) setTimeout(start, 500); else document.addEventListener('DOMContentLoaded', () => setTimeout(start, 500));
  if (midTimer) clearInterval(midTimer);
  midTimer = setInterval(() => { if (!document.hidden) showAd(); }, 120000);   // среда
  try { window.KCY_END_AD = () => showAd(); } catch (e) {}           // край (game over)
}
