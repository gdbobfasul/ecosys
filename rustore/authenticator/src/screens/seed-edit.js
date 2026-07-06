// Version: 1.0013
// seed-edit.js — добавяне/редакция на КРИПТО акаунт (таб „Портфейли").
// Полета: портфейл (или свободно име при „Други"), етикет, акаунт/имейл, seed фраза,
// скрита дума (passphrase/25-та), парола, PIN, частен ключ, публичен адрес, деривационен път,
// бележка. Тайните се пазят СКРИТИ и се показват с „око". Всичко в шифрования сейф на
// устройството — нищо не се качва навън (виж storage.persist).
import { h, mount, toast, copyText } from '../ui/dom.js';
import { t } from '../core/i18n.js';
import { addSeed, updateSeed, deleteSeed, seedCountFor } from '../core/storage.js';
import { WALLETS, walletByKey, maxForWallet } from '../core/wallets.js';

export function renderSeedEdit(root, nav, item) {
  const editing = !!(item && item.id);
  const walletKey = (item && item.wallet) || 'other';
  const w = walletByKey(walletKey);

  const err = h('div', { class: 'err' });

  // За „Други портфейли" даваме свободно име на портфейла.
  const walletName = h('input', { type: 'text', maxlength: '256', value: (item && item.walletName) || '', placeholder: t('crypto_wallet_name_ph') });

  // Обикновено текстово поле.
  const inp = (val, ph) => h('input', { type: 'text', maxlength: '256', value: val || '', placeholder: ph || '' });
  // Многоредово (seed фраза / бележка).
  const area = (val) => { const a = h('textarea', { maxlength: '2000' }); a.value = val || ''; return a; };

  const label = inp((item && item.label), t('crypto_label_ph'));
  const account = inp((item && item.account), t('crypto_account_ph'));
  const seedPhrase = area(item && item.seedPhrase);
  const passphrase = h('input', { type: 'password', maxlength: '256', value: (item && item.passphrase) || '' });
  const password = h('input', { type: 'password', maxlength: '256', value: (item && item.password) || '' });
  const pin = h('input', { type: 'password', maxlength: '256', inputmode: 'numeric', value: (item && item.pin) || '' });
  const privateKey = area(item && item.privateKey);
  const publicAddress = inp((item && item.publicAddress), '0x…');
  const derivationPath = inp((item && item.derivationPath), "m/44'/60'/0'/0");
  const note = area(item && item.note);

  // Поле „копирай" (за адрес/логин).
  function copyField(input) {
    return h('div', { class: 'copyfield' }, input,
      h('button', { class: 'copy-btn', title: t('copy'), onclick: () => { copyText(input.value); toast(t('copied')); } }, '⧉'));
  }
  // Поле с „око" (скрий/покажи) + копирай — за тайните.
  function secretField(input) {
    input.setAttribute('data-mask', '1');   // и универсалното око от lock.js го хваща
    const eye = h('button', { class: 'copy-btn', title: '👁',
      onclick: () => { input.type = input.type === 'password' ? 'text' : 'password'; } }, '👁');
    return h('div', { class: 'copyfield' }, input, eye,
      h('button', { class: 'copy-btn', title: t('copy'), onclick: () => { copyText(input.value); toast(t('copied')); } }, '⧉'));
  }
  // Многоредова тайна (seed/частен ключ): маскираме с CSS-филтър при „скрито".
  function secretArea(ta) {
    let hidden = true;
    ta.style.cssText = (ta.style.cssText || '') + ';filter:blur(5px)';
    const eye = h('button', { class: 'copy-btn', title: '👁',
      onclick: () => { hidden = !hidden; ta.style.filter = hidden ? 'blur(5px)' : 'none'; } }, '👁');
    return h('div', {},
      h('div', { style: 'display:flex;gap:6px' }, eye,
        h('button', { class: 'copy-btn', title: t('copy'), onclick: () => { copyText(ta.value); toast(t('copied')); } }, '⧉')),
      ta);
  }

  const save = async () => {
    if (!label.value.trim()) { err.textContent = t('crypto_label_required'); return; }
    if (!editing && seedCountFor(walletKey) >= maxForWallet(walletKey)) { err.textContent = t('crypto_limit_reached'); return; }
    const data = {
      wallet: walletKey, walletName: walletName.value.trim(),
      label: label.value.trim(), account: account.value.trim(),
      seedPhrase: seedPhrase.value, passphrase: passphrase.value, password: password.value,
      pin: pin.value, privateKey: privateKey.value, publicAddress: publicAddress.value.trim(),
      derivationPath: derivationPath.value.trim(), note: note.value
    };
    if (editing) await updateSeed(item.id, data); else await addSeed(data);
    nav.go('list');
  };
  const remove = async () => { if (!confirm(t('delete_confirm'))) return; await deleteSeed(item.id); nav.go('list'); };

  const wname = w.isOther ? t('crypto_other') : w.name;
  const topbar = h('div', { class: 'topbar' },
    h('button', { class: 'icon-btn', onclick: () => nav.go('list') }, '←'),
    h('h1', { text: (w.icon || '👛') + ' ' + wname })
  );

  const content = [
    h('p', { class: 'muted', style: 'font-size:.82em', text: t('crypto_local_note') })
  ];
  if (w.isOther) { content.push(h('label', { text: t('crypto_wallet_name') }), walletName); }
  content.push(
    h('label', { text: t('crypto_label') }), label,
    h('label', { text: t('crypto_account') }), copyField(account),
    h('label', { text: t('crypto_seed') }), secretArea(seedPhrase),
    h('label', { text: t('crypto_passphrase') }), secretField(passphrase),
    h('label', { text: t('crypto_wallet_password') }), secretField(password),
    h('label', { text: t('crypto_pin') }), secretField(pin),
    h('label', { text: t('crypto_private_key') }), secretArea(privateKey),
    h('label', { text: t('crypto_public_address') }), copyField(publicAddress),
    h('label', { text: t('crypto_derivation') }), copyField(derivationPath),
    h('label', { text: t('note') }), note,
    err,
    h('button', { class: 'btn accent', onclick: save, text: t('save') })
  );
  if (editing) content.push(h('button', { class: 'btn danger', onclick: remove, text: t('delete') }));

  mount(root, topbar, h('div', { class: 'content' }, ...content));
}
