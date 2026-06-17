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

export function renderLockdown(root, { rerender }) {
  clear(root);
  let busy = false;

  const input = el('input', {
    type: 'text', placeholder: 'въведи кодовата дума, за да потвърдиш собственост',
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
      toast(res.deviceChanged ? 'Потвърдено. Отбелязах смяната на устройство.' : 'Добре дошъл отново.');
      rerender();
      return;
    }
    input.value = '';
    status.textContent = 'Не, не съм аз. Само истинският собственик знае името ми.';
  }

  const btn = el('button', { class: 'block', onclick: attempt }, 'Потвърди собственост');

  root.appendChild(faceEl({ thinking: true }));
  root.appendChild(el('h1', { class: 'center err-text' }, '🔒 Засякох смяна на устройство'));
  root.appendChild(el('p', { class: 'center muted' },
    'Изглежда данните ми са пренесени на друг телефон. За твоята защита заключих ' +
    'наученото и отказвам разговор, докато не потвърдиш, че си истинският собственик — ' +
    'като въведеш кодовата дума. Смяната ще остане видимо отбелязана. Няма подсказка.'));

  root.appendChild(el('div', { class: 'card' }, [
    input, btn, status
  ]));

  // Авариен изход и тук: „Започни отначало“ без дума (силно потвърждение).
  function factoryReset() {
    const sure = confirm(
      'Започни отначало?\n\nТова трие НЕОБРАТИМО кодовата дума, цялата памет и разговорите. ' +
      'Имаш ли бекъп файл на знанието?'
    );
    if (!sure) return;
    if (!confirm('Сигурен ли си? Окончателно е.')) return;
    resetAll();
    setSessionName(null);
    toast('Изтрито. Започваме отначало.');
    rerender();
  }
  root.appendChild(el('div', { class: 'card' }, [
    el('p', { class: 'muted', style: 'font-size:13px' },
      'Забрави ли кодовата дума? Единственият изход е да започнеш отначало (трие всичко).'),
    el('button', { class: 'danger block', onclick: factoryReset }, 'Започни отначало (трие всичко)')
  ]));

  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') attempt(); });
  setTimeout(() => input.focus(), 50);
}
