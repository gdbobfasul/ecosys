// Version: 1.0012
// promo-ads.js — ИЗСКАЧАЩА реклама във ВСИЧКИ апове (изискване на собственика): показва ~3–4с
// промо на ПРОИЗВОЛНО одобрено приложение от каталога: снимка + ИМЕ + описание + бутон „Open"
// (линк към приложението) + „KCY Ecosystem publisher 2026". Затворима (× се появява веднага;
// авто-затваря след ~4с). Ред: 2-сек интро „KCY Ecosystem" (intro.js) → СТАРТ реклама → апът;
// после по СРЕДАТА (таймер) и в КРАЯ (игрите викат window.KCY_END_AD() при game over).
//
// Каталогът се тегли ПЪРВО ОТ СЪРВЪРА (public/promo/kcy-promo.json) — така се управлява
// ЦЕНТРАЛНО кои приложения се рекламират, БЕЗ нов билд; вграденото копие е резерва без интернет.
import { MONETIZATION } from '../monetize.js';
// ⚙️ Изскачащите реклами се показват САМО в БЕЗПЛАТНИ апове (за да препращат към платените/Pro
// версии). В ПЛАТЕН ап (one_time/subscription/iap) са ИЗКЛ. — реклами в платен ап дразнят ревюто на
// Huawei/RuStore. Управлява се от МОДЕЛА в publish/monetization.json (билдът го вгражда в monetize.js):
// смениш ли model → "free", рекламите се включват сами. Кодът е цял (нищо не е махнато). Балончето
// „✨ KCY" + showcase-ът (ecosystem.js) са ОТДЕЛНИ, ненатрапчиви и затваряеми — те остават ВИНАГИ.
const PROMO_ADS_ENABLED = !!(MONETIZATION && MONETIZATION.model === 'free');
const CATALOG_URL_REMOTE = 'https://selflearning.bot.nu/promo/kcy-promo.json';
const CATALOG_URL_LOCAL = './kcy-promo.json';
let CACHE = null, SELF = '', midTimer = null;

// БЕЗ AbortController (чупи fetch при CapacitorHttp) — таймаут през Promise.race.
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

// СТАРТ (СЛЕД 2-сек интрото „KCY Ecosystem" — не върху него) + СРЕДА (на всеки ~120с докато е
// активно). КРАЯТ се вика от играта при game over през window.KCY_END_AD().
export function startPromoAds(selfId) {
  // ДЕАКТИВИРАНО: нищо не се показва. Неутрализираме и window.KCY_END_AD (игрите го викат на game
  // over) → без реклама на края. Балончето/showcase (ecosystem.js) е отделно и остава.
  if (!PROMO_ADS_ENABLED) { try { window.KCY_END_AD = function () {}; } catch (e) {} return; }
  SELF = selfId || '';
  loadCatalog();                                                     // предзареди
  const start = () => { showAd(); };                                 // старт реклама (след интрото)
  if (document.body) setTimeout(start, 2600); else document.addEventListener('DOMContentLoaded', () => setTimeout(start, 2600));
  if (midTimer) clearInterval(midTimer);
  midTimer = setInterval(() => { if (!document.hidden) showAd(); }, 120000);   // среда
  try { window.KCY_END_AD = () => showAd(); } catch (e) {}           // край (game over)
}
