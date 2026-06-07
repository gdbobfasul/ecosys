// ⚠️ АВТО-ГЕНЕРИРАН от private/configs/domains.conf чрез scripts/build-app-domains.js.
// НЕ редактирай ръчно — смени domains.conf и пусни генератора пак.
(function () {
  'use strict';
  var APPS = {
  "chat": {
    "domain": "my.girl.place",
    "hosts": [
      "my.girl.place",
      "kaji.kak.si"
    ],
    "prefixes": [
      "/chat/"
    ],
    "dir": "/chat/public/",
    "nested": true
  },
  "wnb": {
    "domain": "find.jwork.ru",
    "hosts": [
      "find.jwork.ru"
    ],
    "prefixes": [
      "/wherenobiz/"
    ],
    "dir": "/wherenobiz/",
    "nested": false
  },
  "hlb": {
    "domain": "look.myhousesetup.com",
    "hosts": [
      "look.myhousesetup.com"
    ],
    "prefixes": [
      "/houselookbook/"
    ],
    "dir": "/houselookbook/",
    "nested": false
  }
};
  window.KCY_APP_DOMAINS = APPS;

  // На кой ап (ключ) принадлежи текущият домейн? null = главният (или непознат) домейн.
  var HOST = (typeof location !== 'undefined' && location.hostname) ? location.hostname : '';
  var CURRENT = null;
  for (var k in APPS) { if (APPS[k].hosts.indexOf(HOST) !== -1) { CURRENT = k; break; } }

  function strip(p, pre) { var r = p.slice(pre.length - 1); return r.charAt(0) === '/' ? r : '/' + r; }

  // Връща пълен адрес към отделния домейн, ИЛИ null, ако пътят не е кръстосан линк
  // (т.е. сочи към ап без отделен домейн, или към СЪЩИЯ ап, на чийто домейн сме вече).
  function mapPath(p) {
    if (!p || p.charAt(0) !== '/') return null;
    for (var key in APPS) {
      var a = APPS[key];
      for (var i = 0; i < a.prefixes.length; i++) {
        var pre = a.prefixes[i];
        if (p !== pre && p.indexOf(pre) !== 0) continue;
        if (key === CURRENT) return null;            // същият ап, същият домейн → остави релативно
        if (a.nested) {
          // Вложен ап (chat): домейнът има същите alias-и (/chat/, /chat/public/),
          // затова пазим пътя — но входът (/chat/ или _DIR) сочи към корена на домейна.
          var noSlash = a.dir.replace(/\/$/, '');
          if (p === pre || p === pre.replace(/\/$/, '') || p === a.dir || p === noSlash) {
            return 'https://' + a.domain + '/';
          }
          if (p.indexOf(a.dir) === 0) return 'https://' + a.domain + '/' + p.slice(a.dir.length);
          return 'https://' + a.domain + p;
        }
        // Невложен ап (wnb/hlb): на отделния домейн е на КОРЕНА → махаме префикса.
        return 'https://' + a.domain + strip(p, pre);
      }
    }
    return null;
  }
  window.kcyAppUrl = mapPath;

  // Пренаписва наличните линкове (<a href> и <option value> в навигацията). Идемпотентно.
  function rewrite(rootEl) {
    var root = rootEl || document;
    var anchors = root.querySelectorAll('a[href^="/"]:not([data-xapp])');
    for (var i = 0; i < anchors.length; i++) {
      var u = mapPath(anchors[i].getAttribute('href'));
      if (u) { anchors[i].setAttribute('href', u); }
      anchors[i].setAttribute('data-xapp', '1');
    }
    var opts = root.querySelectorAll('option[value^="/"]:not([data-xapp])');
    for (var j = 0; j < opts.length; j++) {
      var v = mapPath(opts[j].getAttribute('value'));
      if (v) { opts[j].value = v; }
      opts[j].setAttribute('data-xapp', '1');
    }
  }
  window.kcyRewriteCrossAppLinks = rewrite;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { rewrite(); });
  } else { rewrite(); }
})();
