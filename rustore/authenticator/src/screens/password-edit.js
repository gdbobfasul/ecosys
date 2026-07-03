// Version: 1.0001
// password-edit.js — добавяне/редакция на запис в таб „Пароли".
// Полета (всички до 256 знака): заглавие, логин, парола, допълнително описание.
// До логина и паролата има иконка „копиране" → стойността отива в клипборда.
import { h, mount, toast, copyText } from '../ui/dom.js';
import { t } from '../core/i18n.js';
import { addPassword, updatePassword, deletePassword } from '../core/storage.js';

export function renderPasswordEdit(root, nav, item) {
  const editing = !!(item && item.id);

  const title = h('input', { type: 'text', maxlength: '256', value: (item && item.title) || '' });
  const login = h('input', { type: 'text', maxlength: '256', value: (item && item.login) || '' });
  const password = h('input', { type: 'password', maxlength: '256', value: (item && item.password) || '' });
  const note = h('textarea', { maxlength: '256' });
  note.value = (item && item.note) || '';
  const err = h('div', { class: 'err' });

  // Поле с бутон за копиране.
  function copyField(input) {
    return h('div', { class: 'copyfield' },
      input,
      h('button', { class: 'copy-btn', title: t('copy'),
        onclick: () => { copyText(input.value); toast(t('copied')); } }, '⧉')
    );
  }

  // Показване/скриване на паролата.
  const toggle = h('button', { class: 'copy-btn', title: '👁',
    onclick: () => { password.type = password.type === 'password' ? 'text' : 'password'; } }, '👁');
  const pwdRow = h('div', { class: 'copyfield' }, password, toggle,
    h('button', { class: 'copy-btn', title: t('copy'),
      onclick: () => { copyText(password.value); toast(t('copied')); } }, '⧉'));

  const save = async () => {
    if (!title.value.trim()) { err.textContent = t('title_required'); return; }
    const data = { title: title.value.trim(), login: login.value, password: password.value, note: note.value };
    if (editing) await updatePassword(item.id, data); else await addPassword(data);
    nav.go('list');
  };
  const remove = async () => { if (!confirm(t('delete_confirm'))) return; await deletePassword(item.id); nav.go('list'); };

  const topbar = h('div', { class: 'topbar' },
    h('button', { class: 'icon-btn', onclick: () => nav.go('list') }, '←'),
    h('h1', { text: editing ? t('edit_title') : t('pwd_add_title') })
  );

  const content = [
    h('label', { text: t('title') }), title,
    h('label', { text: t('login') }), copyField(login),
    h('label', { text: t('password') }), pwdRow,
    h('label', { text: t('note') }), note,
    err,
    h('button', { class: 'btn accent', onclick: save, text: t('save') })
  ];
  if (editing) content.push(h('button', { class: 'btn danger', onclick: remove, text: t('delete') }));

  mount(root, topbar, h('div', { class: 'content' }, ...content));
}
