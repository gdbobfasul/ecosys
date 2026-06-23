// list.js — главният екран след отключване, с три таба:
//   „Аутентикация" (въртящи се кодове), „Колекция" (запазени QR кодове),
//   „Пароли" (заглавие/логин/парола/описание). И трите са в шифрирания сейф.
import { h, mount, toast, copyText } from '../ui/dom.js';
import { t } from '../core/i18n.js';
import { THEME } from '../theme.js';
import { session, incrementCounter } from '../core/storage.js';
import { generateCode, secondsRemaining } from '../core/otp.js';

let tickTimer = null;
let activeTab = 'auth';   // запазва се между влизанията

export function renderList(root, nav) {
  if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }

  const topbar = h('div', { class: 'topbar' },
    h('h1', { text: THEME.appName }),
    h('button', { class: 'icon-btn', title: t('settings_title'), onclick: () => nav.go('settings') }, '⚙️')
  );
  const container = h('div', { class: 'content' });
  const fab = h('button', { class: 'fab', onclick: fabAction }, '+');

  const tabs = [
    { key: 'auth', icon: '🔐', label: t('tab_auth') },
    { key: 'collection', icon: '🗂', label: t('tab_collection') },
    { key: 'passwords', icon: '🔑', label: t('tab_passwords') }
  ];
  const tabbar = h('div', { class: 'tabbar' },
    ...tabs.map((tb) => h('button', {
      class: 'tab' + (activeTab === tb.key ? ' on' : ''),
      onclick: () => { activeTab = tb.key; draw(); }
    }, h('div', {}, tb.icon), h('div', { class: 'tablabel', text: tb.label })))
  );

  mount(root, topbar, container, fab, tabbar);

  function fabAction() {
    if (activeTab === 'auth') nav.go('add');
    else if (activeTab === 'collection') nav.go('collection-add');
    else nav.go('password-edit');
  }

  function draw() {
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
    [...tabbar.children].forEach((b, i) => b.classList.toggle('on', tabs[i].key === activeTab));
    if (activeTab === 'auth') drawAuth();
    else if (activeTab === 'collection') drawCollection();
    else drawPasswords();
  }

  // ---------- Таб „Аутентикация" ----------
  function drawAuth() {
    let filter = '';
    let rows = [];
    const search = h('input', { placeholder: t('search_ph'), oninput: (e) => { filter = e.target.value.toLowerCase(); redraw(); } });
    const listEl = h('div', {});
    mount(container, session.entries.length ? search : null, listEl);

    function fmt(e, c) {
      if (e.type === 'steam') return c;
      if (c.length === 6) return c.slice(0, 3) + ' ' + c.slice(3);
      if (c.length === 8) return c.slice(0, 4) + ' ' + c.slice(4);
      return c;
    }
    function rowFor(e) {
      const code = h('div', { class: 'code' }, '••• •••');
      const ring = h('div', { class: 'ring', style: 'font-size:.85em;color:var(--textDim)' }, '');
      const badge = h('div', { class: 'badge' }, ((e.issuer || e.account || '?').trim().charAt(0) || '?').toUpperCase());
      code.addEventListener('click', () => {
        const c = code.textContent.replace(/\s/g, '');
        if (c && !c.includes('•')) { copyText(c); toast(t('copied')); }
      });
      const right = h('div', { class: 'right' });
      if (e.type === 'hotp') {
        right.appendChild(h('button', { class: 'hotp-next', title: t('next_code'),
          onclick: async (ev) => { ev.stopPropagation(); await incrementCounter(e.id); refresh(); } }, '↻'));
      } else { right.appendChild(ring); }
      const info = h('div', { class: 'info', style: 'cursor:pointer' },
        h('div', { class: 'issuer', text: e.issuer || e.account || '—' }),
        h('div', { class: 'acct', text: e.issuer ? (e.account || '') : '' }));
      info.addEventListener('click', () => nav.go('edit', e));
      badge.addEventListener('click', () => nav.go('edit', e));
      const rowEl = h('div', { class: 'entry' }, badge, info, h('div', {}, code), right);
      async function refresh() {
        try { code.textContent = fmt(e, await generateCode(e)); } catch (er) { code.textContent = '——————'; }
        if (e.type !== 'hotp') {
          const rem = secondsRemaining(e.period);
          ring.textContent = rem + 's';
          ring.style.color = rem <= 5 ? 'var(--danger)' : 'var(--textDim)';
        }
      }
      rowEl._refresh = refresh; refresh();
      return rowEl;
    }
    function redraw() {
      if (!session.entries.length) {
        mount(listEl, emptyBox('🔐', t('empty_title'), t('empty_desc')));
        rows = []; return;
      }
      const items = session.entries.filter((e) => !filter || ((e.issuer || '') + ' ' + (e.account || '')).toLowerCase().includes(filter));
      rows = items.map(rowFor);
      mount(listEl, ...rows);
    }
    redraw();
    tickTimer = setInterval(() => { rows.forEach((r) => { if (r._refresh) r._refresh(); }); }, 1000);
  }

  // ---------- Таб „Колекция" ----------
  function drawCollection() {
    if (!session.collection.length) { mount(container, emptyBox('🗂', t('empty_col_title'), t('empty_col_desc'))); return; }
    const rows = session.collection.map((c) => {
      const thumb = c.image
        ? h('img', { src: c.image, style: 'width:42px;height:42px;border-radius:8px;object-fit:cover;background:#fff' })
        : h('div', { class: 'badge' }, '▦');
      const info = h('div', { class: 'info' }, h('div', { class: 'issuer', text: c.title || '—' }),
        h('div', { class: 'acct', text: c.content || '' }));
      const row = h('div', { class: 'entry', style: 'cursor:pointer' }, thumb, info, h('div', { class: 'muted' }, '›'));
      row.addEventListener('click', () => nav.go('collection-view', c));
      return row;
    });
    mount(container, ...rows);
  }

  // ---------- Таб „Пароли" ----------
  function drawPasswords() {
    if (!session.passwords.length) { mount(container, emptyBox('🔑', t('empty_pwd_title'), t('empty_pwd_desc'))); return; }
    const rows = session.passwords.map((p) => {
      const badge = h('div', { class: 'badge' }, ((p.title || '?').trim().charAt(0) || '?').toUpperCase());
      const info = h('div', { class: 'info' }, h('div', { class: 'issuer', text: p.title || '—' }),
        h('div', { class: 'acct', text: p.login || '' }));
      const row = h('div', { class: 'entry', style: 'cursor:pointer' }, badge, info, h('div', { class: 'muted' }, '›'));
      row.addEventListener('click', () => nav.go('password-edit', p));
      return row;
    });
    mount(container, ...rows);
  }

  function emptyBox(icon, title, desc) {
    return h('div', { class: 'center' },
      h('div', { style: 'font-size:2.6em' }, icon),
      h('h1', { text: title }),
      h('p', { class: 'muted', text: desc }));
  }

  draw();
}
