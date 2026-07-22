// Version: 1.0001
// ssh-edit.js — добавяне/редакция на SSH достъп (таб „SSH").
// Полета: име, хост/IP, порт, потребител, парола, частен ключ, бележка. Тайните с „око".
// Всичко в шифрования сейф — само на устройството, нищо не се качва навън.
import { h, mount, toast, copyText } from '../ui/dom.js';
import { t } from '../core/i18n.js';
import { addSsh, updateSsh, deleteSsh } from '../core/storage.js';

export function renderSshEdit(root, nav, item) {
  const editing = !!(item && item.id);

  const name = h('input', { type: 'text', maxlength: '256', value: (item && item.name) || '' });
  const host = h('input', { type: 'text', maxlength: '256', value: (item && item.host) || '', placeholder: '192.168.0.10 / host.example.com' });
  const port = h('input', { type: 'text', maxlength: '256', inputmode: 'numeric', value: (item && item.port) || '', placeholder: '22' });
  const user = h('input', { type: 'text', maxlength: '256', value: (item && item.user) || '', placeholder: 'root / deploy' });
  const password = h('input', { type: 'password', maxlength: '256', value: (item && item.password) || '' });
  const privateKey = h('textarea', { maxlength: '4000' }); privateKey.value = (item && item.privateKey) || '';
  const note = h('textarea', { maxlength: '4000' }); note.value = (item && item.note) || '';
  const err = h('div', { class: 'err' });

  function copyField(input) {
    return h('div', { class: 'copyfield' }, input,
      h('button', { class: 'copy-btn', title: t('copy'), onclick: () => { copyText(input.value); toast(t('copied')); } }, '⧉'));
  }
  const pwdRow = h('div', { class: 'copyfield' }, password,
    h('button', { class: 'copy-btn', title: '👁', onclick: () => { password.type = password.type === 'password' ? 'text' : 'password'; } }, '👁'),
    h('button', { class: 'copy-btn', title: t('copy'), onclick: () => { copyText(password.value); toast(t('copied')); } }, '⧉'));

  const save = async () => {
    if (!name.value.trim() && !host.value.trim()) { err.textContent = t('ssh_name_required'); return; }
    const data = {
      name: name.value.trim(), host: host.value.trim(), port: port.value.trim(), user: user.value.trim(),
      password: password.value, privateKey: privateKey.value, note: note.value
    };
    if (editing) await updateSsh(item.id, data); else await addSsh(data);
    nav.go('list');
  };
  const remove = async () => { if (!confirm(t('delete_confirm'))) return; await deleteSsh(item.id); nav.go('list'); };

  const topbar = h('div', { class: 'topbar' },
    h('button', { class: 'icon-btn', onclick: () => nav.go('list') }, '←'),
    h('h1', { text: editing ? t('edit_title') : t('ssh_add_title') })
  );

  const content = [
    h('label', { text: t('ssh_name') }), name,
    h('label', { text: t('ssh_host') }), copyField(host),
    h('label', { text: t('ssh_port') }), port,
    h('label', { text: t('ssh_user') }), copyField(user),
    h('label', { text: t('password') }), pwdRow,
    h('label', { text: t('ssh_key') }), privateKey,
    h('label', { text: t('note') }), note,
    err,
    h('button', { class: 'btn accent', onclick: save, text: t('save') })
  ];
  if (editing) content.push(h('button', { class: 'btn danger', onclick: remove, text: t('delete') }));

  mount(root, topbar, h('div', { class: 'content' }, ...content));
}
