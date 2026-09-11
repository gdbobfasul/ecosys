// Version: 1.0020
// House-Look-Book — общи помощници за фронтенда: API + навигация + сесия + езиков избор.
// Без външни зависимости. Всичко върви срещу бекенда /api/hlb.
//
// 11.09.2026 (Huawei 3.1 „failed to fetch"): (1) API базата на устройство се чете от hlb-config.json
// (генерира се при билд от huawei/houselookbook/src/config.js → HLB_URL) с РЕЗЕРВА към
// https://pupikes.app/api/hlb (същият сървър) при мрежова грешка; (2) мрежова грешка вече НЕ е
// „Грешка" в интерфейса, а err.offline=true с ясен текст и предложение за ЛОКАЛЕН РЕЖИМ
// (проектите се пазят на устройството — js/hlb-local.js); (3) езиков избор при първо пускане.

const HLB = (function () {
  'use strict';

  // В БРАУЗЪР/на сайта: относителен път (същият origin като сайта).
  // ВГРАДЕН В APK (Capacitor native, origin=https://localhost): АБСОЛЮТЕН към живия
  // сървър, за да работят публикуване/вход/галерия, докато рисуването е изцяло локално.
  const _native = (function () {
    try { return !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()); }
    catch (e) { return false; }
  })();
  const DEFAULT_SITE = 'https://houselook.pupikes.com';           // = src/config.js HLB_URL (резерва, ако конфигът липсва)
  const DEFAULT_FALLBACK_API = 'https://pupikes.app/api/hlb';    // същият сървър, друг домейн (Китай/блокиран домейн)
  const TIMEOUT_MS = 15000;

  let apiBase = _native ? DEFAULT_SITE + '/api/hlb' : '/api/hlb';
  let fallbackBase = _native ? DEFAULT_FALLBACK_API : null;
  let lastOnline = null; // null = неизвестно, true/false след първата заявка

  // Конфигът се чете САМО на устройство (в APK-то е dist/hlb-config.json от билда; на сайта го няма).
  const cfgReady = _native
    ? fetch('hlb-config.json', { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null))
        .then(c => {
          if (c && typeof c.apiBase === 'string' && /^https?:\/\//.test(c.apiBase)) apiBase = c.apiBase.replace(/\/+$/, '');
          if (c && typeof c.fallbackApiBase === 'string' && /^https?:\/\//.test(c.fallbackApiBase)) fallbackBase = c.fallbackApiBase.replace(/\/+$/, '');
        })
        .catch(() => {})
    : Promise.resolve();

  function T(key, vars) { return window.HLB_I18N ? HLB_I18N.t(key, vars) : key; }

  // Таймаут БЕЗ AbortController (CapacitorHttp не го поддържа — урок от екосистемата).
  function withTimeout(p, ms) {
    return Promise.race([p, new Promise((_, rej) => setTimeout(() => { const e = new TypeError('timeout'); e.isTimeout = true; rej(e); }, ms))]);
  }
  function isNetErr(e) { return !!e && (e instanceof TypeError || e.isTimeout || /fetch|network|timeout/i.test(String(e.message || ''))); }

  function offlineError(cause) {
    const err = new Error(T('err.offline'));
    err.offline = true; err.status = 0; err.cause = cause;
    return err;
  }

  // Тънка обвивка над fetch — праща/чете JSON, носи сесийната бисквитка.
  // На устройство: при мрежова грешка опитва веднъж през резервната база; ако и тя не отговори →
  // err.offline=true (интерфейсът предлага локален режим, не показва „Грешка").
  async function api(pathname, { method = 'GET', body, formData } = {}) {
    await cfgReady;
    const opts = { method, credentials: _native ? 'include' : 'same-origin', headers: {} };
    if (formData) {
      opts.body = formData; // multipart — браузърът сам слага Content-Type
    } else if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    let res;
    try {
      res = await withTimeout(fetch(apiBase + pathname, opts), TIMEOUT_MS);
    } catch (e1) {
      if (!isNetErr(e1)) throw e1;
      if (_native && fallbackBase && fallbackBase !== apiBase) {
        try {
          res = await withTimeout(fetch(fallbackBase + pathname, opts), TIMEOUT_MS);
          apiBase = fallbackBase; // резервата работи → оставаме на нея за сесията
        } catch (e2) { lastOnline = false; throw offlineError(e2); }
      } else { lastOnline = false; throw offlineError(e1); }
    }
    let data = null;
    try { data = await res.json(); } catch (_) { /* не е JSON */ }
    // 200, но не JSON (напр. статичен сървър върна index.html) = зад адреса няма API → офлайн режим.
    if (res.ok && data === null) { lastOnline = false; throw offlineError(new Error('not-json')); }
    lastOnline = true;
    if (!res.ok) {
      // 404 на API път = зад този адрес НЯМА бекенд (напр. dist, отворен от статичен сървър) → като офлайн.
      if (res.status === 404 && !(data && (data.error || data.message))) throw offlineError(new Error('404'));
      const err = new Error((data && data.message) || (data && data.error) || T('err.http', { status: res.status }));
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  // Текущ потребител или null (без да хвърля при 401/офлайн).
  async function me() {
    try { return (await api('/me')).user; }
    catch (e) { return null; }
  }

  // Български етикети за навигацията на страниците БЕЗ i18n (админ частите —
  // admin.html / db.html не зареждат i18n.js и НЕ се превеждат).
  const NAV_BG = {
    'nav.build': '🏠 Конструктор', 'nav.local': '📱 Моите проекти', 'nav.gallery': '🖼️ Галерия', 'nav.rank': '⭐ Класация',
    'nav.login': 'Вход', 'nav.logout': 'Изход', 'nav.profile': 'Моят профил', 'nav.admin': '🛠️ Админ',
  };

  // Навигация — еднаква на всички страници. Без линкове извън приложението.
  async function mountNav(active) {
    if (window.HLB_I18N && HLB_I18N.ready) { try { await HLB_I18N.ready; } catch (_) {} }
    const Tn = k => (window.HLB_I18N ? HLB_I18N.t(k) : (NAV_BG[k] || k));
    const user = await me();
    const links = [
      { href: 'index.html',   key: 'build',   i18n: 'nav.build' },
      { href: 'local.html',   key: 'local',   i18n: 'nav.local' },
      { href: 'gallery.html', key: 'gallery', i18n: 'nav.gallery' },
      { href: 'ranking.html', key: 'rank',    i18n: 'nav.rank' },
    ];
    const right = user
      ? `<a href="profile.html" class="nav-link nav-user${active === 'profile' ? ' on' : ''}" title="${esc(Tn('nav.profile'))}">👤 ${esc(user.display_name || user.email)}</a>
         <a href="#" id="navLogout" class="nav-link">${esc(Tn('nav.logout'))}</a>`
      : `<a href="login.html" class="nav-link${active === 'login' ? ' on' : ''}">${esc(Tn('nav.login'))}</a>`;

    // Езиков селектор — самостоятелен за приложението, най-отпред в nav-а.
    let langSelectHtml = '';
    if (window.HLB_I18N) {
      const opts = HLB_I18N.supported.map(l =>
        `<option value="${l.code}"${l.code === HLB_I18N.lang ? ' selected' : ''}>${esc(l.name)}</option>`).join('');
      langSelectHtml = `<select id="hlbLang" class="hlb-lang" title="Language / Език">${opts}</select>`;
    }

    // Админ линк — само за модератор/админ.
    const adminLink = (user && (user.role === 'moderator' || user.role === 'admin'))
      ? `<a href="admin.html" class="nav-link${active === 'admin' ? ' on' : ''}">${esc(Tn('nav.admin'))}</a>` : '';

    const nav = document.createElement('nav');
    nav.className = 'hlb-nav';
    nav.innerHTML = `
      <div class="nav-left">
        ${langSelectHtml}
        ${links.map(l => `<a href="${l.href}" class="nav-link${active === l.key ? ' on' : ''}">${esc(Tn(l.i18n))}</a>`).join('')}
        ${adminLink}
      </div>
      <div class="nav-right">${right}</div>`;
    document.body.insertBefore(nav, document.body.firstChild);

    // Смяна на език → запомни избора и презареди (надеждно пре-рендиране на всичко).
    const langSel = document.getElementById('hlbLang');
    if (langSel) langSel.onchange = function () {
      try { localStorage.setItem('kcy-lang', this.value); localStorage.setItem(LANG_CHOSEN_KEY, '1'); } catch (e) {}
      location.reload();
    };

    const logout = document.getElementById('navLogout');
    if (logout) logout.onclick = async (e) => {
      e.preventDefault();
      try { await api('/logout', { method: 'POST' }); } catch (_) {}
      location.reload();
    };
    return user;
  }

  // Езиков избор при ПЪРВО пускане (стандарт на екосистемата: 15 езика на първия екран).
  // Показва се, докато потребителят НЕ е избрал език сам (флаг hlb.lang.chosen.v1 — i18n.js записва
  // kcy-lang и при автоматично засичане, затова той не става за проверка); генераторът на снимки
  // го изключва с __PUPIKES_LANGGATE_OFF__.
  const LANG_CHOSEN_KEY = 'hlb.lang.chosen.v1';
  function mountLangGate() {
    try {
      if (!window.HLB_I18N || window.__PUPIKES_LANGGATE_OFF__) return;
      if (localStorage.getItem(LANG_CHOSEN_KEY)) return;
    } catch (e) { return; }
    const box = document.createElement('div');
    box.id = 'hlb-langgate';
    box.innerHTML = `<div class="lg-card"><div class="lg-logo">🏠</div><div class="lg-title">HouseLookBook</div>` +
      `<div class="lg-sub">Choose your language · Изберете език · 选择语言</div>` +
      `<div class="lg-grid">${HLB_I18N.supported.map(l => `<button type="button" data-lang="${l.code}">${esc(l.name)}</button>`).join('')}</div></div>`;
    box.querySelectorAll('button[data-lang]').forEach(b => b.onclick = () => {
      try { localStorage.setItem('kcy-lang', b.getAttribute('data-lang')); localStorage.setItem(LANG_CHOSEN_KEY, '1'); } catch (e) {}
      location.reload();
    });
    (document.body || document.documentElement).appendChild(box);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountLangGate);
  else mountLangGate();

  function esc(s) {
    return String(s == null ? '' : s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  }

  // Умалява снимка НА УСТРОЙСТВОТО до data:URL (за мебели — без сървър, работи офлайн).
  function imageToDataUrl(file, maxPx) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const m = maxPx || 256, s = Math.min(1, m / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(img.width * s)); c.height = Math.max(1, Math.round(img.height * s));
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          URL.revokeObjectURL(url);
          resolve(c.toDataURL('image/jpeg', 0.8));
        } catch (e) { reject(e); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
      img.src = url;
    });
  }

  return { api, me, mountNav, esc, imageToDataUrl, isNative: () => _native, isOnline: () => lastOnline, apiBase: () => apiBase };
})();

// ── „Още от Pupikes" — плаващ бутон със ✕ (Version: 1.0005) ─────────────────────────
// Зарежда js/kcy-eco-web.js (копие на public/shared/kcy-eco-web.js) САМО когато сайтът е
// отворен ВЪТРЕ в мобилното приложение (Capacitor) — посетителите в браузър не го виждат.
(function () {
  try {
    if (!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform())) return;
    var me = document.querySelector('script[src*="hlb-common.js"]');
    var src = me ? me.getAttribute('src').replace(/hlb-common\.js.*$/, 'kcy-eco-web.js?v=1.0005') : '/js/kcy-eco-web.js?v=1.0005';
    var s = document.createElement('script');
    s.src = src; s.setAttribute('data-kcy-app', 'houselookbook');
    document.head.appendChild(s);
  } catch (e) {}
})();
