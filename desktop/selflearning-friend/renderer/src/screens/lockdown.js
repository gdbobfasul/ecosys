// lockdown.js — екран при засечена СМЯНА НА УСТРОЙСТВО (анти-кражба).
//
// Показва се, когато device.checkDeviceIntegrity() усети, че данните са пренесени на друг
// телефон. Ботът отказва чат/разкриване на наученото и иска ИМЕТО за повторна авторизация.
// Честно: ако някой знае името, ще успее — но смяната остава отбелязана видимо.
import { el, clear, toast } from '../ui/dom.js';
import { faceEl } from '../ui/face.js';
import { tryUnlock } from '../core/identity.js';
import { setSessionName } from '../core/responder.js';
import { resetAll } from '../core/storage.js';
import { t } from '../core/i18n.js';

export function renderLockdown(root, { rerender }) {
  clear(root);
  let busy = false;

  const input = el('input', {
    type: 'text', placeholder: t('lockdown_input_ph'),
    maxlength: '24', autocomplete: 'off', autocapitalize: 'none'
  });
  const status = el('p', { class: 'center err-text' }, '');

  async function attempt() {
    if (busy) return;
    const v = input.value.trim();
    if (!v) { input.focus(); return; }
    busy = true; btn.disabled = true;
    const res = await tryUnlock(v);
    busy = false; btn.disabled = false;
    if (res.ok) {
      setSessionName(v);
      toast(res.deviceChanged ? t('lockdown_confirmed_changed') : t('lockdown_welcome_back'));
      rerender();
      return;
    }
    input.value = '';
    status.textContent = t('lockdown_not_me');
  }

  const btn = el('button', { class: 'block', onclick: attempt }, t('lockdown_confirm_btn'));

  root.appendChild(faceEl({ thinking: true }));
  root.appendChild(el('h1', { class: 'center err-text' }, t('lockdown_title')));
  root.appendChild(el('p', { class: 'center muted' }, t('lockdown_desc')));

  root.appendChild(el('div', { class: 'card' }, [
    input, btn, status
  ]));

  // Авариен изход и тук: „Започни отначало“ без дума (силно потвърждение).
  function factoryReset() {
    const sure = confirm(t('start_over_q'));
    if (!sure) return;
    if (!confirm(t('start_over_q2'))) return;
    resetAll();
    setSessionName(null);
    toast(t('wiped_restart'));
    rerender();
  }
  root.appendChild(el('div', { class: 'card' }, [
    el('p', { class: 'muted', style: 'font-size:13px' }, t('lock_forgot_note')),
    el('button', { class: 'danger block', onclick: factoryReset }, t('start_over_btn'))
  ]));

  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') attempt(); });
  setTimeout(() => input.focus(), 50);
}
