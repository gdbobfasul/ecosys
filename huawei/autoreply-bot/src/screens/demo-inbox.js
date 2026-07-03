// Version: 1.0001
// demo-inbox.js — симулиран чат (sandbox), в който тестваш робота.
// Потребителят (или „тестов подател") праща съобщение; роботът отговаря по правилата.
//
// Това е целият смисъл на sandbox-а: Android забранява автоматизация на истински
// SMS/чужди приложения, затова симулираме входяща кутия ВЪТРЕ в приложението.
import { el, toast, esc } from '../ui/dom.js';
import { getState, setState, uid } from '../core/storage.js';
import { decideReply } from '../core/rule-engine.js';
import { notifyAutoReply } from '../core/notifier.js';
import { t } from '../core/i18n.js';

export function DemoInboxScreen({ render }) {
  const s = getState();
  const root = el('div', {});

  root.appendChild(el('h1', {}, t('demo_title')));
  root.appendChild(el('p', { class: 'muted' }, t('demo_intro')));

  if (!s.robotOn) {
    root.appendChild(el('div', { class: 'card', style: 'border-color:var(--warn)' },
      [el('p', {}, t('demo_robot_off'))]));
  }

  // Поле за подател + текст
  const senderInput = el('input', { type: 'text', value: t('demo_sender_default'), placeholder: t('demo_sender_ph') });
  const textInput = el('input', { type: 'text', placeholder: t('demo_message_ph') });

  const send = async () => {
    const sender = senderInput.value.trim() || t('demo_unknown');
    const text = textInput.value.trim();
    if (!text) return;
    textInput.value = '';
    await handleIncoming({ sender, text }, render);
    render();
  };

  textInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });

  // Чат изглед
  const chat = el('div', { class: 'card', style: 'max-height:50vh; overflow:auto; display:flex; flex-direction:column' });
  if (s.inbox.length === 0) {
    chat.appendChild(el('div', { class: 'empty' }, t('demo_empty')));
  }
  s.inbox.forEach((m) => {
    chat.appendChild(el('div', { class: 'msg ' + (m.dir === 'out' ? 'out' : 'in') }, [
      el('span', { class: 'who' }, m.dir === 'out' ? t('demo_robot') : esc(m.sender)),
      el('span', { html: esc(m.text) })
    ]));
  });
  root.appendChild(chat);

  root.appendChild(el('div', { class: 'card' }, [
    el('label', {}, t('demo_sender')),
    senderInput,
    el('label', {}, t('demo_message')),
    el('div', { class: 'row' }, [
      el('div', { class: 'grow' }, [textInput]),
      el('button', { class: 'btn primary', onClick: send }, t('demo_send'))
    ]),
    el('div', { class: 'row wrap', style: 'margin-top:8px' }, [
      quick(t('demo_quick_hi'), senderInput, textInput, send),
      quick(t('demo_quick_price'), senderInput, textInput, send),
      quick(t('demo_quick_help'), senderInput, textInput, send)
    ]),
    el('button', { class: 'btn ghost sm full', style: 'margin-top:10px',
      onClick: () => { setState({ inbox: [] }); render(); } }, t('demo_clear'))
  ]));

  return root;
}

function quick(text, senderInput, textInput, send) {
  return el('button', { class: 'btn sm ghost', onClick: () => { textInput.value = text; send(); } }, `„${text}"`);
}

// Обработва входящо съобщение: записва го, пита rule-engine, и (ако има) отговаря.
export async function handleIncoming({ sender, text }, render) {
  const st = getState();
  const inbox = [...st.inbox, { id: uid(), dir: 'in', sender, text, at: Date.now() }];
  setState({ inbox });

  if (!st.robotOn) return; // роботът е изключен → само записваме входящото

  const decision = decideReply({
    message: { sender, text },
    rules: st.rules,
    lists: st.lists,
    schedule: st.schedule,
    when: new Date()
  });

  if (!decision) return; // нищо не съвпадна / филтриран подател

  const cur = getState();
  setState({
    inbox: [...cur.inbox, { id: uid(), dir: 'out', sender, text: decision.reply, at: Date.now() }],
    log: [...cur.log, {
      at: Date.now(), channel: 'local', sender, incoming: text, reply: decision.reply,
      ruleId: decision.ruleId, mode: decision.mode
    }]
  });

  await notifyAutoReply({ sender, reply: decision.reply }, (msg) => toast(msg));
}
