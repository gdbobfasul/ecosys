// Version: 1.0193
// Pupikes i18n — лек преводен слой.
// Текстовете се маркират с data-i18n="ключ" (за textContent) или
// data-i18n-attr="placeholder:ключ" (за атрибути). Преводите се теглят от
// /translations/<lang>.json. По подразбиране английски ('en').
(function (global) {
  'use strict';

  var SUPPORTED = [
    { code: 'en', name: 'English' },
    { code: 'ru', name: 'Русский' },
    { code: 'ky', name: 'Кыргызча' },
    { code: 'uk', name: 'Українська' },
    { code: 'zh-Hant', name: '繁體中文' },
    { code: 'hi', name: 'हिन्दी' },
    { code: 'ar', name: 'العربية' },
    { code: 'bg', name: 'Български' },
    { code: 'de', name: 'Deutsch' },
    { code: 'it', name: 'Italiano' },
    { code: 'es', name: 'Español' },
    { code: 'es-MX', name: 'Español (MX)' },
    { code: 'fr', name: 'Français' },
    { code: 'pt', name: 'Português' },
    { code: 'ja', name: '日本語' }
  ];

  var RTL = ['ar']; // дясно-наляво езици

  var KCY_I18N = {
    supported: SUPPORTED,
    lang: 'en',
    dict: {},
    fallback: {}, // английски като резерв

    // Текущ език: localStorage → <html lang> → 'en'
    detect: function () {
      try {
        var saved = localStorage.getItem('kcy-lang');
        if (saved && this.isSupported(saved)) return saved;
      } catch (e) {}
      var htmlLang = document.documentElement.getAttribute('lang');
      if (htmlLang && this.isSupported(htmlLang)) return htmlLang;
      return 'en';
    },

    isSupported: function (code) {
      return SUPPORTED.some(function (l) { return l.code === code; });
    },

    // Зарежда речник за език (+ английски като резерв)
    load: function (lang) {
      var self = this;
      var jobs = [ self._fetch(lang) ];
      if (lang !== 'en') jobs.push(self._fetch('en'));
      return Promise.all(jobs).then(function (res) {
        self.dict = res[0] || {};
        self.fallback = (lang !== 'en') ? (res[1] || {}) : self.dict;
        self.lang = lang;
      });
    },

    _fetch: function (lang) {
      return fetch('/translations/' + lang + '.json', { cache: 'no-cache' })
        .then(function (r) { return r.ok ? r.json() : {}; })
        .catch(function () { return {}; });
    },

    // Превод по ключ (с резерв към английски, после към самия ключ)
    t: function (key) {
      if (this.dict && this.dict[key] != null) return this.dict[key];
      if (this.fallback && this.fallback[key] != null) return this.fallback[key];
      return key;
    },

    // Прилага преводите върху целия документ.
    // ВАЖНО: ако преводът липсва (t() връща самия ключ), НЕ затриваме вградения
    // текст — иначе при 404 на /translations/ цялата страница се сменя на ключове
    // („chat.app_name" вместо „Анонимен Чат"), което изглежда като рефреш/редирект.
    apply: function (root) {
      root = root || document;
      var self = this;
      // 1) изрични ключове: data-i18n="ключ"
      root.querySelectorAll('[data-i18n]').forEach(function (el) {
        var key = el.getAttribute('data-i18n');
        var val = self.t(key);
        if (val != null && val !== key) el.textContent = val;   // няма превод → запази вградения текст
      });
      // 2) атрибути: data-i18n-attr="placeholder:key;title:key2"
      root.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
        var spec = el.getAttribute('data-i18n-attr');
        spec.split(';').forEach(function (pair) {
          var p = pair.split(':');
          if (p.length === 2) {
            var v = self.t(p[1].trim());
            if (v !== p[1].trim()) el.setAttribute(p[0].trim(), v);   // няма превод → не пипай атрибута
          }
        });
      });
      // посока на текста
      document.documentElement.setAttribute('dir', RTL.indexOf(this.lang) > -1 ? 'rtl' : 'ltr');
      document.documentElement.setAttribute('lang', this.lang);
    },

    // Смяна на език: запазва, зарежда, прилага
    set: function (lang) {
      if (!this.isSupported(lang)) return;
      try { localStorage.setItem('kcy-lang', lang); } catch (e) {}
      var self = this;
      this.load(lang).then(function () {
        self.apply();
        document.dispatchEvent(new CustomEvent('kcy-lang-changed', { detail: { lang: lang } }));
      });
    },

    // Инициализация — вика се веднъж при зареждане
    init: function () {
      var lang = this.detect();
      var self = this;
      return this.load(lang).then(function () {
        self.apply();
        document.dispatchEvent(new CustomEvent('kcy-lang-ready', { detail: { lang: lang } }));
      });
    }
  };

  global.KCY_I18N = KCY_I18N;

  // авто-старт
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { KCY_I18N.init(); });
  } else {
    KCY_I18N.init();
  }
})(window);
