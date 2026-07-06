// Version: 1.0005
// kcy-eco-web.js — „Още от KCY Ecosystem" за САЙТОВЕ, които се показват в Capacitor обвивка
// (chat → my.girl.place, houselookbook → look.myhousesetup.com). Тези приложения зареждат
// сайта директно (server.url) и локалният им src/core/ecosystem.js НЕ се изпълнява — затова
// бутонът идва от сайта, но се показва САМО В ПРИЛОЖЕНИЕТО (window.Capacitor нативен),
// НЕ на обикновените посетители в браузър.
//
// Каталогът се тегли от сървъра (https://selflearning.bot.nu/promo/kcy-promo.json =
// public/promo/kcy-promo.json) през CapacitorHttp (заобикаля CORS; наличен в обвивката).
// Бутонът има ✕ (закрива съдържание → потребителят го скрива до следващото пускане).
//
// КАНОНИЧНО КОПИЕ: public/shared/kcy-eco-web.js. Работни копия: public/chat/public/ и
// public/House-Look-Book/js/ (зареждат се от chat-footer.js / hlb-common.js). При промяна —
// редактирай тук и копирай в двете.
(function () {
  'use strict';
  try {
    if (!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform())) return;
  } catch (e) { return; }
  if (document.getElementById('kcy-eco-wrap')) return;

  // Кое приложение сме (за да се самоизключи от списъка): data-kcy-app на script тага.
  var SELF = '';
  try {
    var cur = document.currentScript || document.querySelector('script[data-kcy-app]');
    SELF = (cur && cur.getAttribute('data-kcy-app')) || '';
  } catch (e) {}

  var CATALOG_URL = 'https://selflearning.bot.nu/promo/kcy-promo.json';
  var CACHE = null;

  function fetchCatalog(url, timeoutMs, cb) {
    var done = false;
    var t = setTimeout(function () { if (!done) { done = true; cb(null); } }, timeoutMs || 6000);
    function finish(v) { if (!done) { done = true; clearTimeout(t); cb(v); } }
    try {
      var CH = (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp) || window.CapacitorHttp;
      if (CH && CH.get) {
        CH.get({ url: url }).then(function (r) {
          try { finish(typeof r.data === 'string' ? JSON.parse(r.data) : r.data); } catch (e) { finish(null); }
        }, function () { finish(null); });
        return;
      }
    } catch (e) { /* пада към fetch */ }
    try {
      fetch(url, { cache: 'no-store' }).then(function (r) { return r.json(); }).then(finish, function () { finish(null); });
    } catch (e) { finish(null); }
  }

  function loadCatalog(cb) {
    if (CACHE) { cb(CACHE); return; }
    fetchCatalog(CATALOG_URL, 6000, function (cat) {
      if (cat && Object.prototype.toString.call(cat.apps) === '[object Array]') CACHE = cat;
      cb(CACHE);
    });
  }

  var LANGS = ['bg', 'ru', 'uk', 'en', 'de', 'fr', 'es', 'es-MX', 'it', 'pt', 'ar', 'hi', 'ja', 'ky', 'zh-Hant'];
  function lang() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && /(^|\.)lang$/.test(k)) { var v = localStorage.getItem(k); if (v && LANGS.indexOf(v) >= 0) return v; }
      }
    } catch (e) {}
    try { var h = document.documentElement.getAttribute('lang'); if (h && LANGS.indexOf(h) >= 0) return h; } catch (e) {}
    return 'en';
  }
  function openLink(url) {
    if (!url) return;
    try { if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser) { window.Capacitor.Plugins.Browser.open({ url: url }); return; } } catch (e) {}
    try { window.open(url, '_blank'); } catch (e) { try { location.href = url; } catch (e2) {} }
  }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function openShowcase() {
    if (document.getElementById('kcy-eco-ov')) return;
    var ov = document.createElement('div'); ov.id = 'kcy-eco-ov';
    ov.style.cssText = 'position:fixed;inset:0;z-index:2147483200;background:#0b1220;color:#e6edf3;font-family:system-ui,Segoe UI,Roboto,sans-serif;display:flex;flex-direction:column';
    ov.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #1b2536">' +
        '<div style="font-weight:800;font-size:16px;background:linear-gradient(90deg,#4a9eff,#8bd450);-webkit-background-clip:text;background-clip:text;color:transparent">KCY Ecosystem</div>' +
        '<button id="kcy-eco-x" style="background:#1b2536;color:#cdd;border:none;border-radius:8px;padding:8px 12px;font-size:16px;cursor:pointer">✕</button></div>' +
      '<div id="kcy-eco-list" style="flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:12px"><div style="text-align:center;opacity:.55;padding:30px">…</div></div>' +
      '<div style="text-align:center;padding:10px;font-size:12px;opacity:.55;border-top:1px solid #1b2536">KCY Ecosystem publisher 2026</div>';
    document.body.appendChild(ov);
    document.getElementById('kcy-eco-x').onclick = function () { ov.remove(); };
    loadCatalog(function (cat) {
      var list = document.getElementById('kcy-eco-list'); if (!list) return;
      var apps = ((cat && cat.apps) || []).filter(function (a) { return a && a.enabled && a.id !== SELF; });
      if (!apps.length) { list.innerHTML = '<div style="text-align:center;opacity:.55;padding:30px">—</div>'; return; }
      var lg = lang();
      list.innerHTML = apps.map(function (a) {
        var desc = (a.text && (a.text[lg] || a.text.en)) || '';
        var img = a.img ? esc(a.img) : '';
        return '<div class="kcy-eco-card" data-url="' + esc(a.storeUrl || '') + '" style="background:#111a2b;border:1px solid #1b2536;border-radius:12px;overflow:hidden;cursor:pointer">' +
          (img ? '<img src="' + img + '" style="width:100%;display:block" loading="lazy" onerror="this.style.display=\'none\'">' : '') +
          '<div style="padding:12px"><div style="font-weight:700;font-size:15px">' + esc(a.name || '') + '</div>' +
          '<div style="opacity:.82;font-size:13px;margin-top:4px">' + esc(desc) + '</div>' +
          '<div style="margin-top:10px"><span style="display:inline-block;background:#2ea043;color:#fff;border-radius:8px;padding:8px 14px;font-weight:600;font-size:13px">Open ›</span></div></div></div>';
      }).join('');
      var cards = list.querySelectorAll('.kcy-eco-card');
      for (var i = 0; i < cards.length; i++) {
        (function (c) { c.onclick = function () { openLink(c.getAttribute('data-url')); }; })(cards[i]);
      }
    });
  }

  function add() {
    if (!document.body || document.getElementById('kcy-eco-wrap')) return;
    var wrap = document.createElement('div'); wrap.id = 'kcy-eco-wrap';
    wrap.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:2147483000;padding:9px 9px 0 0';
    var b = document.createElement('button'); b.id = 'kcy-eco-btn';
    b.textContent = '✨ KCY';
    b.title = 'KCY Ecosystem';
    b.style.cssText = 'background:#1b2536;color:#8bd450;border:1px solid #2a3550;border-radius:20px;padding:9px 13px;font:600 13px system-ui,Segoe UI,Roboto,sans-serif;box-shadow:0 3px 10px rgba(0,0,0,.35);cursor:pointer';
    b.onclick = openShowcase;
    var x = document.createElement('button'); x.id = 'kcy-eco-hide';
    x.textContent = '✕';
    x.title = 'Close';
    x.setAttribute('aria-label', 'Close');
    x.style.cssText = 'position:absolute;top:0;right:0;width:18px;height:18px;display:flex;align-items:center;justify-content:center;background:#2a3550;color:#cdd;border:1px solid #3a4560;border-radius:50%;font:600 10px/1 system-ui,Segoe UI,Roboto,sans-serif;padding:0;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.35)';
    x.onclick = function (e) { e.stopPropagation(); try { wrap.remove(); } catch (err) {} };
    wrap.appendChild(b); wrap.appendChild(x);
    document.body.appendChild(wrap);
  }
  if (document.body) add(); else document.addEventListener('DOMContentLoaded', add);
})();
