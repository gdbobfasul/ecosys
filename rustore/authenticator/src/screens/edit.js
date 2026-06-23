// edit.js — редакция на съществуващ акаунт: издател/акаунт, подредба и изтриване.
import { h, mount } from '../ui/dom.js';
import { t } from '../core/i18n.js';
import { updateEntry, deleteEntry, moveEntry } from '../core/storage.js';

export function renderEdit(root, nav, entry) {
  if (!entry) return nav.go('list');

  const issuer = h('input', { type: 'text', value: entry.issuer || '' });
  const account = h('input', { type: 'text', value: entry.account || '' });

  const save = async () => {
    await updateEntry(entry.id, { issuer: issuer.value.trim(), account: account.value.trim() });
    nav.go('list');
  };
  const remove = async () => {
    if (!confirm(t('delete_confirm'))) return;
    await deleteEntry(entry.id);
    nav.go('list');
  };

  const topbar = h('div', { class: 'topbar' },
    h('button', { class: 'icon-btn', onclick: () => nav.go('list') }, '←'),
    h('h1', { text: t('edit_title') })
  );

  mount(root, topbar, h('div', { class: 'content' },
    h('label', { text: t('issuer') }), issuer,
    h('label', { text: t('account') }), account,
    h('div', { class: 'row' },
      h('button', { class: 'btn ghost', onclick: async () => { await moveEntry(entry.id, -1); nav.go('list'); } }, '↑'),
      h('button', { class: 'btn ghost', onclick: async () => { await moveEntry(entry.id, 1); nav.go('list'); } }, '↓')
    ),
    h('button', { class: 'btn accent', onclick: save, text: t('save') }),
    h('button', { class: 'btn danger', onclick: remove, text: t('delete') })
  ));
}
