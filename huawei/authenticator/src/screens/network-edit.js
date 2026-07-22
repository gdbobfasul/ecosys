// Version: 1.0001
// network-edit.js — добавяне/редакция на EVM мрежа (таб „Мрежи"). Полетата са като в MetaMask
// „Add network": Network Name, RPC URL, Chain ID, Currency Symbol, Block Explorer URL.
// Всичко в шифрования сейф — само на устройството.
import { h, mount, toast, copyText } from '../ui/dom.js';
import { t } from '../core/i18n.js';
import { addNetwork, updateNetwork, deleteNetwork } from '../core/storage.js';

export function renderNetworkEdit(root, nav, item) {
  const editing = !!(item && item.id);

  const name = h('input', { type: 'text', maxlength: '256', value: (item && item.name) || '', placeholder: 'BSC Mainnet' });
  const rpcUrl = h('input', { type: 'text', maxlength: '256', value: (item && item.rpcUrl) || '', placeholder: 'https://bsc-dataseed.binance.org/' });
  const chainId = h('input', { type: 'text', maxlength: '256', inputmode: 'numeric', value: (item && item.chainId) || '', placeholder: '56' });
  const currencySymbol = h('input', { type: 'text', maxlength: '256', value: (item && item.currencySymbol) || '', placeholder: 'BNB' });
  const blockExplorer = h('input', { type: 'text', maxlength: '256', value: (item && item.blockExplorer) || '', placeholder: 'https://bscscan.com' });
  const note = h('textarea', { maxlength: '2000' }); note.value = (item && item.note) || '';
  const err = h('div', { class: 'err' });

  function copyField(input) {
    return h('div', { class: 'copyfield' }, input,
      h('button', { class: 'copy-btn', title: t('copy'), onclick: () => { copyText(input.value); toast(t('copied')); } }, '⧉'));
  }

  const save = async () => {
    if (!name.value.trim()) { err.textContent = t('net_name_required'); return; }
    const data = {
      name: name.value.trim(), rpcUrl: rpcUrl.value.trim(), chainId: chainId.value.trim(),
      currencySymbol: currencySymbol.value.trim(), blockExplorer: blockExplorer.value.trim(), note: note.value
    };
    if (editing) await updateNetwork(item.id, data); else await addNetwork(data);
    nav.go('list');
  };
  const remove = async () => { if (!confirm(t('delete_confirm'))) return; await deleteNetwork(item.id); nav.go('list'); };

  const topbar = h('div', { class: 'topbar' },
    h('button', { class: 'icon-btn', onclick: () => nav.go('list') }, '←'),
    h('h1', { text: editing ? t('edit_title') : t('net_add_title') })
  );

  const content = [
    h('label', { text: t('net_name') }), name,
    h('label', { text: t('net_rpc') }), copyField(rpcUrl),
    h('label', { text: t('net_chainid') }), copyField(chainId),
    h('label', { text: t('net_symbol') }), currencySymbol,
    h('label', { text: t('net_explorer') }), copyField(blockExplorer),
    h('label', { text: t('note') }), note,
    err,
    h('button', { class: 'btn accent', onclick: save, text: t('save') })
  ];
  if (editing) content.push(h('button', { class: 'btn danger', onclick: remove, text: t('delete') }));

  mount(root, topbar, h('div', { class: 'content' }, ...content));
}
