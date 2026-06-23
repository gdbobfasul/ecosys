// Рендира правна страница (window.KG_DOC = 'privacy'|'offer'|'refund') на избрания език.
// Данните се зареждат ДИНАМИЧНО от /shared/legal/data/<lang>.js (всеки слага
// window.KG_LEGAL_DATA = {privacy, offer, refund}). Липсващ език → ru (автентична версия).
// Езикът идва от localStorage kcy-lang (споделен между табове). Малък селектор горе.
(function () {
  'use strict';
  var LANGS = [['ru', 'Русский'], ['en', 'English'], ['ky', 'Кыргызча'], ['bg', 'Български'],
    ['uk', 'Українська'], ['de', 'Deutsch'], ['es', 'Español'], ['es-MX', 'Español (MX)'],
    ['fr', 'Français'], ['it', 'Italiano'], ['pt', 'Português'], ['zh-Hant', '繁體中文'],
    ['ja', '日本語'], ['ar', 'العربية'], ['hi', 'हिन्दी']];
  var BACK = { ru: 'Назад', en: 'Back', ky: 'Артка', bg: 'Назад' };
  var cache = {};

  function getLang() {
    try { var l = localStorage.getItem('kcy-lang') || localStorage.getItem('fbp-lang'); if (l) return l; } catch (e) {}
    return document.documentElement.getAttribute('lang') || 'ru';
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]; }); }
  function block(item) {
    if (typeof item === 'string') return '<p>' + esc(item) + '</p>';
    if (item && item.ul) return '<ul>' + item.ul.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    return '';
  }

  function docHTML(doc) {
    if (!doc) return '';
    var secs = (doc.sections || []).map(function (s) {
      return '<h2>' + esc(s.h) + '</h2>' + (s.b || []).map(block).join('');
    }).join('');
    return '<h1>' + esc(doc.title) + '</h1>' +
      (doc.meta ? '<p class="meta">' + esc(doc.meta) + '</p>' : '') +
      (doc.lead ? '<p>' + esc(doc.lead) + '</p>' : '') + secs +
      (doc.requisites ? '<h2>' + esc(doc.requisites.h) + '</h2>' + (doc.requisites.b || []).map(block).join('') : '') +
      (doc.note ? '<div class="note">' + esc(doc.note) + '</div>' : '');
  }

  function draw(data) {
    data = data || {};
    var ids = window.KG_DOCS || [window.KG_DOC];  // една страница може да показва няколко документа
    var docs = ids.map(function (id) { return data[id]; }).filter(Boolean);
    var l = getLang(), lb = l.split('-')[0];
    document.documentElement.setAttribute('dir', lb === 'ar' ? 'rtl' : 'ltr'); // арабски = отдясно-наляво
    document.documentElement.setAttribute('lang', lb);
    if (docs[0]) document.title = docs[0].title;
    var opts = LANGS.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === l ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('');
    document.getElementById('kg-legal-root').innerHTML =
      '<div class="kg-top"><a class="back" href="javascript:history.back()">← ' + (BACK[lb] || BACK.ru) + '</a>' +
        '<select id="kg-legal-lang">' + opts + '</select></div>' +
      (docs.length ? docs.map(docHTML).join('<hr style="margin:36px 0;border:none;border-top:1px solid rgba(148,163,184,.25)">') : '<p>—</p>');
    var sel = document.getElementById('kg-legal-lang');
    if (sel) sel.onchange = function () { try { localStorage.setItem('kcy-lang', this.value); } catch (e) {} load(this.value); };
  }

  function load(lang) {
    var base = (lang || '').split('-')[0]; // es-MX → es файл
    if (cache[base]) { window.KG_LEGAL_DATA = cache[base]; draw(cache[base]); return; }
    var s = document.createElement('script');
    s.src = '/shared/legal/data/' + base + '.js?v=1.0001';
    s.onload = function () { cache[base] = window.KG_LEGAL_DATA; draw(window.KG_LEGAL_DATA); };
    s.onerror = function () { if (base !== 'ru') load('ru'); else draw(null); };
    document.head.appendChild(s);
  }

  ['kcy-lang-changed', 'kcy-lang-ready', 'fbp-lang-changed', 'fbp-lang-ready'].forEach(function (ev) {
    document.addEventListener(ev, function () { load(getLang()); });
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { load(getLang()); });
  else load(getLang());
})();
