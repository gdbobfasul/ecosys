// lock.js — екран за заключване. Ботът пита „Как се казвам?“ и пуска само собственика.
import { el, clear, toast } from '../ui/dom.js';
import { faceEl } from '../ui/face.js';
import { tryUnlock, cooldownRemainingMs } from '../core/identity.js';
import { setSessionName } from '../core/responder.js';
import { resetAll } from '../core/storage.js';
import { armAutoListen } from '../core/conversation.js';

export function renderLock(root, { rerender }) {
  clear(root);
  let busy = false;

  const input = el('input', {
    type: 'text', placeholder: 'въведи моята кодова дума', maxlength: '24',
    autocomplete: 'off', autocapitalize: 'none'
  });
  const status = el('p', { class: 'center muted' }, '');

  function refreshCooldown() {
    const ms = cooldownRemainingMs();
    if (ms > 0) {
      const s = Math.ceil(ms / 1000);
      status.className = 'center warn-text';
      status.textContent = `Изчакай ${s} сек. преди нов опит.`;
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
    if (!v) { input.focus(); toast('Първо въведи кодовата дума.'); return; }
    busy = true; btn.disabled = true; listenBtn.disabled = true;
    const res = await tryUnlock(v);
    busy = false; btn.disabled = false; listenBtn.disabled = false;
    if (res.ok) {
      setSessionName(v);
      // Бутон „Започни да ме слушаш“ → веднага пуска слушането/разговора в чата.
      if (opts.thenListen) { armAutoListen(); toast('Свързан! Слушам те… 🎙️'); }
      else toast('Добре дошъл отново 👋');
      rerender();
      return;
    }
    input.value = '';
    if (res.reason === 'cooldown') {
      refreshCooldown();
      toast('Твърде много опити. Малка пауза.');
    } else {
      status.className = 'center err-text';
      status.textContent = res.attemptsLeft > 0
        ? `Не, не съм аз. Опитай пак (остават ${res.attemptsLeft} опита).`
        : 'Не, не съм аз.';
    }
  }

  const btn = el('button', { class: 'block', onclick: () => attempt() }, 'Това ли е кодовата дума?');
  // Бутон за свързване с глас — не само с Enter. Проверява думата и веднага почва да слуша.
  const listenBtn = el('button', {
    class: 'secondary block', style: 'margin-top:8px',
    onclick: () => attempt({ thenListen: true })
  }, '🎙️ Започни да ме слушаш');

  root.appendChild(faceEl({ thinking: true }));
  root.appendChild(el('h1', { class: 'center' }, 'Как се казвам?'));
  root.appendChild(el('p', { class: 'center muted' },
    'Само човекът, който ми избра кодовата дума, може да разговаря с мен. ' +
    'Няма подсказка — думата е тайната.'));

  root.appendChild(el('div', { class: 'card' }, [
    input, btn, listenBtn, status,
    el('p', { class: 'muted', style: 'font-size:12px;margin-top:8px' },
      'Натисни „Започни да ме слушаш“, за да се свържеш с мен с глас веднага (не само с Enter).')
  ]));

  // Авариен изход: „Започни отначало“ БЕЗ дума (за забравена дума). Силно потвърждение.
  function factoryReset() {
    const sure = confirm(
      'Започни отначало?\n\nТова трие НЕОБРАТИМО кодовата дума, цялата памет и разговорите. ' +
      'Имаш ли бекъп файл на знанието? След това ще поискам нова кодова дума.'
    );
    if (!sure) return;
    const sure2 = confirm('Сигурен ли си? Това е окончателно и не може да се върне.');
    if (!sure2) return;
    resetAll();
    setSessionName(null);
    toast('Изтрито. Започваме отначало.');
    rerender();
  }
  root.appendChild(el('div', { class: 'card' }, [
    el('p', { class: 'muted', style: 'font-size:13px' },
      'Забрави ли кодовата дума? Няма подсказка. Единственият изход е да започнеш отначало ' +
      '(трие всичко). Ако имаш бекъп файл, после ще можеш да го внесеш.'),
    el('button', { class: 'danger block', onclick: factoryReset }, 'Започни отначало (трие всичко)')
  ]));

  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') attempt(); });
  setTimeout(() => input.focus(), 50);
  refreshCooldown();
}
