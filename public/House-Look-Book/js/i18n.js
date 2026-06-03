// Version: 1.0148
// House-Look-Book — самостоятелен i18n (независим от сайта и от другите приложения).
// Зарежда преводи от i18n/<код>.json (релативно → портативно към отделен домейн).
// Език: localStorage['kcy-lang'] (споделен на същия домейн) → navigator.language → DEFAULT.
// Липсващ език/ключ → fallback към DEFAULT, после към самия ключ (никога не се чупи).
(function () {
  'use strict';

  var SUPPORTED = [
    { code: 'bg',      name: 'Български' },
    { code: 'en',      name: 'English' },
    { code: 'zh-Hant', name: '中文' },
    { code: 'ru',      name: 'Русский' },
    { code: 'hi',      name: 'हिन्दी' },
    { code: 'fr',      name: 'Français' },
    { code: 'de',      name: 'Deutsch' },
    { code: 'es',      name: 'Español' },
    { code: 'es-MX',   name: 'Español (MX)' },
    { code: 'ja',      name: '日本語' },
    { code: 'it',      name: 'Italiano' },
    { code: 'pt',      name: 'Português' },
    { code: 'ar',      name: 'العربية' }
  ];
  var DEFAULT = 'en';
  var STORE_KEY = 'kcy-lang';
  var BASE = 'i18n/';

  var I18N = {
    supported: SUPPORTED,
    lang: DEFAULT,
    dict: {},
    fallback: {},

    isSupported: function (code) {
      return SUPPORTED.some(function (l) { return l.code === code; });
    },

    detect: function () {
      try { var s = localStorage.getItem(STORE_KEY); if (s && this.isSupported(s)) return s; } catch (e) {}
      var n = (navigator.language || '').toLowerCase();
      for (var i = 0; i < SUPPORTED.length; i++) {
        var c = SUPPORTED[i].code.toLowerCase();
        if (n === c || n.split('-')[0] === c.split('-')[0]) return SUPPORTED[i].code;
      }
      return DEFAULT;
    },

    _fetch: function (code) {
      return fetch(BASE + code + '.json')
        .then(function (r) { return r.ok ? r.json() : {}; })
        .catch(function () { return {}; });
    },

    // Превод по ключ; {var} замествания по желание.
    t: function (key, vars) {
      var s = (this.dict[key] != null) ? this.dict[key]
            : (this.fallback[key] != null) ? this.fallback[key] : key;
      if (vars) Object.keys(vars).forEach(function (k) {
        s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]);
      });
      return s;
    },

    // Прилага преводите към елементи с data-i18n / data-i18n-html / data-i18n-attr.
    apply: function (root) {
      root = root || document;
      var self = this;
      root.querySelectorAll('[data-i18n]').forEach(function (el) {
        el.textContent = self.t(el.getAttribute('data-i18n'));
      });
      root.querySelectorAll('[data-i18n-html]').forEach(function (el) {
        el.innerHTML = self.t(el.getAttribute('data-i18n-html'));
      });
      root.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
        el.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
          var p = pair.split(':');
          if (p.length === 2) el.setAttribute(p[0].trim(), self.t(p[1].trim()));
        });
      });
      document.documentElement.lang = this.lang;
      document.documentElement.dir = (this.lang === 'ar') ? 'rtl' : 'ltr';
    },

    // Сменя езика: записва избора, зарежда речник + fallback, прилага.
    set: function (code) {
      if (!this.isSupported(code)) code = DEFAULT;
      this.lang = code;
      try { localStorage.setItem(STORE_KEY, code); } catch (e) {}
      var self = this;
      var jobs = [this._fetch(code)];
      if (code !== DEFAULT) jobs.push(this._fetch(DEFAULT));
      return Promise.all(jobs).then(function (res) {
        self.dict = res[0] || {};
        self.fallback = (code !== DEFAULT) ? (res[1] || {}) : self.dict;
        self.apply(document);
        document.dispatchEvent(new CustomEvent('hlb-lang-ready', { detail: { lang: code } }));
      });
    }
  };

  // Авто-старт: зарежда избрания език веднага. js/i18n.js се зарежда ПРЕДИ
  // другите скриптове, така че HLB_I18N.ready е готов преди рендера.
  window.HLB_I18N = I18N;
  I18N.ready = I18N.set(I18N.detect());
})();
