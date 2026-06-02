// WhereNoBiz — общи помощници: API + навигация + знаме-emoji + континенти.
// Без крипто, без външни линкове. Всичко върви срещу собствения бекенд /api/wnb.

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

  const CONTINENTS = ['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania'];
  const CONTINENT_BG = {
    'Africa': '🌍 Африка', 'Asia': '🌏 Азия', 'Europe': '🌍 Европа',
    'North America': '🌎 Северна Америка', 'South America': '🌎 Южна Америка', 'Oceania': '🌏 Океания',
  };

  async function mountNav(active) {
    const user = await me();
    const links = [
      { href: 'index.html',  key: 'home',   label: '🌍 Начало' },
      { href: 'browse.html', key: 'browse', label: '🔎 Листвай' },
      { href: 'new.html',    key: 'new',    label: '💡 Поствай ниша' },
    ];
    const right = user
      ? `<span class="nav-user">${esc(user.display_name || user.email)}</span>
         <a href="#" id="navLogout" class="nav-link">Изход</a>`
      : `<a href="login.html" class="nav-link${active === 'login' ? ' on' : ''}">Вход</a>`;
    const nav = document.createElement('nav');
    nav.className = 'wnb-nav';
    nav.innerHTML = `
      <div class="nav-left">${links.map(l => `<a href="${l.href}" class="nav-link${active === l.key ? ' on' : ''}">${l.label}</a>`).join('')}</div>
      <div class="nav-right">${right}</div>`;
    document.body.insertBefore(nav, document.body.firstChild);
    const logout = document.getElementById('navLogout');
    if (logout) logout.onclick = async (e) => { e.preventDefault(); await api('/logout', { method: 'POST' }); location.reload(); };
    return user;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  }

  return { api, me, flag, mountNav, esc, CONTINENTS, CONTINENT_BG };
})();
