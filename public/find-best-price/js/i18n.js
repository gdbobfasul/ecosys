// Version: 1.0193
// Find Best Price — самостоятелен i18n (релативно i18n/<код>.json → портативно към свой домейн).
// При липсващ превод НЕ затрива вградения текст (за да не се показват ключове). 15 езика.
(function () {
  'use strict';

  var SUPPORTED = [
    { code: 'bg', name: 'Български' }, { code: 'en', name: 'English' },
    { code: 'ru', name: 'Русский' }, { code: 'ky', name: 'Кыргызча' }, { code: 'uk', name: 'Українська' },
    { code: 'zh-Hant', name: '中文' }, { code: 'hi', name: 'हिन्दी' }, { code: 'fr', name: 'Français' },
    { code: 'de', name: 'Deutsch' }, { code: 'es', name: 'Español' }, { code: 'es-MX', name: 'Español (MX)' },
    { code: 'ja', name: '日本語' }, { code: 'it', name: 'Italiano' }, { code: 'pt', name: 'Português' },
    { code: 'ar', name: 'العربية' }
  ];
  var DEFAULT = 'en', STORE_KEY = 'kcy-lang', BASE = 'i18n/';

  var I18N = {
    supported: SUPPORTED, lang: DEFAULT, dict: {}, fallback: {},
    isSupported: function (c) { return SUPPORTED.some(function (l) { return l.code === c; }); },
    detect: function () {
      try { var s = localStorage.getItem(STORE_KEY); if (s && this.isSupported(s)) return s; } catch (e) {}
      var n = (navigator.language || '').toLowerCase();
      for (var i = 0; i < SUPPORTED.length; i++) { var c = SUPPORTED[i].code.toLowerCase(); if (n === c || n.split('-')[0] === c.split('-')[0]) return SUPPORTED[i].code; }
      return DEFAULT;
    },
    _fetch: function (c) { return fetch(BASE + c + '.json').then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }); },
    t: function (key, vars) {
      var s = (this.dict[key] != null) ? this.dict[key] : (this.fallback[key] != null) ? this.fallback[key] : key;
      if (vars) Object.keys(vars).forEach(function (k) { s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]); });
      return s;
    },
    apply: function (root) {
      root = root || document; var self = this;
      root.querySelectorAll('[data-i18n]').forEach(function (el) { var k = el.getAttribute('data-i18n'), v = self.t(k); if (v !== k) el.textContent = v; });
      root.querySelectorAll('[data-i18n-html]').forEach(function (el) { var k = el.getAttribute('data-i18n-html'), v = self.t(k); if (v !== k) el.innerHTML = v; });
      root.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
        el.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
          var p = pair.split(':'); if (p.length === 2) { var v = self.t(p[1].trim()); if (v !== p[1].trim()) el.setAttribute(p[0].trim(), v); }
        });
      });
      document.documentElement.lang = this.lang; document.documentElement.dir = (this.lang === 'ar') ? 'rtl' : 'ltr';
    },
    set: function (code) {
      if (!this.isSupported(code)) code = DEFAULT;
      this.lang = code; try { localStorage.setItem(STORE_KEY, code); } catch (e) {}
      var self = this, jobs = [this._fetch(code)]; if (code !== DEFAULT) jobs.push(this._fetch(DEFAULT));
      return Promise.all(jobs).then(function (res) {
        self.dict = res[0] || {}; self.fallback = (code !== DEFAULT) ? (res[1] || {}) : self.dict;
        self.apply(document); document.dispatchEvent(new CustomEvent('fbp-lang-ready', { detail: { lang: code } }));
      });
    }
  };
  window.FBP_I18N = I18N;
  I18N.ready = I18N.set(I18N.detect());
})();
