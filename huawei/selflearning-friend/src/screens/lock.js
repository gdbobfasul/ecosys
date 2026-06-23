// lock.js — екран за заключване. Ботът пита „Как се казвам?“ и пуска само собственика.
import { el, clear, toast } from '../ui/dom.js';
import { faceEl } from '../ui/face.js';
import { tryUnlock, cooldownRemainingMs } from '../core/identity.js';
import { setSessionName } from '../core/responder.js';
import { resetAll } from '../core/storage.js';
import { armAutoListen } from '../core/conversation.js';
import { t, tf } from '../core/i18n.js';

export function renderLock(root, { rerender }) {
  clear(root);
  let busy = false;

  const input = el('input', {
    type: 'text', placeholder: t('lock_input_ph'), maxlength: '24',
    autocomplete: 'off', autocapitalize: 'none'
  });
  const status = el('p', { class: 'center muted' }, '');

  function refreshCooldown() {
    const ms = cooldownRemainingMs();
    if (ms > 0) {
      const s = Math.ceil(ms / 1000);
      status.className = 'center warn-text';
      status.textContent = tf('lock_cooldown', s);
      input.disabled = true;
      btn.disabled = true;
      listenBtn.disabled = true;
      setTimeout(refreshCooldown, 1000);
    } else {
      input.disabled = false;
      btn.disabled = false;
      listenBtn.disabled = false;
      if (status.className.includes('warn')) { status.textContent = ''; status.className = 'center muted'; }
    }
  }

  async function attempt(opts = {}) {
    if (busy) return;
    const v = input.value.trim();
    if (!v) { input.focus(); toast(t('lock_enter_first')); return; }
    busy = true; btn.disabled = true; listenBtn.disabled = true;
    const res = await tryUnlock(v);
    busy = false; btn.disabled = false; listenBtn.disabled = false;
    if (res.ok) {
      setSessionName(v);
      // Бутон „Започни да ме слушаш“ → веднага пуска слушането/разговора в чата.
      if (opts.thenListen) { armAutoListen(); toast(t('lock_connected_listen')); }
      else toast(t('lock_welcome_back'));
      rerender();
      return;
    }
    input.value = '';
    if (res.reason === 'cooldown') {
      refreshCooldown();
      toast(t('lock_too_many'));
    } else {
      status.className = 'center err-text';
      status.textContent = res.attemptsLeft > 0
        ? tf('lock_not_me_left', res.attemptsLeft)
        : t('lock_not_me');
    }
  }

  const btn = el('button', { class: 'block', onclick: () => attempt() }, t('lock_btn'));
  // Бутон за свързване с глас — не само с Enter. Проверява думата и веднага почва да слуша.
  const listenBtn = el('button', {
    class: 'block',
    // Ясно изглеждащ бутон (различен цвят от главния) — не „secondary“, който се сливаше с картата.
    style: 'margin-top:10px; background: var(--accent-2, #2de0c6); color:#04130f; font-weight:700; border:none;',
    onclick: () => attempt({ thenListen: true })
  }, t('lock_listen_btn'));

  root.appendChild(faceEl({ thinking: true }));
  root.appendChild(el('h1', { class: 'center' }, t('lock_q')));
  root.appendChild(el('p', { class: 'center muted' }, t('lock_intro')));

  root.appendChild(el('div', { class: 'card' }, [
    input, btn, listenBtn, status,
    el('p', { class: 'muted', style: 'font-size:12px;margin-top:8px' }, t('lock_listen_note'))
  ]));

  // Авариен изход: „Започни отначало“ БЕЗ дума (за забравена дума). Силно потвърждение.
  function factoryReset() {
    const sure = confirm(t('start_over_q'));
    if (!sure) return;
    const sure2 = confirm(t('start_over_q2'));
    if (!sure2) return;
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
  refreshCooldown();
}
