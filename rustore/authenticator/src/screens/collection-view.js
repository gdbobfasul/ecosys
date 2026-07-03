// Version: 1.0001
// collection-view.js — преглед на запазен QR от колекцията: картинката (за повторно
// сканиране), заглавието (може да се смени) и декодираният текст (с копиране). + триене.
import { h, mount, toast, copyText } from '../ui/dom.js';
import { t } from '../core/i18n.js';
import { updateCollectionItem, deleteCollectionItem } from '../core/storage.js';

export function renderCollectionView(root, nav, item) {
  if (!item) return nav.go('list');

  const titleInput = h('input', { type: 'text', maxlength: '256', value: item.title || '' });

  const save = async () => { await updateCollectionItem(item.id, { title: titleInput.value.trim() }); nav.go('list'); };
  const remove = async () => { if (!confirm(t('delete_confirm'))) return; await deleteCollectionItem(item.id); nav.go('list'); };

  const topbar = h('div', { class: 'topbar' },
    h('button', { class: 'icon-btn', onclick: () => nav.go('list') }, '←'),
    h('h1', { text: t('tab_collection') })
  );

  const content = [
    h('label', { text: t('title') }), titleInput
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
