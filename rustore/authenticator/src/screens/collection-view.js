// Version: 1.0001
// collection-view.js — преглед на запазен QR от колекцията: картинката (за повторно
// сканиране), заглавието (може да се смени) и декодираният текст (с копиране). + триене.
import { h, mount, toast, copyText } from '../ui/dom.js';
import { t } from '../core/i18n.js';
import { updateCollectionItem, deleteCollectionItem } from '../core/storage.js';

export function renderCollectionView(root, nav, item) {
  if (!item) return nav.go('list');

  const titleInput = h('input', { type: 'text', maxlength: '256', value: item.title || '' });
  const appNameInput = h('input', { type: 'text', maxlength: '256', value: item.appName || '' });
  const loginInput = h('input', { type: 'text', maxlength: '256', value: item.login || '' });
  const passwordInput = h('input', { type: 'password', maxlength: '256', value: item.password || '' });
  const noteInput = h('textarea', { maxlength: '256', rows: '2' }, item.note || '');

  const save = async () => { await updateCollectionItem(item.id, {
    title: titleInput.value.trim(), appName: appNameInput.value.trim(),
    login: loginInput.value.trim(), password: passwordInput.value, note: noteInput.value.trim() }); nav.go('list'); };
  const remove = async () => { if (!confirm(t('delete_confirm'))) return; await deleteCollectionItem(item.id); nav.go('list'); };

  const topbar = h('div', { class: 'topbar' },
    h('button', { class: 'icon-btn', onclick: () => nav.go('list') }, '←'),
    h('h1', { text: t('tab_collection') })
  );

  // поле с бутон за копиране (и „око" за паролата)
  function copyRow(input, secret) {
    const kids = [input];
    if (secret) kids.push(h('button', { class: 'copy-btn', title: '👁', onclick: () => { input.type = input.type === 'password' ? 'text' : 'password'; } }, '👁'));
    kids.push(h('button', { class: 'copy-btn', title: t('copy'), onclick: () => { copyText(input.value); toast(t('copied')); } }, '⧉'));
    return h('div', { class: 'copyfield' }, ...kids);
  }

  const content = [
    h('label', { text: t('title') }), titleInput,
    h('label', { text: t('col_appname') || 'Приложение' }), appNameInput,
    h('label', { text: t('col_login') || 'Имейл / потребител' }), copyRow(loginInput, false),
    h('label', { text: t('col_password') || 'Парола' }), copyRow(passwordInput, true),
    h('label', { text: t('col_note') || 'Бележка' }), noteInput
  ];
  if (item.image) content.push(h('img', { src: item.image, class: 'qrimg' }));
  if (item.content) {
    content.push(h('label', { text: 'QR' }));
    content.push(h('div', { class: 'copyfield' },
      h('input', { type: 'text', value: item.content, readonly: 'readonly' }),
      h('button', { class: 'copy-btn', title: t('copy'), onclick: () => { copyText(item.content); toast(t('copied')); } }, '⧉')
    ));
  }
  content.push(h('button', { class: 'btn accent', onclick: save, text: t('save') }));
  content.push(h('button', { class: 'btn danger', onclick: remove, text: t('delete') }));

  mount(root, topbar, h('div', { class: 'content' }, ...content));
}
