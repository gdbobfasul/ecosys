// demo-chat.js — вграден чат за тест. Пишеш въпрос → роботът отговаря по правилата.
import { el, esc } from '../ui/dom.js';
import { getState } from '../core/storage.js';
import { respond } from '../core/respond.js';
import { getAdapter } from '../core/channel-adapter.js';
import { notify } from '../core/notifier.js';
import { toast } from '../ui/dom.js';

export function renderDemoChat(root, { navigate }) {
  const s = getState();

  root.appendChild(el('header', { class: 'page-head' }, [
    el('h1', {}, 'Демо чат'),
    el('p', { class: 'lead' }, 'Напиши въпрос — роботът отговаря по правилата (канал: local).')
  ]));

  const thread = el('div', { class: 'chat-thread' });

  function bubble(text, who, meta) {
    return el('div', { class: 'bubble ' + who }, [
      el('div', { class: 'bubble-text', html: esc(text).replace(/\n/g, '<br>') }),
      meta ? el('div', { class: 'bubble-meta' }, meta) : null
    ]);
  }

  // Поздрав в началото.
  if (s.config.greeting) thread.appendChild(bubble(s.config.greeting, 'bot', 'поздрав'));

  function botAnswer(input) {
    const r = respond(input);
    const local = getAdapter('local');
    local.deliver({ text: r.reply }); // local адаптер: показваме в чата
    const metaMap = { away: 'извън работно време', answer: 'правило', fallback: 'резервен' };
    thread.appendChild(bubble(r.reply, 'bot', metaMap[r.kind]));
    thread.scrollTop = thread.scrollHeight;
    if (getState().permissions.notifications) {
      notify('Роботът отговори', r.reply, (m) => toast(m));
    }
  }

  function send(text) {
    const t = String(text || '').trim();
    if (!t) return;
    thread.appendChild(bubble(t, 'user'));
    thread.scrollTop = thread.scrollHeight;
    setTimeout(() => botAnswer(t), 120);
  }

  // Бързи бутони.
  const quick = el('div', { class: 'quick-row' },
    (s.config.quickReplies || []).map((q) =>
      el('button', { class: 'chip', onclick: () => send(q) }, q)
    )
  );

  const input = el('input', { class: 'input', type: 'text', placeholder: 'Напиши въпрос...' });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { send(input.value); input.value = ''; }
  });
  const sendBtn = el('button', { class: 'btn primary', onclick: () => { send(input.value); input.value = ''; } }, 'Изпрати');

  root.appendChild(el('section', { class: 'card chat-card' }, [
    thread,
    quick,
    el('div', { class: 'row gap composer' }, [input, sendBtn])
  ]));

  root.appendChild(el('button', { class: 'btn ghost', onclick: () => navigate('dashboard') }, '← Към таблото'));
}
