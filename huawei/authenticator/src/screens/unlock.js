// unlock.js — отключване на сейфа с парола (или биометрия, ако е включена).
import { h, mount } from '../ui/dom.js';
import { t } from '../core/i18n.js';
import { unlockVault, loadSettings } from '../core/storage.js';
import { biometricAvailable, biometricVerify, biometricGetPassword } from '../core/biometric.js';

export function renderUnlock(root, nav) {
  const pass = h('input', { type: 'password', autocomplete: 'current-password' });
  const err = h('div', { class: 'err' });

  const submit = async () => {
    try {
      await unlockVault(pass.value);
      nav.go('list');
    } catch (e) {
      err.textContent = t('wrong_password');
      pass.value = '';
    }
  };
  pass.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });

  const bioBtn = h('button', { class: 'btn ghost', style: 'display:none', onclick: doBiometric },
    '👆 ' + t('use_biometric'));

  async function doBiometric() {
    const ok = await biometricVerify(t('unlock_title'));
    if (!ok) return;
    const pw = await biometricGetPassword();
    if (!pw) return;
    try { await unlockVault(pw); nav.go('list'); }
    catch (e) { err.textContent = t('wrong_password'); }
  }

  mount(root, h('div', { class: 'content' },
    h('div', { style: 'text-align:center;font-size:2.8em' }, '🔒'),
    h('h1', { style: 'text-align:center', text: t('unlock_title') }),
    h('label', { text: t('password') }), pass,
    err,
    h('button', { class: 'btn', onclick: submit, text: t('unlock') }),
    bioBtn
  ));

  // Покажи биометрията само ако е включена И налична на устройството; пробвай веднага.
  if (loadSettings().biometric) {
    biometricAvailable().then((av) => { if (av) { bioBtn.style.display = ''; doBiometric(); } });
  }
  setTimeout(() => { try { pass.focus(); } catch (e) {} }, 60);
}
