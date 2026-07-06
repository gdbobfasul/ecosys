// Version: 1.0013
// dups.js — преглед на дублираните/подобни записи с отметки кои да се изтрият.
// Два режима: акаунти (2FA кодове) по подразбиране, и ПАРОЛИ (nav.go('dups',{mode:'passwords'})).
// По подразбиране се отмятат всички ОСВЕН първия във всяка група (пази се по един).
import { h, mount, toast } from '../ui/dom.js';
import { t, tf } from '../core/i18n.js';
import { session, deleteEntry, deletePassword } from '../core/storage.js';
import { findDuplicateGroups } from '../core/dups.js';
import { generateCode } from '../core/otp.js';
import { passwordDupKey } from '../core/passwords-io.js';

// Групи от дублирани ПАРОЛИ (по домейн+потребител). Връща същата форма като findDuplicateGroups.
function findPasswordDupGroups() {
  const map = new Map();
  for (const p of session.passwords) {
    const k = passwordDupKey(p);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(p);
  }
  return [...map.values()].filter((arr) => arr.length > 1).map((arr) => ({ reason: 'password', entries: arr }));
}

export function renderDups(root, nav, opts) {
  const mode = (opts && opts.mode) === 'passwords' ? 'passwords' : 'auth';
  const groups = mode === 'passwords' ? findPasswordDupGroups() : findDuplicateGroups();
  const topbar = h('div', { class: 'topbar' },
    h('button', { class: 'icon-btn', onclick: () => nav.go('settings') }, '←'),
    h('h1', { text: t('duplicates') })
  );

  if (!groups.length) {
    mount(root, topbar, h('div', { class: 'center' },
      h('div', { style: 'font-size:2.4em' }, '✅'),
      h('h1', { text: t('no_duplicates') })
    ));
    return;
  }

  const selected = new Set();
  groups.forEach((g) => g.entries.forEach((e, i) => { if (i > 0) selected.add(e.id); }));

  function rowAuth(e) {
    const cb = h('input', { type: 'checkbox' });
    cb.checked = selected.has(e.id);
    cb.addEventListener('change', () => { if (cb.checked) selected.add(e.id); else selected.delete(e.id); });
    const code = h('span', { class: 'muted', style: 'font-family:ui-monospace,monospace' }, '••••••');
    generateCode(e).then((c) => { code.textContent = c; }).catch(() => {});
    return h('label', { class: 'entry', style: 'cursor:pointer' },
      cb,
      h('div', { class: 'info' },
        h('div', { class: 'issuer', text: e.issuer || e.account || '—' }),
        h('div', { class: 'acct', text: (e.issuer ? (e.account || '') + '  ' : '') })
      ),
      code
    );
  }
  function rowPwd(p) {
    const cb = h('input', { type: 'checkbox' });
    cb.checked = selected.has(p.id);
    cb.addEventListener('change', () => { if (cb.checked) selected.add(p.id); else selected.delete(p.id); });
    return h('label', { class: 'entry', style: 'cursor:pointer' },
      cb,
      h('div', { class: 'info' },
        h('div', { class: 'issuer', text: p.title || p.url || '—' }),
        h('div', { class: 'acct', text: (p.login || '') + (p.url ? '  ·  ' + p.url : '') })
      )
    );
  }

  const cards = groups.map((g) => h('div', { style: 'margin-bottom:18px' },
    h('div', { class: 'muted', style: 'margin-bottom:8px' },
      (g.reason === 'secret' ? '🔑 ' + t('dup_same_secret')
        : g.reason === 'password' ? '🔑 ' + t('dup_same_login')
        : '🔤 ' + t('dup_similar')) + '  (' + g.entries.length + ')'),
    ...g.entries.map(mode === 'passwords' ? rowPwd : rowAuth)
  ));

  const delBtn = h('button', { class: 'btn danger', onclick: async () => {
    const ids = [...selected];
    if (!ids.length) return;
    for (const id of ids) { if (mode === 'passwords') await deletePassword(id); else await deleteEntry(id); }
    toast(tf('deleted_n', ids.length));
    nav.go('list');
  } }, t('delete_selected'));

  mount(root, topbar, h('div', { class: 'content' }, ...cards, delBtn));
}
