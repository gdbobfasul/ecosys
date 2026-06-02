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
      const err = new Error((data && data.message) || (data && data.error) || `Грешка ${res.status}`);
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

  // Навигация — еднаква на всички страници. Без линкове извън приложението.
  async function mountNav(active) {
    const user = await me();
    const links = [
      { href: 'index.html',   key: 'build',   label: '🏠 Конструктор' },
      { href: 'gallery.html', key: 'gallery', label: '🖼️ Галерия' },
      { href: 'ranking.html', key: 'rank',    label: '⭐ Класация' },
    ];
    const right = user
      ? `<span class="nav-user">${esc(user.display_name || user.email)}</span>
         <a href="#" id="navLogout" class="nav-link">Изход</a>`
      : `<a href="login.html" class="nav-link${active === 'login' ? ' on' : ''}">Вход</a>`;

    const nav = document.createElement('nav');
    nav.className = 'hlb-nav';
    nav.innerHTML = `
      <div class="nav-left">
        ${links.map(l => `<a href="${l.href}" class="nav-link${active === l.key ? ' on' : ''}">${l.label}</a>`).join('')}
      </div>
      <div class="nav-right">${right}</div>`;
    document.body.insertBefore(nav, document.body.firstChild);

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
