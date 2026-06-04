// WhereNoBiz — общи помощници: API + навигация + знаме-emoji + континенти.
// Без външни зависимости. Всичко върви срещу собствения бекенд /api/wnb.

const WNB = (function () {
  'use strict';
  const BASE = '/api/wnb';

  async function api(pathname, { method = 'GET', body, formData } = {}) {
    const opts = { method, credentials: 'same-origin', headers: {} };
    if (formData) opts.body = formData;
    else if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    const res = await fetch(BASE + pathname, opts);
    let data = null;
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) {
      const err = new Error((data && data.message) || (data && data.error) || `Грешка ${res.status}`);
      err.status = res.status; err.data = data;
      throw err;
    }
    return data;
  }

  async function me() {
    try { return (await api('/me')).user; } catch (e) { return null; }
  }

  // Знаме-emoji от ISO код (regional indicator) — без да пазим emoji в базата.
  function flag(code) {
    if (!code || code.length !== 2) return '🏳️';
    const A = 0x1F1E6;
    return String.fromCodePoint(A + (code.charCodeAt(0) - 65), A + (code.charCodeAt(1) - 65));
  }

  const CONTINENTS = ['Africa', 'Asia', 'Europe', 'Russia', 'North America', 'South America', 'Oceania'];
  // Запазено като fallback (ако i18n не е зареден). Преводът минава през continentName().
  const CONTINENT_BG = {
    'Africa': '🌍 Африка', 'Asia': '🌏 Азия', 'Europe': '🌍 Европа', 'Russia': '🇷🇺 Русия',
    'North America': '🌎 Северна Америка', 'South America': '🌎 Южна Америка', 'Oceania': '🌏 Океания',
  };
  // Преведено име на континент (или BG fallback).
  function continentName(cont) {
    return window.WNB_I18N ? WNB_I18N.t('continent.' + cont) : (CONTINENT_BG[cont] || cont);
  }

  async function mountNav(active) {
    if (window.WNB_I18N && WNB_I18N.ready) { try { await WNB_I18N.ready; } catch (_) {} }
    const T = k => (window.WNB_I18N ? WNB_I18N.t(k) : k);
    const user = await me();
    const links = [
      { href: 'index.html',  key: 'home',   i18n: 'nav.home' },
      { href: 'browse.html', key: 'browse', i18n: 'nav.browse' },
      { href: 'new.html',    key: 'new',    i18n: 'nav.new' },
    ];
    const right = user
      ? `<span class="nav-user">${esc(user.display_name || user.email)}</span>
         <a href="#" id="navLogout" class="nav-link">${esc(T('nav.logout'))}</a>`
      : `<a href="login.html" class="nav-link${active === 'login' ? ' on' : ''}">${esc(T('nav.login'))}</a>`;
    const adminLink = (user && (user.role === 'moderator' || user.role === 'admin'))
      ? `<a href="admin.html" class="nav-link${active === 'admin' ? ' on' : ''}">🛠️ Админ</a>` : '';
    // Езиков селектор — самостоятелен за приложението, най-отпред.
    let langSelectHtml = '';
    if (window.WNB_I18N) {
      const opts = WNB_I18N.supported.map(l =>
        `<option value="${l.code}"${l.code === WNB_I18N.lang ? ' selected' : ''}>${esc(l.name)}</option>`).join('');
      langSelectHtml = `<select id="wnbLang" class="wnb-lang" title="Language / Език">${opts}</select>`;
    }
    const nav = document.createElement('nav');
    nav.className = 'wnb-nav';
    nav.innerHTML = `
      <div class="nav-left">${langSelectHtml}${links.map(l => `<a href="${l.href}" class="nav-link${active === l.key ? ' on' : ''}">${esc(T(l.i18n))}</a>`).join('')}${adminLink}</div>
      <div class="nav-right">${right}</div>`;
    document.body.insertBefore(nav, document.body.firstChild);
    const langSel = document.getElementById('wnbLang');
    if (langSel) langSel.onchange = function () { try { localStorage.setItem('kcy-lang', this.value); } catch (e) {} location.reload(); };
    const logout = document.getElementById('navLogout');
    if (logout) logout.onclick = async (e) => { e.preventDefault(); await api('/logout', { method: 'POST' }); location.reload(); };
    return user;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  }

  return { api, me, flag, mountNav, esc, CONTINENTS, CONTINENT_BG, continentName };
})();
