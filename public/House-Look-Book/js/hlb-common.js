// Version: 1.0171
// House-Look-Book — общи помощници за фронтенда: API + навигация + сесия.
// Без външни зависимости. Всичко върви срещу собствения бекенд /api/hlb.

const HLB = (function () {
  'use strict';

  const BASE = '/api/hlb';

  // Тънка обвивка над fetch — праща/чете JSON, носи сесийната бисквитка.
  async function api(pathname, { method = 'GET', body, formData } = {}) {
    const opts = { method, credentials: 'same-origin', headers: {} };
    if (formData) {
      opts.body = formData; // multipart — браузърът сам слага Content-Type
    } else if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(BASE + pathname, opts);
    let data = null;
    try { data = await res.json(); } catch (_) { /* празен отговор */ }
    if (!res.ok) {
      const err = new Error((data && data.message) || (data && data.error) || (window.HLB_I18N ? HLB_I18N.t('err.http', { status: res.status }) : `Грешка ${res.status}`));
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  // Текущ потребител или null (без да хвърля при 401).
  async function me() {
    try { return (await api('/me')).user; }
    catch (e) { return null; }
  }

  // Български етикети за навигацията на страниците БЕЗ i18n (админ частите —
  // admin.html / db.html не зареждат i18n.js и НЕ се превеждат).
  const NAV_BG = {
    'nav.build': '🏠 Конструктор', 'nav.gallery': '🖼️ Галерия', 'nav.rank': '⭐ Класация',
    'nav.login': 'Вход', 'nav.logout': 'Изход', 'nav.profile': 'Моят профил', 'nav.admin': '🛠️ Админ',
  };

  // Навигация — еднаква на всички страници. Без линкове извън приложението.
  async function mountNav(active) {
    if (window.HLB_I18N && HLB_I18N.ready) { try { await HLB_I18N.ready; } catch (_) {} }
    const T = k => (window.HLB_I18N ? HLB_I18N.t(k) : (NAV_BG[k] || k));
    const user = await me();
    const links = [
      { href: 'index.html',   key: 'build',   i18n: 'nav.build' },
      { href: 'gallery.html', key: 'gallery', i18n: 'nav.gallery' },
      { href: 'ranking.html', key: 'rank',    i18n: 'nav.rank' },
    ];
    const right = user
      ? `<a href="profile.html" class="nav-link nav-user${active === 'profile' ? ' on' : ''}" title="${esc(T('nav.profile'))}">👤 ${esc(user.display_name || user.email)}</a>
         <a href="#" id="navLogout" class="nav-link">${esc(T('nav.logout'))}</a>`
      : `<a href="login.html" class="nav-link${active === 'login' ? ' on' : ''}">${esc(T('nav.login'))}</a>`;

    // Езиков селектор — самостоятелен за приложението, най-отпред в nav-а.
    let langSelectHtml = '';
    if (window.HLB_I18N) {
      const opts = HLB_I18N.supported.map(l =>
        `<option value="${l.code}"${l.code === HLB_I18N.lang ? ' selected' : ''}>${esc(l.name)}</option>`).join('');
      langSelectHtml = `<select id="hlbLang" class="hlb-lang" title="Language / Език">${opts}</select>`;
    }

    // Админ линк — само за модератор/админ.
    const adminLink = (user && (user.role === 'moderator' || user.role === 'admin'))
      ? `<a href="admin.html" class="nav-link${active === 'admin' ? ' on' : ''}">${esc(T('nav.admin'))}</a>` : '';

    const nav = document.createElement('nav');
    nav.className = 'hlb-nav';
    nav.innerHTML = `
      <div class="nav-left">
        ${langSelectHtml}
        ${links.map(l => `<a href="${l.href}" class="nav-link${active === l.key ? ' on' : ''}">${esc(T(l.i18n))}</a>`).join('')}
        ${adminLink}
      </div>
      <div class="nav-right">${right}</div>`;
    document.body.insertBefore(nav, document.body.firstChild);

    // Смяна на език → запомни избора и презареди (надеждно пре-рендиране на всичко).
    const langSel = document.getElementById('hlbLang');
    if (langSel) langSel.onchange = function () {
      try { localStorage.setItem('kcy-lang', this.value); } catch (e) {}
      location.reload();
    };

    const logout = document.getElementById('navLogout');
    if (logout) logout.onclick = async (e) => {
      e.preventDefault();
      await api('/logout', { method: 'POST' });
      location.reload();
    };
    return user;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  }

  return { api, me, mountNav, esc };
})();

// ── „Още от KCY Ecosystem" — плаващ бутон със ✕ (Version: 1.0005) ─────────────────────────
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
