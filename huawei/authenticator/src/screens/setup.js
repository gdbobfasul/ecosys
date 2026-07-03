// Version: 1.0001
// setup.js — създаване на master парола при първо стартиране (празен сейф).
import { h, mount } from '../ui/dom.js';
import { t } from '../core/i18n.js';
import { createVault } from '../core/storage.js';

export function renderSetup(root, nav) {
  const pass = h('input', { type: 'password', autocomplete: 'new-password' });
  const conf = h('input', { type: 'password', autocomplete: 'new-password' });
  const err = h('div', { class: 'err' });

  const submit = async () => {
    const p = pass.value, c = conf.value;
    if (!p || p.length < 6) { err.textContent = t('password_min'); return; }
    if (p !== c) { err.textContent = t('passwords_mismatch'); return; }
    await createVault(p);
    nav.go('list');
  };
  conf.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });

  mount(root, h('div', { class: 'content' },
    h('div', { style: 'text-align:center;font-size:2.8em' }, '🛡️'),
    h('h1', { style: 'text-align:center', text: t('setup_title') }),
    h('p', { class: 'muted', style: 'text-align:center', text: t('setup_desc') }),
    h('label', { text: t('password') }), pass,
    h('label', { text: t('confirm_password') }), conf,
    err,
    h('button', { class: 'btn accent', onclick: submit, text: t('create_vault') })
  ));
}
