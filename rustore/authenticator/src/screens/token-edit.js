// Version: 1.0001
// token-edit.js — добавяне/редакция на custom токен (таб „Токени"). Полетата са като в
// MetaMask „Import tokens": Token Contract Address, Token Symbol, Token Decimals. Плюс по избор
// име и към коя мрежа е (връзка с таб „Мрежи"). Всичко в шифрования сейф — само на устройството.
import { h, mount, toast, copyText } from '../ui/dom.js';
import { t } from '../core/i18n.js';
import { addToken, updateToken, deleteToken, session } from '../core/storage.js';

export function renderTokenEdit(root, nav, item) {
  const editing = !!(item && item.id);

  const name = h('input', { type: 'text', maxlength: '256', value: (item && item.name) || '', placeholder: 'Tether USD' });
  const contractAddress = h('input', { type: 'text', maxlength: '256', value: (item && item.contractAddress) || '', placeholder: '0x…' });
  const symbol = h('input', { type: 'text', maxlength: '256', value: (item && item.symbol) || '', placeholder: 'USDT' });
  const decimals = h('input', { type: 'text', maxlength: '256', inputmode: 'numeric', value: (item && item.decimals) || '', placeholder: '18' });
  const note = h('textarea', { maxlength: '2000' }); note.value = (item && item.note) || '';
  const err = h('div', { class: 'err' });

  // Мрежа: падащо меню от запазените мрежи (таб „Мрежи") + свободен избор „—".
  const network = h('select', {});
  network.appendChild(h('option', { value: '', text: '—' }));
  (session.networks || []).forEach((n) => {
    const opt = h('option', { value: n.name || n.id, text: (n.name || n.id) + (n.chainId ? ' (' + n.chainId + ')' : '') });
    if (item && item.network && item.network === (n.name || n.id)) opt.selected = true;
    network.appendChild(opt);
  });

  function copyField(input) {
    return h('div', { class: 'copyfield' }, input,
      h('button', { class: 'copy-btn', title: t('copy'), onclick: () => { copyText(input.value); toast(t('copied')); } }, '⧉'));
  }

  const save = async () => {
    if (!contractAddress.value.trim()) { err.textContent = t('tok_addr_required'); return; }
    const data = {
      name: name.value.trim(), contractAddress: contractAddress.value.trim(), symbol: symbol.value.trim(),
      decimals: decimals.value.trim(), network: network.value, note: note.value
    };
    if (editing) await updateToken(item.id, data); else await addToken(data);
    nav.go('list');
  };
  const remove = async () => { if (!confirm(t('delete_confirm'))) return; await deleteToken(item.id); nav.go('list'); };

  const topbar = h('div', { class: 'topbar' },
    h('button', { class: 'icon-btn', onclick: () => nav.go('list') }, '←'),
    h('h1', { text: editing ? t('edit_title') : t('tok_add_title') })
  );

  const content = [
    h('label', { text: t('tok_name') }), name,
    h('label', { text: t('tok_address') }), copyField(contractAddress),
    h('label', { text: t('tok_symbol') }), symbol,
    h('label', { text: t('tok_decimals') }), decimals,
    h('label', { text: t('tok_network') }), network,
    h('label', { text: t('note') }), note,
    err,
    h('button', { class: 'btn accent', onclick: save, text: t('save') })
  ];
  if (editing) content.push(h('button', { class: 'btn danger', onclick: remove, text: t('delete') }));

  mount(root, topbar, h('div', { class: 'content' }, ...content));
}
