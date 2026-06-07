// Version: 1.0193
// Find Best Price — въвеждане: вход/регистрация → дефиниране на обект → добавяне на продукти.
(function () {
  'use strict';
  var BTYPES = ['factory', 'shop', 'stall', 'reseller', 'online'];
  var CATS = ['food', 'building', 'autoparts', 'toys', 'clothes', 'bicycles', 'furniture', 'computers', 'antiques', 'machinery', 'drones', 'robots'];
  var QUALITIES = ['new', 'used', 'refurbished', 'premium', 'standard', 'economy'];
  var SERVICE_CATS = ['dentist', 'medical', 'repair', 'legal', 'manufacturing', 'construction', 'beauty', 'education', 'transport', 'it'];
  var KINDS = ['product', 'service', 'sparepart'];
  var prodKind = 'product';
  var T = function (k, v) { return window.FBP_I18N ? FBP_I18N.t(k, v) : k; };
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[<>&]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]; }); }
  function api(path, opts) { opts = opts || {}; opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {}); opts.credentials = 'same-origin'; return fetch('/api/fbp' + path, opts).then(function (r) { return r.json().then(function (b) { return { status: r.status, ok: r.ok, body: b }; }); }); }
  function msg(id, text, ok) { var e = $(id); if (e) { e.textContent = text; e.className = 'msg ' + (ok ? 'ok' : 'err'); } }

  function fillLang() { var s = $('lang'); if (!s || !window.FBP_I18N) return; s.innerHTML = ''; FBP_I18N.supported.forEach(function (l) { var o = document.createElement('option'); o.value = l.code; o.textContent = l.name; s.appendChild(o); }); s.value = FBP_I18N.lang; }
  function opt(id, list, prefix) { var s = $(id); if (!s) return; var cur = s.value; s.innerHTML = ''; list.forEach(function (x) { var o = document.createElement('option'); o.value = x; o.textContent = T(prefix + x); s.appendChild(o); }); if (cur) s.value = cur; }

  // ── auth ──
  function showLogged(isLogged) {
    $('authCard').style.display = isLogged ? 'none' : '';
    $('bizCard').style.display = isLogged ? '' : 'none';
    $('prodCard').style.display = isLogged ? '' : 'none';
    if (isLogged) { loadBusinesses(); loadProducts(); }
  }
  function checkMe() { api('/me').then(function (r) { showLogged(r.ok && r.body.user); }); }

  $('tabLogin').onclick = function () { $('loginForm').style.display = ''; $('regForm').style.display = 'none'; $('tabLogin').classList.remove('ghost'); $('tabReg').classList.add('ghost'); };
  $('tabReg').onclick = function () { $('loginForm').style.display = 'none'; $('regForm').style.display = ''; $('tabReg').classList.remove('ghost'); $('tabLogin').classList.add('ghost'); };
  $('btnLogin').onclick = function () {
    api('/login', { method: 'POST', body: JSON.stringify({ email: $('l_email').value.trim(), password: $('l_pass').value }) })
      .then(function (r) { if (r.ok) showLogged(true); else msg('authMsg', r.body.message || 'Грешка', false); });
  };
  $('btnReg').onclick = function () {
    api('/register', { method: 'POST', body: JSON.stringify({ email: $('r_email').value.trim(), password: $('r_pass').value, display_name: $('r_name').value.trim() }) })
      .then(function (r) { if (r.ok) showLogged(true); else msg('authMsg', r.body.message || 'Грешка', false); });
  };

  // ── обекти ──
  function loadBusinesses() {
    api('/business/mine').then(function (r) {
      if (!r.ok) return;
      var bl = $('bizList'), ps = $('p_biz'); bl.innerHTML = ''; ps.innerHTML = '';
      (r.body.businesses || []).forEach(function (b) {
        var loc = [b.country, b.city, b.village, b.district].filter(Boolean).join(', ');
        bl.innerHTML += '<div class="it">🏢 ' + esc(b.name) + ' (' + esc(T('biztype.' + b.btype)) + ') — ' + esc(loc) + '</div>';
        var o = document.createElement('option'); o.value = b.id; o.textContent = b.name; ps.appendChild(o);
      });
    });
  }
  $('btnBiz').onclick = function () {
    var data = { btype: $('b_type').value, name: $('b_name').value.trim(), country: $('b_country').value.trim(), city: $('b_city').value.trim(), village: $('b_village').value.trim(), district: $('b_district').value.trim(), location_exact: $('b_location').value.trim() };
    api('/business', { method: 'POST', body: JSON.stringify(data) }).then(function (r) {
      if (r.ok) { msg('bizMsg', T('biz.saved'), true); $('b_name').value = ''; $('b_location').value = ''; loadBusinesses(); }
      else msg('bizMsg', r.body.message || 'Грешка', false);
    });
  };

  // ── продукти ──
  function loadProducts() {
    api('/products/mine').then(function (r) {
      if (!r.ok) return;
      var pl = $('prodList'); pl.innerHTML = '';
      (r.body.products || []).forEach(function (p) {
        pl.innerHTML += '<div class="it">🏷️ ' + esc(p.name) + ' — ' + esc(p.price) + ' ' + esc(p.currency) + ' · ' + esc(T('cat.' + p.category)) + ' · ' + esc(p.business_name) + '</div>';
      });
    });
  }
  $('btnProd').onclick = function () {
    var data = { business_id: $('p_biz').value, kind: prodKind, category: $('p_cat').value, name: $('p_name').value.trim(), price: $('p_price').value, currency: $('p_currency').value.trim() || 'USD', quality: $('p_quality').value, materials: $('p_materials').value.trim(), manufacturer: $('p_manufacturer').value.trim(), brand: $('p_brand').value.trim(), fits_product: ($('p_fits') ? $('p_fits').value.trim() : '') };
    if (!data.business_id) { msg('prodMsg', T('biz.define_first'), false); return; }
    api('/products', { method: 'POST', body: JSON.stringify(data) }).then(function (r) {
      if (r.ok) { msg('prodMsg', T('prod.saved'), true); $('p_name').value = ''; $('p_price').value = ''; loadProducts(); }
      else msg('prodMsg', r.body.message || 'Грешка', false);
    });
  };

  function fillCats() { opt('p_cat', prodKind === 'service' ? SERVICE_CATS : CATS, 'cat.'); var w = $('p_fitsWrap'); if (w) w.style.display = prodKind === 'sparepart' ? '' : 'none'; }
  function fillSelects() {
    opt('b_type', BTYPES, 'biztype.');
    opt('p_kind', KINDS, 'kind.'); var pk = $('p_kind'); if (pk) { pk.value = prodKind; pk.onchange = function () { prodKind = pk.value; fillCats(); }; }
    fillCats();
    var q = $('p_quality'); if (q) { q.innerHTML = '<option value="">—</option>'; QUALITIES.forEach(function (x) { var o = document.createElement('option'); o.value = x; o.textContent = T('quality.' + x); q.appendChild(o); }); }
  }
  function init() { fillLang(); fillSelects(); checkMe(); }
  document.addEventListener('fbp-lang-ready', function () { fillLang(); fillSelects(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
