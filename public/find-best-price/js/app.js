// Version: 1.0193
// Find Best Price — начало: категории + търсачка + резултати (публично).
(function () {
  'use strict';
  var CATS = [
    { id: 'food', ic: '🍎' }, { id: 'building', ic: '🧱' }, { id: 'autoparts', ic: '🔧' }, { id: 'toys', ic: '🧸' },
    { id: 'clothes', ic: '👕' }, { id: 'bicycles', ic: '🚲' }, { id: 'furniture', ic: '🛋️' }, { id: 'computers', ic: '💻' },
    { id: 'antiques', ic: '🏺' }, { id: 'machinery', ic: '🚜' }, { id: 'drones', ic: '🛸' }, { id: 'robots', ic: '🤖' }
  ];
  var QUALITIES = ['new', 'used', 'refurbished', 'premium', 'standard', 'economy'];
  var SERVICE_CATS = [
    { id: 'dentist', ic: '🦷' }, { id: 'medical', ic: '🩺' }, { id: 'repair', ic: '🔧' }, { id: 'legal', ic: '⚖️' }, { id: 'manufacturing', ic: '🏭' },
    { id: 'construction', ic: '🏗️' }, { id: 'beauty', ic: '💇' }, { id: 'education', ic: '🎓' }, { id: 'transport', ic: '🚚' }, { id: 'it', ic: '💻' },
  ];
  var KINDS = ['product', 'service', 'sparepart'];
  var kind = 'product';
  var selectedCat = '';
  function catsFor() { return kind === 'service' ? SERVICE_CATS : CATS; }
  var T = function (k, v) { return window.FBP_I18N ? FBP_I18N.t(k, v) : k; };
  function esc(s) { return String(s == null ? '' : s).replace(/[<>&]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]; }); }
  function val(id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }

  function fillLang() {
    var s = document.getElementById('lang'); if (!s || !window.FBP_I18N) return;
    s.innerHTML = ''; FBP_I18N.supported.forEach(function (l) { var o = document.createElement('option'); o.value = l.code; o.textContent = l.name; s.appendChild(o); });
    s.value = FBP_I18N.lang;
  }
  function fillQuality() {
    var s = document.getElementById('f_quality'); if (!s) return;
    s.innerHTML = '<option value="">' + esc(T('common.all')) + '</option>';
    QUALITIES.forEach(function (q) { var o = document.createElement('option'); o.value = q; o.textContent = T('quality.' + q); s.appendChild(o); });
  }
  function renderKinds() {
    var box = document.getElementById('kinds'); if (!box) return; box.innerHTML = '';
    KINDS.forEach(function (k) {
      var d = document.createElement('div'); d.className = 'kind' + (kind === k ? ' on' : '');
      d.textContent = T('kind.' + k);
      d.onclick = function () { kind = k; selectedCat = ''; renderKinds(); renderCats(); updateFits(); updateChip(); doSearch(); };
      box.appendChild(d);
    });
  }
  function updateFits() { var w = document.getElementById('fitsWrap'); if (w) w.style.display = kind === 'sparepart' ? '' : 'none'; }
  function renderCats() {
    var box = document.getElementById('cats'); if (!box) return; box.innerHTML = '';
    catsFor().forEach(function (c) {
      var d = document.createElement('div'); d.className = 'cat' + (selectedCat === c.id ? ' on' : '');
      d.innerHTML = '<div class="ic">' + c.ic + '</div><div class="nm">' + esc(T('cat.' + c.id)) + '</div>';
      d.onclick = function () { selectedCat = (selectedCat === c.id ? '' : c.id); renderCats(); updateChip(); doSearch(); };
      box.appendChild(d);
    });
  }
  function updateChip() { var c = document.getElementById('catChip'); if (c) c.textContent = selectedCat ? (T('search.category') + ': ' + T('cat.' + selectedCat)) : ''; }

  function doSearch() {
    var p = new URLSearchParams();
    p.set('kind', kind);
    if (selectedCat) p.set('category', selectedCat);
    if (kind === 'sparepart') { var fits = val('f_fits'); if (fits) p.set('fits_product', fits); }
    [['country', 'f_country'], ['city', 'f_city'], ['village', 'f_village'], ['district', 'f_district'],
     ['quality', 'f_quality'], ['materials', 'f_materials'], ['manufacturer', 'f_manufacturer'], ['brand', 'f_brand'],
     ['price_min', 'f_pmin'], ['price_max', 'f_pmax']].forEach(function (pair) { var v = val(pair[1]); if (v) p.set(pair[0], v); });
    var box = document.getElementById('results'); box.innerHTML = '<div class="empty">' + esc(T('common.loading')) + '</div>';
    fetch('/api/fbp/search?' + p.toString()).then(function (r) { return r.json(); }).then(function (d) {
      box.innerHTML = '';
      if (!d.results || !d.results.length) { box.innerHTML = '<div class="empty">' + esc(T('search.none')) + '</div>'; return; }
      d.results.forEach(function (r) {
        var loc = [r.country, r.city, r.village, r.district].filter(Boolean).join(', ');
        var meta = [r.fits_product ? '🔩 ' + r.fits_product : '', r.brand, r.manufacturer, r.materials, r.quality ? T('quality.' + r.quality) : ''].filter(Boolean).join(' · ');
        var row = document.createElement('div'); row.className = 'res-row';
        row.innerHTML = '<div class="price">' + esc(r.price) + ' ' + esc(r.currency) + '</div>' +
          '<div style="flex:1"><div class="pname">' + esc(r.name) + '</div>' + (meta ? '<div class="meta">' + esc(meta) + '</div>' : '') +
          '<div class="loc">📍 ' + esc(loc) + ' — ' + esc(r.business_name) + ' (' + esc(T('biztype.' + r.btype)) + ')</div></div>';
        box.appendChild(row);
      });
    }).catch(function () { box.innerHTML = '<div class="empty">' + esc(T('search.none')) + '</div>'; });
  }

  function init() { fillLang(); fillQuality(); renderKinds(); renderCats(); updateFits(); updateChip(); var b = document.getElementById('btnSearch'); if (b) b.onclick = doSearch; doSearch(); }
  document.addEventListener('fbp-lang-ready', function () { fillLang(); fillQuality(); renderKinds(); renderCats(); updateChip(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
